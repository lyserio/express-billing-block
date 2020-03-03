const moment 	= require("moment")
const Stripe 	= require("stripe")
const express 	= require("express")
const router 	= express.Router()
const ejs 		= require("ejs")
let stripe = null
let options = {}


const {
	beautifyAmount,
	asyncHandler, 
	deepMerge,
	updateSubscriptionData
} = require("./utils")

const countriesList = require("./countries.json")

const defaultElementsOptions = { style: {
	base: {
		fontSmoothing: 'antialiased',
		fontSize: '16px',
		lineHeight: '1.7'
	},
	invalid: {
		color: '#fa755a',
		iconColor: '#fa755a'
	}
}}

router.post('/webhook', asyncHandler(async (req, res, next) => {

	if (!stripe) stripe = Stripe(options.secretKey)

	// Make sure event is signed
	// let sig = req.header("stripe-signature")

	// Will fail if event doesn't exist
	let event = await stripe.events.retrieve(req.body.id)

	let type = event.type
	console.log('Stripe said: '+type)

	if (type === 'customer.subscription.trial_will_end') {
		
		// Send email for ending trial
		// sendMail(`Your trial is ending - ${options.siteName}`, `Hello,\n\nThis is an email to let you know that your ${options.siteName} trial will be ending soon.\n\nIf you do not wish to continue, you can cancel your subscription now in your dashboard. Else, you don't have anything to do :)\n\nCheers`, dbUser.email)

	} else if (type === 'customer.source.expiring') {

		// Send email for credit card expiring
		// Already handled by Stripe

	} else if (type === 'invoice.payment_failed') {
		
		// Send email for failed invoice payment
		// Already handled by Stripe
	
	} else if (type === 'customer.subscription.created') {

		// what about downgrade
		const subscription		= event.data.object
		const customerId 		= subscription.customer

		const planId 			= subscription.metadata.planId
		const plan 				= options.plans.find(p => p.id === planId)
			
		let user = await options.mongoUser.findOne({ 'stripe.customerId': customerId }).exec()

		if (options.onUpgrade && typeof options.onUpgrade === 'function') options.onUpgrade(user, planId)

		sendMail("Thank you for upgrading", 
`Hello,\n
This is a confirmation email that you have successfully upgraded your account to the ${plan.name} plan.\n
Glad to have you on board!`, user.email)

	
	} else if (type === 'customer.subscription.updated') {
		
		// Triggers when the billing period ends and a new billing period begins, when switching from one plan to another, or switching status from trial to active

		// Either ones of these status means the user has the right to access the product
		const acceptableStatus = ['trialing', 'active', 'incomplete', 'past_due']
		
		const subscription 	= event.data.object
		const currentStatus = subscription.status
		const planId 		= subscription.metadata.planId
		const customer 		= subscription.customer
		
		let user = await options.mongoUser.findOne({'stripe.customerId': customer}).exec()

		if (user.stripe.subscriptionStatus) user.stripe.subscriptionStatus = currentStatus

		if (user.plan) {
			if (acceptableStatus.includes(currentStatus)) {
				user.plan = planId
			} else {
				user.plan = 'free'
			}
		}

		await user.save()

		if (options.onSubscriptionChange && typeof options.onSubscriptionChange === 'function') options.onSubscriptionChange(user)
			
	} else if (type === 'customer.subscription.deleted') {

		const subscription 	= event.data.object
		const customerId 	= subscription.customer

		let user = await options.mongoUser.findOne({'stripe.customerId': customerId}).exec()
		
		if (user.plan) user.plan = 'free'
		user.stripe.subscriptionId = null
		user.stripe.subscriptionItems = []
		user.stripe.canceled = false

		await user.save()

		if (options.onCancel && typeof options.onCancel === 'function') options.onCancel(user)

		sendMail(`Subscription canceled - ${options.siteName}`, 
`Hello,\n
We inform that your ${options.siteName} subscription is now canceled.
${options.cancelMailExtra ? options.cancelMailExtra + '\n' : ''}
We hope to see you back soon!`, user.email)

	} else {
		// Won't act on it
	}

	res.send({ received: true })
}))

const billingInfos = async (customerId, user, context, getInvoices=true) => {

	let userPlan = options.plans.find(p => p.id === user.plan)
	let upgradablePlans = []
	
	if (context === 'choosepage') {
		// All the plans except the one we currently are (usually the free plan)
		upgradablePlans = options.plans.filter(p => options.allowNoUpgrade ? true : p.id !== user.plan)
	} else {
		// In this case it's for the upgrade modal 
		// Which means we don't show the current plan or the free plan if it's not
		upgradablePlans = options.plans.filter(p => (options.allowNoUpgrade ? true : p.id !== 'free') && p.id !== user.plan)
	}

	if (userPlan) {
		for (let plan of upgradablePlans) {
			if (plan.order > userPlan.order) plan.isHigher = true
			else if (plan.order < userPlan.order) plan.isLower = true
		}
	}

	const stripeElementsOptions = deepMerge(defaultElementsOptions, options.stripeElementsOptions)

	if (!customerId) {
		return {
			customer: null,
			paymentMethods: [],
			invoices: [],
			upgradablePlans: upgradablePlans,
			userPlan: userPlan,
			subscriptions: [],
			stripeElementsOptions: stripeElementsOptions,
			user: user,
			options: options
		}
	}

	let customer = await stripe.customers.retrieve(customerId, {expand: ['subscriptions.data.plan.product']})
	if (!customer.address) customer.address = {}

	let paymentMethods = await stripe.paymentMethods.list({ customer: customerId, type: 'card' })

	paymentMethods = paymentMethods.data.map(m => {
		if (customer.invoice_settings.default_payment_method ? m.id === customer.invoice_settings.default_payment_method : 
			m.id === customer.default_source) { // fallback to default_source for old customers (deprecated)
			m.isDefault = true
		}

		return m
	})

	let subscriptions = customer.subscriptions.data

	// Make sure we are up to date (if change from Stripe dashboard)
	const userObj = await options.mongoUser.findById(user.id).exec()
	await updateSubscriptionData(userObj, subscriptions[0])

	// We shouldn't have multiple ones, but just in case.
	subscriptions = subscriptions.map(sub => {

		sub.currentPeriodStart = moment(sub.current_period_start * 1000).format("ll")
		sub.currentPeriodEnd = moment(sub.current_period_end * 1000).format("ll")
		
		if (sub.plan) { 
			sub.plan.amount = beautifyAmount(sub.plan.amount)

			sub.unitLabel = sub.plan.product.unit_label
			sub.name = sub.plan.product.name
		}

		if (sub.discount && sub.discount.coupon) {
			let coupon = sub.discount.coupon

			sub.discountDescription = `${coupon.name}: -${coupon.percent_off ? coupon.percent_off + '%' : coupon.amount_off + ' ' + coupon.currency} for ${coupon.duration_in_months} months`
		}

		return sub
	})

	if (getInvoices) {

		var allInvoices = await stripe.invoices.list({
			customer: customerId,
			limit: 5 
		})

		if (options.showDraftInvoice) {
			try {
				let upcomingInvoice = await stripe.invoices.retrieveUpcoming(customerId)
				allInvoices.data.unshift(upcomingInvoice)
			} catch(e) {
				// No upcoming invoices
			}
		}

		allInvoices = allInvoices.data
		.filter(invoice => invoice.amount_due > 0) // Only show 'real' invoices 
		.map(invoice => {
			invoice.amount = beautifyAmount(invoice.amount_due)

			// Because the invoice's own period isn't correct for the first invoice, we use the one from the first item
			invoice.cleanPeriodEnd = moment(invoice.lines.data[0].period.end * 1000).format('ll')
			invoice.cleanPeriodStart = moment(invoice.lines.data[0].period.start * 1000).format('ll')

			invoice.date = moment(invoice.date * 1000).format('ll')
			invoice.unpaid = (invoice.attempt_count > 1 && !invoice.paid)

			return invoice
		})

	}

	return {
		customer: customer,
		paymentMethods: paymentMethods,
		upgradablePlans: upgradablePlans,
		userPlan: userPlan,
		invoices: getInvoices ? allInvoices : null,
		subscriptions: subscriptions,
		user: user,
		stripeElementsOptions: stripeElementsOptions,
		options: options
	}
}

router.use((req, res, next) => {
	if (!req.user) return next('Login required for billing.')

	res.locals.customerId = req.user.stripeCustomerId || (req.user.stripe ? req.user.stripe.customerId : null)
	res.locals.subscriptionId = req.user.subscription || (req.user.stripe ? req.user.stripe.subscriptionId : null)
	
	if (!stripe) stripe = Stripe(options.secretKey)

	next()
})

router.get('/', asyncHandler(async (req, res, next) => {

	const customerId = res.locals.customerId
	const data = await billingInfos(customerId, req.user)

	res.render(__dirname+'/views/billing.ejs', { ...data, countries: countriesList })

}))

router.get('/testcoupon', (req, res, next) => {

	let coupons = options.coupons
	let couponToTest = req.query.code

	let exist = coupons && coupons.find(c => c.code === couponToTest)

	if (!exist) return res.send({ valid: false })

	res.send({
		valid: true,
		description: exist.description
	})
})

// Adds a card to customer, which is created if it doesn't exist
// Accepts either a paymentMethodId or a cardToken directly from Elements
// returns the Stripe Customer ID
const addCardToCustomer = async (user, customerId, paymentMethodId, cardToken) => {
	
	let customer = null

	if (customerId) {

		if (paymentMethodId) {
			// Attach and set as default
			await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })
			await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } })
		} else {
			await stripe.customers.update(customerId, { source: cardToken })
		}

		return customerId
	} 

	if (paymentMethodId) {
		customer = await stripe.customers.create({ email: user.email, payment_method: paymentMethodId })
	} else {
		customer = await stripe.customers.create({ email: user.email, source: cardToken })
	}

	let dbUser = await options.mongoUser.findById(user.id).exec()
	
	dbUser.stripe.customerId = customer.id
	
	await dbUser.save()

	return customer.id
}

router.get('/setupintent', asyncHandler(async (req, res, next) => {

	const customerId = res.locals.customerId

	// Triggers authentication if needed
	const setupIntent = await stripe.setupIntents.create({ usage: 'off_session' })

	res.send({ clientSecret: setupIntent.client_secret })
}))

router.post('/upgrade', asyncHandler(async (req, res, next) => {

	const token 		= req.body.token
	const couponCode 	= req.body.coupon
	const planId 		= req.body.upgradePlan

	// These two are most probably undefined 
	const subscriptionId = res.locals.subscriptionId
	let customerId 		 = res.locals.customerId

	if (!customerId && !token) return next("Sorry! We need a credit card to subscribe you.")

	// If the customer doesn't have card or isn't a Stripe customer
	if (token) { 
		try {
			customerId = await addCardToCustomer(req.user, customerId, null, token)
		} catch(e) {
			console.error(e)
			return next("We couldn't process your credit card. Please try another one or check with your bank.")
		}
	}

	let user = await options.mongoUser.findById(req.user.id).exec()

	const plan = options.plans.find(plan => plan.id === planId)
	if (!plan) return next('This plan looks invalid. Contact support for help.')

	// If we supplied a coupon
	let coupon = null
	if (options.coupons && options.coupons.find(c => c.code === couponCode)) {
		coupon = couponCode
	}

	try {

		if (subscriptionId) {

			// https://stripe.com/docs/billing/subscriptions/upgrading-downgrading

			var subscription = await stripe.subscriptions.retrieve(subscriptionId)
			subscription = await stripe.subscriptions.update(subscriptionId, {
				coupon: coupon || undefined,
				items: [{
					id: subscription.items.data[0].id,
					plan: plan.stripeId,
				}],
				expand: ['latest_invoice.payment_intent'],
				metadata: {
					planId: planId
				}
			})

		} else {

			var subscription = await stripe.subscriptions.create({
									coupon: coupon || undefined,
									customer: customerId,
									trial_from_plan: true,
									payment_behavior: 'allow_incomplete',  // For legacy API versions
									items: [{ 
										plan: plan.stripeId 
									}],
									expand: ['latest_invoice.payment_intent'],
									metadata: {
										planId: planId
									}
								})
		}
	} catch(e) {
		console.error(e)
		return next("Error subscribing you to the corrrect plan. Please contact support.")
	}

	// So the user can start using the app ASAP
	user.plan = planId
	await updateSubscriptionData(user, subscription)

	// That means it requires SCA auth
	// Depending if on-session or off-session
	// Either waiting for Card saving confirmation or direct Payment confirmation
	if (subscription.pending_setup_intent) {

		var intent = subscription.pending_setup_intent
		var action = 'handleCardSetup'
	
	} else if (subscription.latest_invoice.payment_intent) {
	
		var intent = subscription.latest_invoice.payment_intent
		var action = 'handleCardPayment'
	
	} else if (subscription.status === 'incomplete') {
	
		return next("We couldn't complete the transaction.")
	}

	// Means user need to do SCA/3DSecure shit to complete payment
	// "requires_source_action" and "requires_source" are deprecated, only for old API versions

	// Nothing to do anymore
	if (!intent || intent.status === 'succeeded') return res.send({})

	if (['requires_action', 'requires_source_action'].includes(intent.status)) {

		let secret = intent.client_secret
		
		return res.send({ actionRequired: action, clientSecret: secret })
	
	} else if (['requires_payment_method', 'requires_source'].includes(intent.status)) {
		
		return next('Please try with another card.')
	} 

	next('Unknown error with your subscription. Please try with another card.')

}))

router.post('/customerinfos', asyncHandler(async (req, res, next) => {

	const data = req.body
	const customerId = res.locals.customerId

	await stripe.customers.update(customerId, {
		name: data.name,
		address: {
			line1: data.line1,
			line2: data.line2,
			state: data.state,
			postal_code: data.postal_code,
			city: data.city,
			country: data.country
		}
	})

	res.redirect(options.accountPath)

}))

router.post('/card', asyncHandler(async (req, res, next) => {

	const paymentMethodId = req.body.paymentMethodId
	const customerId = res.locals.customerId

	await addCardToCustomer(req.user, customerId, paymentMethodId)

	res.send({})
}))

router.get('/removecard', asyncHandler(async (req, res, next) => {

	const paymentMethodId = req.query.id

	await stripe.paymentMethods.detach(paymentMethodId)

	res.redirect(options.accountPath)
}))

router.get('/setcarddefault', asyncHandler(async (req, res, next) => {

	const paymentMethodId = req.query.id

	await stripe.customers.update(res.locals.customerId, { 
		invoice_settings: {
			default_payment_method: paymentMethodId
		} 
	})

	res.redirect(options.accountPath)
}))

router.get('/chooseplan', asyncHandler(async (req, res, next) => {

	const customerId = res.locals.customerId

	let data = await billingInfos(customerId, req.user, "choosepage", false)

	data.redirect = options.choosePlanRedirect

	const pageOptions = options.pages.choosePlan ? options.pages.choosePlan : {}

	if (customerId) {
		data.subtitle = pageOptions.loggedSubtitle
		data.title = pageOptions.loggedTitle || "Select a plan"
	} else {
		data.subtitle = pageOptions.subtitle
		data.title = pageOptions.title || "Select a plan"
	}

	res.render(__dirname + '/views/choosePlan', data)
}))

router.post('/cancelsubscription', asyncHandler(async (req, res, next) => {

	let user = await options.mongoUser.findById(req.user.id).exec()

	const subscriptionId = res.locals.subscriptionId

	await stripe.subscriptions.update(subscriptionId, {
 		cancel_at_period_end: true
 	})

 	user.stripe.canceled = true
	user.save()

	const feedback = req.body.feedback

	if (feedback && feedback.length) {
		if (options.notify) options.notify(`${user.email} gave a feedback before cancelling:<br/>${feedback}`)
	}

	res.redirect(options.accountPath)
}))

router.get('/resumesubscription', asyncHandler(async (req, res, next) => {

	const subscriptionId = res.locals.subscriptionId

	let user = await options.mongoUser.findById(req.user.id).exec()

	await stripe.subscriptions.update(subscriptionId, {
		cancel_at_period_end: false
	})

	user.stripe.canceled = false
	user.save()

	res.redirect(options.accountPath)
}))

router.get('/billing.js', (req, res, next) => {
	res.sendFile(__dirname+'/billing.js')
})

module.exports = (opts) => {
	if (opts) options = opts

	if (!options.mongoUser) throw new Error('Missing parameter mongoUser (a mongoose collection of your users)')

	sendMail = options.sendMail || function () {}
	options.plans = options.plans || []
	options.pages = options.pages || {}
	options.stripeElementsOptions = options.stripeElementsOptions || {}
	
	options.accountPath = options.accountPath || '/account#billing'

	return router
}

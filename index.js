const moment 	= require("moment")
const Stripe 	= require("stripe")
const express 	= require('express')
const router 	= express.Router()
const ejs 		= require("ejs")

let options = {}

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

const billing = async (customerId) => {

	let stripe = Stripe(options.secretKey)

	let stripeCustomer = await stripe.customers.retrieve(customerId)

	console.log(stripeCustomer)

	// const subscription = stripe.subscriptions.retrieve(req.user.subscription)

	let sources = stripeCustomer.sources.data
	let subscriptions = stripeCustomer.subscriptions.data

	subscriptions = subscriptions.map(sub => {

		sub.currentPeriodStart = moment(sub.current_period_start * 1000).format("ll")
		sub.currentPeriodEnd = moment(sub.current_period_end * 1000).format("ll")

		return sub
	})

	let allInvoices = await stripe.invoices.list({
		customer: customerId,
		limit: 5 
	})

	allInvoices = allInvoices.data.map(invoice => {
		invoice.amount = (invoice.amount_due / 100).toLocaleString('en-US', { 
			style: 'currency', 
			currency: 'USD'
		})

		invoice.periodEnd = moment(invoice.period_end * 1000).format('ll')
		invoice.periodStart = moment(invoice.period_start * 1000).format('ll')

		invoice.date = moment(invoice.date * 1000).format('ll')
		invoice.unpaid = (invoice.attempt_count > 1)

		return invoice
	})

	return {
		sources: sources,
		invoices: allInvoices,
		subscriptions: subscriptions
	}

}

router.get('/', asyncHandler(async (req, res, next) => {

	let customerId = "cus_Dd4hrgKIMflCaz"
	// let customerId = req.user.stripeCustomerId || req.user.stripe.customerId

	if (customerId) {
		const data = await billing(customerId)

		res.render(__dirname+'/billing.ejs', data)
	} else {
		res.send(`<p>Billing doesn't seem enabled for your account.<b>Once you upgrade, your cards and invoices will show here.</p>`)
	}

}))

router.post('/card', asyncHandler(async (req, res, next) => {

	//let customerId = "cus_Dd4hrgKIMflCaz"
	let token = req.body.stripeToken
	let customerId = req.user.stripeCustomerId || req.user.stripe.customerId

	const customer = await stripe.customers.update(customerId, {
		source: token
	})

	return res.send({})

}))

module.exports = (opts) => {
	if (opts) options = opts

	return router
}
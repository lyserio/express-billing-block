# express-billing-page

*Still in alpha testing*

A simple Express (4.0+) middleware for rendering billing pages to your users, directly connected to Stripe.

Designed for use with Bootstrap 4.0 and jQuery.

The goal is to be a drop-in helper for handling and managing Stripe subscriptions.

## Features

- [x] List of recent invoices
- [x] Display alert in case of non-payment
- [x] List active subscription plans
- [x] List active cards, update current one
- [x] Upgrade popups
- [ ] Webhook for handling non-payments
- [ ] Webhook popups
- [ ] Button to disable subscription

### Notes

- req.user must contain a valid user object, with either `user.stripeCustomerId` or `user.stripe.customerId` defined
- doesn't support metered billing for now

## Usage

Install the library

```bash
npm i express-billing-page
```

Server code:

```javascript
app.use('/billing', require('express-billing-page')({
	mongoUser: db.User,
	secretKey: "sk_live_xxxxxxxxxxxxxxxxxxxxxxx",
	publicKey: "pk_live_xxxxxxxxxxxxxxxxxxxxxxx",
	upgradable: true,
	sendMail: (subject, text, email) => {
		// Send a mail with the library of your choice
	},
	plans: [{
		name: 'Hobby',
		id: 'hobby',
		order: 1,
		stripeId: 'plan_xxxxxxxxxxxxx',
		price: 12,
		advantages: ['200 daily active users', '1 year data retention', '3 apps', 'Priority support']
	}, {
		name: 'Pro',
		id: 'pro',
		order: 2,
		stripeId: 'plan_xxxxxxxxxxxxx',
		price: 29,
		advantages: ['10000 daily active users', 'Unlimited data retention', '10 apps', 'High priority support']
	}]
}))

```

Simple client code example (**jQuery & bootstrap.js are required**):

```javascript
<div id='billing'></div>

<script src='/billing/billing.js'></script>

<script>
	billing.reload('#billing')
</script>
```

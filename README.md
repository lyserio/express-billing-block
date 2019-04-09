# express-billing-page

*Still in testing*

An Express (4.0+) middleware for rendering billing pages to your users, directly connected to Stripe.
Designed for MongoDB, Bootstrap 4.0 and jQuery.

The goal is to be a drop-in helper for handling and managing Stripe subscriptions.
Useful for showing your users status of their subscriptions, their invoices, manager their cards, etc..

## Features

- [x] List of recent invoices
- [x] Display alert in case of non-payment
- [x] List active subscription plans
- [x] List active cards, update current one
- [x] Upgrade popups
- [x] Webhook for handling non-payments
- [x] Button to self un-subscribe

### Notes

- `req.user` must contain a valid user object
- In your Mongoose model, your users must have a `stripe` object:
```
stripe: {
	subscriptionId: String,
	customerId: String,
	subscriptionItems: []
}
```

## Usage

Install the library

```bash
npm install express-billing-page
```

Server code:

```javascript
app.use('/billing', require('express-billing-page')({
	mongoUser: db.User, // A direct access to your Mongoose database User
	secretKey: "sk_live_xxxxxxxxxxxxxxxxxxxxxxx",
	publicKey: "pk_live_xxxxxxxxxxxxxxxxxxxxxxx",
	upgradable: true, // Will offer a popup to upgrade plans
	sendMail: (subject, text, email) => {
		// Send a mail with the library of your choice
		// For upgrades, card changes, etc...
	},
	plans: [{
		name: 'Hobby',
		id: 'hobby',
		order: 1,
		stripeId: 'plan_xxxxxxxxxxxxx', // Id of your plan on Stripe
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

Will auto populate the div `#billingSection`.

```javascript
<div id='billingSection'></div>

<script src='/billing/billing.js'></script>
```

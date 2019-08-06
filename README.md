# express-billing-page

*Still in testing*

An Express (4.0+) middleware for rendering billing pages to your users, directly connected to Stripe.

Designed for MongoDB. 

*Requires Bootstrap 4 (CSS + JS), jQuery, and Open Iconic on your client side.* 

The goal is to be a drop-in module for handling and managing Stripe subscriptions.
Useful for showing your users status of their subscriptions, their invoices, and allow them to manage their subscriptions and cards on their own.

## Features

- [x] Upgrade popups
- [x] List of recent invoices
- [x] Support SCA (3D secure)
- [x] Display alert in case of payment failure
- [x] List active subscription plans
- [x] Manage credit cards
- [x] Button to self stop subscriptions
- [x] Support coupons in the URL

## Who uses it?

<table>
<tr>
	<td align="center">
		<a href="https://nucleus.sh"><img src="https://nucleus.sh/logo_color.svg" height="64" /></a>
	</td>
	<td align="center">
		<a href="https://eliopay.com"><img src="https://eliopay.com/logo_black.svg" height="64" /></a>
	</td>
	<td align="center">
		<a href="https://backery.io"><img src="https://backery.io/logo_color.svg" height="64" /></a>
	</td>
	<td align="center">
		<a href="https://litch.app"><img src="https://litch.app/img/logo.png" height="64" /></a>
	</td>
	<td align="center">
		<a href="https://musli.io"><img src="https://musli.io/icon.svg" height="64" /></a>
	</td>
</tr>
<tr>
	<td align="center">Nucleus</td>
	<td align="center">ElioPay</td>
	<td align="center">Backery</td>
	<td align="center">Litch.app</td>
	<td align="center">Musli.io</td>
</tr>
</table>

_👋 Want to be listed there? [Contact me](mailto:vince@lyser.io)._


### Notes

- `req.user` must contain a valid user object

- In your Mongoose model, your users must have a `stripe` object:
```
let UserSchema = {
	...
	stripe: {
		subscriptionId: String,
		customerId: String,
		subscriptionItems: []
	}
	...
}
```

- Set a Stripe webhook to https://your-site-url.com/billing/webhook and subscribe to:
	- `invoice.payment_succeeded`
	- `customer.subscription.deleted`
	- `customer.subscription.updated`

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
	accountPath: '/account', // So the redirects don't fail
	sendMail: (subject, text, email) => {
		// Send a mail with the library of your choice
		// For upgrades, card changes, etc...
	},
	onUpgrade: (user) => {
		// Called when user upgraded
	},
	onCancel: () => {
		// Called when user cancelled his subscription (or failed to pay)
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

.

```html
<h1>Your subscription</h1>
<div id='billingSection'></div>

<script src='/billing/billing.js'></script>
<script>
	billing.load('#billingSection')
</script>
```

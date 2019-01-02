# express-billing-page

*Still in alpha testing*

A simple Express (4.0+) middleware for rendering billing pages to your users, directly connected to Stripe.
Optimized for Bootstrap 4.0.


## Features

- List of recent invoices
- Display alert in case of non-payment
- List active subscription plans
- List active cards, update current one
- 

*Future*
- Webhook for handling non-payments
- Webhook popups
- Upgrade popups
- Button disable subscription

### Notes

- req.user must contain a valid user object, with either `user.stripeCustomerId` or `user.stripe.customerId` defined
- doesn't support metered billing for now

## Usage

Install the library

> npm i express-billing-page

Then in your server code:

```javascript
const billingPage = require('express-billing-page')

app.use('/billing', billingPage({
	secretKey: 'sk_test_xxxxxxxxxxxxxxxxx'
}))
```

Simple client code example with jQuery:

```javascript
$.get('/billing', (billingPage) => {
	$('#billingPage').html(billingPage)
}).fail(e => {
	console.error(e)	
})
```

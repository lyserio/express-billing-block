
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

const deepMerge = (target, ...sources) => {
	if (!sources.length) return target;
	const source = sources.shift();

	if (isObject(target) && isObject(source)) {
		for (const key in source) {
			if (isObject(source[key])) {
				if (!target[key]) Object.assign(target, { [key]: {} })
				deepMerge(target[key], source[key])
			} else {
				Object.assign(target, { [key]: source[key] })
			}
		}
	}

	return deepMerge(target, ...sources)
}

module.exports = {
	asyncHandler: fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),

	beautifyAmount: amount => (amount / 100).toLocaleString('en-US', {  style: 'currency',  currency: 'USD' }),

	deepMerge: deepMerge,

	updateSubscriptionData: async (user, subscription) => {

		if (!subscription || !user) return // No subscription data
		
		user.stripe.subscriptionId = subscription.id
		user.stripe.subscriptionItems = subscription.items.data.map(i => {
			return { 
				plan: i.plan.id, 
				id: i.id 
			}
		})

		await user.save()
	}

}
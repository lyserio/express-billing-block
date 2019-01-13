let billing = {

	reload: (selector="billingSection", callback) => {
		$(selector).html(`
			<div class="d-flex align-items-center">
				<p>Loading...</p>
				<div class="spinner-border ml-auto" role="status" aria-hidden="true"></div>
			</div>
		`)
		
		$.get('/billing/', (result) => {

			$(selector).html(result)

			// Load Stripe
			var head = document.getElementsByTagName('head')[0]
			var script = document.createElement('script')
			script.type = 'text/javascript'
			script.onload = () => { initStripe() }
			script.src = 'https://js.stripe.com/v3/'
			head.appendChild(script)
			
			if (callback)callback()

		}).fail(e => {
			console.error(e)
		})
	},

	upgradeModal: () => {
		$('#upgradeModal').modal('show')
	}

} 

// Show spinner if we're gonna show upgrade modal
if(window.location.href.indexOf("upgrade") > -1) {
	$('body').append(`
		<div id='tempOverlaySpinner' style='position: fixed; background: rgba(0,0,0,0.7); height:100%; width: 100%; z-index: 1000; top:0;' class="d-flex justify-content-center">
			<div class="spinner-border text-light align-self-center" role="status">
				<span class="sr-only">Loading...</span>
			</div>
		</div>
	`)
}

billing.reload("#billingSection", () => {
	if(window.location.href.indexOf("upgrade") > -1) {
		$("#tempOverlaySpinner").remove()
		billing.upgradeModal()
	}
})


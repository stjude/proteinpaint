exports.sleep = function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/*
	Detect an asynchronously rendered element
	_opts{}      see the defaults inside the detectElement function
	.elem        the DOM element where the selector will be queried
	.selector    (required) a valid CSS-selector of the element to be returned
	
	// options related to the native MutationObserver
	.callback()  optional, the argument to the MutationObserver constructor
	.observeOpts{}  the argument to a MutationObserver instance's observe() method
	  .target       the first observe() argument, the DOM element to be observed for changes, may be the same as opts.elem
	  .opts         the second observer() argument, see https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe
*/

exports.detectElement = function detectElement(_opts = {}) {
	const defaults = {
		elem: document.body,
		// selector: required
		maxTime: 5000,
		observeOpts: {
			target: document.body,
			opts: {
				childList: true,
				subtree: true
			}
		}
	}

	const opts = Object.assign(defaults, _opts)

	if (!opts.selector) throw `missing opts.selector`

	const start = Date.now()
	return new Promise((resolve, reject) => {
		const elem = opts.elem.querySelector(opts.selector)
		if (elem) {
			resolve(elem)
			return
		}

		const defaultCallback = mutations => {
			const elem = opts.elem.querySelector(opts.selector)
			const expired = Date.now() - start > opts.maxTime
			if (elem || expired) {
				observer.disconnect()
				if (t) clearTimeout(t)
				if (elem) resolve(elem)
				else reject(`test exceeded maxTime=${opts.maxTime}`)
			}
		}

		const observer = new MutationObserver(opts.callback || defaultCallback)
		observer.observe(opts.observeOpts.target, opts.observeOpts.opts)

		let t
		if (opts.maxTime) {
			t = setTimeout(() => {
				reject(`the elem '${opts.selector}' did not render within ${opts.maxTime} milliseconds`)
			}, opts.maxTime)
		}
	})
}

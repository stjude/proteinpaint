export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

//exports.sleep = sleep

/*
	Detect an asynchronously rendered element
	NOTE: you can use MutationObserver directly, this is meant for convenience for common use cases

	Argument
	_opts{}      see the defaults inside the detectLst function
	.elem        the DOM element where the selector will be queried
	.selector    (required) a valid CSS-selector of the element to be returned
	.count       the expected number of detected matching elements to stop the observer

	// options related to the native MutationObserver
	.callback()  optional, the argument to the MutationObserver constructor
	.observeOpts{}  the argument to a MutationObserver instance's observe() method
	  .target       the first observe() argument, the DOM element to be observed for changes, may be the same as opts.elem
	  .opts         the second observer() argument, see https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe

	Returns
	Array of zero or more matched DOM nodes
*/

export async function detectLst(_opts = {}) {
	const defaults = {
		elem: document.body,
		// selector: required
		maxTime: 5000,
		count: 1,
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
	// always defer execution to the next step, to give time for an element to change
	if (opts.count > 0) await sleep(0)

	const start = Date.now()
	return new Promise((resolve, reject) => {
		const elems = opts.elem.querySelectorAll(opts.selector)
		const matched = elems.length === opts.count
		if (matched) {
			resolve([...elems])
			return
		}

		const defaultCallback = mutations => {
			const elems = opts.elem.querySelectorAll(opts.selector)
			const matched = elems.length === opts.count //; console.log(58, elems.length, opts.count)
			const expired = Date.now() - start > opts.maxTime
			if (matched || expired) {
				observer.disconnect()
				if (t) clearTimeout(t)
				if (matched) resolve([...elems])
				else reject(`test exceeded maxTime=${opts.maxTime}`)
			}
		}

		const observer = new MutationObserver(opts.callback || defaultCallback)
		observer.observe(opts.observeOpts.target, opts.observeOpts.opts)

		let t
		if (opts.maxTime) {
			t = setTimeout(() => {
				if (opts.count === 0) {
				} else reject(`the elem '${opts.selector}' did not render within ${opts.maxTime} milliseconds`)
			}, opts.maxTime)
		}
	})
}

/*
	same arguments as detectLst, except count is forced to 1
	return the expected element
*/
export async function detectOne(opts) {
	opts.count = 1
	const lst = await detectLst(opts)
	return lst[0]
}

/*
	same arguments as detectLst, except count is forced to 0
	return the expected element

	--  you have to know the element hasn't been removed when this is called
*/
export async function detectZero(opts) {
	opts.count = 0
	const lst = await detectLst(opts)
	return lst[0] // should be undefined
}

// --  you do NOT need to know the element hasn't been removed when this is called
export async function whenGone(opts) {
	return new Promise((resolve, reject) => {
		let j = 0
		const i = setInterval(() => {
			if (opts.elem.querySelectorAll(opts.selector).length === 0) {
				clearInterval(i)
				resolve(elem)
			} else {
				j++
				if (j > 10) {
					reject(`elem did not hide within 200ms`)
					clearInterval(i)
				}
			}
		}, 20)
	})
}

export async function whenHidden(elem) {
	return new Promise((resolve, reject) => {
		let j = 0
		const i = setInterval(() => {
			if (elem.style.display == 'none') {
				clearInterval(i)
				resolve(elem)
			} else {
				j++
				if (j > 10) {
					reject(`elem did not hide within 200ms`)
					clearInterval(i)
				}
			}
		}, 20)
	})
}

export async function whenVisible(elem) {
	return new Promise((resolve, reject) => {
		let j = 0
		const i = setInterval(() => {
			if (elem.style.display != 'none') {
				clearInterval(i)
				resolve(elem)
			} else {
				j++
				if (j > 10) {
					reject(`elem did not become visible within 200ms`)
					clearInterval(i)
				}
			}
		}, 20)
	})
}

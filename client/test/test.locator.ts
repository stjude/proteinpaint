//import type { Dom } from '../types/d3.d.ts'

export class Locator {
	elem: any //HTMLElement | SVGElement | SVGGElement | SVGLineElement | SVGRectElement | SVGSVGElement | SVGTextElement
	opts = {
		intervalWait: 25,
		maxWait: 5000
	}

	// arg could be one of the following, must always
	// - DOM element
	// - string selector
	// - d3-selection
	constructor(arg: any, opts = {}) {
		Object.assign(this.opts, opts)
		if (typeof arg == 'string') {
			const node = document.body.querySelector(arg)
			if (!node) throw `missing elem by selector='${arg}'`
			this.elem = node
		} else if (typeof arg.node == 'function') {
			const numMatch = arg.size()
			if (!numMatch) throw `missing elem from d3-selection`
			this.elem = arg.node() // will collaps
		} else {
			this.elem = arg
		}
	}

	// convenience method to allow await Locator.init(elem).whenVisible('')
	static init(elem) {
		return new Locator(elem)
	}

	// selector: string selector such as '#my-id', '.my-class', `[data-testid='my-id-here']`, `[role='button']`, etc
	shows(selector, targetVisibility = true) {
		const intervalWait = this.opts.intervalWait
		const maxWait = this.opts.maxWait
		let elapsed = intervalWait
		return new Promise((resolve, reject) => {
			const i = setInterval(() => {
				const descendants = this.elem.querySelectorAll(selector)
				if (descendants?.[0]?.checkVisibility() === targetVisibility) {
					clearInterval(i)
					resolve(descendants)
				} else {
					elapsed += intervalWait
					if (elapsed > maxWait) {
						reject(`elem did not become visible within 5 seconds`)
						clearInterval(i)
					}
				}
			}, intervalWait)
		})
	}

	hides(selector) {
		return this.shows(selector, false)
	}
}

//import type { Dom } from '../types/d3.d.ts'

export class Locator {
	elem: any //HTMLElement | SVGElement | SVGGElement | SVGLineElement | SVGRectElement | SVGSVGElement | SVGTextElement
	opts = {
		intervalWait: 25,
		maxWait: 3000
	}
	pending: ((elems: any[]) => Promise<any>)[] = []
	result: any | any[] = []

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
		this.pending = []
	}

	// convenience method to allow await Locator.init(elem).whenVisible('')
	static init(elem) {
		return new Locator(elem)
	}

	// selector: string selector such as '#my-id', '.my-class', `[data-testid='my-id-here']`, `[role='button']`, etc
	shows(selector, opts: { intervalWait?: number; maxWait?: number; visibility?: boolean; count?: number } = {}) {
		//this.steps.push('shows', selector, )
		const targetCount = opts.count || 1
		const visibility = opts.visibility || true
		const intervalWait = opts.intervalWait || this.opts.intervalWait
		const maxWait = opts.maxWait || this.opts.maxWait
		let elapsed = intervalWait
		this.pending.push(async elems => {
			//console.log(48, elems, targetCount, visibility)
			const matchedElems = new Set()
			return new Promise((resolve, _) => {
				const i = setInterval(() => {
					for (const elem of elems) {
						for (const descendant of elem.querySelectorAll(selector)) {
							if (matchedElems.has(descendant)) continue //; console.log(55, descendant, descendant.checkVisibility())
							if (descendant.checkVisibility() === visibility) matchedElems.add(descendant)
						}
						if (matchedElems.size >= targetCount) {
							clearInterval(i)
							resolve([...matchedElems])
						} else {
							elapsed += intervalWait
							if (elapsed > maxWait) {
								clearInterval(i)
								resolve([...matchedElems])
								//const numMissing = targetCount - matchedElems.size
								//reject(`${numMissing} of ${targetCount} elements did not become visible within ${maxWait} milliseconds`)
							}
						}
					}
				}, intervalWait)
			})
		})
		return this
	}

	find(selector) {
		this.pending.push(async elems => {
			for (const elem of elems) {
				const match = elem.querySelector(selector)
				if (match) {
					return [match]
				}
			}
			return []
		})
		return this
	}

	async all() {
		const pending = this.pending
		this.pending = [] // clear
		let elems = [this.elem]
		for (const fxn of pending) {
			elems = await fxn(elems)
		}
		return [...elems]
	}

	async text() {
		const elems = await this.all()
		return elems.map(elem => elem.innerText)
	}

	hides(selector) {
		return this.shows(selector, { visibility: false })
	}
}

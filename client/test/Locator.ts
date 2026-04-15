//import type { Dom } from '../types/d3.d.ts'

export class Locator {
	rootElem: any //HTMLElement | SVGElement | SVGGElement | SVGLineElement | SVGRectElement | SVGSVGElement | SVGTextElement
	opts = {
		intervalWait: 25,
		maxWait: 3000
	}
	pending: [fxn: (elems: any[], opts?: any) => Promise<any>, opts: any][] = []
	result: any | any[] = []

	// convenience method to allow await Locator.init(elem).whenVisible('')
	static init(elem) {
		return new Locator(elem)
	}

	// arg could be one of the following, must always
	// - DOM element
	// - string selector
	// - d3-selection
	constructor(arg: any, opts = {}) {
		Object.assign(this.opts, opts)
		this.setRoot(arg)
	}

	setRoot(arg) {
		if (typeof arg == 'string') {
			const node = document.body.querySelector(arg)
			if (!node) throw `missing elem by selector='${arg}'`
			this.rootElem = node
		} else if (typeof arg.node == 'function') {
			const numMatch = arg.size()
			if (!numMatch) throw `missing elem from d3-selection`
			this.rootElem = arg.node() // will collaps
		} else {
			this.rootElem = arg
		}
		this.pending = []
	}

	root(arg) {
		if (arg) this.setRoot(arg)
		return this.rootElem
	}

	// selector: string selector such as '#my-id', '.my-class', `[data-testid='my-id-here']`, `[role='button']`, etc
	shows(
		selector,
		opts: {
			intervalWait?: number
			maxWait?: number
			visibility?: boolean
			count?: number
			attr?: { [attrName: string]: string | number }
		} = {}
	) {
		this.pending.push([
			shows,
			{
				selector,
				targetCount: opts.count || 1, //'>=1',
				visibility: opts.visibility ?? true,
				intervalWait: opts.intervalWait || this.opts.intervalWait,
				maxWait: opts.maxWait || this.opts.maxWait,
				attr: opts.attr || {}
			}
		])

		return this
	}

	// same argument as this.shows(), but visibility is not checked
	// and assumes that the elements targeted by the selector are
	// ready to be queried
	find(selector) {
		this.pending.push([find, { selector }])
		return this
	}

	// cannot chain another method after get(), since
	// the retured promise would require wrapping in parentheses
	//
	// get()
	// - run the pending functions in sequence and return the resolved
	//   queried elems or its properties based on the argument
	//
	// Arguments:
	//  arg: undefined | string | number | callback
	//
	// returns
	//  - no argument: get the matched elements as an array
	//  - callback function: passes the matched elements to the callback and returns its returned value
	//  - number: use as index key to return elems[index]
	//  - string: see the processing in the
	async get(arg?: string | number | ((elems: any[]) => any)) {
		const pending = this.pending
		this.pending = [] // clear
		let elems = [this.rootElem]
		for (const [fxn, opts] of pending) {
			elems = await fxn(elems, opts)
		}
		// no argument, return all matched elements
		if (!arguments.length || arg === undefined) return elems
		// apply callback and return whatever the callback returns
		if (typeof arg === 'function') return arg(elems)
		// return an elems entry, may be undefined
		if (typeof arg === 'number') return elems[arg]
		if (typeof arg === 'string') {
			// no need to parse string argument for exact matches
			if (arg == 'length') return elems.length

			// parse the string argument for indicator character and key
			const key = arg.slice(1)
			if (!key) return elems

			const char = arg[0]
			// '.' indicates an element property
			if (char === '.') return elems.map(elem => elem[key])
			// '@' indicates an element attribute
			if (char === '@') return elems.map(elem => elem.getAttribute(key))
			// ':' indicates an element style
			if (char === ':') return elems.map(elem => elem.style[key])
		}
		throw `invalid Locator.get() argument='${arg}'`
	}

	// TODO: support .set(arg, value)???

	/*** convenient aliased methods for .get(arg) ***/
	async length() {
		return await this.get('length')
	}

	async value() {
		return await this.get('.value')
	}

	async text() {
		return await this.get('.innerText')
	}

	hides(selector) {
		return this.shows(selector, { visibility: false })
	}

	async click(arg) {
		const elems = await this.get(arg)
		const arr = Array.isArray(elems) ? elems : [elems]
		for (const elem of arr) {
			const box = elem.getBoundingClientRect()
			const clientX = box.x + 0.5 * box.width
			const clientY = box.y + box.height
			elem.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX, clientY }))
		}
		return elems
	}
}

// must not reference 'this'
async function shows(elems, opts: any) {
	return new Promise(resolve => {
		const { selector, targetCount, intervalWait, maxWait, visibility, attr } = opts
		const matchedElems = new Set()
		let elapsed = 0,
			pending = false
		const i = setInterval(() => {
			// in case a previous interval has not finished yet, skip this iteration
			if (pending) return
			pending = true
			for (const elem of elems) {
				for (const descendant of elem.querySelectorAll(selector)) {
					if (matchedElems.has(descendant)) continue
					if (descendant.checkVisibility() === visibility) {
						if (!attr) matchedElems.add(descendant)
						else {
							const kvEntries = Object.entries(attr)
							const matchedKeys: string[] = []
							for (const [key, value] of kvEntries) {
								if (elem.getAttribute(key) !== value) matchedKeys.push(key)
							}
							if (matchedKeys.length === kvEntries.length) matchedElems.add(descendant)
						}
					}
				}
			}
			elapsed += intervalWait
			if (matchedElems.size >= targetCount || elapsed > maxWait) {
				clearInterval(i)
				resolve([...matchedElems])
			}
			pending = false
		}, intervalWait)
	})
}

// function matchCount(targetCount: number | string, count, op) {
// 	if (targetCount === count) return true
// 	if (typeof targetCount === 'number') return false
// 	if (typeof targetCount === 'string') {
// 		//console.log(127, targetCount, count, count >= Number(targetCount.slice(1)))
// 		if (targetCount.startsWith('>')) return count >= Number(targetCount.slice(1))
// 		if (targetCount.startsWith('<')) return count >= Number(targetCount.slice(1))
// 		if (targetCount.startsWith('>=')) return count >= Number(targetCount.slice(2))
// 		if (targetCount.startsWith('<=')) return count >= Number(targetCount.slice(2))
// 	}
// 	throw new Error(`Error: invalid target count ${JSON.stringify(targetCount)}`)
// }

async function find(elems, opts: any) {
	for (const elem of elems) {
		const match = elem.querySelector(opts.selector)
		if (match) {
			return [match]
		}
	}
	return []
}

export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

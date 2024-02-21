import { getAppInit, getStoreInit } from '../rx'

/********* EXPORTED ********
sleep
detectLst
detectAttr
detectChildAttr
detectStyle
detectChildStyle
detectText
detectChildText
detectGt
detectGte
detectLt
detectLte
detectOne
detectZero
whenGone
whenHidden
whenVisible
*/

export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

//exports.sleep = sleep

/*
    Detect an asynchronously rendered element
    NOTE: you can use MutationObserver directly, this is meant for convenience for common use cases

    Argument
    _opts{}      see the defaults inside the detectLst function

    // options related to the native MutationObserver
    // see https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe
    .target      required, the first argument to a MutationObserver instance's observe() method
                             the DOM element to be observed and where the optional selector will be queried; alias for opts.elem
    .observe{}   the second argument to a MutationObserver instance's observe() method

    .selector    optional, a valid CSS-selector of the element to be returned under opts.target. 
                             If empty, then opts.target will be returned
    
    .matcher()   optional, a function that signals the end of the observer 
                             passed (mutationsList, observer) as arguments
                             must return an array of zero or more elements to trigger observer.disconnect() 
    .maxTime     optional, max time to wait

    // only used when opts.matcher is not supplied
    .count       optional, the expected number of detected matching elements to stop the observer
    .matchAs     optional, how to match the current versus expected counts, '=','>','<','>=','<=' default is '='

    Returns
    Array of zero or more matched DOM nodes
*/

export async function detectLst(_opts = {}) {
	const defaults = {
		target: _opts.target || _opts.elem,
		selector: _opts.selector,
		maxTime: 12000, // default is increased from 5 to 12 specifically for gdc live tests with high latency
		observe: {
			childList: true,
			subtree: true,
			attributes: true,
			characterData: true
		}
	}

	if (!_opts.matcher) {
		defaults.count = 1
		defaults.matchAs = '='
	}

	const opts = Object.assign(defaults, _opts)
	if (!opts.target) throw `missing opts.target (alias for opts.elem)` //; console.log(52, opts)

	//if (!opts.selector) throw `missing opts.selector`
	// may defer execution to the next step, to give time for an element to change
	if (!opts.trigger && opts.count > 0) await sleep(0)
	const start = Date.now()
	return new Promise((resolve, reject) => {
		if (!opts.matcher && opts.selector) {
			const elems = opts.target.querySelectorAll(opts.selector)
			const matched = matchedCount(elems.length, opts)
			if (matched) {
				resolve([...elems])
				return
			}
		}

		const callback = mutations => {
			const elems = opts.selector ? [...opts.target.querySelectorAll(opts.selector)] : [opts.target]
			const mutated = mutations.filter(m => elems.includes(m.target))
			if (!mutated.length && opts.count !== 0) return
			const matched = opts.matcher ? opts.matcher(mutated, observer) : matchedCount(elems.length, opts)
			const expired = Date.now() - start > opts.maxTime
			if (matched || expired) {
				observer.disconnect()
				if (t) clearTimeout(t)
				if (matched) resolve(Array.isArray(matched) ? matched : elems)
				else reject(`test exceeded maxTime=${opts.maxTime}`)
			}
		}

		const observer = new MutationObserver(callback)
		observer.observe(opts.target, opts.observe)

		let t
		if (opts.maxTime) {
			t = setTimeout(() => {
				if (opts.count === 0) {
				} else reject(`the elem '${opts.target}' did not render within ${opts.maxTime} milliseconds`)
			}, opts.maxTime)
		}

		if (opts.trigger) opts.trigger()
	})
}

// compare the actual vs expected element counts
function matchedCount(actual, opts) {
	const expected = opts.count
	switch (opts.matchAs) {
		case '=':
			return actual === expected
		case '<':
			return actual < expected
		case '<=':
			return actual <= expected
		case '>':
			return actual > expected
		case '>=':
			return actual >= expected
		default:
			throw `unknown matchAs='${opts.matchAs}'`
	}
}

/*
    convenience helpers for detectLst with preconfigured MutationRecord.type, attributeName
*/

export async function detectAttr(opts) {
	if (!opts.observe) opts.observe = {}
	opts.observe.attributes = true
	const lst = await detectLst(opts)
	return lst
}

export async function detectChildAttr(opts) {
	if (!opts.observe) opts.observe = {}
	opts.observe.subtree = true
	opts.observe.attributes = true
	if (opts.attr) {
		if (opts.matcher) console.warn(`will not use opts.attr since an opts.matcher is already available`)
		else {
			if (!('count' in opts)) opts.count = 1
			opts.matcher = mutations => {
				const matched = mutations.filter(m => {
					for (const key in opts.attr) {
						if (typeof opts.attr[key] === 'function') {
							const value = m.target.getAttribute(key)
							if (!opts.attr[key](value)) return false
						} else if (value != opts.attr[key]) {
							return false
						}
					}
					return true
				})
				// TODO: should accumulate matched counts???
				if (matched.length === opts.count) return matched.map(d => d.target)
			}
		}
	}
	const lst = await detectLst(opts)
	return lst
}

export async function detectStyle(opts) {
	if (!opts.observe) opts.observe = {}
	opts.observe.attributes = true
	opts.observe.attributeFilter = ['style']
	const lst = await detectLst(opts)
	return lst
}

export async function detectChildStyle(opts) {
	if (!opts.observe) opts.observe = {}
	opts.observe.subtree = true
	opts.observe.attributes = true
	opts.observe.attributeFilter = ['style']
	if (opts.style) {
		if (opts.matcher) console.warn(`will not use opts.style since an opts.matcher is already available`)
		else {
			if (!('count' in opts)) opts.count = 1
			opts.matcher = mutations => {
				// need to be careful of strings
				const matched = mutations.filter(m => {
					for (const key in opts.style) {
						const value = m.target.style[key]
						if (typeof opts.style[key] == 'function') {
							if (!opts.style[key](value)) return false
						} else if (value != opts.style[key]) return false
					}
					return true
				})
				// TODO: should accumulate matched counts???
				if (matched.length === opts.count) return matched.map(d => d.target)
			}
		}
	}
	const lst = await detectLst(opts)
	return lst
}

export async function detectText(opts) {
	if (!opts.observe) opts.observe = {}
	opts.observe.characterData = true
	const lst = await detectLst(opts)
	return lst
}

export async function detectChildText(opts) {
	if (!opts.observe) opts.observe = {}
	opts.observe.subtree = true
	opts.observe.characterData = true
	opts.observe.childList = true
	if (!opts.matcher) {
		opts.matcher = mutations => mutations.map(m => m.target)
	}
	const lst = await detectLst(opts)
	return lst
}

/*
    convenience helpers for detectLst with preconfigured matchAs
    same arguments as detectLst
*/
export async function detectGt(opts) {
	opts.matchAs = '>'
	const lst = await detectLst(opts)
	return lst
}

export async function detectGte(opts) {
	opts.matchAs = '>='
	const lst = await detectLst(opts)
	return lst
}

export async function detectLt(opts) {
	opts.matchAs = '<'
	const lst = await detectLst(opts)
	return lst
}

export async function detectLte(opts) {
	opts.matchAs = '<='
	const lst = await detectLst(opts)
	return lst
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
	if (!opts.observe) opts.observe = {}
	opts.observe.childList = true
	opts.observe.subtree = true
	const lst = await detectLst(opts)
	return lst[0] // should be undefined
}

// --  you do NOT need to know the element hasn't been removed when this is called
export async function whenGone(opts) {
	return new Promise((resolve, reject) => {
		let j = 0
		const i = setInterval(() => {
			if (opts.target.querySelectorAll(opts.selector).length === 0) {
				clearInterval(i)
				resolve(opts.target)
			} else {
				j++
				if (j > 10) {
					reject(`elem did not hide within 200ms`)
					clearInterval(i)
				}
			}
		}, 20)

		setTimeout(() => {
			clearInterval(i)
		}, opts.maxTime || 3000)
	})
}

// must know that the element already exists when calling this,
// otherwise use one of the detect* helpers
export async function whenHidden(elem) {
	return new Promise((resolve, reject) => {
		let j = 0
		const i = setInterval(() => {
			if (elem.style.display == 'none') {
				clearInterval(i)
				resolve(elem)
			} else {
				j++
				if (j > 200) {
					reject(`elem did not hide within 5 seconds`)
					clearInterval(i)
				}
			}
		}, 25)
	})
}

// must know that the element already exists when calling this,
// otherwise use one of the detect* helpers
export async function whenVisible(elem, opts = {}) {
	const intervalWait = 25
	const totalWait = opts.wait || 5000
	const numRepeats = totalWait / intervalWait
	return new Promise((resolve, reject) => {
		let j = 0
		const i = setInterval(() => {
			if (elem.style.display != 'none') {
				clearInterval(i)
				resolve(elem)
			} else {
				j++
				if (j > numRepeats) {
					reject(`elem did not become visible within 5 seconds`)
					clearInterval(i)
				}
			}
		}, intervalWait)
	})
}

class TestAppStore {
	constructor(opts) {
		;(this.type = 'store'),
			(this.defaultState = {
				debug: true
			})
	}

	async init() {}
}

const storeInit = getStoreInit(TestAppStore)

class TestApp {
	constructor(opts) {
		this.type = 'app'
		this.opts = opts
		this.fetchOpts = opts.fetchOpts
	}

	async init() {
		try {
			this.store = await storeInit({ app: this.api, state: this.opts.state })
			this.state = await this.store.copyState()
			if (this.opts.dom) this.dom = this.opts.dom
			await this.api.dispatch()
		} catch (e) {
			if (e.stack) console.log(e.stack)
			else throw `TestApp Error: ${e}`
		}
	}
}

export const testAppInit = getAppInit(TestApp)

/************
 Init Factory
*************/

export function getInitFxn(_Class_) {
	/*
		arg: 
		= opts{} for an App constructor
		= App instance for all other classes

		returns a function that 
		- creates a _Class_ instance
		- optionally attaches a self reference to the api
		- freezes and returns the instance api
	*/
	return (arg, instanceOpts = {}) => {
		// instantiate mutable private properties and methods
		const self = new _Class_(arg, instanceOpts)

		// get the instance's api that hides its
		// mutable props and methods
		const api = self.api
			? // if there is already an instance api as constructed, use it
			  self.api
			: // if not, check if there is an api generator function
			self.getApi
			? // if yes, generate the api
			  self.getApi()
			: // if not, expose the mutable instance as its public api
			  self

		const opts = (self.app && self.app.opts) || (self.api && self.api.opts) || {}
		// expose the hidden instance to debugging and testing code
		if (opts.debug) api.Inner = self

		// freeze the api's properties and methods before exposing
		return Object.freeze(api)
	}
}

/**************
Utility Classes
***************/

/*
	A Bus instance will be its own api,
	since it does not have a getApi() method.
	Instead, the mutable Bus instance will be hidden via the
	component.api.on() method.
*/

export class Bus {
	constructor(name, eventTypes, callbacks, defaultArg) {
		/*
		name
		- the property name within the termdb.callbacks object
		  to use for initializing bus events

		eventType
		- must be one of the eventTypes supplied to the Bus constructor
		- maybe be namespaced or not, example: "postRender.test" or "postRender"

		arg
		- optional the argument to supply to the callback

		callbacks
		- optional 

		defaultArg
		- when emitting an event without a second argument,
		  the defaultArg will be supplied as the argument
		  to the callback
	*/
		this.name = name
		this.eventTypes = eventTypes
		this.events = {}
		this.defaultArg = defaultArg
		if (callbacks && name in callbacks) {
			for (const eventType in callbacks[name]) {
				this.on(eventType, callbacks[name][eventType])
			}
		}
	}

	on(eventType, callback, opts = {}) {
		/*
		eventType
		- must match one of the eventTypes supplied to the Bus constructor
		- maybe be namespaced or not, example: "postRender.test" or "postRender"
		- any previous event-attached callbacks will be REPLACED in this bus 
		  when the same eventType is used as an argument again -- same behavior
		  as a DOM event listener namespacing and replacement

		arg
		- optional the argument to supply to the callback

		opts 
		- optional callback configuration, such as
		.wait // to delay callback  
	*/
		const [type, name] = eventType.split('.')
		if (!this.eventTypes.includes(type)) {
			throw `Unknown bus event '${type}' for component ${this.name}`
		} else if (!callback) {
			delete this.events[eventType]
		} else if (typeof callback == 'function') {
			if (eventType in this.events && !eventType.includes('.')) {
				console.log(`Warning: replacing ${this.name} ${eventType} callback - use event.name?`)
			}
			this.events[eventType] = opts.wait ? arg => setTimeout(() => callback(arg), opts.wait) : callback
		} else if (Array.isArray(callback)) {
			if (eventType in this.events) {
				console.log(`Warning: replacing ${this.name} ${eventType} callback - use event.name?`)
			}
			const wrapperFxn = arg => {
				for (const fxn of callback) fxn(arg)
			}
			this.events[eventType] = opts.wait ? arg => setTimeout(() => wrapperFxn(arg), opts.wait) : wrapperFxn
		} else {
			throw `invalid callback for ${this.name} eventType=${eventType}`
		}
		return this
	}

	emit(eventType, arg = null, wait = 0) {
		/*
		eventType
		- must be one of the eventTypes supplied to the Bus constructor
		- maybe be namespaced or not, example: "postRender.test" or "postRender"

		arg
		- optional: the argument to supply to the callback
		  if null or undefined, will use constructor() opts.defaultArg instead

		wait
		- optional delay in calling the callback
	*/
		setTimeout(() => {
			for (const type in this.events) {
				if (type == eventType || type.startsWith(eventType + '.')) {
					this.events[type](arg || this.defaultArg)
				}
			}
		}, wait)
		return this
	}
}

/****************
  API Generators
*****************/

export function getStoreApi(self) {
	const api = {
		async write(action) {
			// avoid calls to inherited methods
			const actions = self.constructor.prototype.actions
			if (!actions) {
				throw `no store actions specified`
			}
			if (!actions.hasOwnProperty(action.type)) {
				throw `Action=${action.type} must be declared in an "actions" property of a class.`
			}
			if (typeof actions[action.type] !== 'function') {
				throw `invalid action type=${action.type}`
			}
			await actions[action.type].call(self, action)
			return api.state()
		},
		state(sub = null) {
			if (!sub) {
				const stateCopy = self.fromJson(self.toJson(self.state))
				self.deepFreeze(stateCopy)
				return stateCopy
			} else {
				if (!self.getters.hasOwnProperty(sub.type)) {
					throw `undefined state getter method for component type='${sub.type}'`
				}
				return self.getters[sub.type].call(self, sub)
			}
		}
	}
	return api
}

export function getAppApi(self) {
	const middlewares = []

	const api = {
		opts: self.opts,
		state(sub = null) {
			// return self // would allow access to hidden instance
			return sub ? self.store.state(sub) : self.state
		},
		async dispatch(action = {}) {
			/*
			???
			to-do:
 			track dispatched actions and
 			if there is a pending action,
 			debounce dispatch requests
			until the pending action is done?
	 	  ???
 			*/
			if (middlewares.length) {
				for (const fxn of middlewares.slice()) {
					const result = await fxn(action)
					if (result) {
						if (result.cancel) return
						if (result.error) throw result.error
						if (result.deactivate) {
							middlewares.splice(middlewares.indexOf(fxn), 1)
						}
					}
				}
			}
			// replace app.state
			self.state = await self.store.write(action)
			await self.main(action)
		},
		middle(fxn) {
			/*
			add middlewares prior to calling dispatch()

			fxn(action) 
			- called in the order of being added to middlewares array
			- must accept an action{} argument
			- do not return any value to eventually reach dispatch()
			  - OR -
			- optionally return an object{}
				.error: "string" will throw
				.cancel: true will cancel dispatch
				.deactivate: true will remove the fxn from the middlewares array
			*/
			if (typeof fxn !== 'function') throw `a middleware must be a function`
			if (middlewares.includes(fxn)) throw `the function is already in the middlewares array`
			middlewares.push(fxn)
			return api
		},
		async save(action) {
			// save changes to store, do not notify components
			self.state = await self.store.write(action)
		},
		// must not expose this.bus directly since that
		// will also expose bus.emit() which should only
		// be triggered by this component
		on(eventType, callback) {
			if (self.bus) self.bus.on(eventType, callback)
			else console.log('no component event bus')
			return api
		},
		components(dotSepNames = '') {
			return self.getComponents(dotSepNames)
		}
	}
	return api
}

export function getComponentApi(self) {
	const api = {
		async main(action, data = null) {
			// reduce boilerplate or repeated code
			// in component class main() by performing
			// typical pre-emptive checks here
			const acty = action.type ? action.type.split('_') : []
			if (self.reactsTo) {
				// fine-grained flow control, may deprecate in favor of array format
				if (typeof self.reactsTo == 'function' && !self.reactsTo(action, acty)) return
				// coarse-grained flow control
				if (Array.isArray(self.reactsTo) && !self.reactsTo.includes(acty[0]) && !self.reactsTo.includes(action.type))
					return
			}
			await self.main(action, data)
			return api
		},
		// must not expose self.bus directly since that
		// will also expose bus.emit() which should only
		// be triggered by this component
		on(eventType, callback) {
			if (self.bus) self.bus.on(eventType, callback)
			else console.log('no component event bus')
			return api
		},
		components(dotSepNames = '') {
			return typeof self.getComponents == 'function' ? self.getComponents(dotSepNames) : api
		}
	}
	return api
}

/******************
  Detached Helpers
******************/
/*
	Methods to attach directly to an instance
	inside a class contructor method.
	
	This is recommended instead of using 
	inheritance via "extends", since this "mixin" 
	approach:

	- makes it clearer which instance method corresponds
	  to what rx.core method
	
	- it is not susceptible to any class prototype edits
	  that may affect all instances that inherits from 
	  the edited class

	- avoids conceptual association of classical
	  inheritance using the "extends" keyword
*/

// Component Helpers
// -----------------

export async function notifyComponents(action, data = null) {
	const called = []
	for (const name in this.components) {
		const component = this.components[name]
		if (Array.isArray(component)) {
			for (const c of component) called.push(c.main(action, data))
		} else if (component.hasOwnProperty('main')) {
			called.push(component.main(action, data))
		} else if (component && typeof component == 'object') {
			for (const name in component) {
				if (component.hasOwnProperty(name) && typeof component[name].main == 'function') {
					called.push(component[name].main(action, data))
				}
			}
		}
	}
	return Promise.all(called)
}

// access the api of an indirectly connected component,
// for example to subscribe an .on(event, listener) to
// the event bus of a distant component
export function getComponents(dotSepNames) {
	if (!dotSepNames) return Object.assign({}, this.components)
	// string-based convenient accessor,
	// so instead of
	// app.components().controls.components().search,
	// simply
	// app.components("controls.search")
	const names = dotSepNames.split('.')
	let component = this.components
	while (names.length) {
		let name = names.shift()
		if (Array.isArray(component)) name = Number(name)
		component = !names.length
			? component[name]
			: component[name] && component[name].components
			? component[name].components
			: component[name]
		if (typeof component == 'function') component = component()
		if (!component) break
	}
	return component
}

// Store Helpers
// -------------

/*
	base: 
	- either an state object or its JSON-stringified equivalent 

	args
	- full or partial state object(s). if base is a string, then
	  the arg object will be converted to/from JSON to
	  create a copy for merging
*/
export function copyMerge(base, ...args) {
	const target = typeof base == 'string' ? this.fromJson(base) : base
	for (const arg of args) {
		if (arg) {
			const source = typeof base == 'string' ? this.fromJson(this.toJson(arg)) : arg
			for (const key in source) {
				if (!target[key] || Array.isArray(target[key]) || typeof target[key] !== 'object') target[key] = source[key]
				else this.copyMerge(target[key], source[key])
			}
		}
	}
	return target
}

export function fromJson(objStr) {
	// this method should not be reused when there is
	// a need to recover any Set or Map values, instead
	// declare a class specific fromJson() method that has
	// new Set(arrOfValues) or new Map(arrOfPairedValues)
	return JSON.parse(objStr)
}

export function toJson(obj = null) {
	// this method should not be reused when there is
	// a need to stringify any Set or Map values,
	// instead declare a class specific toJson() method
	// that converts any Set or Map values to
	// [...Set] or [...Map] before JSON.stringify()
	return JSON.stringify(obj ? obj : this.state)
}

export function deepFreeze(obj) {
	Object.freeze(obj)
	for (const key in obj) {
		if (typeof obj == 'object') this.deepFreeze(obj[key])
	}
}

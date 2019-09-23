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
	return (arg, holder) => {
		// instantiate mutable private properties and methods
		const self = new _Class_(arg, holder)
		
		// get the instance's api that hides its
		// mutable props and methods
		const api = self.api
			// if there is already an instance api as constructed, use it
			? self.api
			// if not, check if there is an api generator function
			: self.getApi
			// if yes, generate the api
			? self.getApi()  
			// if not, expose the mutable instance as its public api
			: self

		const opts = self.app && self.app.opts || self.api && self.api.opts || {}
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
*/

export class Bus {
	constructor(name, eventTypes, callbacks, defaultArg) {
		this.name = name
		this.eventTypes = eventTypes
		this.events = {}
		this.defaultArg = defaultArg
		for (const eventType in callbacks[name]) {
			this.on(eventType, callbacks[name][eventType])
		}
	}

	on(eventType, callback, opts = {}) {
		const [type, name] = eventType.split(".")
		if (!this.eventTypes.includes(type)) {
			throw `Unknown bus event '${type}' for component ${this.name}`
		} else if (!callback) {
			delete this.events[eventType]
		} else if (typeof callback == "function") {
			if (eventType in this.events) {
				console.log(`Warning: replacing ${this.name} ${eventType} callback - use event.name?`)
			}
			this.events[eventType] = opts.timeout 
				? arg => setTimeout(() => callback(arg), opts.timeout) 
				: callback
		} else if (Array.isArray(callback)) {
			if (eventType in this.events) {
				console.log(`Warning: replacing ${this.name} ${eventType} callback - use event.name?`)
			}
			const wrapperFxn = arg => {
				for (const fxn of callback) fxn(arg)
			}
			this.events[eventType] = opts.timeout 
				? arg => setTimeout(() => wrapperFxn(arg), opts.timeout) 
				: wrapperFxn
		} else {
			throw `invalid callback for ${this.name} eventType=${eventType}`
		}
		return this
	}

	emit(eventType, arg = null) {
		setTimeout(() => {
			for (const type in this.events) {
				if (type == eventType || type.startsWith(eventType + ".")) {
					this.events[type](arg ? arg : this.defaultArg)
				}
			}
		}, 0)
		return this
	}
}

/****************
  API Generators
*****************/

export function getStoreApi(_self) {
	// might make self argument required
	// so no need to assign a getApi method
	// to instance
	const self = _self ? _self : this
	const api = {
		async write(action) {
			// enforce undescore convention for action methods,
			// non-action methods should use camel-case instead
			if (!action.type.includes("_")) {
				throw `A store action type must use an underscore '_'.`
			}
			// avoid calls to inherited methods
			if (!self.constructor.prototype.hasOwnProperty(action.type)) {
				throw `Action=${action.type} must be declared directly as a class method.`
			}
			if (typeof self[action.type] !== 'function') {
				throw `invalid action type=${action.type}`
			}
			await self[action.type].call(self, action)
			return api.state()
		},
		state() {
			const stateCopy = self.fromJson(self.toJson(self.state))
			self.deepFreeze(stateCopy)
			return stateCopy
		}
	}
	return api
}

export function getAppApi(_self) {
	// might make self argument required
	// so no need to assign a getApi method
	// to instance
	const self = _self ? _self : this
	const api = {
		opts: self.opts,
		state() {
			return self.state
		},
		async dispatch(action={}) {
			/*
			  track dispatched actions and
				if there is a pending action,
				debounce dispatch requests
				until the pending action is done?
			*/
			self.state = await self.store.write(action)
			//self.deepFreeze(action)
			self.main(action)
		},
		// must not expose this.bus directly since that
		// will also expose bus.emit() which should only
		// be triggered by this component
		on(eventType, callback) {
			if (self.bus) self.bus.on(eventType, callback)
			else console.log('no component event bus')
			return api
		},
		components(dotSepNames='') {
			return self.getComponents(dotSepNames)
		}
	}
	return api
}

export function getComponentApi(_self) {
	// might make self argument required
	// so no need to assign a getApi method
	// to instance
	const self = _self ? _self : this
	const api = {
		main(action) {
			// reduce boilerplate or repeated code
			// in component class main() by performing
			// typical pre-emptive checks here
			const acty = action.type ? action.type.split("_") : []
			if (self.reactsTo && !self.reactsTo(action, acty)) return
			self.main(action)
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
		components(dotSepNames='') {
			return self.getComponents(dotSepNames)
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

export function notifyComponents(action) {
	for (const name in this.components) {
		const component = this.components[name]
		if (Array.isArray(component)) {
			for (const c of component) c.main(action)
		} else {
			component.main(action)
		}
	}
}

// access the api of an indirectly connected component, 
// for example to subscribe an .on(event, listener) to 
// the event bus of a distant component
export function getComponents(dotSepNames) {
	if (!dotSepNames) return Object.assign({},this.components)
	// string-based convenient accessor, 
  // so instead of
  // app.components().controls.components().search,
  // simply
  // app.components("controls.search")
	const names = dotSepNames.split(".")
	let component = this.components
	while(names.length) {
		let name = names.shift()
		if (Array.isArray(component)) name = Number(name)
		component = names.length ? component[name].components : component[name]
		if (typeof component == "function") component = component()
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
	const target = typeof base == "string" ? this.fromJson(base) : base
	for(const arg of args) {
		if (arg) {
			const source = typeof base == "string" ? this.fromJson(this.toJson(arg)) : arg
			for(const key in source) {
				if (!target[key] || Array.isArray(target[key]) || typeof target[key] !== "object") target[key] = source[key]
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

export function toJson(obj=null) {
	// this method should not be reused when there is 
	// a need to stringify any Set or Map values, 
	// instead declare a class specific toJson() method 
	// that converts any Set or Map values to 
	// [...Set] or [...Map] before JSON.stringify()
	return JSON.stringify(obj ? obj : this.state) 
}

export function deepFreeze(obj) {
	Object.freeze(obj)
	for(const key in obj) {
		if (typeof obj == 'object') this.deepFreeze(obj[key])
	}
}

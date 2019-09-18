/************
 Init Factory
*************/

export function getInitFxn(_Class_) {
	/*
		arg: 
		= opts{} for an App constructor
		= App instance for all other classes
	*/
	return (arg, holder) => {
		// private properties and methods
		const self = new _Class_(arg, holder)
		const api = self.store
			// only an app instance will have a store
			// and its api == instance.app
			? self.app 
			: self.getApi
			// hide mutable props and methods behind the instance api
			? self.getApi()  
			// expose the mutable instance as its public api
			: self

		const opts = self.app && self.app.opts || {}
		if (opts.debug) api.Inner = self
		return Object.freeze(api)
	}
}

/*************
 Root Classes
 ************/
/*
  should provide inheritable utility methods
*/

export class App {
	getApi(opts) {
		const self = this
		const api = {
			opts,
			state() {
				return self.state
			},
			async dispatch(action={}) {
				if (typeof self.store[action.type] !== 'function') {
					throw `invalid action type=${action.type}`
				}
				await self.store[action.type](action)
				self.state = self.store.copy()
				// console.log(action, self.app)
				self.main(action)
			},
			// must not expose this.bus directly since that
			// will also expose bus.emit() which should only
			// be triggered by this component
			on(eventType, callback) {
				if (self.bus) self.bus.on(eventType, callback)
				else console.log('no component event bus')
				return api
			}
		}
		return api
	}

	notifyComponents(action) {
		for (const name in this.components) {
			const component = this.components[name]
			if (Array.isArray(component)) {
				for (const c of component) c.main(action)
			} else {
				component.main(action)
			}
		}
	}
}

export class Store {
	copy() {
		const copy = JSON.parse(JSON.stringify(this.state))
		// FIX-ME: must be recursive freeze
		this.deepFreeze(copy)
		return copy
	}
	deepFreeze(obj) {
		Object.freeze(obj)
		for(const key in obj) {
			if (typeof obj != 'object') this.deepFreeze(obj[key])
		}
	}
}

export class Component {
	getApi() {
		const self = this
		const api = {
			main(action) {
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
			}
		}
		return api
	}

	notifyComponents() {
		for (const name in this.components) {
			const component = this.components[name]
			if (Array.isArray(component)) {
				for (const c of component) c.main()
			} else {
				component.main()
			}
		}
	}
}

/**************
Utility Classes
***************/

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




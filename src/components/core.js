"use strict"

/* 
 a generic function to create 
 a store generator function
 given a store Class as argument

 the store class must have methods
 names to match the action.type
 from the dispatch argument
*/
function storeInit(StoreClass) {
	return function storeInit(opts) {
		const inner = new StoreClass(opts)

		const self = {
			dispatch(action) { console.log(action)
				if (typeof inner[action.type] !== 'function') {
					throw `invalid action type=${action.type}`
				}
				if (inner.async.includes(action.type)) {
					//await inner[action.type](action)
				} else {
					inner[action.type](action)
				}
				const copy = JSON.parse(JSON.stringify(inner.state))
				// FIX-ME: must be recursive freeze
				inner.copy = Object.freeze(copy); console.log(inner.copy)
				inner.app.main(action, inner.copy)
			},
			copy(action) {
				return inner.copy
			}
		}
		if (opts.debug) self.Inner = inner

		// FIX-ME: must be recursive freeze
		return Object.freeze(self)
	}
}

exports.storeInit = storeInit

function componentInit(ComponentClass) {
	return opts => {
		// private properties and methods
		const inner = new ComponentClass(opts)

		// the publicly visible "instance",
		// to be made immutable below
		const self = {
			// update private state and propagate
			// shared state to downstream components
			main(state, data) {
				inner.main(state, data)
				if (inner.components) {
					for (const name in self.components) {
						const component = self.components[name]
						if (Array.isArray(component)) {
							for (const c of component) c.main()
						} else {
							component.main()
						}
					}
				}
				return self
			},

			// provides an immutable copy of the shared
			// state from this component
			state(key = "") {
				const value = key ? inner.state[key] : inner.state
				return typeof value == "object" ? deepCopyFreeze(value) : value
			},

			// must not expose inner.bus directly since that
			// will also expose bus.emit() which should only
			// be triggered by this component
			on(eventType, callback) {
				inner.bus.on(eventType, callback)
				return self
			}
		}

		// only expose inner on debug mode
		if (opts.debug) self.Inner = inner

		// make public instance immutable (read-only + method calls)
		return Object.freeze(self)
	}
}

exports.componentInit = componentInit

function deepCopyFreeze(obj) {
	// FIX-ME: must be recursive
	return Object.freeze(Object.assign({}, obj))
}

/*
	Event bus pattern inspired by vue-bus and d3-dispatch
  
  eventTypes              array of allowed string event type[.name]

  callbacks{}
  .$eventType[.name]:     callback function or [functions]

  defaultArg              the default argument to supply to 
                          dispatcher.call() below
*/
exports.busInit = function(name, eventTypes = [], callbacks = {}, defaultArg = null) {
	const bus = new ComponentBus(name, eventTypes, callbacks, defaultArg)
	return Object.freeze(bus)
}

class ComponentBus {
	constructor(name, eventTypes, callbacks, defaultArg) {
		this.name = name
		this.eventTypes = eventTypes
		this.events = {}
		this.defaultArg = defaultArg
		for (const eventType in callbacks) {
			this.on(eventType, callbacks[eventType])
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

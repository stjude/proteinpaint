"use strict"
/*
	PRX
	- a custom reactive framework for ProteinPaint

	Goals:

	- to enforce an easy-to-follow unidirectional data flow
	  and reactive component design

	- to enforce a uniform coding style using the 
		closured-class-instance pattern
		https://docs.google.com/document/d/19sKaqxHHDg8J7AOn5RT57g9GUUNEQq7Comi4f6AJcmI/edit#

	- promote test-driven development by having a regular-browser-friendly 
	  test framework
	
	- help clean up code architecture
	 
	- make it easier to migrate to other reactive frameworks later, 
	  as needed

	- help onboard other team members and code contributors
	  by using a reactive pattern, which should be familiar
	  to non-pp developers
*/

class Component {
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

class Store {
	copy() {
		const copy = JSON.parse(JSON.stringify(this.state))
		// FIX-ME: must be recursive freeze
		this.copy = Object.freeze(copy)
		return this.copy
	}
}

/* 
	storeInit() 

	a generic function to create 
	a store generator function
	given a store Class as argument

	the store class must have method
	names to match the action.type
	from the dispatch argument
*/
function storeInit(StoreClass) {
	return function storeInit(opts) {
		const inner = new StoreClass(opts)

		const self = {
			async dispatch(action) { console.log(action)
				if (typeof inner[action.type] !== 'function') {
					throw `invalid action type=${action.type}`
				}
				await inner[action.type](action); console.log('test')
				inner.copy()
				inner.app.main(action, inner.copy)
			}
		}
		if (opts.debug) self.Inner = inner

		// FIX-ME: must be recursive freeze
		return Object.freeze(self)
	}
}

exports.storeInit = storeInit


/*
	appInit()

	a generic function to create 
	an app generator function
	given an app Class as argument

	the component class is most often 
	DOM-related, and has:
	- a required main(action, state)
	- an optional components {} object
	- an optional event ".bus" property

*/

function appInit(ComponentClass) {
	return (opts, holder) => {
		// private properties and methods
		const inner = new ComponentClass(opts, holder)

		// the publicly visible "instance",
		// to be made immutable below
		const self = {
			// update private state and propagate
			// shared state to downstream components
			main(action, state) {
				inner.main(action, state)
				return self
			},

			// must not expose inner.bus directly since that
			// will also expose bus.emit() which should only
			// be triggered by this component
			on(eventType, callback) {
				if (inner.bus) inner.bus.on(eventType, callback)
				else console.log('no event bus in ', inner)
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


/*
	componentInit()

	a generic function to create 
	a component generator function
	given a store Class as argument

	the component class is most often 
	DOM-related, and has:
	- a required main(action, state)
	- an optional components {} object
	- an optional event ".bus" property

*/

function componentInit(ComponentClass) {
	return (opts, holder) => {
		// private properties and methods
		const inner = new ComponentClass(opts, holder)

		// the publicly visible "instance",
		// to be made immutable below
		const self = {
			// update private state and propagate
			// shared state to downstream components
			main(action, state) {
				inner.main(action, state)
				return self
			},

			// must not expose inner.bus directly since that
			// will also expose bus.emit() which should only
			// be triggered by this component
			on(eventType, callback) {
				if (inner.bus) inner.bus.on(eventType, callback)
				else console.log('no event bus in ', inner)
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
		} else if (typeof callback == "function") { console.log(callback.name)
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
				if (type == eventType || type.startsWith(eventType + ".")) { console.log(198, type, this.events[type].name)
					this.events[type](arg ? arg : this.defaultArg)
				}
			}
		}, 0)
		return this
	}
}

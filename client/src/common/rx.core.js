/*
*********** Exported ***********
getInitFxn()
getStoreApi()
getAppApi()
getComponentApi()
Bus (class)
notifyComponents()
getComponents()
copyMerge()
fromJson()
toJson()
deepFreeze()
deepEqual()
*********** Internal ***********

Instances, APIs, and callback arguments are documented at:
https://docs.google.com/document/d/1G3LqbtsCEkGw4ABA_VognhjVnUHnsVYAGdXyhYG374M/edit#

*/

/************
 Init Factory
*************/

export function getInitFxn(_Class_) {
	/* return the initiator function to wrap around the _Class_ and return the API

		instanceOpts{}
		- app: required for non-app components

		returns a function that 
		- creates a _Class_ instance
		- optionally attaches a self reference to the api
		- freezes and returns the instance api
	*/
	return (instanceOpts = {}) => {
		/* instantiate mutable private properties and methods

		rx uses following predefined attributes from an app instance
		.type
			required
			TODO explain
		.components{}
			required
		.eventTypes[]
			optional

		.printError()
			optional
			triggered by exception upon dispatching action
		.tip
			optional
			Menu instance
		.dom{}
			optional
			.holder, d3-wrapped dom
		.appInit
			optional
			TODO explain

		*/
		const self = new _Class_(instanceOpts)

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

		const opts = (self.app && self.app.opts) || (self.api && self.api.opts) || self.opts || {}
		// expose the hidden instance to debugging and testing code
		if (opts.debug) api.Inner = self

		// freeze the api's properties and methods before exposing
		Object.freeze(api)

		if (self.eventTypes) {
			// set up an optional event bus
			const callbacks = self.type in instanceOpts ? instanceOpts[self.type].callbacks : instanceOpts.callbacks
			self.bus = new Bus(self.api, self.eventTypes, callbacks)
			self.bus.emit('postInit')
		}
		return api
	}
}

/*
	may apply overrides to instance opts
	if there is an instance.type key in the opts.app
*/
export function getOpts(opts, instance) {
	if (!instance.app) return opts
	if (instance.app.opts[instance.type]) {
		copyMerge(opts, instance.app.opts[instance.type])
		opts.debug = instance.app.debug
	}
	return opts
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
			return await api.copyState()
		},
		async copyState(opts = {}) {
			if (opts.rehydrate) await self.rehydrate()
			const stateCopy = self.fromJson(self.toJson(self.state))
			self.deepFreeze(stateCopy)
			return stateCopy
		}
	}
	return api
}

export function getAppApi(self) {
	if (!('type' in self)) {
		throw `The component's this.type must be set before calling this.getAppApi(this).`
	}

	const middlewares = []

	const api = {
		type: self.type,
		opts: self.opts,
		async dispatch(action) {
			/*
			???
			to-do:
 			track dispatched actions and
 			if there is a pending action (e.g. waiting on server response)
 			debounce dispatch requests
			until the pending action is done?
	 	  ???
 			*/
			try {
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
				if (action) self.state = await self.store.write(action)
				// else an empty action should force components to update

				const data = self.main ? self.main() : null
				const current = { action, appState: self.state }
				await notifyComponents(self.components, current, data)
			} catch (e) {
				if (self.printError) self.printError(e)
				else console.log(e)
			}
			if (self.bus) self.bus.emit('postRender')
		},
		async save(action) {
			// save changes to store, do not notify components
			self.state = await self.store.write(action)
		},
		getState() {
			return self.state
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
		// must not expose this.bus directly since that
		// will also expose bus.emit() which should only
		// be triggered by this component
		on(eventType, callback) {
			if (!self.eventTypes) throw `no eventTypes[] for ${self.type} component`
			self.bus.on(eventType, callback)
			return api
		},
		getComponents(dotSepNames = '') {
			return getComponents(self.components, dotSepNames)
		},
		destroy() {
			for (const key in self.components) {
				const component = self.components[key]
				if (typeof component.destroy == 'function') {
					component.destroy()
				} else if (component.holder) {
					component.holder.selectAll('*').remove()
				}
				delete self.components[key]
			}
			if (typeof self.destroy == 'function') self.destroy()
			if (self.dom) {
				if (self.dom.holder) self.dom.holder.selectAll('*').remove()
				for (const key in self.dom) {
					delete self.dom[key]
				}
			}
			delete self.store
		}
	}

	// expose tooltip if set, expected to be shared in common
	// by all components within an app; should use the HOPI
	// pattern to hide the mutable parts, not checked here
	if (self.tip) api.tip = self.tip
	if (self.opts.debugName) window[self.opts.debugName] = api
	if (self.appInit) api.appInit = self.appInit
	return api
}

export function getComponentApi(self) {
	if (!('type' in self)) {
		throw `The component's type must be set before calling this.getComponentApi(this).`
	}

	const api = {
		type: self.type,
		id: self.id,
		async update(current, data) {
			if (current.action && self.reactsTo && !self.reactsTo(current.action)) return
			const componentState = self.getState ? self.getState(current.appState) : current.appState
			// no new state computed for this component
			if (!componentState) return
			let componentData = null
			// force update if there is no action, or
			// if the current and pending state is not equal
			if (!current.action || !deepEqual(componentState, self.state)) {
				self.state = componentState
				// in some cases, a component may only be a wrapper to child
				// components, in which case it will not have a
				componentData = self.main ? await self.main(data) : null
			}
			// notify children
			await notifyComponents(self.components, current, componentData)
			if (self.bus) self.bus.emit('postRender')
			return api
		},
		async setInnerAttr(data) {
			if (typeof self.setAttr == 'function') {
				await self.setAttr(data)
			}
		},
		// must not expose self.bus directly since that
		// will also expose bus.emit() which should only
		// be triggered by this component
		on(eventType, callback) {
			if (!self.eventTypes) throw `no eventTypes[] for ${self.type} component`
			self.bus.on(eventType, callback)
			return api
		},
		getComponents(dotSepNames = '') {
			return getComponents(self.components, dotSepNames)
		},
		destroy() {
			for (const key in self.components) {
				const component = self.components[key]
				if (typeof component.destroy == 'function') {
					component.destroy()
				} else if (component.holder) {
					component.holder.selectAll('*').remove()
				}
				delete self.components[key]
			}
			if (typeof self.destroy == 'function') self.destroy()
			self.dom.holder.selectAll('*').remove()
			for (const key in self.dom) {
				delete self.dom[key]
			}
		}
	}
	// must not freeze returned api, as getInitFxn() will add api.Inner
	return api
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
	constructor(api, eventTypes, callbacks) {
		/*
			api{} 
			- the immutable api of the app or component
			
			eventTypes[] 
			- the events that this component wants to emit
			- e.g. ['postInit', 'postRender', 'postClick']
			- must not be namespaced
			- later, api.on() can use namespaced eventTypes

			callbacks{}
			- any event listeners to set-up for this component 
			- key: eventType, value: callback

		*/
		this.name = api.type + (api.id === undefined || api.id === null ? '' : '#' + api.id)
		this.eventTypes = eventTypes
		this.events = {}
		this.defaultArg = api
		if (callbacks) {
			for (const eventType in callbacks) {
				this.on(eventType, callbacks[eventType])
			}
		}
	}

	on(eventType, callback, opts = {}) {
		/*
		assign or delete a callback for an event

		eventType
		- must match one of the eventTypes supplied to the Bus constructor
		- maybe be namespaced or not, example: "postRender.test" or "postRender"
		- any previous event-attached callbacks will be REPLACED in this bus 
		  when the same eventType is used as an argument again -- same behavior
		  as a DOM event listener namespacing and replacement

		callback
		- function. if missing will delete the eventType from bus

		opts{}
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
					if (eventType == 'postInit') delete this.events[type]
				}
			}
		}, wait)
		return this
	}

	destroy() {
		for (const key in this.events) {
			delete this.events[key]
		}
	}
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

export async function notifyComponents(components, current, data = null) {
	if (!components) return // allow component-less app
	const called = []

	for (const name in components) {
		// when components is array, name will be index
		const component = components[name]
		if (Array.isArray(component)) {
			for (const c of component) called.push(c.update(current, data))
		} else if (component.hasOwnProperty('update')) {
			called.push(component.update(current, data))
		} else if (component && typeof component == 'object' && !component.main) {
			for (const name in component) {
				if (component.hasOwnProperty(name) && typeof component[name].update == 'function') {
					called.push(component[name].update(current, data))
				}
			}
		}
	}
	return Promise.all(called)
}

// access the api of an indirectly connected component,
// for example to subscribe an .on(event, listener) to
// the event bus of a distant component
export function getComponents(components, dotSepNames) {
	if (!dotSepNames) return Object.assign({}, components)
	// string-based convenient accessor,
	// so instead of
	// app.getComponents().controls.getComponents().search,
	// simply
	// app.getComponents("controls.search")
	const names = dotSepNames.split('.')
	let component = components
	while (names.length) {
		let name = names.shift()
		if (Array.isArray(component)) name = Number(name)
		component = !names.length
			? component[name]
			: component[name] && component[name].components
			? component[name].components
			: component[name] && component[name].getComponents
			? component[name].getComponents()
			: component[name]
		if (!component) break
	}
	return component
}

// Store Helpers
// -------------

/*
	base: 
	- either a state object or its JSON-stringified equivalent 
	- will be over-written by second+ argument,
	  similar to native Object.assign() overwrite sequence

	args
	- full or partial state object(s). if base is a string, then
	  the arg object will be converted to/from JSON to
	  create a copy for merging
	- the last argument may be an array of keys to force replacing
	  an object value instead of extending it

	Merging behavior:
	- a base value that is an array or non-object will be replaced by matching arg key-value
	- a base value that is an object will be extended by a matching arg key-value
	- nested base object values will be extended recursively, instead of being swapped/replaced
	  at the root level
	- see core.spec test for copyMerge details
*/
export function copyMerge(base, ...args) {
	const replaceKeyVals = []
	if (Array.isArray(args[args.length - 1])) {
		replaceKeyVals.push(...args.pop())
	}
	const target = typeof base == 'string' ? fromJson(base) : base
	for (const arg of args) {
		if (arg) {
			const source = typeof base == 'string' ? fromJson(toJson(arg)) : arg
			for (const key in source) {
				if (
					!target[key] ||
					Array.isArray(target[key]) ||
					typeof target[key] !== 'object' ||
					replaceKeyVals.includes(key)
				)
					target[key] = source[key]
				else copyMerge(target[key], source[key], replaceKeyVals)
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
	//
	// also, do not use this when autogenerated IDs
	// need to be attached to list entries
	//
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
		if (typeof obj == 'object') deepFreeze(obj[key])
	}
}

// Match Helpers
// -----------

export function deepEqual(x, y) {
	if (x === y) {
		return true
	} else if (typeof x == 'object' && x != null && typeof y == 'object' && y != null) {
		if (Object.keys(x).length != Object.keys(y).length) {
			return false
		}

		for (var prop in x) {
			if (y.hasOwnProperty(prop)) {
				if (!deepEqual(x[prop], y[prop])) return false
			} else {
				return false
			}
		}
		return true
	} else return false
}

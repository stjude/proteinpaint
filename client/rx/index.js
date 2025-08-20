import { deepEqual, deepFreeze, notifyComponents } from './src/utils.ts'
export { deepEqual, deepFreeze } from './src/utils.ts'
export { Bus } from './src/Bus.ts'

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

/* 
	getInitFxn()
	- returns a _Class_ initiator function that
		- creates a _Class_ instance
		- optionally attaches an api.Inner reference to the instance for debugging
		- optionally creates an instance.bus property if there is an instance.eventTypes property
		- freezes and returns an immutable instance API

	Design goal: 
	- to protect _Class_ instance properties from being changed arbitrarily 
	  by any code that has a reference to it
	- Flexibility to use the generated instance outside of the rx framework/notification flow,
		with or without an coordinating "app"
*/
export function getInitFxn(_Class_) {
	/*
		opts
		- the argument to the _Class_ constructor
	*/
	return opts => {
		// create a _Class_ instance with mutable private properties and methods
		const self = new _Class_(opts)

		if (!self.api && self.type) {
			if (self.type == 'app') prepApp(self, opts)
			else if (self.type == 'store') prepStore(self, opts)
			else prepComponent(self, opts)
		}

		// get the instance's api that may hide its mutable props and methods
		// - if there is already an instance api as constructed, use it
		// - if not, expose the mutable instance as its public api
		const api = self.api || self
		// optionally expose the hidden instance to debugging and testing code
		if (self.debug || (self.opts && self.opts.debug)) api.Inner = self
		// an instance may want to add or modify api properties before it is frozen
		if (typeof self.preApiFreeze == 'function') self.preApiFreeze(api)
		// freeze the api's properties and methods before exposing
		Object.freeze(api)

		// the optional instance.init() is expected to be an async function,
		// which is not compatible within a constructor() function,
		// so call it here if it is available as an instance method
		if (self.init) {
			// return a Promise thar resolves to the instance API;
			// the parent component must use the await keyword
			// when using this initializer to get the instance's API
			return self
				.init()
				.then(() => {
					if (self.bus) self.bus.emit('postInit')
					return api
				})
				.catch(e => {
					if (self.printError) self.printError(e)
					if (self.bus) self.bus.emit('postInit', null, 0, e)
					else throw e
				})
		} else {
			if (self.bus) self.bus.emit('postInit')
			// return the instance API; the parent component that uses this initializer
			// does NOT have to use the await keyword
			return api
		}
	}
}

export function getAppInit(_Class_) {
	return getInitPrepFxn(_Class_, prepApp)
}

export function getStoreInit(_Class_) {
	return getInitPrepFxn(_Class_, prepStore)
}

export function getCompInit(_Class_) {
	return getInitPrepFxn(_Class_, prepComponent)
}

function getInitPrepFxn(_Class_, prepFxn) {
	if (typeof prepFxn != 'function') throw 'prepFxn must be a function'

	/*
		opts
		- the argument to the _Class_ constructor
	*/
	return async opts => {
		let self
		try {
			if (opts.app?.opts && 'debug' in opts.app.opts && !('debug' in opts) && opts != opts.app.opts) {
				// propagate debugmode from app.opts, if not set directly on the current opts object
				opts.debug = opts.app.opts.debug
			}
			// create a _Class_ instance with mutable private properties and methods
			self = new _Class_(opts)
			prepFxn(self, opts)

			// get the instance's api that may hide its mutable props and methods
			// - if there is already an instance api as constructed, use it
			// - if not, expose the instance as its public api
			const api = self.api || self
			// optionally expose the hidden instance to debugging and testing code
			if (self.debug || (self.opts && self.opts.debug)) api.Inner = self
			// an instance may want to add or modify api properties before it is frozen
			if (self.preApiFreeze) await self.preApiFreeze(api)
			// freeze the api's properties and methods before exposing
			Object.freeze(api)

			// instance.init() can be an async function
			// which is not compatible within a constructor() function,
			// so call it here if it is available as an instance method
			if (self.init) {
				if (self.app && self.app != self) await self.init(self.app.getState())
				else await self.init()

				// lessen confusing behavior
				if (self.type != 'app' && self.type != 'store' && self.state && !self.hasStatePreMain) {
					delete self.state
					console.warn(
						`${self.type}: rx deleted this.state after init()` +
							`to avoid confusing behavior, such as the component not rendering initially ` +
							`because this.state would not have changed between init() and the first time ` +
							`main() is called. To skip this warning and retain this.state after init(), ` +
							`set this.hasStatePreMain = true in the ${self.type} constructor.`
					)
				}
			}
			if (self.bus) self.bus.emit('postInit')
			return api
		} catch (error) {
			console.log('error:', error)
			if (self?.bus) self.bus.emit('postInit', null, 0, error)
			if (!self?.printError) throw error
		}
	}
}

/*
	may apply overrides to instance opts
	if there is an instance.type key in app.opts
*/
export function getOpts(_opts, instance) {
	const opts = Object.assign({}, instance.opts || {}, _opts)
	if (!instance.app) return opts
	if (instance.type in instance.app.opts) {
		/*
			Always override opts with any app.opts that is available
			for the instance's component type, supplied as an appInit() argument.

			TODO: May want the ability to NOT override an existing key-value
			in opts, only apply app.opts[instance.type] override for key-values
			that are not in opts. Need to see an actual use case before working on this.
		*/
		const overrides = instance.app.opts[instance.type]
		if (instance.validateOpts) instance.validateOpts(overrides)
		copyMerge(opts, overrides)
	}
	if ('debug' in instance.app) opts.debug = instance.app.debug
	else if (instance.app.opts && 'debug' in instance.app.opts) opts.debug = instance.app.opts.debug
	return opts
}

/*
	Parallelize the potentially async initialization of multiple components

	initPromises{}
	- keys: component names
	- values: Promise
*/
export async function multiInit(initPromises) {
	const components = {}
	try {
		await Promise.all(Object.values(initPromises))
		for (const name in initPromises) {
			components[name] = await initPromises[name]
		}
		return components
	} catch (e) {
		throw e
	}
}

/****************
  API Generators
*****************/

export function prepStore(self, opts) {
	if (self.validateOpts) self.validateOpts(opts)
	self.app = opts.app
	self.opts = getOpts(opts, self)
	self.api = getStoreApi(self)
	self.copyMerge = copyMerge
	self.deepFreeze = deepFreeze
	// see comments on when not to reuse rx.fromJson, rx.toJson
	if (!self.fromJson) self.fromJson = fromJson // used in store.api.copyState()
	if (!self.toJson) self.toJson = toJson // used in store.api.copyState()
	self.state = copyMerge(self.toJson(self.defaultState), opts.state)
	if (self.validateState) self.validateState()
}

// the action.sequenceId can be used by a chart/app
// to identify the state that corresponds to an async step
// like a server data request, so that a really late-arriving data
// can be rejected if the state that was associated with that requested
// is already stale/superseded by a subsequent state update
let sequenceId = 0

/*
type RxAction = {
  type: string          // one of the methods in [StoreClass].prototype.actions, for example see mass/store.js
  id?: string           // a component identifier to help with routing the dispatched action
  [key=string]: any     // the payload, depends on the action.type, can make this action into a union

  _notificationRoot_?: RxComponentApi[]  
												// may be used to directly notify specific components that are known to be affected by an action,
    										// this will cause the dispatch notification to skip all components above or outside the 
    										// _notificationRoot_, !!! use only rarely when absolutely sure of excluding other components !!!

  _scope_?: 'none' | 'local' | 'global'
  											// indicates where this action should be tracked by a history tracker such as a recover component
                        // NOTE: may be deprecated(???) in favor of ._notificationRoot_
}
*/

export function getStoreApi(self) {
	self.history = []
	self.currIndex = -1
	let numPromisedWrites = 0
	const api = {
		// action: RxAction
		async write(action) {
			// to allow an app or chart code to fail due to race condition,
			// hardcode a constant value or comment out the ++ for the sequenceID
			// !!! CRITICAL TO INCREMENT THIS !!!
			action.sequenceId = sequenceId++
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
			// quick fix?? add custom state properties to the state to trigger special action-related handling
			// _scope_:
			self.state._scope_ = action._scope_
			if (!self.opts.debounceInterval) return api.copyState()

			// track the #
			numPromisedWrites += 1
			let decrement = -1
			return new Promise((resolve, reject) => {
				const interval = setInterval(() => {
					numPromisedWrites += decrement
					decrement = 0
					if (numPromisedWrites > 0) return
					clearInterval(interval)
					resolve(api.copyState())
				}, self.opts.debounceInterval)
			})
		},
		async copyState() {
			const stateCopy = self.fromJson(self.toJson(self.state))
			self.deepFreeze(stateCopy)
			return stateCopy
		}
	}
	return api
}

export function prepApp(self, opts) {
	try {
		if (self.validateOpts) self.validateOpts(opts)
		if ('id' in opts) self.id = opts[self.type].id
		self.opts = opts
		self.api = getAppApi(self)
	} catch (e) {
		console.error(e)
		if (self.printError) self.printError(e)
		else alert(e)
	}
}

export function getAppApi(self) {
	// optional registry for component instances
	const componentsByType = {}
	const middlewares = []
	let numExpectedWrites = 0
	let latestActionSequenceId
	const api = {
		type: self.type,
		opts: self.opts,
		// action: RxAction
		async dispatch(action) {
			self.bus.emit('preDispatch')
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

				// expect store.write() to be debounced and handle rapid succession of dispatches
				// replace app.state if there is an action
				if (action) self.state = await self.store.write(action)
				latestActionSequenceId = action?.sequenceId
				// TODO: may need to group calls to self.main by action type and plot.id,
				// in order to debounce correctly
				if (self.main) await self.main()
				const current = { action, appState: self.state }
				await notifyComponents(current.action?._notificationRoot_ || self.components, current)
			} catch (e) {
				if (self.wasDestroyed) return
				if (self.bus && latestActionSequenceId == action?.sequenceId) self.bus.emit('error')
				if (self.printError) self.printError(e)
				else console.log(e)
			}
			// do not emit a postRender event if the action has become stale
			if (self.bus && latestActionSequenceId == action?.sequenceId) self.bus.emit('postRender')
		},
		// action: RxAction
		async save(action) {
			// save changes to store, do not notify components
			self.state = await self.store.write(action)
			// TODO: may generalize to use the key instead of hardcoding to only .recover
			if (componentsByType.recover) {
				for (const id in componentsByType.recover) {
					const api = componentsByType.recover[id]
					// note: store.write() returns a frozen state, so safe to pass as argument
					api.replaceLastState(self.state)
				}
			}
		},
		getState() {
			return self.state
		},
		// fxn: RxAction => void
		middle(fxn) {
			/*
			add middlewares prior to calling dispatch()
			
			fxn(action: RxAction) 
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
		register(api) {
			if (!componentsByType[api.type]) componentsByType[api.type] = {}
			componentsByType[api.type][api.id] = api
		},
		deregister(api) {
			if (componentsByType[api.type]?.[api.id]) delete componentsByType[api.type][api.id]
		},
		triggerAbort(reason = '') {
			if (reason) if (reason) console.info(`triggerAbort()`, reason)
			for (const name of Object.keys(self.components)) {
				const component = self.components[name]
				if (!component) continue
				if (Array.isArray(component)) {
					for (const c of component) c.triggerAbort()
				} else if (component.hasOwnProperty('triggerAbort')) {
					component.triggerAbort()
				} else if (component && typeof component == 'object' && !component.main) {
					for (const subname of Object.keys(component)) {
						if (typeof component[subname].triggerAbort == 'function') {
							component[subname].triggerAbort()
						}
					}
				}
			}
		},
		destroy() {
			// delete references to other objects to make it easier
			// for automatic garbage collection to find unreferenced objects
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
			if (self.bus) self.bus.destroy()
			delete self.store
			if (self.api) delete self.api
			self.wasDestroyed = true
		}
	}

	// expose tooltip if set, expected to be shared in common
	// by all components within an app; should use the HOPI
	// pattern to hide the mutable parts, not checked here
	if (self.opts.debugName) window[self.opts.debugName] = api
	if (!self.bus) {
		if (!self.eventTypes) self.eventTypes = ['preDispatch', 'postInit', 'postRender', 'firstRender', 'error']
		if (self.customEvents) self.eventTypes.push(...self.customEvents)
		// set up a required event bus
		const callbacks = (self.opts.app && self.opts.app.callbacks) || self.opts.callbacks || {}
		self.bus = new Bus(api, self.eventTypes, callbacks)
	}
	return api
}

export function prepComponent(self, opts) {
	if (!opts.app) throw `missing self.opts.app in prepComponent(${self.type})`
	self.app = opts.app
	self.opts = getOpts(opts, self)
	if (self.validateOpts) self.validateOpts(opts)
	// the component type + id may be used later to
	// simplify getting its state from the store
	if ('id' in opts) self.id = self.opts.id
	self.api = getComponentApi(self)
}

export function getComponentApi(self) {
	if (!('type' in self)) {
		throw `The component's type must be set before calling this.getComponentApi(this).`
	}

	// track abortController instances to optionally cancel active async steps,
	// for example to cancel matrix data requests when the view is closed
	const abortControllers = new Set()

	// remember the action.sequenceId that caused the last state change
	let latestActionSequenceId

	const api = {
		type: self.type,
		id: self.id,
		// current: {action: RxAction, appState}
		async update(current) {
			if (current.action && self.reactsTo && !self.reactsTo(current.action)) return
			const componentState = self.getState ? self.getState(current.appState) : current.appState
			// no new state computed for this component
			if (!componentState) return
			// force update if there is no action, or
			// if the current and pending state is not equal
			if (!current.action || !deepEqual(componentState, self.state)) {
				if (current.action) latestActionSequenceId = current.action.sequenceId
				if (self.mainArg == 'state') {
					// some components may require passing state to its .main() method,
					// for example when extending a simple object class into an rx-component
					await self.main(componentState)
				} else {
					self.state = componentState
					if (self.main) {
						try {
							await self.main()
						} catch (e) {
							if (self.bus) self.bus.emit('error')
							throw e
						}
					}
				}
			}
			try {
				// notify children
				await notifyComponents(self.components, current)
				if (self.bus && (!current.action || current.action.sequenceId === latestActionSequenceId))
					self.bus.emit('postRender')
				return api
			} catch (e) {
				if (self.printError) self.printError(e)
				else if (self.dom?.errdiv) throw { message: e.message || e.error || e, errdiv: self.dom?.errdiv }
				else throw e
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
		//
		// When an async function takes a while to resolve, such as for server requests,
		// a subsequent action may trigger another request before the first one resolves,
		// in that case should ignore the stale response/result from the async function.
		// This is an api function so that code that has access to this component api
		// can also tie-in a function call to the fresheness of the component action.
		//
		async detectStale(asyncFxn, opts = {}) {
			let errMsg = ''
			try {
				const actionSequenceId = latestActionSequenceId
				const promises = []
				let i, promResolve
				if (opts.abortCtrl) {
					abortControllers.add(opts.abortCtrl)
					promises.push(
						new Promise((resolve, reject) => {
							promResolve = resolve
							i = setInterval(() => {
								if (actionSequenceId !== latestActionSequenceId) {
									clearInterval(i)
									try {
										opts.abortCtrl.abort()
										throw `stale sequenceId`
									} catch (e) {
										reject(e)
									}
								}
							}, opts.wait || 100)
						})
					)
				}
				promises.push(asyncFxn())
				// the setInterval does not resolve, so Promise.race can only be "won" by the asyncFxn() result,
				// but the race can be aborted by the reject() inside the setInterval
				const result = await Promise.race(promises)
				if (i) clearInterval(i)
				if (promResolve) promResolve()
				if (opts.abortCtrl && abortControllers.has(opts.abortCtrl)) abortControllers.delete(opts.abortCtrl)
				if (latestActionSequenceId !== actionSequenceId) {
					// another state change has been dispatched between the start and completion of the server request
					console.warn('aborted state update, the returned data corresponds to a stale action.sequenceId')
					if (opts.abortCtrl) opts.abortCtrl.abort()
					return [result, true]
				}
				return [result]
			} catch (e) {
				if (typeof e == 'string' && e.includes('sequenceId')) console.warn(e)
				throw e
			}
		},
		triggerAbort(reason = '') {
			if (reason) console.info(`triggerAbort()`, reason)
			for (const c of abortControllers.values()) {
				try {
					c.abort()
					abortControllers.delete(c)
				} catch (e) {
					// ok to
					console.warn('unable to cancel fetch: ', e)
					abortControllers.delete(c)
				}
			}
			if (!self.components) return
			for (const name of Object.keys(self.components)) {
				const component = self.components[name]
				if (Array.isArray(component)) {
					for (const c of component) c.triggerAbort()
				} else if (component.hasOwnProperty('triggerAbort')) {
					component.triggerAbort()
				} else if (component && typeof component == 'object' && !component.main) {
					for (const subname of Object.keys(component)) {
						if (typeof component[subname].triggerAbort == 'function') {
							component[subname].triggerAbort()
						}
					}
				}
			}
		},
		destroy() {
			// delete references to other objects to make it easier
			// for automatic garbage collection to find unreferenced objects
			self.app.deregister(self.api)
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
					if (typeof self.dom[key]?.remove == 'function') self.dom[key].remove()
					delete self.dom[key]
				}
			}
			if (self.bus) self.bus.destroy()
			if (self.api) delete self.api
		}
	}

	if (!self.bus) {
		if (!self.eventTypes) self.eventTypes = ['postInit', 'postRender', 'postPrintError', 'firstRender', 'error']
		if (self.customEvents) self.eventTypes.push(...self.customEvents)
		// set up a required event bus
		self.bus = new Bus(api, self.eventTypes, (self.opts && self.opts.callbacks) || {})
	}

	// must not freeze returned api, as getInitFxn() will add api.Inner
	return api
}

/**************
Utility Classes
***************/

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
	  to what rx method
	
	- it is not susceptible to any class prototype edits
	  that may affect all instances that inherits from 
	  the edited class

	- avoids conceptual association of classical
	  inheritance using the "extends" keyword
*/

// Component Helpers
// -----------------

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

		if (!names.length) component = component[name]
		else if (component[name] && component[name].components) component = component[name].components
		else if (component[name] && component[name].getComponents) component = component[name].getComponents()
		else component = component[name]
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
	  at the root level *** EXCEPT IF there is an isAtomic flag on one of these ****
	  - the source
	  - target object
	  - target child object
	- see index.spec test for copyMerge details
*/
export function copyMerge(base, ...args) {
	const target = typeof base == 'string' ? fromJson(base) : base
	for (const arg of args) {
		if (arg) {
			const source = typeof base == 'string' ? fromJson(toJson(arg)) : arg
			for (const key in source) {
				if (
					!target[key] ||
					Array.isArray(target[key]) ||
					typeof target[key] !== 'object' ||
					source === null ||
					source === undefined ||
					source.isAtomic ||
					target?.isAtomic ||
					target[key]?.isAtomic
				)
					target[key] = source[key]
				else copyMerge(target[key], source[key])
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

export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

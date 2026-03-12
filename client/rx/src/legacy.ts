// !!! TODO: migrate all rx code to strictly-defined typescript and
// to use classes (with private #Inner) instead of closures !!!
import { copyMerge } from './utils.ts'
import { AppApi } from './AppApi.ts'
import { StoreApi } from './StoreApi.ts'
import { ComponentApi } from './ComponentApi.ts'

/*
*********** Exported ***********
getInitFxn()
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
// deprecated: use <AppApi | StoreApi | ComponentApi>.getInitFxn
export function getInitFxn(_Class_) {
	/*
		opts
		- the argument to the _Class_ constructor
	*/
	return opts => {
		// create a _Class_ instance with mutable private properties and methods
		const self = new _Class_(opts)

		if (!self.api && self.type) {
			if (self.type == 'app') throw `use AppApi.getInitFxn() instead of getInitFxn()`
			else if (self.type == 'store') throw `use StoreApi.getInitFxn() instead of getInitFxn()`
			else {
				if (_Class_.type) throw `use ComponentApi.getInitFxn() instead of getInitFxn()`
				prepComponent(self, opts)
			}
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

// should use AppApi.getInitFxn() directly
export function getAppInit(_Class_) {
	if (_Class_.type) return AppApi.getInitFxn(_Class_)
	throw `A rx app class must declare a static type='app'.`
}

export function getStoreInit(_Class_) {
	if (_Class_.type) return StoreApi.getInitFxn(_Class_)
	throw `A rx store class must declare a static type='store'.`
}

export function getCompInit(_Class_) {
	if (_Class_.type) return ComponentApi.getInitFxn(_Class_)
	console.trace(115, _Class_)
	throw `A rx component class must declare a static type.`
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
	await Promise.all(Object.values(initPromises))
	for (const name in initPromises) {
		components[name] = await initPromises[name]
	}
	return components
}

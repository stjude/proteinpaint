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
		if (!self.opts) self.opts = opts
		if (self.bus) self.bus.emit('postInit')
		if (!self.api) return Object.freeze(self)

		if (self.init) throw `legacy getInitFxn() does not accept a class with an init() method`
		if (self.debug || self.opts?.debug) self.api.Inner = self
		// return the instance API; the parent component that uses this initializer
		// does NOT have to use the await keyword
		return Object.freeze(self.api)
	}
}

// should use AppApi.getInitFxn() directly
export function getAppInit(_Class_) {
	if (_Class_.type) return AppApi.getInitFxn(_Class_)
	throw `A rx app class must declare a static type='app'.`
}

// should use StoreApi.getInitFxn() directly
export function getStoreInit(_Class_) {
	if (_Class_.type) return StoreApi.getInitFxn(_Class_)
	throw `A rx store class must declare a static type='store'.`
}

// should use ComponentApi.getInitFxn() directly
export function getCompInit(_Class_) {
	if (_Class_.type) return ComponentApi.getInitFxn(_Class_)
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

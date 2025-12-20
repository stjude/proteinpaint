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

// x, y: objects to compare
// matched: a tracker for x nested object values that's already been inspected
//          and found to match the corresponding value in y. This is useful when
//          using deepEqual() in deepCopyFreeze(), since it returns early when
//          some value does not match, but there may have been other nested objects
//          that have already been matched that do not need to be inspected again.
//
// NOTE: The 2nd argument will be frozen if added to the optional matched argument.
//       May improve the matched argument later into an opts{} argument, as needed.
export function deepEqual(x, y, matched?: WeakMap<any, WeakSet<any>> | Map<any, WeakSet<any>>) {
	if (x === y) {
		return true
	} else if (typeof x == 'object' && x != null && typeof y == 'object' && y != null) {
		if (matched?.get(x)?.has(y)) return true
		const xEntries = Object.entries(x)
		const yKeys = Object.keys(y)
		if (xEntries.length != yKeys.length) return false
		// an empty object and empty array should not equal each other
		if (!xEntries.length && x.constructor.name !== y.constructor.name) return false
		// not using for..in loop, in order to not descend into inherited props/methods
		for (const [key, val] of xEntries) {
			if (!yKeys.includes(key)) return false
			if (!deepEqual(val, y[key], matched)) return false
		}
		if (matched) {
			Object.freeze(y)
			if (!matched.has(x)) matched.set(x, new WeakSet())
			matched.get(x)!.add(y)
		}
		return true
	} else return false
}

export function deepFreeze(obj) {
	Object.freeze(obj)
	// not using for..in loop, in order to not descend into inherited props/methods
	for (const value of Object.values(obj)) {
		if (value !== null && typeof value == 'object') deepFreeze(value)
	}
	return obj
}

// a reusable reference to an empty object
const emptyFrozenObj = Object.freeze({})

// input: object to copy
// ref: may reuse another copy that's already frozen, if it already equals the input
// matched: a tracker to supply as 3rd argument to deepEqual(), to track objects
//          that equal the second argument.
export function deepCopyFreeze(
	input,
	ref: any = {},
	matched: WeakMap<any, WeakSet<any>> | Map<any, WeakSet<any>> = new Map()
) {
	// non-objects will be returned as-is
	if (input === null || typeof input != 'object') return input
	if (input.constructor.name !== 'Object' && input.constructor.name !== 'Array') {
		// class instances (non-literal objects) will be returned as-is but frozen
		if (!matched.has(input)) matched.set(input, new WeakSet())
		matched.get(input)!.add(input)
		// !!! TODO: may need to detect embedder-created object instances that become part of state !!!
		// !!! and decide whether it's safe to freeze, or create plain object copy in store.write() !!!
		return deepFreeze(input)
	}
	if (deepEqual(input, ref, matched)) return ref
	const copy = Array.isArray(input) ? [] : {}
	// ref argument may be a non-object (string, number, etc), where
	// ref?.[key] (such as 1['test'] or "abc"['test']) would still work
	// but is not really an intended, valid comparison with an input object
	const _ref = ref === null || typeof ref !== 'object' ? emptyFrozenObj : ref
	// not using for..in loop, in order to not descend into inherited props/methods
	for (const [key, value] of Object.entries(input)) {
		copy[key] = deepCopyFreeze(value, _ref[key], matched)
	}
	return Object.freeze(copy)
}

export async function notifyComponents(components, current) {
	if (!components) return // allow component-less app
	const called: any[] = []

	for (const name of Object.keys(components)) {
		// when components is array, name will be index
		const component = components[name]
		if (Array.isArray(component)) {
			for (const c of component) called.push(c.update(current))
		} else if (typeof component == 'object') {
			if (typeof component.update == 'function') {
				called.push(component.update(current))
			} else if (!component.main) {
				for (const subname of Object.keys(component)) {
					if (typeof component[subname] == 'object' && typeof component[subname]?.update == 'function') {
						called.push(component[subname].update(current))
					}
				}
			}
		}
	}
	return Promise.all(called)
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
		if (!arg) continue
		const source = typeof base == 'string' ? fromJson(toJson(arg)) : arg
		for (const [key, value] of Object.entries(source)) {
			if (
				!target[key] ||
				Array.isArray(target[key]) ||
				typeof target[key] !== 'object' ||
				source === null ||
				source === undefined ||
				source.isAtomic ||
				target?.isAtomic ||
				target[key]?.isAtomic
			) {
				target[key] = value
			} else copyMerge(target[key], value)
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

export function toJson(this: any, obj = null) {
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

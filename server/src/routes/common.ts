// Below are request payload validator functions that are likely to be reused across many server routes.
// Route-specific validators should be coded in server/routes or server/checkers files.

/*
Property names that a plain object inherits from Object.prototype, plus 'prototype'. Used as a request
payload object key, one of these can replace the prototype of the object it is assigned onto (for example
Object.assign(req.query, req.body) with a __proto__ key). Used as a string value, one of these can select
an inherited property when it later indexes an object (for example genomes[req.query.dslabel] returning
Object.prototype for dslabel='__proto__'). findForbiddenName() below rejects both, see setAppMiddlewares().
*/
export const forbiddenNames: ReadonlySet<string> = new Set([
	'__proto__',
	'prototype',
	// constructor, toString, hasOwnProperty, valueOf, isPrototypeOf, propertyIsEnumerable,
	// toLocaleString, __defineGetter__, __defineSetter__, __lookupGetter__, __lookupSetter__
	...Object.getOwnPropertyNames(Object.prototype)
])

/*
Recursively search a request payload for a forbidden name (see forbiddenNames above) used as an object key
or as a whole string value, and return the path to the first match, or '' if none. An explicit stack is
used instead of recursion so that a deeply nested payload cannot overflow the call stack, and a seen set
guards against a cyclic object. Only plain objects and arrays are descended into; a getter is not triggered
since the payload is plain data from JSON.parse or the url query parser. A substring such as 'toString of x'
is allowed, only a value that equals a forbidden name in full is rejected.
*/
export function findForbiddenName(input: any): string {
	const seen = new WeakSet()
	const stack: { node: any; path: string }[] = [{ node: input, path: '' }]
	while (stack.length) {
		const { node, path } = stack.pop() as { node: any; path: string }
		if (typeof node == 'string') {
			if (forbiddenNames.has(node)) return path || '(value)'
			continue
		}
		if (!node || typeof node != 'object') continue
		if (seen.has(node)) continue
		seen.add(node)
		if (Array.isArray(node)) {
			for (let i = 0; i < node.length; i++) stack.push({ node: node[i], path: `${path}[${i}]` })
			continue
		}
		// Object.keys, so that a __proto__ own data property from JSON.parse (which is enumerable) is seen,
		// while the inherited __proto__ accessor of an ordinary object is not
		for (const key of Object.keys(node)) {
			const keyPath = path ? `${path}.${key}` : key
			if (forbiddenNames.has(key)) return keyPath
			stack.push({ node: node[key], path: keyPath })
		}
	}
	return ''
}

export function validBoolean(input, err?: string): boolean {
	// urlJsonDecode(req.query) as called in app.middleware will convert '1' and '0' to a number
	if (input === 1) return true // normalize value to a boolean
	if (input === 0 || input === undefined) return false // normalize value to a boolean
	if (typeof input != 'boolean') throw err || `input must be a boolean`
	return input
}

// may use spread operator (return {...validGenomeDs, otherProp: '...'}) for convenience
// in request payloads that expect both genome and dslabel
export function validGenomeDs(input): { genome: string; dslabel: string } {
	const genome = validGenome(input.genome)
	const dslabel = validDslabel(input.dslabel)
	// TODO: may pass the genomes object as an argument
	return { genome, dslabel }
}

export function validGenome(value): string {
	if (typeof value != 'string' || !value) throw 'genome should be a non-empty string'
	if (!/^[a-zA-Z0-9._-]+$/.test(value)) throw 'invalid genome character'
	return value
}

export function validDslabel(value): string {
	if (typeof value != 'string' || !value) throw 'dslabel should be a non-empty string'
	if (!/^[a-zA-Z0-9._-]+$/.test(value)) throw 'invalid dslabel character'
	return value
}

export function validString(input, err?: string): string {
	if (typeof input != 'string' || !input) throw err || 'input must be a non-empty string'
	return input
}

export function validStringArr(input, err?: string): string[] {
	if (!Array.isArray(input)) throw err || `input must be an array`
	for (const v of input) {
		if (typeof v != 'string' || !v) throw err || `array entry must be a non-empty string`
	}
	return input
}

export function validNumber(input, err?: string): number {
	if (typeof input != 'number') throw err || 'input should be a number'
	return input
}

export function validNumberArr(input, err?: string): number[] {
	if (!Array.isArray(input)) throw err || `input must be an array`
	for (const v of input) {
		if (typeof v != 'number') throw err || `array entry must be a number`
	}
	return input
}

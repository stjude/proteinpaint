import tape from 'tape'
import { encode, decode, UrlJsonRaw, UrlJsonEncoded } from '../urljson.ts'

/*************************
 reusable helper functions
**************************/

function preprocess(params) {
	return Object.fromEntries(params.split('&').map(kv => kv.split('=').map(decodeURIComponent)))
}

// this test may run on nodejs which does not have structuredClone, unlike the browser
const structuredClone = /*window?.structuredClone ||*/ p => JSON.parse(JSON.stringify(p))

/**************
 test sections
***************/

// Test that the original values are recovered with the expected type

tape('string values', test => {
	const params: UrlJsonRaw = { a: 'abc', b: '123', c: '{}', d: '[]', e: 'false', f: 'true', g: 'null', h: 'undefined' }
	const encodedParams = encode(structuredClone(params))
	test.deepEqual(params, decode(preprocess(encodedParams)), 'should correctly encode and decode string values')
	test.end()
})

tape('numeric values', test => {
	const params: UrlJsonRaw = { a: 1, b: 0.99, c: 1e2 }
	const encodedParams = encode(structuredClone(params))
	test.deepEqual(params, decode(preprocess(encodedParams)), 'should correctly encode and decode numeric values')
	test.end()
})

tape('boolean values', test => {
	const params: UrlJsonRaw = { a: true, b: false }
	const encodedParams = encode(structuredClone(params))
	test.deepEqual(params, decode(preprocess(encodedParams)), 'should correctly encode and decode boolean values')
	test.end()
})

tape('empty values', test => {
	const params: UrlJsonRaw = { a: null, b: undefined, c: 0 }
	const encodedParams = encode(structuredClone(params))
	test.deepEqual(
		{ a: null, c: 0 },
		decode(preprocess(encodedParams)),
		'should correctly encode and decode boolean values'
	)
	test.end()
})

tape('array values', test => {
	const params: UrlJsonRaw = { a: ['xyz', 1, 0, true, false, null, 'null', undefined, { b: 5 }] }
	const encodedParams = encode(structuredClone(params))
	// Special handling of undefined value in an array, which JSON.stringify() converts to null
	if (params.a && Array.isArray(params.a)) params.a[params.a.indexOf(undefined)] = null
	test.deepEqual(params, decode(preprocess(encodedParams)), 'should correctly encode and decode array values')
	test.end()
})

tape('object values', test => {
	const params: UrlJsonRaw = { a: {}, b: { 1: 'test', nested: { x: 99 } }, c: ['xyz', true], d: undefined, e: null }
	const encodedParams = encode(structuredClone(params))
	// special handling of undefined value in an object, which JSON.stringify deletes from the object
	for (const key in params) {
		if (params[key] === undefined) delete params[key]
	}
	test.deepEqual(params, decode(preprocess(encodedParams)), 'should correctly encode and decode object values')
	test.end()
})

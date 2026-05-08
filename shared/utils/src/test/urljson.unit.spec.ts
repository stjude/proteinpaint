import tape from 'tape'
import type { UrlJsonRaw } from '../urljson.ts'
import { encode, decode } from '../urljson.ts'

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
tape('simple values', test => {
	const params: UrlJsonRaw = { a: 'abc', b: '', c: 123.4 }
	const encodedParams = encode(params)
	test.equal(encodedParams, 'a=abc&b=&c=123.4', 'should be encoded with no extra characters')
	test.end()
})

tape('string values', test => {
	const params: UrlJsonRaw = {
		a: 'abc',
		b: '123',
		c: '{}',
		d: '[]',
		e: 'false',
		f: 'true',
		g: 'null',
		h: 'undefined',
		i: '"quoted"'
	}
	const encodedParams = encode(structuredClone(params))
	test.deepEqual(params, decode(preprocess(encodedParams)), 'should be correctly encoded and decoded')
	test.end()
})

tape('numeric values', test => {
	const params: UrlJsonRaw = { a: 1, b: 0.99, c: 1e2 }
	const encodedParams = encode(structuredClone(params))
	test.deepEqual(params, decode(preprocess(encodedParams)), 'should be correctly encoded and decoded')
	test.end()
})

tape('boolean values', test => {
	const params: UrlJsonRaw = { a: true, b: false }
	const encodedParams = encode(structuredClone(params))
	test.deepEqual(params, decode(preprocess(encodedParams)), 'should be correctly encoded and decoded')
	test.end()
})

tape('empty values', test => {
	const params: UrlJsonRaw = { a: null, b: undefined, c: 0, d: '' }
	const encodedParams = encode(structuredClone(params))
	test.deepEqual(
		// expect undefined values to be removed by JSON.stringify()
		{ a: null, c: 0, d: '' },
		decode(preprocess(encodedParams)),
		'should be correctly encoded and decoded'
	)
	test.end()
})

tape('array values', test => {
	const params: UrlJsonRaw = { a: ['xyz', 1, 0, true, false, null, 'null', undefined, { b: 5 }] }
	const encodedParams = encode(structuredClone(params))
	// Special handling of undefined value in an array, which JSON.stringify() converts to null
	if (params.a && Array.isArray(params.a)) params.a[params.a.indexOf(undefined)] = null
	test.deepEqual(params, decode(preprocess(encodedParams)), 'should be correctly encoded and decoded')
	test.end()
})

tape('object values', test => {
	const params: UrlJsonRaw = { a: {}, b: { 1: 'test', nested: { x: 99 } }, c: ['xyz', true], d: undefined, e: null }
	const encodedParams = encode(structuredClone(params))
	// special handling of undefined value in an object, which JSON.stringify deletes from the object
	for (const key in params) {
		if (params[key] === undefined) delete params[key]
	}
	test.deepEqual(params, decode(preprocess(encodedParams)), 'should be correctly encoded and decoded')
	test.end()
})

tape('non-string value type safety', test => {
	// This test demonstrates that decode() should handle non-string values gracefully
	// without attempting to call .startsWith() on them
	const query = {
		a: 'test',
		b: 123 as any, // Simulate a numeric value passed as-is
		c: true as any, // Simulate a boolean value passed as-is
		d: null as any, // Simulate a null value passed as-is
		e: ['array'] as any // Simulate an array value passed as-is
	}

	// decode() should not throw an error when processing non-string values
	test.doesNotThrow(() => {
		decode(query)
	}, 'should not throw when value types are not strings')

	test.end()
})

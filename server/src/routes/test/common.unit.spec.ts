import tape from 'tape'
import { findForbiddenName, forbiddenNames } from '../common.ts'

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- routes/common findForbiddenName -***-')
	test.end()
})

tape('forbiddenNames set', test => {
	for (const name of ['__proto__', 'prototype', 'constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
		test.ok(forbiddenNames.has(name), `should include ${name}`)
	}
	test.notOk(forbiddenNames.has('dslabel'), 'should not include an ordinary name')
	test.end()
})

tape('a clean payload', test => {
	test.equal(findForbiddenName({ genome: 'hg38', dslabel: 'TermdbTest', filter: { lst: [] } }), '', 'returns empty')
	test.equal(findForbiddenName({ a: [1, 'two', { b: null }] }), '', 'returns empty for nested arrays and objects')
	test.equal(findForbiddenName('a plain string'), '', 'returns empty for a plain string')
	test.end()
})

tape('a forbidden object key', test => {
	// an object literal { __proto__: ... } sets the prototype rather than an own key, so an own __proto__
	// key can only arise from JSON.parse or defineProperty; test both those realistic sources below
	test.equal(findForbiddenName(JSON.parse('{"__proto__":{"isAdmin":true}}')), '__proto__', 'top-level __proto__ key')
	const withDefined = {}
	Object.defineProperty(withDefined, '__proto__', { value: { isAdmin: true }, enumerable: true })
	test.equal(findForbiddenName(withDefined), '__proto__', 'defined __proto__ own key')
	test.equal(
		findForbiddenName({ filter: { lst: [{ constructor: 1 }] } }),
		'filter.lst[0].constructor',
		'reports the path to a nested constructor key'
	)
	// JSON.parse creates an enumerable own __proto__ data property, which Object.keys sees
	test.equal(findForbiddenName(JSON.parse('{"a":{"__proto__":{"x":1}}}')), 'a.__proto__', 'json-parsed __proto__ key')
	test.end()
})

tape('a forbidden string value', test => {
	test.equal(findForbiddenName({ dslabel: '__proto__' }), 'dslabel', 'reports the path of a __proto__ value')
	test.equal(findForbiddenName({ genome: 'constructor' }), 'genome', 'reports the path of a constructor value')
	test.equal(findForbiddenName({ a: ['ok', 'toString'] }), 'a[1]', 'reports the array index of a toString value')
	test.equal(findForbiddenName('hasOwnProperty'), '(value)', 'reports a bare forbidden string value')
	test.end()
})

tape('similar but allowed values', test => {
	test.equal(findForbiddenName({ a: 'toString of the gene' }), '', 'allows a forbidden name as a substring')
	test.equal(findForbiddenName({ a: '__proto__x' }), '', 'allows a value that only starts with a forbidden name')
	test.equal(findForbiddenName({ a: 'Constructor' }), '', 'is case-sensitive')
	test.end()
})

tape('deep and cyclic payloads', test => {
	let deep: any = 'toString'
	for (let i = 0; i < 10000; i++) deep = { nested: deep }
	test.ok(findForbiddenName(deep).endsWith('.nested'), 'does not overflow the stack on a deep payload')

	const cyclic: any = { a: 1 }
	cyclic.self = cyclic
	test.equal(findForbiddenName(cyclic), '', 'returns for a cyclic object without a forbidden name')
	test.end()
})

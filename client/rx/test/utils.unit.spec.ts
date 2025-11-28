import tape from 'tape'
import { copyMerge, deepFreeze, deepCopyFreeze } from '../src/utils.ts'

tape('copyMerge()', test => {
	const target = {
		setting: {
			color: 'red'
		},
		arr: ['x', 'y', 'z'],
		keyNotInSource: 'test'
	}
	const source = {
		name: 'name',
		setting: {
			color: 'blue',
			height: 100
		},
		arr: ['a', 'b']
	}
	const obj = copyMerge(target, source)
	test.true('keyNotInSource' in obj, 'should keep target object key-values when the key is not in the source object')
	test.deepEqual(
		Object.keys(obj),
		['setting', 'arr', 'keyNotInSource', 'name'],
		'should extend the target object with new keys from the source object'
	)
	test.deepEqual(obj.setting, source.setting, 'should merge source nested key-values to target object')
	test.deepEqual(obj.arr, source.arr, 'should replace a target array value with the corresponding source array value')

	const target1 = {
		settings: {
			color: 'red'
		}
	}
	const source1 = { settings: { a: 1 }, isAtomic: true }
	test.deepEqual(
		copyMerge(target1, source1).settings,
		source1.settings,
		'should replace a target object value instead of extending it, if there is an isAtomic property in either the source or target object'
	)

	const a = { b: 1, c: { x: 'test', y: [0, 1], z: { r: 2 }, g: { isAtomic: true, h: 'nested' } } }
	const b = { b: 2, c: { z: { x: 2 }, y: [4], g: { isAtomic: true, i: 'new prop' } } }
	test.deepEqual(
		copyMerge(a, b),
		{ b: 2, c: { x: 'test', y: [4], z: { r: 2, x: 2 }, g: { isAtomic: true, i: 'new prop' } } },
		`gives the expected copyMerged results`
	)

	test.end()
})

tape('deepFreeze()', test => {
	const a = deepFreeze({ b: 1, c: { x: 'test', y: [0, 1], z: { r: 2 }, g: { h: 'nested' } } })
	const b = { c: { g: { i: 'new prop' } } }
	const message = 'should not allow any edits to a deep frozen object'
	try {
		copyMerge(a, b)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}
	test.end()
})

tape('deepCopyFreeze()', test => {
	class Abc {}
	const objFromClass = new Abc()
	const orig = { b: 1, c: { x: 'test', y: [0, 1], z: { r: 2 }, g: { h: 'nested' }, objFromClass } }
	const copy = deepCopyFreeze(orig)
	test.notEqual(orig, copy, `should not return the original literal object as a copy`)
	test.equal(orig.c.objFromClass, objFromClass, `should return an original class instance as a copy`)
	test.deepEqual(orig, copy, `should produce a matching copy`)

	const b = { c: { g: { i: 'new prop' } } }
	const message = 'should not allow any edits to a deep frozen copy'
	try {
		copyMerge(copy, b)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}
	test.end()
})

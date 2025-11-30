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
	const abc = new Abc()
	const abc2 = new Abc()
	const filter = { join: '', lst: [{ tvs: { values: [] } }, { lst: [{ tvs: { values: [] } }] }] }
	const orig = { filter, b: 1, c: { x: 'test', y: [0, 1, abc2], z: { r: 2 }, g: { h: 'nested' }, abc } }
	const copy = deepCopyFreeze(orig)
	test.notEqual(orig, copy, `should not return the original literal object as a copy`)
	test.equal(orig.c.abc, abc, `should return an original class instance as a copy`)
	test.deepEqual(orig, copy, `should produce a matching fully nested copy`)

	const message = 'should not allow any edits to a deep frozen copy'
	try {
		copyMerge(copy, { c: { g: { i: 'new prop' } } })
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}

	orig.c.g.h = 'edited'
	const matched = new Set()
	const reused = new Set()
	const copy2 = deepCopyFreeze(orig, copy, matched, reused)
	test.equal(matched.size, 13, `should have 13 matched objects`)
	// some of the reused objects may have the other matched objects nested in it,
	// so the total reused objects would be less than the number of matched objects
	test.equal(reused.size, 4, `should have 4 reused frozen objects`)
	test.deepEqual(copy2.c.y, copy.c.y, `should reuse the frozen nested y[] entries`)
	test.equal(copy2.c.y[2], copy.c.y[2], `should reuse the frozen nested y[] non-literal object entries`)
	test.equal(copy2.c.z, copy.c.z, `should reuse the frozen nested z object as-is`)

	{
		;(orig as any).nonUniqueAbc = abc
		//;(orig as any).nonUniqueAbc2 = abc; console.log(91, Object.keys(orig))
		const message = 'should throw on finding non-unique object references within the input object'
		try {
			deepCopyFreeze(orig, copy)
			test.fail(message)
		} catch (e) {
			console.info(e)
			test.pass(message)
		}
	}

	{
		const clone = structuredClone(orig)
		clone.c.y[2] = abc2 // manually enforce the expected reuse of a class instance, here and below,
		clone.c.abc = abc // since structuredClone will create fresh copies of all objects
		deepFreeze(clone)
		const frozenCopy = deepCopyFreeze(orig, clone)
		test.equal(clone, frozenCopy, `should reuse a frozen clone in full`)

		// Simulate a filter edit that empties a nested filterUiRoot array, where a previous coding bug
		// resulted in the incorrect matching of the cohortFilter.lst[0] entry against the filterUiRoot.lst.
		// This test makes sure the same bug is not reintroduced.
		orig.filter.lst[1].lst?.pop()
		const frozenCopy2 = deepCopyFreeze(orig, frozenCopy)
		test.deepEqual(frozenCopy2, orig, `should reuse a frozen reference clone's properties that have not changed`)
	}

	test.end()
})

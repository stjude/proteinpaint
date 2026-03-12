import tape from 'tape'
import { SingleCellCellTypeBase } from '../singleCellCellType.ts'
import { TermTypes } from '#shared/terms.js'

/*************************
 reusable helper functions
**************************/

function getValidRawTerm(overrides: any = {}) {
	return {
		type: TermTypes.SINGLECELL_CELLTYPE,
		sample: { sID: 'S1', eID: 'E1' },
		plot: 'My plot',
		...overrides
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- tw/singleCellCellType -***-')
	test.end()
})

tape('validate() should throw on invalid terms', test => {
	test.throws(
		() => SingleCellCellTypeBase.validate(null as any),
		/term is not an object/,
		'Should throw when term is not an object'
	)

	test.throws(
		() => SingleCellCellTypeBase.validate({ type: 'categorical' } as any),
		/incorrect term.type='categorical'/,
		'Should throw when term.type is incorrect'
	)

	test.doesNotThrow(
		() => SingleCellCellTypeBase.validate(getValidRawTerm() as any),
		'Should accept valid singleCellCellType term'
	)

	test.end()
})

tape('fill() should add default groupsetting and values when missing', test => {
	const term = getValidRawTerm({ groupsetting: undefined, values: undefined })
	SingleCellCellTypeBase.fill(term as any)

	test.deepEqual(term.groupsetting, { disabled: false }, 'Should set default groupsetting')
	test.deepEqual(term.values, {}, 'Should set default values object')
	test.end()
})

tape('fill() should preserve existing groupsetting and values', test => {
	const term = getValidRawTerm({
		groupsetting: { disabled: true, lst: [{ name: 'g1', groups: [] }] },
		values: { A: { key: 'A', label: 'A' } }
	})
	SingleCellCellTypeBase.fill(term as any)

	test.equal(term.groupsetting.disabled, true, 'Should preserve existing groupsetting.disabled')
	test.deepEqual(term.values, { A: { key: 'A', label: 'A' } }, 'Should preserve existing values')
	test.end()
})

tape('fill() should no-op for class instances', test => {
	const instance = new SingleCellCellTypeBase(getValidRawTerm() as any)
	test.doesNotThrow(
		() => SingleCellCellTypeBase.fill(instance as any),
		'Should not throw when fill is called on instance'
	)
	test.end()
})

tape('constructor should set explicit term fields', test => {
	const term = getValidRawTerm({
		groupsetting: { disabled: true },
		values: { B: { key: 'B', label: 'B' } }
	})
	const x = new SingleCellCellTypeBase(term as any)

	test.equal(x.type, TermTypes.SINGLECELL_CELLTYPE, 'Should set type')
	test.deepEqual(x.sample, { sID: 'S1', eID: 'E1' }, 'Should set sample')
	test.equal(x.plot, 'My plot', 'Should set plot')
	test.deepEqual(x.groupsetting, { disabled: true }, 'Should preserve provided groupsetting')
	test.deepEqual(x.values, { B: { key: 'B', label: 'B' } }, 'Should preserve provided values')
	test.end()
})

tape('constructor should fallback to default fields when optional fields missing', test => {
	const term = getValidRawTerm({ sample: undefined, plot: undefined, groupsetting: undefined, values: undefined })
	const x = new SingleCellCellTypeBase(term as any)

	test.deepEqual(x.sample, {}, 'Should fallback sample to empty object')
	test.equal(x.plot, '', 'Should fallback plot to empty string')
	test.deepEqual(x.groupsetting, { disabled: false }, 'Should fallback groupsetting')
	test.deepEqual(x.values, {}, 'Should fallback values')
	test.end()
})

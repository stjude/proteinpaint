import tape from 'tape'
import { TwBase } from '../TwBase.ts'

/*************************
 reusable helper functions
**************************/

function getTw(override: any = {}) {
	return Object.assign(
		{
			type: 'GvValuesTW',
			$id: 'test.$id',
			term: { type: 'geneVariant', name: 'KRAS' },
			q: { type: 'values' }
		},
		override
	) as any
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- tw/TwBase.unit -***-')
	test.end()
})

/* PlotBase.getMutableConfig() replaces every routed tw of a plot config with an
instance of this class on each hydration, so a plot-specific tw prop that the
constructor does not copy is silently dropped before the plot renders. That is
what made an edited matrix row label not stick. */
tape('TwBase() carries the plot-specific tw props', function (test) {
	const xtw: any = new TwBase(
		getTw({
			label: 'my custom label',
			legend: { group: 'Assay availability' },
			exclude: ['Unknown'],
			sortSamples: { by: 'a' },
			minNumSamples: 2,
			valueFilter: { type: 'tvs' }
		}),
		{}
	)
	test.equal(xtw.label, 'my custom label', 'keeps a tw.label, e.g. an edited matrix row label')
	test.deepEqual(xtw.legend, { group: 'Assay availability' }, 'keeps tw.legend, which merges shared legend groups')
	test.deepEqual(xtw.exclude, ['Unknown'], 'keeps tw.exclude of a divideBy tw')
	test.deepEqual(xtw.sortSamples, { by: 'a' }, 'keeps tw.sortSamples')
	test.equal(xtw.minNumSamples, 2, 'keeps tw.minNumSamples')
	test.deepEqual(xtw.valueFilter, { type: 'tvs' }, 'keeps tw.valueFilter')

	// matrix.xtw.ts getTermGroups() clones the hydrated config, which drops
	// anything that is not an own enumerable prop of the instance
	test.equal(structuredClone(xtw).label, 'my custom label', 'keeps the label through a structuredClone of the instance')
	test.end()
})

/* checks the values and not the presence of the keys: whether a declared but
unassigned class field becomes an own prop depends on useDefineForClassFields,
which differs between the tsconfigs this spec may be compiled with */
tape('TwBase() does not invent the optional props', function (test) {
	const xtw: any = new TwBase(getTw(), {})
	test.equal(xtw.label, undefined, 'leaves label unset when the tw has none, so the term name is used')
	test.equal(xtw.sortSamples, undefined, 'leaves sortSamples unset when the tw has none')
	test.end()
})

/* the label is a display-only override of the term name. including it in the min
copy would change the $id and the data request payload, so that renaming a row
would refetch its data and orphan its twSpecificSettings */
tape('TwBase.getMinCopy() ignores the label', function (test) {
	const xtw: any = new TwBase(getTw({ label: 'my custom label' }), {})
	const copy = xtw.getMinCopy()
	test.equal(copy.label, undefined, 'omits the label from the min copy')
	test.deepEqual(
		Object.keys(copy).sort(),
		['$id', 'q', 'term', 'type'],
		'the min copy is limited to the props that identify the tw'
	)
	test.end()
})

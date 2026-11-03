import tape from 'tape'
import { mclass } from '#shared/common.js'
import {
	describeSlice,
	getDotPie,
	getPieLegend,
	getPiePosition,
	getPieTipData,
	hasPies
} from '../viewModel/PieViewModel.ts'

/*
Tests:
    - Pie positions
    - Hidden slices
    - Slice labels and colors
    - Pie tooltip
    - Dots of a pie chart
    - Pie legend
*/

const settings: any = { minDotSize: 2, maxDotSize: 24 }
const slice = (key: string, label: string, color: string, count: number, hidden?: boolean) => ({
	key,
	label,
	color,
	count,
	...(hidden && { hidden })
})
const pie = (n: number, radius: number, termType?: string) => ({
	n,
	radius,
	termType,
	slices: [slice('WT', 'Wildtype', '#D3D3D3', n - 1, true), slice('M', 'MISSENSE', '#3987CC', 1)]
})
const dot = (column: string, withPie?: any): any => ({
	row: 'TP53',
	rowSection: 'Genes',
	column,
	colSection: 'Cell type',
	colorValue: 1,
	sizeValue: 1,
	...(withPie && { pie: withPie })
})

tape('\n', function (test) {
	test.comment('-***- plots/aggregateMatrix/viewModel/PieViewModel -***-')
	test.end()
})

tape('Pie positions', function (test) {
	test.equal(getPiePosition(pie(100, 1), settings).radius, 24, 'Should draw the largest pie at the maximum dot size')
	test.equal(getPiePosition(pie(25, 0.5), settings).radius, 12, 'Should keep the pie area proportional to n')
	test.equal(
		getPiePosition(pie(1, 0.001), settings).radius,
		2,
		'Should not draw a pie smaller than the minimum dot size'
	)
	const position = getPiePosition(pie(10, 1), settings)
	test.equal(position.n, 10, 'Should carry over the number of samples')
	test.ok(
		position.slices.every(s => s.path.startsWith('M')),
		'Should create an svg path for every slice'
	)
	test.end()
})

tape('Hidden slices', function (test) {
	test.deepEqual(
		getPiePosition(pie(100, 1), settings).slices.map(s => s.key),
		['M'],
		'Should not draw slices that are hidden, such as wildtype'
	)
	const hiddenOnly = { n: 5, radius: 1, slices: [slice('WT', 'Wildtype', '#ccc', 5, true)] }
	test.equal(getPiePosition(hiddenOnly, settings).slices.length, 0, 'Should have no slices to draw when all are hidden')
	test.end()
})

tape('Slice labels and colors', function (test) {
	// the client mclass has the launch argument mclassOverride applied, so it decides the look of a variant class
	const original = { ...mclass.M }
	Object.assign(mclass.M, { label: 'Custom missense', color: '#123456' })
	const overridden = describeSlice(slice('M', 'MISSENSE', '#3987CC', 1), 'geneVariant')
	Object.assign(mclass.M, original)
	test.deepEqual(
		overridden,
		{ label: 'Custom missense', color: '#123456' },
		'Should describe a variant class by the mclass of the client, which has the override'
	)
	test.deepEqual(
		describeSlice(slice('M', 'Male', '#abcdef', 1), 'categorical'),
		{ label: 'Male', color: '#abcdef' },
		'Should keep what the server sent for other term types'
	)
	test.deepEqual(
		describeSlice(slice('__proto__', 'x', '#000000', 1), 'geneVariant'),
		{ label: 'x', color: '#000000' },
		'Should not read inherited properties of mclass'
	)
	test.end()
})

tape('Pie tooltip', function (test) {
	const entries = (sampleType?: any) => getPieTipData(pie(100, 1), sampleType).map(e => [e.label, e.value])
	test.deepEqual(
		entries({ name: 'cell', plural_name: 'cells' }),
		[
			['Cells', 100],
			['Wildtype', 99],
			['MISSENSE', 1]
		],
		'Should list the number of samples and each slice, hidden ones too'
	)
	test.equal(entries()[0][0], 'Samples', 'Should call the samples samples without a sample type')
	test.end()
})

tape('Dots of a pie chart', function (test) {
	const shown = getDotPie(dot('B', pie(10, 1)), settings, true)
	test.ok(shown.pie, 'Should draw a pie that has slices')
	test.equal(shown.isNoData, false, 'Should treat a pie as data')
	test.equal(shown.tipData.length, 3, 'Should add the pie to the tooltip')

	const none = getDotPie(dot('None'), settings, true)
	test.equal(none.pie, undefined, 'Should not draw a pie for a dot without one')
	test.equal(none.isNoData, true, 'Should treat a dot without a pie as no data in a pie chart')
	test.equal(none.tipData.length, 0, 'Should not add entries to the tooltip of a dot without a pie')

	const hiddenOnly = { n: 5, radius: 1, slices: [slice('WT', 'Wildtype', '#ccc', 5, true)] }
	const hidden = getDotPie(dot('Hidden', hiddenOnly), settings, true)
	test.equal(hidden.pie, undefined, 'Should not draw a pie whose slices are all hidden')
	test.equal(hidden.isNoData, true, 'Should treat a pie whose slices are all hidden as no data')
	test.equal(hidden.tipData.length, 0, 'Should not report the samples of a pie that is not shown')

	test.equal(getDotPie(dot('A'), settings, false).isNoData, false, 'Should keep dots as data when there are no pies')
	test.equal(hasPies([[dot('A'), dot('B', pie(10, 1))]]), true, 'Should find a pie in the data')
	test.equal(hasPies([[dot('A'), dot('B')]]), false, 'Should find no pies in data without any')
	test.end()
})

tape('Pie legend', function (test) {
	const data = [[dot('B', pie(100, 1, 'geneVariant')), dot('T', pie(25, 0.5, 'geneVariant')), dot('None')]]
	const legend = getPieLegend(data)
	test.equal(legend.title, 'Variant class', 'Should title a gene variant legend')
	test.deepEqual(
		legend.entries.map(e => e.key),
		['M'],
		'Should list every slice that is drawn once, without the hidden slices'
	)
	test.equal(getPieLegend([[dot('A', pie(5, 1))]]).title, 'Category', 'Should title the legend of other terms')
	test.deepEqual(getPieLegend([[dot('A')]]).entries, [], 'Should have no legend entries without pies')
	test.end()
})

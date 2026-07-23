import test from 'tape'
import LegendJSONMapper from '../LegendJSONMapper'
import Legend from '../Legend'
import LohLegend from '../../loh/LohLegend'
import CnvLegend from '../../cnv/CnvLegend'
import { CnvType } from '../../cnv/CnvType'

const legendJSONMapper = new LegendJSONMapper(0)
const emptyMap = new Map()

function createLegendWithWaterfall(color: string) {
	return new Legend(
		'SNV',
		'CNV',
		'LOH',
		'SV',
		90,
		'percentile',
		emptyMap,
		emptyMap,
		'heatmap',
		false,
		{} as any,
		undefined,
		{ color, onColorChange: () => {} }
	)
}

test('\n', t => {
	t.pass('-***- client/plots/disco/legend/LegendJSONMapper.ts waterfall legend -***-')
	t.end()
})

test('LegendJSONMapper includes mutation waterfall entry with color picker and axis note', t => {
	const legend = createLegendWithWaterfall('#abcdef')
	const mapped = legendJSONMapper.map(legend)
	const waterfallEntry = mapped.find(group => group.name === 'Mutation Waterfall Plot')

	t.ok(waterfallEntry, 'waterfall legend entry exists')
	t.equal(waterfallEntry.items[0].colorPicker, true, 'first item uses color picker')
	t.equal(waterfallEntry.items[0].color, '#abcdef', 'color picker reflects current color')
	t.equal(waterfallEntry.items[1].text, 'Axis: log10 intermutation distance', 'axis note is appended')
	t.end()
})

test('LegendJSONMapper includes fusion event counts', t => {
	const legend = new Legend(
		'Mutations',
		'CNV',
		'LOH',
		'SV',
		90,
		'percentile',
		emptyMap,
		emptyMap,
		'heatmap',
		true,
		{} as any,
		undefined,
		undefined,
		{ interchromosomal: 2, intrachromosomal: 1 }
	)
	const mapped = legendJSONMapper.map(legend)
	const fusionEntry = mapped.find(group => group.name === 'SV')

	t.equal(fusionEntry.items[0].text, 'Interchromosomal (2)', 'Interchromosomal count is shown')
	t.equal(fusionEntry.items[1].text, 'Intrachromosomal (1)', 'Intrachromosomal count is shown')
	t.end()
})

test('LegendJSONMapper renders CNV, ITD, and LOH in separate rows with event counts', t => {
	const cnvMap = new Map([
		[CnvType.Gain, new CnvLegend('Max', CnvType.Gain, '#f00', 2)],
		[CnvType.Loss, new CnvLegend('Min', CnvType.Loss, '#00f', -1)],
		[CnvType.Cap, new CnvLegend('Capping', CnvType.Cap, '#f00', 2)],
		[CnvType.ITD, new CnvLegend('ITD', CnvType.ITD, '#ff70ff', 3)]
	])
	const legend = new Legend(
		'Mutations',
		'CNV',
		'LOH',
		'SV',
		90,
		'percentile',
		emptyMap,
		cnvMap,
		'bar',
		false,
		{} as any,
		new LohLegend(4),
		undefined,
		{ interchromosomal: 0, intrachromosomal: 0 },
		2
	)
	const mapped = legendJSONMapper.map(legend)
	const cnv = mapped.find(group => group.name == 'CNV')
	const itd = mapped.find(group => group.name == 'ITD')
	const loh = mapped.find(group => group.name == 'LOH')

	t.notOk(
		cnv.items.some(item => item.key == CnvType.ITD),
		'CNV row does not contain ITD'
	)
	t.equal(itd.items[0].text, 'ITD (3)', 'ITD has its own event-count row')
	t.equal(loh.items.length, 1, 'LOH row no longer contains min/max items')
	t.equal(loh.items[0].text, 'LOH (4)', 'LOH row shows its event count')
	t.equal(legend.legendCount(), 3, 'Legend height includes separate CNV, ITD, and LOH rows')

	legend.cnvCount = 0
	const withoutCnvEvents = legendJSONMapper.map(legend)
	t.notOk(
		withoutCnvEvents.find(group => group.name == 'CNV'),
		'CNV row is omitted when the plot has only ITD events'
	)
	t.ok(
		withoutCnvEvents.find(group => group.name == 'ITD'),
		'ITD count row remains without CNV events'
	)
	t.end()
})

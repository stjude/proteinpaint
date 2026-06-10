import test from 'tape'
import LegendJSONMapper from '../LegendJSONMapper'
import Legend from '../Legend'

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

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

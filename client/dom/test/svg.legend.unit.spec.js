import tape from 'tape'
import svgLegend from '../svg.legend'
import { select } from 'd3-selection'

tape('default behavior', test => {
	test.timeoutAfter(100)
	test.plan(3)

	const width = 300
	const height = 300
	const svg = select('body')
		.append('svg')
		.attr('width', width)
		.attr('height', height)
		.attr('overflow', 'visible')
	const holder = svg.append('g').attr('transform', 'translate(100,0)')
	const legendRenderer = svgLegend({
		holder,
		rectFillFxn: d => d.color,
		iconStroke: '#aaa',
		handlers: {
			legend: {
				click: () => tape.pass('should trigger the legend click callback')
			}
		}
	})

	const legendData = [
		{
			name: 'Legend group 1',
			items: [
				{
					termid: 'mutation class',
					key: 'F',
					text: 'Frameshift',
					color: 'blue',
					order: 0,
					border: '1px solid #ccc'
				},
				{
					termid: 'mutation class',
					key: 'M',
					text: 'Missense',
					color: 'red',
					order: 1,
					border: '1px solid #ccc'
				}
			]
		}
	]

	legendRenderer(legendData)
	test.equal(holder.selectAll(':scope>g').size(), legendData.length, 'should have the expected number of legend groups')
	test.equal(
		holder
			.selectAll('text')
			.filter(t => t.color || t.key)
			.size(),
		legendData.reduce((sum, d) => sum + d.items.length, 0),
		'should have the expected number of legend items'
	)
	test.equal(
		holder
			.selectAll('rect')
			.filter(function(t) {
				return t.color === select(this).attr('fill')
			})
			.size(),
		legendData.reduce((sum, d) => sum + d.items.length, 0),
		'should have the expected color for each legend item'
	)
	test.end()
})

/*
// position will be determined by holder.attr('transform'), so no need to test?
tape('vertical layout')
tape('legend group for symbol/icon shapes')
*/

import tape from 'tape'
import * as d3s from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { drawShareViolins, shareDensity } from '../usagePlot'

/**
 * Tests
 *   - shareDensity: a density over 0 to 1 that integrates to about 1, and has a shape for identical shares
 *   - drawShareViolins: per group a violin, a dot per sample and a median tick, at the median's x
 */

tape('\n', test => {
	test.comment('-***- dnameth/usagePlot -***-')
	test.end()
})

tape('shareDensity', test => {
	const d = shareDensity([0.2, 0.25, 0.3, 0.3, 0.35, 0.4])
	test.equal(d.length, 101, 'should evaluate the density over 0 to 1 in steps of 0.01')
	const area = d.reduce((sum, [, y]) => sum + y * 0.01, 0)
	test.ok(Math.abs(area - 1) < 0.05, `should integrate to about 1 (${area.toFixed(3)})`)
	const peak = d.reduce((a, b) => (b[1] > a[1] ? b : a))
	test.ok(peak[0] > 0.2 && peak[0] < 0.4, 'and peak among the values')
	test.ok(
		shareDensity([0.5, 0.5, 0.5]).some(([, y]) => y > 0),
		'should give identical shares a shape, by the least bandwidth'
	)
	test.end()
})

tape('drawShareViolins', test => {
	const svg = d3s.select('body').append('svg')
	const x = scaleLinear().domain([0, 1]).range([0, 100])
	drawShareViolins(svg, {
		groups: [
			{ color: 'gray', values: [0.1, 0.2, 0.3, 0.4, 0.5] },
			{ color: 'purple', values: [0.6, 0.7, 0.8] },
			{ color: 'blue', values: [] }
		],
		x,
		h: 14
	})
	test.equal(svg.selectAll('path').size(), 2, 'should draw a violin per group with samples')
	const xs = (svg.select('path').attr('d') as string).match(/[ML]([\d.]+),/g)!.map(m => Number(m.slice(1, -1)))
	test.ok(Math.max(...xs) < 70, 'only where it has density, not along the whole row')
	test.equal(svg.selectAll('circle').size(), 8, 'and a dot per sample')
	const ticks = svg
		.selectAll('line')
		.nodes()
		.map((n: any) => Number(n.getAttribute('x1')))
	test.deepEqual(ticks, [30, 70], 'and a tick at the median of each')
	;(svg.node() as Element).remove()
	test.end()
})

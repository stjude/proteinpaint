import tape from 'tape'
import * as d3s from 'd3-selection'
import { drawLocus, colors, type LocusData } from '../view'

/**
 * Tests
 *   - draws one cell per sample and bin, expression bars, the gene sketch, and rho bars
 *   - draws a missing value in the missing color
 *   - puts the TSS bin on top for a minus-strand gene
 *   - a click on a row passes that row's bin
 *   - marks only the other isoforms' distinct TSSs inside the locus
 *   - profile lines by thirds of expression, or by group with the group difference and rho within groups
 *   - draws sample columns at a given width
 */

function getHolder() {
	return d3s.select('body').append('div')
}

function getData(strand = '+'): LocusData {
	const iso = (isoform: string, start: number, stop: number) => ({
		isoform,
		chr: 'chr1',
		start,
		stop,
		strand: '+',
		isdefault: false,
		exon: [[start, stop]] as [number, number][]
	})
	return {
		gene: {
			chr: 'chr1',
			start: 1000,
			stop: 5000,
			strand,
			isoform: 'NM_1',
			isdefault: true,
			exon: [
				[1000, 1200],
				[4800, 5000]
			],
			intron: [[1200, 4800]],
			coding: [
				[1100, 1200],
				[4800, 4900]
			],
			utr5: [[1000, 1100]],
			utr3: [[4900, 5000]],
			cdslen: 200,
			codingstart: 1100,
			codingstop: 4900
		},
		isoforms: [
			iso('NM_1', 1000, 5000),
			// same TSS as NM_1: no extra mark
			iso('NM_2', 1000, 4000),
			// an alternative TSS inside the locus: one mark
			iso('NM_3', 3000, 5000),
			// TSS outside the locus: no mark
			iso('NM_4', 9000, 9500)
		],
		region: { chr: 'chr1', start: 0, stop: 6000 },
		unit: 'TPM',
		samples: [
			{ name: 's1', value: 0, group: 'A' },
			{ name: 's2', value: 5, group: 'B' },
			{ name: 's3', value: 50 }
		],
		bins: [
			{
				start: 100,
				stop: 900,
				nCpg: 10,
				beta: [0.9, 0.5, 0.1],
				rho: -1,
				q: 0.01
			},
			{ start: 1000, stop: 5900, nCpg: 10, beta: [0.2, null, 0.8] }
		]
	}
}

const tip = {
	clear: () => {},
	show: () => {},
	hide: () => {},
	d: d3s.select('body').append('div')
}

tape('\n', test => {
	test.comment('-***- plots/methylationLocus/view -***-')
	test.end()
})

tape('draws cells, bars, gene, and rho', test => {
	const holder = getHolder()
	drawLocus(
		holder,
		getData(),
		tip,
		() => 'red',
		() => {}
	)
	test.equal(holder.selectAll('[data-testid=sjpp-methylationLocus-heatmap] rect').size(), 6, 'should draw 3 x 2 cells')
	test.equal(holder.selectAll('[data-testid=sjpp-methylationLocus-expression] rect').size(), 3, 'should draw 3 bars')
	test.equal(
		holder.selectAll('[data-testid=sjpp-methylationLocus-group] rect').size(),
		3,
		'should draw the group strip'
	)
	const sketch = holder.select('.sjpp-methylationLocus-sketch')
	test.equal(sketch.size(), 1, 'should draw the gene sketch')
	test.ok(String(sketch.attr('href')).startsWith('data:image/png'), 'should embed the sketch as an image')
	test.equal(holder.selectAll('.sjpp-methylationLocus-fan').size(), 2, 'should draw one fan line per bin')
	test.equal(
		holder.selectAll('[data-testid=sjpp-methylationLocus-rho] rect').size(),
		1,
		'should draw a rho bar only for the tested bin'
	)
	holder.remove()
	test.end()
})

tape('column width', test => {
	const holder = getHolder()
	drawLocus(
		holder,
		getData(),
		tip,
		() => 'red',
		() => {},
		2
	)
	const widths = holder
		.selectAll('[data-testid=sjpp-methylationLocus-heatmap] rect')
		.nodes()
		.map((n: any) => Number(n.getAttribute('width')))
	test.deepEqual([...new Set(widths)], [2], 'should draw each sample column at the given width')
	holder.remove()
	test.end()
})

tape('missing value', test => {
	const holder = getHolder()
	drawLocus(
		holder,
		getData(),
		tip,
		() => 'red',
		() => {}
	)
	const fills = holder
		.selectAll('[data-testid=sjpp-methylationLocus-heatmap] rect')
		.nodes()
		.map((n: any) => n.getAttribute('fill'))
	test.equal(fills.filter(f => f == colors.missing).length, 1, 'should draw the one null value in the missing color')
	holder.remove()
	test.end()
})

tape('minus strand and row click', test => {
	const holder = getHolder()
	let clicked: any
	drawLocus(
		holder,
		getData('-'),
		tip,
		() => 'red',
		bin => (clicked = bin)
	)
	// on the minus strand, the bin at the higher coordinate is the 5' one and goes on top
	const first = holder.select('[data-testid=sjpp-methylationLocus-heatmap] rect').attr('fill')
	test.equal(first, colors.beta(0.2), 'should put the 5-prime bin on the top row')

	const hit = holder.select('[data-testid=sjpp-methylationLocus-hit]').node() as SVGRectElement
	const top = hit.getBoundingClientRect()
	const heat = (
		holder.select('[data-testid=sjpp-methylationLocus-heatmap] rect').node() as SVGRectElement
	).getBoundingClientRect()
	hit.dispatchEvent(
		new MouseEvent('click', {
			clientX: heat.x + 1,
			clientY: heat.y + 1,
			bubbles: true
		})
	)
	test.ok(top.height > 0, 'should draw a hit layer')
	test.equal(clicked?.start, 1000, 'should pass the clicked row bin')
	holder.remove()
	test.end()
})

tape('other isoforms TSS', test => {
	const holder = getHolder()
	drawLocus(
		holder,
		getData(),
		tip,
		() => 'red',
		() => {}
	)
	test.equal(holder.selectAll('.sjpp-methylationLocus-altTss').size(), 1, 'should mark one alternative TSS')
	holder.remove()
	test.end()
})

tape('profile without groups', test => {
	const holder = getHolder()
	drawLocus(
		holder,
		getData(),
		tip,
		() => 'red',
		() => {}
	)
	test.equal(
		holder.selectAll('.sjpp-methylationLocus-profileLine').size(),
		3,
		'should draw a line per third of the samples'
	)
	test.equal(
		holder.selectAll('[data-testid=sjpp-methylationLocus-diff]').size(),
		0,
		'should not draw a group difference'
	)
	test.equal(holder.selectAll('.sjpp-methylationLocus-groupRho').size(), 0, 'should not draw group rho')
	holder.remove()
	test.end()
})

tape('profile, difference and rho with two groups', test => {
	const holder = getHolder()
	const data = getData()
	data.groups = ['A', 'B']
	data.bins[0].byGroup = [
		{ group: 'A', rho: 0.5, q: 0.01 },
		{ group: 'B', rho: -0.2, q: 0.3 }
	]
	data.bins[1].byGroup = [{ group: 'A' }, { group: 'B' }]
	drawLocus(
		holder,
		data,
		tip,
		g => (g == 'A' ? 'green' : 'orange'),
		() => {}
	)
	test.equal(holder.selectAll('.sjpp-methylationLocus-profileLine').size(), 2, 'should draw a line per group')
	const bars = holder.selectAll('[data-testid=sjpp-methylationLocus-diff] rect').nodes() as SVGRectElement[]
	// bin 0: B (s2, 0.5) minus A (s1, 0.9) = -0.4, less methylated in B; bin 1 has no value for B (s2 is null)
	test.equal(bars.length, 1, 'should draw a difference for the bin with values in both groups')
	test.equal(bars[0].getAttribute('fill'), colors.beta(0.15), 'should color a lower beta in the second group blue')
	const dots = holder.selectAll('.sjpp-methylationLocus-groupRho').nodes() as SVGCircleElement[]
	test.equal(dots.length, 2, 'should draw a rho dot per group that was tested')
	test.deepEqual(
		dots.map(d => d.getAttribute('fill')),
		['green', 'white'],
		'should fill only the dot with q < 0.05'
	)
	holder.remove()
	test.end()
})

tape('locus axis and flank lines', test => {
	const holder = getHolder()
	drawLocus(
		holder,
		getData(),
		tip,
		() => 'red',
		() => {}
	)
	test.equal(holder.selectAll('.sjpp-methylationLocus-axis').size(), 1, 'should draw an axis over the whole locus')
	const starts = (holder.selectAll('.sjpp-methylationLocus-fan').nodes() as SVGPathElement[]).map(p =>
		Number(p.getAttribute('d')!.slice(1).split(',')[0])
	)
	// bin 0 (100-900) is in the flank before the gene (1000-5000); bin 1 has its middle inside the gene
	test.ok(starts[0] < starts[1], 'should start the line of a flank bin at the axis, left of the sketch edge')
	const labels = holder
		.selectAll('[data-testid=sjpp-methylationLocus-gene] text')
		.nodes()
		.map((t: any) => t.textContent)
	// 2 rows are 24 px: the TSS (1 kb into the 6 kb locus) is 4 px from the top, so the upstream label is
	// left out to keep it off the TSS label, and the downstream one is drawn
	test.ok(labels.includes('+1 kb'), 'should label the length of the downstream flank')
	test.notOk(labels.includes('−1 kb'), 'should leave out a flank label that would cover the TSS label')
	holder.remove()
	test.end()
})

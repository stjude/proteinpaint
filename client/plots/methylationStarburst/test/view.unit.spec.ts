import tape from 'tape'
import * as d3s from 'd3-selection'
import {
	drawStarburst,
	drawPathways,
	setLabel,
	spearman,
	quadrants,
	type StarburstData,
	type StarburstPathways
} from '../view'

/*
Tests:
	- spearman: monotone, reversed, ties
	- quadrants: counts past both cutoffs, the same-direction odds ratio, the empty-cell correction
	- draws a promoter and a body panel with stats, corner counts and the dots image
	- highlighted genes are named where they have a value
	- a click passes the nearest gene
	- gene sets: three cells a set, most significant merged first, dots at q < 0.05, a square only when merged, a row cap
*/

tape('\n', test => {
	test.comment('-***- plots/methylationStarburst/view -***-')
	test.end()
})

tape('spearman', test => {
	test.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1, 'should be 1 for a monotone increase')
	test.equal(spearman([1, 2, 3, 4], [4, 3, 2, 1]), -1, 'should be -1 for a monotone decrease')
	// ranks x 1,2.5,2.5,4 and y 1,2,3,4: r = 4.5 / sqrt(4.5 * 5)
	test.ok(Math.abs(spearman([1, 2, 2, 3], [1, 2, 3, 4])! - 4.5 / Math.sqrt(22.5)) < 1e-12, 'should average tied ranks')
	test.equal(spearman([1, 2], [1, 2]), null, 'should be null under 3 values')
	test.end()
})

tape('quadrants', test => {
	const c = { minDeltaBeta: 0.1, maxQ: 0.05 }
	// hyper-up x2, hypo-down x2, hyper-down x1, hypo-up x1, then one under each cutoff
	const db = [0.2, 0.3, -0.2, -0.3, 0.2, -0.2, 0.05, 0.2]
	const fc = [1, 2, -1, -2, -1, 1, 1, 1]
	const q = [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.5]
	const r = quadrants(db, fc, q, c)
	test.deepEqual(r.n, { hyperUp: 2, hyperDown: 1, hypoUp: 1, hypoDown: 2 }, 'should count only genes past both cutoffs')
	test.ok(Math.abs(r.or! - 4) < 1e-9, 'should give (hyper-up x hypo-down) / (hyper-down x hypo-up)')
	test.ok(r.lo! < 4 && r.hi! > 4, 'should put the odds ratio inside its interval')
	const z = quadrants([0.2, -0.2], [1, -1], [0.01, 0.01], c)
	test.ok(Math.abs(z.or! - (1.5 * 1.5) / (0.5 * 0.5)) < 1e-9, 'should add 0.5 to every cell when one is empty')
	test.equal(quadrants([0.01], [1], [0.01], c).or, undefined, 'should give no odds ratio with no gene past the cutoffs')
	test.end()
})

function getData(): StarburstData {
	return {
		genes: ['A', 'B', 'C', 'D'],
		log2fc: [0, 2, -2, 1],
		q: [0.5, 0.001, 0.001, 0.001],
		promoter: [0, 0.3, -0.3, null],
		body: [0, -0.2, 0.2, 0.1],
		sampleSize1: 10,
		sampleSize2: 12,
		corrected: false
	}
}

tape('draws two panels', test => {
	const holder = d3s.select('body').append('div')
	drawStarburst(holder, getData(), { minDeltaBeta: 0.05, maxQ: 0.05 }, ['ref', 'case'], {}, () => {})
	for (const region of ['promoter', 'body']) {
		const g = holder.select(`[data-testid=sjpp-methylationStarburst-${region}]`)
		test.equal(g.size(), 1, `should draw the ${region} panel`)
		test.ok(
			String(g.select('.sjpp-methylationStarburst-dots').attr('href')).startsWith('data:image/png'),
			`should draw the ${region} dots as an image`
		)
		test.equal(g.selectAll('.sjpp-methylationStarburst-count').size(), 4, `should label the 4 ${region} quadrants`)
	}
	const stats = holder
		.selectAll('[data-testid=sjpp-methylationStarburst-stats]')
		.nodes()
		.map((n: any) => n.textContent)
	test.ok(stats[0].startsWith('3 genes'), 'should count the genes with a promoter value')
	test.ok(stats[1].startsWith('4 genes'), 'should count the genes with a body value')
	const counts = (region: string) =>
		holder
			.selectAll(`[data-testid=sjpp-methylationStarburst-${region}] .sjpp-methylationStarburst-count text`)
			.nodes()
			.map((n: any) => n.textContent)
	// promoter: B hyper-up, C hypo-down; body: B hypo-up, C hyper-down, D hyper-up
	test.deepEqual(counts('promoter'), ['hypo, up 0', 'hyper, up 1', 'hypo, down 1', 'hyper, down 0'], 'promoter counts')
	test.deepEqual(counts('body'), ['hypo, up 1', 'hyper, up 1', 'hypo, down 0', 'hyper, down 1'], 'body counts')
	holder.remove()
	test.end()
})

tape('highlighted genes', test => {
	const holder = d3s.select('body').append('div')
	drawStarburst(holder, getData(), { minDeltaBeta: 0.05, maxQ: 0.05 }, ['ref', 'case'], {}, () => {}, ['D', 'Z'])
	const named = (region: string) =>
		holder
			.selectAll(`[data-testid=sjpp-methylationStarburst-${region}] .sjpp-methylationStarburst-highlight text`)
			.nodes()
			.map((n: any) => n.textContent)
	test.deepEqual(named('body'), ['D'], 'should name a highlighted gene where it has a value')
	test.deepEqual(named('promoter'), [], 'should skip a gene with no value in the region, and an unknown gene')
	holder.remove()
	test.end()
})

tape('click passes the nearest gene', test => {
	const holder = d3s.select('body').append('div')
	let clicked = ''
	const tip = { clear: () => tip, show: () => {}, hide: () => {}, d: d3s.select('body').append('div') }
	drawStarburst(holder, getData(), { minDeltaBeta: 0.05, maxQ: 0.05 }, ['ref', 'case'], tip, g => (clicked = g))
	// gene A sits at (0, 0), the center of a symmetric panel
	const hit = holder.select(
		'[data-testid=sjpp-methylationStarburst-promoter] [data-testid=sjpp-methylationStarburst-hit]'
	)
	const node = hit.node() as SVGRectElement
	const r = node.getBoundingClientRect()
	node.dispatchEvent(
		new MouseEvent('click', { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true })
	)
	test.equal(clicked, 'A', 'should pass the gene under the pointer')
	holder.remove()
	tip.d.remove()
	test.end()
})

function getPathways(): StarburstPathways {
	const layer = (log10q: number, direction = 1) => ({ log10q, direction, overlap: 5 })
	return {
		geneSetGroup: 'H: hallmark gene sets',
		genes: 1000,
		tested: 50,
		passing: [400, 300, 350],
		brown: { df: 3.5, scale: 1.1 },
		sets: [
			// significant in each layer and merged
			{ id: 'HALLMARK_A_SET', size: 40, layers: [layer(-4), layer(-3, -1), layer(-6)], genes: ['G1', 'G2'] },
			// significant only when merged
			{ id: 'HALLMARK_B_SET', size: 30, layers: [layer(-1), layer(-1), layer(-2)], genes: ['G3'] },
			// significant in expression alone
			{ id: 'HALLMARK_C_SET', size: 20, layers: [layer(-8), layer(0, 0), layer(-1)], genes: [] }
		]
	}
}

tape('gene sets', test => {
	const holder = d3s.select('body').append('div')
	drawPathways(holder, getPathways(), ['ref', 'case'], {})
	test.equal(holder.selectAll('.sjpp-methylationStarburst-pathwayCell').size(), 9, 'should draw three cells a set')
	test.equal(
		holder.selectAll('.sjpp-methylationStarburst-pathwaySig').size(),
		5,
		'should mark each cell at q < 0.05: 3, 1 and 1'
	)
	test.equal(
		holder.selectAll('.sjpp-methylationStarburst-pathwayMergedOnly').size(),
		1,
		'should square the merged-only set'
	)
	const labels = holder
		.selectAll('[data-testid=sjpp-methylationStarburst-pathways] g text')
		.nodes()
		.map((n: any) => n.firstChild.textContent)
	test.deepEqual(labels, ['A set', 'B set', 'C set'], 'should order the sets by merged q, most significant first')
	holder.remove()

	const capped = d3s.select('body').append('div')
	drawPathways(capped, getPathways(), ['ref', 'case'], {}, 2)
	test.equal(capped.selectAll('.sjpp-methylationStarburst-pathwayCell').size(), 6, 'should draw up to maxRows sets')
	test.ok(
		capped.select('[data-testid=sjpp-methylationStarburst-pathwayStats]').text().includes('(top 2 shown)'),
		'should say when sets are left out'
	)
	capped.remove()
	test.end()
})

tape('setLabel', test => {
	test.equal(
		setLabel('HALLMARK_TNFA_SIGNALING_VIA_NFKB'),
		'Tnfa signaling via nfkb',
		'should drop the collection prefix'
	)
	test.equal(setLabel('GOBP_DNA_REPAIR'), 'Dna repair', 'should drop a GO prefix')
	test.end()
})

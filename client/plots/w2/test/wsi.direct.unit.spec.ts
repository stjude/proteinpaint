import tape from 'tape'
import { select } from 'd3-selection'
import {
	parseBoundaries,
	pointInRing,
	tooltipRows,
	cellsInLasso,
	renderNhoodHeatmap,
	renderSimilarSearch,
	focusExtent
} from '../wsi.direct'

/* Tests
    parseBoundaries: boundary csv -> one ring per cell
    pointInRing: hover hit test
    tooltipRows: hover tooltip content
    cellsInLasso: lasso selection by cell centroid
    renderNhoodHeatmap: enrichment z-score matrix rendering
    renderSimilarSearch: no-op guard without dataset addressing (the rest needs a live server, see wsi.integration.spec.ts)
    focusExtent: niche box µm -> px, same transform as parseBoundaries
*/

// two cells, µm coords; mpp 0.5 doubles px values, y negated for OL
const boundaries = `"cell_id","vertex_x","vertex_y"
"cell-1",1,2
"cell-1",3,4
"cell-1",5,6
"cell-2",7,8
"cell-2",9,10
"cell-2",11,12
`

tape('\n', function (test) {
	test.comment('-***- plots/w2/wsi.direct parsers -***-')
	test.end()
})

tape('boundary csv -> one ring per cell', test => {
	const polys = parseBoundaries(boundaries, 0.5, 0.5)
	test.equal(polys.length, 2, 'two cells parsed')
	test.deepEqual(
		polys[0],
		{
			id: 'cell-1',
			ring: [
				[2, -4],
				[6, -8],
				[10, -12]
			]
		},
		'µm scaled to px by mpp, y negated, id unquoted'
	)
	test.equal(polys[1].id, 'cell-2', 'last cell not dropped')
	test.end()
})

tape('focusExtent boxes a niche in the same µm -> px space as parseBoundaries', test => {
	const box = focusExtent(100, 200, 40, 0.5, 0.5) // 40µm-wide box centered on (100,200), mpp 0.5
	test.deepEqual(box, [160, -440, 240, -360], 'min/max px, y negated for OL, half the window on each side')
	const [cellX, cellY] = [100 / 0.5, -200 / 0.5] // the same transform parseBoundaries applies to a cell vertex
	test.ok(
		cellX >= box[0] && cellX <= box[2] && cellY >= box[1] && cellY <= box[3],
		"the query's own center point falls inside its box"
	)
	test.end()
})

tape('pointInRing hover hit test', test => {
	// unit square, first vertex repeated last as in the boundary CSVs
	const ring = [
		[0, 0],
		[10, 0],
		[10, 10],
		[0, 10],
		[0, 0]
	]
	test.true(pointInRing(5, 5, ring), 'center is inside')
	test.false(pointInRing(15, 5, ring), 'point beside the ring is outside')
	test.false(pointInRing(5, -5, ring), 'point above the ring is outside')
	// concave ring: a notch cut into the square's right side
	const concave = [
		[0, 0],
		[10, 0],
		[10, 4],
		[4, 5],
		[10, 6],
		[10, 10],
		[0, 10],
		[0, 0]
	]
	test.false(pointInRing(8, 5, concave), 'point in the notch is outside')
	test.true(pointInRing(2, 5, concave), 'point left of the notch is inside')
	test.end()
})

tape('tooltipRows hover tooltip content', test => {
	const types = { 'cell-1': 'T cell, activated' } // free text, commas allowed
	const counts: { gene: string; cells: { [id: string]: number } }[] = [
		{ gene: 'PTPRC', cells: { 'cell-1': 5 } },
		{ gene: 'ACE2', cells: {} } // cell absent = zero count
	]
	test.deepEqual(
		tooltipRows('cell-1', types, counts),
		['cell id: cell-1', 'cell type: T cell, activated', 'PTPRC expression: 5.0', 'ACE2 expression: 0.0'],
		'id, annotated type (commas intact), one count line per gene, 0.0 when absent'
	)
	test.deepEqual(
		tooltipRows('cell-2', types, counts),
		['cell id: cell-2', 'PTPRC expression: 0.0', 'ACE2 expression: 0.0'],
		'unannotated cell: no type line'
	)
	test.deepEqual(tooltipRows('cell-1', undefined, []), ['cell id: cell-1'], 'no annotations, no genes: id only')
	test.end()
})

tape('cellsInLasso selects by cell centroid', test => {
	// lasso: the 0..10 square. Cells are small triangles named by where their centroid lands
	const lasso = [
		[0, 0],
		[10, 0],
		[10, 10],
		[0, 10],
		[0, 0]
	]
	const cell = (id: string, cx: number, cy: number) => ({
		id,
		ring: [
			[cx - 1, cy - 1],
			[cx + 1, cy - 1],
			[cx, cy + 2]
		] // centroid = (cx, cy)
	})
	const inside = cell('in', 5, 5)
	const outside = cell('out', 20, 20)
	// centroid outside though one vertex pokes in: vertices (11,9),(13,9),(12,12) -> centroid (12,10)
	const straddle = {
		id: 'straddle',
		ring: [
			[9, 9],
			[13, 9],
			[14, 12]
		]
	} // centroid (12, 10): outside
	const hits = cellsInLasso(lasso, [outside, inside, straddle])
	test.deepEqual(
		hits.map(c => c.id),
		['in'],
		'only the cell whose centroid is inside the ring, in input order'
	)
	test.deepEqual(cellsInLasso(lasso, []), [], 'no candidates: empty selection')
	test.deepEqual(
		cellsInLasso(
			[
				[0, 0],
				[1, 0],
				[1, 1],
				[0, 1]
			],
			[inside]
		),
		[],
		'tiny lasso misses the cell'
	)
	test.end()
})

tape('renderNhoodHeatmap draws one cell per type pair', test => {
	const holder = select(document.body).append('div')
	renderNhoodHeatmap(holder, {
		types: ['B cells', 'Tumor'],
		count: [
			[30, 6],
			[6, 18]
		],
		zscore: [
			[4.2, -4.2],
			[null, 1.5]
		],
		cells: 10,
		skipped: 3,
		k: 6,
		perms: 50
	})
	const panel = holder.node() as HTMLElement
	test.equal(panel.querySelectorAll('.sjpp-wsi-nhood-cell').length, 4, '2x2 types -> 4 cells')
	test.ok(panel.textContent?.includes('10 cells, 6 nearest neighbours, 50 permutations'), 'title reports the run')
	test.ok(panel.textContent?.includes('3 unannotated cells skipped'), 'title reports skipped cells')
	const texts = [...panel.querySelectorAll('.sjpp-wsi-nhood-cell text')].map(t => t.textContent)
	test.deepEqual(texts, ['4.2', '-4.2', '–', '1.5'], 'z-scores printed to 1 decimal, null as a dash')
	const fills = [...panel.querySelectorAll('.sjpp-wsi-nhood-cell rect')].map(r => r.getAttribute('fill'))
	test.notEqual(fills[0], fills[1], 'enriched and depleted cells get different colors')
	test.equal(fills[2], '#f0efec', 'null z-score gets the neutral fill')
	test.equal(panel.querySelectorAll('.sjpp-wsi-nhood-cell title').length, 4, 'every cell has a hover tooltip')
	test.equal(
		panel.querySelectorAll('[data-testid="sjpp-wsi-nhood-controls"]').length,
		0,
		'no controls without a rerun callback'
	)
	holder.remove()
	test.end()
})

tape('renderNhoodHeatmap k/permutation controls rerun with clamped values', test => {
	const holder = select(document.body).append('div')
	const calls: [number, number][] = []
	const result = {
		types: ['A', 'B'],
		count: [
			[1, 2],
			[2, 1]
		],
		zscore: [
			[0.5, -0.5],
			[-0.5, 0.5]
		],
		cells: 4,
		skipped: 0,
		k: 6,
		perms: 50
	}
	renderNhoodHeatmap(holder, result, (k, perms) => calls.push([k, perms]))
	const panel = holder.node() as HTMLElement
	const inputs = [...panel.querySelectorAll('[data-testid="sjpp-wsi-nhood-controls"] input')] as HTMLInputElement[]
	test.equal(inputs.length, 2, 'k and permutations inputs')
	test.deepEqual([inputs[0].value, inputs[1].value], ['6', '50'], 'prefilled with the values that ran')
	inputs[0].value = '10'
	inputs[1].value = '200'
	;(panel.querySelector('[data-testid="sjpp-wsi-nhood-rerun"]') as HTMLButtonElement).click()
	test.deepEqual(calls, [[10, 200]], 'Rerun passes the entered k and permutations')
	inputs[0].value = '99'
	inputs[1].value = '3'
	;(panel.querySelector('[data-testid="sjpp-wsi-nhood-rerun"]') as HTMLButtonElement).click()
	test.deepEqual(calls[1], [30, 10], 'out-of-range entries are clamped to the route bounds')
	holder.remove()
	test.end()
})

tape('renderSimilarSearch is a no-op without dataset addressing', async test => {
	// direct-file mode (opts.genome/dslabel/sampleId absent) has no dataset to
	// search, and must return before making any network request -- the only
	// part of this function testable without a live server (see
	// wsi.integration.spec.ts for the rest)
	const holder = select(document.body).append('div')
	const query = {
		types: ['A', 'B'],
		typeCounts: [3, 2],
		count: [
			[1, 2],
			[2, 1]
		],
		zscore: [
			[0.5, -0.5],
			[-0.5, 0.5]
		],
		cells: 5,
		skipped: 0,
		k: 6,
		perms: 50
	}
	await renderSimilarSearch(holder, {}, query)
	test.equal((holder.node() as HTMLElement).children.length, 0, 'nothing rendered, no fetch attempted')
	holder.remove()
	test.end()
})

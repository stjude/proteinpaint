import tape from 'tape'
import { parseBoundaries, pointInRing, tooltipRows, cellsInLasso } from '../wsi.direct'

/* Tests
    parseBoundaries: boundary csv -> one ring per cell
    pointInRing: hover hit test
    tooltipRows: hover tooltip content
    cellsInLasso: lasso selection by cell centroid
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

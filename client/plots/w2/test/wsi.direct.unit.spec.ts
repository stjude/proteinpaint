import tape from 'tape'
import { parseBoundaries, pointInRing, tooltipRows } from '../wsi.direct'

/* Tests
    parseBoundaries: boundary csv -> one ring per cell
    pointInRing: hover hit test
    tooltipRows: hover tooltip content
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

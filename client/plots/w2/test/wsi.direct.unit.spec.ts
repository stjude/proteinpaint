import tape from 'tape'
import { parseBoundaries, parseCellAnnotations, pointInRing } from '../wsi.direct'

/* Tests
    parseBoundaries: boundary csv -> one ring per cell
    parseCellAnnotations: per-cell annotations csv -> id->type map
    pointInRing: hover hit test
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

// one row per cell; cell-2 is QC-filtered (empty type)
const annotations = `"cell_id","cell_type"
"cell-1","Tumor"
"cell-2",
"cell-3","B cells"
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

tape('per-cell annotations csv -> id->type map', test => {
	test.deepEqual(
		parseCellAnnotations(annotations),
		{ 'cell-1': 'Tumor', 'cell-3': 'B cells' },
		'types keyed by unquoted cell_id; QC-filtered cell (empty type) omitted'
	)
	test.deepEqual(parseCellAnnotations('"foo","bar"\n"a","b"\n'), {}, 'unexpected header = empty map')
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

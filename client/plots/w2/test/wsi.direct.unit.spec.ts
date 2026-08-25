import tape from 'tape'
import { parseBoundaries, pointInRing } from '../wsi.direct'

/* Tests
    parseBoundaries: plain csv (no cell_type column)
    parseBoundaries: csv with annotation columns
    pointInRing: hover hit test
*/

// two cells, µm coords; mpp 0.5 doubles px values, y negated for OL
const plain = `"cell_id","vertex_x","vertex_y"
"cell-1",1,2
"cell-1",3,4
"cell-1",5,6
"cell-2",7,8
"cell-2",9,10
"cell-2",11,12
`

const annotated = `"cell_id","vertex_x","vertex_y","leiden","cell_type"
"cell-1",1,2,"0","Tumor"
"cell-1",3,4,"0","Tumor"
"cell-1",5,6,"0","Tumor"
"cell-2",7,8,,
"cell-2",9,10,,
"cell-2",11,12,,
"cell-3",1,1,"2","B cells"
"cell-3",2,2,"2","B cells"
"cell-3",3,3,"2","B cells"
`

tape('\n', function (test) {
	test.comment('-***- plots/w2/wsi.direct parseBoundaries -***-')
	test.end()
})

tape('plain csv (no cell_type column)', test => {
	const { polys, cellTypes } = parseBoundaries(plain, 0.5, 0.5)
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
	test.equal(cellTypes, undefined, 'no cellTypes without a cell_type column')
	test.end()
})

tape('csv with annotation columns', test => {
	const { polys, cellTypes } = parseBoundaries(annotated, 1, 1)
	test.equal(polys.length, 3, 'all cells parsed regardless of annotation')
	test.deepEqual(cellTypes, { 'cell-1': 'Tumor', 'cell-3': 'B cells' }, 'types keyed by unquoted cell_id')
	test.false(cellTypes && 'cell-2' in cellTypes, 'QC-filtered cell (empty field) has no type')
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

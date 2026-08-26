import tape from 'tape'
import { distinctCellTypes } from '../routes/wsitiles.ts'

/* Tests
    distinctCellTypes: per-cell annotations csv
    distinctCellTypes: csv without a cell_type column
*/

tape('\n', function (test) {
	test.comment('-***- server/routes/wsitiles distinctCellTypes -***-')
	test.end()
})

tape('per-cell annotations csv', test => {
	const csv = `"cell_id","cell_type"
"cell-1","Tumor"
"cell-2",
"cell-3","B cells"
"cell-4","Tumor"
`
	test.deepEqual(distinctCellTypes(csv), ['B cells', 'Tumor'], 'distinct non-empty types, sorted, unquoted')
	test.end()
})

tape('csv without a cell_type column', test => {
	const csv = `"cell_id","vertex_x","vertex_y"
"cell-1",1,2
`
	test.equal(distinctCellTypes(csv), undefined, 'no cell_type column = undefined')
	test.end()
})

import tape from 'tape'
import { getSingleCellCellValues } from '../matrixData.ts'
import { SINGLECELL_NUMERIC_VALUE } from '#types'

tape('single cell numeric values omit missing/nonfinite fields and preserve zero', async test => {
	const categories = ['', ' \t', undefined, null, 'NA', 'NaN', 'Infinity', '0', '-2', ' 2.5 ']
	const ds = {
		queries: { singleCell: { data: { get: async () => ({
			plots: [{ noExpCells: categories.map((category, i) => ({ cellId: String(i), category })) }]
		}) } } }
	}
	const values = await getSingleCellCellValues({}, {
		term: { type: SINGLECELL_NUMERIC_VALUE, name: 'score', plot: 'UMAP', sample: { sID: 's1' } }
	}, ds)
	test.deepEqual(values.map(cell => cell.value), [0, -2, 2.5], 'only finite, nonblank values are returned')
	test.deepEqual(values.map(cell => cell.cellId), ['7', '8', '9'], 'values retain their cell IDs')
	test.end()
})

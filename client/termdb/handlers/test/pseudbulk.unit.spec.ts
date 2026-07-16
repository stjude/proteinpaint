import tape from 'tape'
import { SearchHandler } from '../pseudobulk.ts'

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/handlers/pseudobulk -***-')
	test.end()
})

tape('buildRenderingDataMap() groups terms by assay and memberId', function (test) {
	const handler = new SearchHandler()
	const terms = [
		{ id: 't1', name: 'A', assay: 'geneExpression', memberId: 'CD4' },
		{ id: 't2', name: 'B', assay: 'geneExpression', memberId: 'CD4' },
		{ id: 't3', name: 'C', assay: 'geneExpression', memberId: 'CD8' },
		{ id: 't4', name: 'D', assay: 'cellType', memberId: 'Myeloid' }
	]

	const map = handler.buildRenderingDataMap(terms as any[])

	test.equal(map.size, 2, 'creates one top-level key per assay')
	test.ok(map.has('geneExpression'), 'contains geneExpression assay')
	test.ok(map.has('cellType'), 'contains cellType assay')

	const geneExpressionMap = map.get('geneExpression')!
	test.equal(geneExpressionMap.size, 2, 'creates one nested key per memberId within assay')
	test.equal(geneExpressionMap.get('CD4')!.length, 2, 'groups multiple terms under same assay/memberId')
	test.equal(geneExpressionMap.get('CD8')![0].id, 't3', 'stores the correct term under another memberId')

	const cellTypeMap = map.get('cellType')!
	test.equal(cellTypeMap.size, 1, 'cellType assay has one memberId')
	test.equal(cellTypeMap.get('Myeloid')![0].id, 't4', 'stores term under expected cellType memberId')

	test.end()
})

tape('buildRenderingDataMap() returns an empty map for empty input', function (test) {
	const handler = new SearchHandler()
	const map = handler.buildRenderingDataMap([])

	test.equal(map.size, 0, 'empty input produces empty map')
	test.end()
})


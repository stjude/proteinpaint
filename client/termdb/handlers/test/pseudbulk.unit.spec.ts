import tape from 'tape'
import { createPseudobulkTerms, SearchHandler } from '../pseudobulk.ts'

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

tape('createPseudobulkTerms() creates one term per category/gene combination', function (test) {
	const selectedTerms = [
		{ id: 'blast', name: 'Blast', type: 'pseudobulk', assay: 'geneExpression', memberId: 'Cell Type' },
		{ id: 'monocyte', name: 'Monocyte', type: 'pseudobulk', assay: 'geneExpression', memberId: 'Cell Type' }
	]

	const terms = createPseudobulkTerms(selectedTerms as any[], [{ gene: 'TP53' }, { gene: 'KRAS' }])

	test.equal(terms.length, 4, 'creates the category/gene cross product')
	test.deepEqual(
		terms.map(term => term.gene),
		['TP53', 'KRAS', 'TP53', 'KRAS'],
		'sets one gene string on each term'
	)
	test.deepEqual(
		terms.map(term => term.category),
		['blast', 'blast', 'monocyte', 'monocyte'],
		'sets category from the selected value'
	)
	test.deepEqual(
		terms.map(term => term.name),
		[
			'geneExpression blast TP53',
			'geneExpression blast KRAS',
			'geneExpression monocyte TP53',
			'geneExpression monocyte KRAS'
		],
		'names each term from its assay, category, and gene'
	)
	test.notOk('genes' in terms[0], 'does not add the obsolete genes array')
	test.end()
})

tape('createPseudobulkTerms() creates one term for one category and one gene', function (test) {
	const selectedTerms = [
		{ id: 'blast', name: 'Blast', type: 'pseudobulk', assay: 'geneExpression', memberId: 'Cell Type' }
	]

	const terms = createPseudobulkTerms(selectedTerms as any[], [{ gene: 'TP53' }])

	test.equal(terms.length, 1, 'creates one term')
	test.equal(terms[0].category, 'blast', 'sets term.category')
	test.equal(terms[0].gene, 'TP53', 'sets term.gene')
	test.equal(terms[0].name, 'geneExpression blast TP53', 'sets term.name')
	test.end()
})

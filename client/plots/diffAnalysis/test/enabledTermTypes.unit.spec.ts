import tape from 'tape'
import { TermTypeGroups } from '#shared/terms.js'
import { getDaTermTypes } from '../enabledTermTypes.ts'

tape('\n', test => {
	test.comment('-***- plots/diffAnalysis/enabledTermTypes -***-')
	test.end()
})

tape('getDaTermTypes()', test => {
	test.deepEqual(getDaTermTypes(undefined), [], 'should offer nothing without a termdbConfig')
	test.deepEqual(
		getDaTermTypes({
			queries: { rnaseqGeneCount: {}, dnaMethylation: { promoter: {} }, junction: { cluster: true } }
		}),
		['geneExpression', 'dnaMethylation', 'junction'],
		'should offer every kind of data, gene expression first'
	)
	test.deepEqual(
		getDaTermTypes({ queries: { dnaMethylation: { elementTypes: [{ key: 'enhancer' }] }, junction: {} } }),
		['dnaMethylation'],
		'should offer methylation by element class alone, and no splicing without junction clusters'
	)
	test.deepEqual(
		getDaTermTypes({ queries: {}, termType2terms: { [TermTypeGroups.PSEUDOBULK]: [{ id: 'x' }] } }),
		['geneExpression'],
		'should offer gene expression for pseudobulk alone'
	)
	test.end()
})

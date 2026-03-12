import tape from 'tape'
import { SingleCellGeneExpressionBase, getSCGEunit } from '../singleCellGeneExpression.ts'
import { GENE_EXPRESSION, SINGLECELL_GENE_EXPRESSION } from '#shared/terms.js'

/*************************
 reusable helper functions
**************************/

const mockVocabApi = {
	termdbConfig: {
		queries: {
			singleCell: {
				geneExpression: { unit: 'log2 CPM' }
			}
		}
	}
}

const mockVocabApiNoUnit = {
	termdbConfig: {
		queries: {
			singleCell: {
				geneExpression: {}
			}
		}
	}
}

function getValidRawTerm(overrides: any = {}) {
	return {
		type: SINGLECELL_GENE_EXPRESSION,
		gene: 'TP53',
		sample: 'Tumor cells',
		...overrides
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- tw/singleCellGeneExpression -***-')
	test.end()
})

tape('getSCGEunit() should return configured unit and fallback default unit', test => {
	test.equal(getSCGEunit(mockVocabApi as any), 'log2 CPM', 'Should return configured unit from termdbConfig')
	test.equal(getSCGEunit(mockVocabApiNoUnit as any), 'Gene Expression', 'Should fallback to default unit')
	test.end()
})

tape('validate() should throw on invalid terms', test => {
	test.throws(
		() => SingleCellGeneExpressionBase.validate(null as any),
		/term is not an object/,
		'Should throw when term is not an object'
	)

	test.throws(
		() => SingleCellGeneExpressionBase.validate({ type: GENE_EXPRESSION } as any),
		/incorrect term.type='geneExpression'/,
		'Should throw when term.type is incorrect'
	)

	test.throws(
		() =>
			SingleCellGeneExpressionBase.validate({
				type: SINGLECELL_GENE_EXPRESSION,
				sample: 'Tumor cells'
			} as any),
		/no gene or name present/,
		'Should throw when both gene and name are missing'
	)

	test.throws(
		() =>
			SingleCellGeneExpressionBase.validate({
				type: SINGLECELL_GENE_EXPRESSION,
				gene: 123,
				name: 'Bad gene',
				sample: 'Tumor cells'
			} as any),
		/singleCellGeneExpression term.gene must be non-empty string/,
		'Should throw when gene is not a non-empty string'
	)

	test.throws(
		() =>
			SingleCellGeneExpressionBase.validate({
				type: SINGLECELL_GENE_EXPRESSION,
				gene: 'TP53'
			} as any),
		/missing sample name/,
		'Should throw when sample is missing'
	)

	test.end()
})

tape('fill() should populate missing name and unit', test => {
	const term = getValidRawTerm({ name: undefined, unit: undefined })
	SingleCellGeneExpressionBase.fill(term as any, { vocabApi: mockVocabApi as any } as any)

	test.equal(term.unit, 'log2 CPM', 'Should set unit from vocabApi')
	test.equal(term.name, 'TP53 log2 CPM', 'Should set generated name from gene and unit')
	test.end()
})

tape('fill() should not overwrite existing name', test => {
	const term = getValidRawTerm({ name: 'Custom label', unit: undefined })
	SingleCellGeneExpressionBase.fill(term as any, { vocabApi: mockVocabApi as any } as any)

	test.equal(term.name, 'Custom label', 'Should preserve existing name')
	test.equal(term.unit, undefined, 'Should not force unit when name already exists')
	test.end()
})

tape('fill() should no-op for class instances', test => {
	const instance = new SingleCellGeneExpressionBase(getValidRawTerm(), { vocabApi: mockVocabApi as any } as any)
	test.doesNotThrow(
		() => SingleCellGeneExpressionBase.fill(instance as any, { vocabApi: mockVocabApi as any } as any),
		'Should not throw when fill is called on instance'
	)
	test.end()
})

tape('constructor should set fields and use configured unit', test => {
	const term = getValidRawTerm({ unit: undefined })
	const x = new SingleCellGeneExpressionBase(term as any, { vocabApi: mockVocabApi as any } as any)

	test.equal(x.type, SINGLECELL_GENE_EXPRESSION, 'Should set type')
	test.equal(x.gene, 'TP53', 'Should set gene')
	test.equal(x.sample, 'Tumor cells', 'Should set sample')
	test.equal(x.unit, 'log2 CPM', 'Should set configured unit when term.unit is missing')
	test.end()
})

tape('constructor should use default unit when config unit is missing', test => {
	const term = getValidRawTerm({ unit: undefined })
	const x = new SingleCellGeneExpressionBase(term as any, { vocabApi: mockVocabApiNoUnit as any } as any)

	test.equal(x.unit, 'Gene Expression', 'Should fallback to default unit')
	test.end()
})

tape('constructor should preserve explicit term.unit', test => {
	const term = getValidRawTerm({ unit: 'Custom Unit' })
	const x = new SingleCellGeneExpressionBase(term as any, { vocabApi: mockVocabApi as any } as any)

	test.equal(x.unit, 'Custom Unit', 'Should preserve explicit term.unit')
	test.end()
})

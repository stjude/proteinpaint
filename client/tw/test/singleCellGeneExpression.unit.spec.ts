import tape from 'tape'
import { SingleCellGeneExpressionBase, getSCGEunit, getSampleAssayInfo } from '../singleCellGeneExpression.ts'
import { GENE_EXPRESSION, SINGLECELL_GENE_EXPRESSION } from '#types'

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

/* ---- getSampleAssayInfo() ---- */

/** Run fn with window.fetch stubbed: a payload object is served as a JSON
 Response (the shape dofetch3's processResponse expects); an Error rejects.
 Counts the calls so the no-request branches can assert none happened. */
async function withMockFetch(payload: any, fn: (calls: { n: number }) => Promise<void>) {
	const realFetch = window.fetch
	const calls = { n: 0 }
	window.fetch = (async () => {
		calls.n++
		if (payload instanceof Error) throw payload
		return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } })
	}) as any
	try {
		await fn(calls)
	} finally {
		window.fetch = realFetch
	}
}

// getSampleAssayInfo only reads vocabApi.vocab for the request body
const assayVocabApi = { vocab: { genome: 'hg38-test', dslabel: 'MockDs' } } as any

tape('getSampleAssayInfo() should return the panel assay with its gene list', async test => {
	await withMockFetch({ assay: 'panel', genes: ['ACE2', 'ACTA2', 'PTPRC'] }, async () => {
		const info = await getSampleAssayInfo(assayVocabApi, { sID: 'assay-panel-sample' })
		test.equal(info.assay, 'panel', 'Should report the panel assay')
		test.deepEqual(info.genes, ['ACE2', 'ACTA2', 'PTPRC'], 'Should return the assayed gene list for the search boxes')
	})
	test.end()
})

tape('getSampleAssayInfo() should return whole-transcriptome without a gene list', async test => {
	// the server sends genes only for panel samples; without them the search
	// boxes stay on the genome gene db
	await withMockFetch({ assay: 'wholeTranscriptome' }, async () => {
		const info = await getSampleAssayInfo(assayVocabApi, { sID: 'assay-wt-sample' })
		test.equal(info.assay, 'wholeTranscriptome', 'Should report the whole-transcriptome assay')
		test.equal(info.genes, undefined, 'Should not return a gene list')
	})
	test.end()
})

tape('getSampleAssayInfo() should fall back to {} on a failed request', async test => {
	await withMockFetch(new Error('mock network failure'), async () => {
		const info = await getSampleAssayInfo(assayVocabApi, { sID: 'assay-error-sample' })
		test.deepEqual(info, {}, 'Should return {} so gene search falls back to the genome gene db')
	})
	test.end()
})

tape('getSampleAssayInfo() should not request anything without a sample', async test => {
	await withMockFetch({ assay: 'panel', genes: ['PTPRC'] }, async calls => {
		test.deepEqual(await getSampleAssayInfo(assayVocabApi, undefined), {}, 'Should return {} for no sample')
		test.deepEqual(await getSampleAssayInfo(assayVocabApi, { sID: '' }), {}, 'Should return {} for an empty sID')
		test.equal(calls.n, 0, 'Should make no request at all')
	})
	test.end()
})

import tape from 'tape'
import * as d3s from 'd3-selection'
import { SearchHandler } from '../singleCellGeneExpression.ts'
import { SINGLECELL_GENE_EXPRESSION } from '#shared/terms.js'

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s.select('body').append('div')
}

function getUsecase(sample: any = { id: 'sample-A' }) {
	return {
		target: 'sampleScatter',
		detail: 'term',
		specialCase: {
			config: { sample }
		}
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/handlers/singleCellGeneExpression -***-')
	test.end()
})

tape('validateOpts() should require callback, app, holder, genomeObj, and usecase.specialCase.config.sample', test => {
	const handler = new SearchHandler()
	const holder = getHolder()

	test.throws(
		() =>
			handler.validateOpts({
				holder,
				app: { vocabApi: { termdbConfig: { queries: { singleCell: { geneExpression: {} } } } } },
				genomeObj: {},
				usecase: getUsecase()
			}),
		/callback is required/,
		'Should throw when callback is missing'
	)

	test.throws(
		() =>
			handler.validateOpts({
				holder,
				callback: () => {},
				genomeObj: {},
				usecase: getUsecase()
			}),
		/app is required/,
		'Should throw when app is missing'
	)

	test.throws(
		() =>
			handler.validateOpts({
				callback: () => {},
				app: { vocabApi: { termdbConfig: {} } },
				genomeObj: {},
				usecase: getUsecase()
			}),
		/holder is required/,
		'Should throw when holder is missing'
	)

	test.throws(
		() =>
			handler.validateOpts({
				holder,
				callback: () => {},
				app: { vocabApi: { termdbConfig: {} } },
				usecase: getUsecase()
			}),
		/genomeObj is required/,
		'Should throw when genomeObj is missing'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('selectGene() should throw when no gene is selected', async test => {
	const handler = new SearchHandler()
	handler.app = { vocabApi: { termdbConfig: {} } } as any
	handler.callback = () => {}

	try {
		await handler.selectGene(undefined, { id: 'sample-A' })
		test.fail('Should throw when no gene is selected')
	} catch (e) {
		test.match(String(e), /No gene selected/, 'Should throw expected message when gene is missing')
	}

	test.end()
})

tape('selectGene() should call callback with configured unit and default unit fallback', async test => {
	const handler = new SearchHandler()
	const sample = { id: 'sample-A', type: 'tumor' }
	let selected: any

	handler.callback = t => {
		selected = t
	}
	handler.app = {
		vocabApi: {
			termdbConfig: {
				queries: {
					singleCell: {
						geneExpression: { unit: 'log2 CPM' }
					}
				}
			}
		}
	} as any

	await handler.selectGene('TP53', sample)
	test.equal(selected?.gene, 'TP53', 'Should pass selected gene')
	test.equal(selected?.name, 'TP53 log2 CPM', 'Should include configured unit in term name')
	test.equal(selected?.type, SINGLECELL_GENE_EXPRESSION, 'Should set type to singleCellGeneExpression')
	test.deepEqual(selected?.sample, sample, 'Should pass through selected sample')

	handler.app = { vocabApi: { termdbConfig: { queries: { singleCell: { geneExpression: {} } } } } } as any
	await handler.selectGene('GATA3', sample)
	test.equal(selected?.name, 'GATA3 Gene Expression', 'Should use default unit when config unit is not provided')

	test.end()
})

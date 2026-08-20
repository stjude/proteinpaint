import tape from 'tape'
import { SearchHandler } from '../geneExpression.ts'
import { TermTypes } from '#types'

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/handlers/geneExpression -***-')
	test.end()
})

tape('selectGene() should throw when no gene is selected', async test => {
	const handler = new SearchHandler()
	handler.app = { vocabApi: { termdbConfig: { queries: { geneExpression: {} } } } } as any
	handler.callback = () => {}

	try {
		await handler.selectGene(undefined)
		test.fail('Should throw when no gene is selected')
	} catch (e) {
		test.match(String(e), /No gene selected/, 'Should throw expected message when gene is missing')
	}

	test.end()
})

tape('selectGene() should call callback with configured unit from termdbConfig', async test => {
	const handler = new SearchHandler()
	let selected: any

	handler.callback = t => {
		selected = t
	}
	handler.app = {
		vocabApi: {
			termdbConfig: {
				queries: {
					geneExpression: { unit: 'log2 TPM' }
				}
			}
		}
	} as any

	await handler.selectGene({ geneSymbol: 'TP53' })
	test.equal(selected?.term.gene, 'TP53', 'Should pass selected gene')
	test.equal(selected?.term.name, 'TP53 log2 TPM', 'Should include configured unit in term name')
	test.equal(selected?.term.type, TermTypes.GENE_EXPRESSION, 'Should set type to geneExpression')

	test.end()
})

tape('selectGene() should use default unit when not configured', async test => {
	const handler = new SearchHandler()
	let selected: any

	handler.callback = t => {
		selected = t
	}
	handler.app = {
		vocabApi: {
			termdbConfig: {
				queries: {}
			}
		}
	} as any

	await handler.selectGene({ geneSymbol: 'BRCA1' })
	test.equal(selected?.term.gene, 'BRCA1', 'Should pass selected gene')
	test.equal(selected?.term.name, 'BRCA1 Gene Expression', 'Should use default unit when config unit is not provided')
	test.equal(selected?.term.type, TermTypes.GENE_EXPRESSION, 'Should set type to geneExpression')

	test.end()
})

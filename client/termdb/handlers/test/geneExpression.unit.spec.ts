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

	handler.sampleTypeSelect = [
		{ property: key => (key == 'checked' ? true : 1) },
		{ property: key => (key == 'checked' ? false : 2) }
	] as any

	await handler.selectGene({ geneSymbol: 'TP53' })
	test.deepEqual(selected?.sampleTypes, [1], 'Should pass selected sampleTypes as array')
	test.equal(selected?.gene, 'TP53', 'Should pass selected gene')
	test.equal(selected?.name, 'TP53 log2 TPM', 'Should include configured unit in name')
	test.equal(selected?.type, TermTypes.GENE_EXPRESSION, 'Should set type to geneExpression')

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
	test.equal(selected?.sampleTypes, undefined, 'Should include sampleTypes key with undefined value when not provided')
	test.equal(selected?.gene, 'BRCA1', 'Should pass selected gene')
	test.equal(selected?.name, 'BRCA1 Gene Expression', 'Should use default unit when config unit is not provided')
	test.equal(selected?.type, TermTypes.GENE_EXPRESSION, 'Should set type to geneExpression')

	test.end()
})

tape('selectGene() should require at least one sample type when selector is rendered', async test => {
	const handler = new SearchHandler()
	let called = false
	let alertMsg = ''
	const oldAlert = window.alert

	handler.callback = () => {
		called = true
	}
	handler.app = {
		vocabApi: {
			termdbConfig: {
				queries: {}
			}
		}
	} as any
	handler.sampleTypeSelect = [{ property: key => (key == 'checked' ? false : 1) }] as any

	window.alert = (msg: any) => {
		alertMsg = msg
	}
	await handler.selectGene({ geneSymbol: 'BRCA1' })
	window.alert = oldAlert

	test.equal(called, false, 'Should not call callback when no sample type is selected')
	test.equal(alertMsg, 'Must select at least one sample type', 'Should notify user to select sample type')
	test.end()
})

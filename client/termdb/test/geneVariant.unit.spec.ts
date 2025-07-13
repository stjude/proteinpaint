import tape from 'tape'
import { SearchHandler } from '../handlers/geneVariant.ts'

const handler = new SearchHandler()

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- geneVariant search handler -***-')
	test.end()
})

tape('selectGene()', async function (test) {
	test.timeoutAfter(100)
	test.plan(5)
	let search, actualTerm, expectedTerm, message

	handler.callback = term => (actualTerm = term)
	search = {
		chr: 'chr17',
		start: 7661778,
		stop: 7687538,
		geneSymbol: 'TP53',
		fromWhat: 'TP53'
	}
	await handler.selectGene(search)
	expectedTerm = {
		kind: 'gene',
		id: 'TP53',
		gene: 'TP53',
		name: 'TP53',
		type: 'geneVariant'
	}
	test.deepEqual(actualTerm, expectedTerm, 'should return correct term when searching by gene symbol')

	search = {
		chr: 'chr17',
		start: 7661778,
		stop: 7687538,
		fromWhat: 'Valid coordinate'
	}
	await handler.selectGene(search)
	expectedTerm = {
		kind: 'coord',
		id: 'chr17:7661779-7687538',
		chr: 'chr17',
		start: 7661778,
		stop: 7687538,
		name: 'chr17:7661779-7687538',
		type: 'geneVariant'
	}
	test.deepEqual(actualTerm, expectedTerm, 'should return correct term when searching by coordinate')

	search = {
		start: 7661778,
		stop: 7687538,
		fromWhat: 'TP53'
	}
	message = 'should throw when no gene symbol and no chr'
	await verifyError(search, message)

	search = {
		chr: 'chr17',
		stop: 7687538,
		fromWhat: 'TP53'
	}
	message = 'should throw when no gene symbol and no start'
	await verifyError(search, message)

	search = {
		chr: 'chr17',
		start: 7661778,
		fromWhat: 'TP53'
	}
	message = 'should throw when no gene symbol and no stop'
	await verifyError(search, message)

	async function verifyError(search, message) {
		try {
			await handler.selectGene(search)
			test.fail(message)
		} catch (e: any) {
			test.pass(`${message}: ${e.message || e}`)
		}
	}
})

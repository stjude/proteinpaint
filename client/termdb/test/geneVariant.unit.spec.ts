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

tape('selectGene()', function (test) {
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
	handler.selectGene(search)
	expectedTerm = {
		name: 'TP53',
		genes: [
			{
				kind: 'gene',
				id: 'TP53',
				gene: 'TP53',
				name: 'TP53',
				type: 'geneVariant'
			}
		],
		type: 'geneVariant'
	}
	test.deepEqual(actualTerm, expectedTerm, 'should return correct term when searching by gene symbol')

	search = {
		chr: 'chr17',
		start: 7661778,
		stop: 7687538,
		fromWhat: 'Valid coordinate'
	}
	handler.selectGene(search)
	expectedTerm = {
		name: 'chr17:7661779-7687538',
		genes: [
			{
				kind: 'coord',
				chr: 'chr17',
				start: 7661778,
				stop: 7687538,
				name: 'chr17:7661779-7687538',
				type: 'geneVariant'
			}
		],
		type: 'geneVariant'
	}
	test.deepEqual(actualTerm, expectedTerm, 'should return correct term when searching by coordinate')

	search = {
		start: 7661778,
		stop: 7687538,
		fromWhat: 'TP53'
	}
	message = 'should throw when no gene symbol and no chr'
	verifyError(search, message)

	search = {
		chr: 'chr17',
		stop: 7687538,
		fromWhat: 'TP53'
	}
	message = 'should throw when no gene symbol and no start'
	verifyError(search, message)

	search = {
		chr: 'chr17',
		start: 7661778,
		fromWhat: 'TP53'
	}
	message = 'should throw when no gene symbol and no stop'
	verifyError(search, message)

	function verifyError(search, message) {
		try {
			handler.selectGene(search)
			test.fail(message)
		} catch (e: any) {
			test.pass(`${message}: ${e.message || e}`)
		}
	}
	test.end()
})

tape('selectGeneSet()', function (test) {
	let actualTerm
	handler.callback = term => (actualTerm = term)
	const result = { geneList: [{ gene: 'CTNNB1' }, { gene: 'TP53' }] }
	handler.selectGeneSet(result)
	const expectedTerm = {
		name: 'CTNNB1, TP53',
		genes: [
			{
				kind: 'gene',
				id: 'CTNNB1',
				gene: 'CTNNB1',
				name: 'CTNNB1',
				type: 'geneVariant'
			},
			{
				kind: 'gene',
				id: 'TP53',
				gene: 'TP53',
				name: 'TP53',
				type: 'geneVariant'
			}
		],
		type: 'geneVariant'
	}
	test.deepEqual(actualTerm, expectedTerm, 'should return correct term when searching by gene set')
	test.end()
})

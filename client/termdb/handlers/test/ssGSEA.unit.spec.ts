import tape from 'tape'
import * as d3s from 'd3-selection'
import { SearchHandler } from '../ssGSEA.ts'

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s.select('body').append('div')
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/handlers/ssGSEA -***-')
	test.end()
})

tape('init() should throw when genomeObj.termdbs is missing', async test => {
	const handler = new SearchHandler()
	const holder = getHolder()

	try {
		await handler.init({
			holder,
			callback: () => {},
			app: {},
			genomeObj: { name: 'hg38' }
		})
		test.fail('Should throw when genesetDbName is missing')
	} catch (e) {
		test.match(String(e), /genesetDbName missing/, 'Should throw expected error message')
	}

	if (test['_ok']) holder.remove()
	test.end()
})

tape('init() should throw when genomeObj.termdbs is empty', async test => {
	const handler = new SearchHandler()
	const holder = getHolder()

	try {
		await handler.init({
			holder,
			callback: () => {},
			app: {},
			genomeObj: { name: 'hg38', termdbs: {} }
		})
		test.fail('Should throw when no databases are available')
	} catch (e) {
		test.match(String(e), /genesetDbName missing/, 'Should throw expected error message for empty termdbs')
	}

	if (test['_ok']) holder.remove()
	test.end()
})

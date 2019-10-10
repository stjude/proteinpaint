const tape = require('tape')
const d3s = require('d3-selection')
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'SJLife',
		genome: 'hg38'
	},
	debug: 1,
	fetchOpts: {
		serverData: helpers.serverData
	}
})

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- tdb.tree.search -***-')
	test.end()
})

tape('term search', function(test) {
	test.timeoutAfter(1000)
	test.plan(3)

	runpp({
		callbacks: {
			search: {
				'postInit.test': testSearchNoresult
			}
		}
	})

	function testSearchNoresult(search) {
		search.Inner.main({ str: 'xxxyyyzz' })
		search.on('postRender', () => {
			const div = search.Inner.dom.resultDiv.select('div').node()
			test.equal(div.innerHTML, 'No match', 'should show "No match"')
			testSearchHasresult(search)
		})
	}
	function testSearchHasresult(search) {
		search.Inner.main({ str: 'cardio' })
		search.on('postRender', () => {
			const table = search.Inner.dom.resultDiv.select('table').node()
			test.equal(table.childNodes.length, 3, 'should show 3 matching entries')
			testResult(search)
		})
	}

	function testResult(search) {
		search.Inner.dom.resultDiv
			.select('table')
			.node()
			.childNodes[0].childNodes[0].click()
		search.Inner.app.on('postRender', () => {
			test.ok(
				search.Inner.app.Inner.dom.holder.selectAll('.termdiv').nodes().length > 10,
				'should be showing more than 10 terms'
			)

			search.on('postRender', null)
			test.end()
		})
	}
})

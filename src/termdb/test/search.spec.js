const tape = require('tape')
const d3s = require('d3-selection')
const serverconfig = require('../../../serverconfig')
const host = 'http://localhost:' + serverconfig.port
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
	test.plan(2)

	runpp({
		callbacks: {
			search: {
				'postInit.test': runTests
			}
		}
	})

	function runTests(search) {
		search.on('postInit.test', null)
		helpers
			.rideInit({ arg: search })
			.run(triggerSearch)
			.run(testSearchResult, 100)
			.run(triggerClickTerm)
			.run(testClickResult, 100)
			.done(() => test.end())
	}

	function triggerSearch(search) {
		search.Inner.main({ str: 'cardio' })
	}

	function testSearchResult(search) {
		const table = search.Inner.dom.resultDiv.select('table').node()
		test.equal(table.childNodes.length, 3, 'should show 3 matching entries')
	}

	function triggerClickTerm(search) {
		search.Inner.dom.resultDiv
			.select('table')
			.node()
			.childNodes[0].childNodes[0].click()
	}
	function testClickResult(search) {
		test.ok(
			search.Inner.app.Inner.dom.holder.selectAll('.termdiv').nodes().length > 10,
			'should be showing more than 10 terms'
		)
	}
})

// given modifier_click_term, see if search result show as buttons

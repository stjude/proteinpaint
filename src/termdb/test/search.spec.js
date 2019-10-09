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
	test.plan(1)

	runpp({
		state: {
			dslabel: 'SJLife',
			genome: 'hg38'
		},
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
			.run(testSearch, 100)
			.run(testViewButton)
			.run(testTreeButton)
			.done(() => test.end())
	}

	function triggerSearch(search){
		search.Inner.app.dispatch({ type: 'search_', str: 'cardio' })
	}

	function testSearch(search) {
		const table = search.Inner.dom.resultDiv.select('table').node()
		test.equal(table.childNodes.length, 3, 'should show 3 matching entries')
	}

	function testViewButton(search) {
		const table = search.Inner.dom.resultDiv.select('table').node()
		// click on the view button of the first term <tr> in table, see if loads
	}
	function testTreeButton(search) {
		const table = search.Inner.dom.resultDiv.select('table').node()
		// click on the Tree button of first term in table, see if loads
	}
})

// given modifier_click_term, see if search result show as buttons

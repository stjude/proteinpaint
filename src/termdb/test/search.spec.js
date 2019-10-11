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
	test.pass('-***- termdb/search -***-')
	test.end()
})

tape('term search', function(test) {
	test.timeoutAfter(1000)

	runpp({
		callbacks: {
			search: {
				'postInit.test': runTests
			}
		}
	})

	function runTests(search) {
		const tree = search.Inner.app.components('tree')

		helpers
			.rideInit({ arg: search, bus: search, eventType: 'postRender.test' })
			.use(triggerSearchNoResult)
			.to(testSearchNoResult)
			.use(triggerSearchHasResult)
			.to(testSearchHasResult)
			.use(triggerClickTerm)
			.to(testClickResult, { arg: tree, bus: tree })
			// or instead of the preceding .to(..., opts={}) pattern,
			// instead use the .change().to() pattern below
			/*
			.change({ arg: tree, bus: tree })
			.to(testClickResult)
			*/
			.done(test)
	}

	function triggerSearchNoResult(search) {
		search.Inner.main({ str: 'xxxyyyzz' })
	}

	function testSearchNoResult(search) {
		const div = search.Inner.dom.resultDiv.select('div').node()
		test.equal(div.innerHTML, 'No match', 'should show "No match"')
	}

	function triggerSearchHasResult(search) {
		search.Inner.main({ str: 'cardio' })
	}

	function testSearchHasResult(search) {
		const table = search.Inner.dom.resultDiv.select('table').node()
		test.equal(table.childNodes.length, 3, 'should show 3 matching entries')
	}

	function triggerClickTerm(search) {
		search.Inner.dom.resultDiv
			.select('table')
			.node()
			.childNodes[0].childNodes[0].click()
	}

	function testClickResult(tree) {
		test.ok(tree.Inner.dom.holder.selectAll('.termdiv').nodes().length > 10, 'should show more than 10 terms')
	}
})

// given modifier_click_term, see if search result show as buttons

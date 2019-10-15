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

tape('term search, default behavior', function(test) {
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
		test.ok(tree.Inner.dom.treeDiv.selectAll('.termdiv').nodes().length > 10, 'should show more than 10 terms')
	}
})

tape('modifiers: click_term', test=> {
	test.timeoutAfter(1000)

	runpp({
		modifiers: {
			click_term: modifier_callback
		},
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
			.use(triggerSearch)
			.to(testSearchResult)
			.done(test)
	}
	function triggerSearch(search) {
		search.Inner.main({ str: 'cardio' })
	}
	function testSearchResult(search) {
		const buttons = search.Inner.dom.resultDiv.node()
			.getElementsByClassName('sja_filter_tag_btn add_term_btn')
		test.equal(buttons.length, 3, 'should show 3 buttons')
		buttons[0].click()
	}
	function modifier_callback(term) {
		test.ok(graphable(term), 'modifier callback called with a graphable term')
	}
})


function graphable(term) {
	if (!term) throw 'missing term'
	return term.iscategorical || term.isinteger || term.isfloat || term.iscondition
}

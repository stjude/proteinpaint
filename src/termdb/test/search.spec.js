const tape = require('tape')
const d3s = require('d3-selection')
const helpers = require('../../../test/front.helpers.js')

/*
Note:
these tests are dependent on SJLife termdb data.
if data updates, these tests may also needs to be updated
*/

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
			.use(triggerFirstSearch)
			.to(testFirstSearch)
			.use(triggerClickResult_firstSearch)
			.to(testClickResult_firstSearch, { arg: tree, bus: tree })
			.use(triggerSecondSearch_samebranchas1st)
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

	function triggerFirstSearch(search) {
		search.Inner.main({ str: 'cardio' })
	}

	let searchResultBtns
	function testFirstSearch(search) {
		searchResultBtns = search.Inner.dom.resultDiv.select('table').selectAll('.sja_menuoption')
		test.equal(searchResultBtns.size(), 3, 'search result should show 3 buttons')
	}

	let clickedTerm_firstSearch
	function triggerClickResult_firstSearch(search) {
		const btn1 = searchResultBtns.nodes()[0]
		btn1.click()
		d3s.select(btn1).each(function(d) {
			clickedTerm_firstSearch = d
		})
	}

	function testClickResult_firstSearch(tree) {
		const termdivs = tree.Inner.dom.treeDiv.selectAll('.termdiv')
		test.ok(termdivs.nodes().length > 10, 'updated tree should show more than 10 terms')
		test.equal(
			termdivs.filter(i => i.id == clickedTerm_firstSearch.id).size(),
			1,
			'clicked term now appears in the updated tree'
		)
		test.ok(
			tree.Inner.components.plots[clickedTerm_firstSearch.id],
			'clicked term ID is now a key in tree.components.plots{}'
		)
	}

	// second search, on the same branch as the first search
	function triggerSecondSearch_samebranchas1st(search) {
		// somehow this function doesn't run
		search.Inner.main({ str: 'asthma' })
	}
})

tape('modifiers: click_term', test => {
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
		const buttons = search.Inner.dom.resultDiv.node().getElementsByClassName('sja_filter_tag_btn add_term_btn')
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

import tape from 'tape'
import * as d3s from 'd3-selection'
import * as helpers from '../../test/front.helpers.js'

/*
Tests:
	term search, default behavior with barchart usecase
	click_term
	tree.click_term2select_tvs

Note:
these tests are dependent on TermdbTest termdb data.
if data updates, these tests may also needs to be updated
*/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38-test'
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/search -***-')
	test.end()
})

tape('term search, default behavior with barchart usecase', function (test) {
	test.timeoutAfter(5000)
	runpp({
		state: {
			tree: {
				usecase: { target: 'barchart', detail: 'term' }
			}
		},
		search: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(search) {
		search.on('postRender.test', null)
		const tree = search.Inner.app.getComponents('tree')

		helpers
			.rideInit({ arg: search, bus: search, eventType: 'postSearch' })
			.use(triggerSearchNoResult)
			.to(testSearchNoResult)
			.use(triggerFirstSearch)
			.to(testFirstSearch)
			.use(triggerClickResult_firstSearch)
			.to(testClickResult_firstSearch, { arg: tree, bus: tree, eventType: 'postRender' })
			// .use(triggerSecondSearch_samebranchas1st)
			// .use(triggerSearchExcludedType)
			// .to(testExcludedTypeResult)
			.done(test)
	}

	function triggerSearchNoResult(search) {
		search.Inner.doSearch('xxxyyyzz')
	}

	function testSearchNoResult(search) {
		const div = search.Inner.dom.resultDiv_terms.select('div').node()
		test.equal(div.innerHTML, 'No match', 'should show "No match"')
	}

	function triggerFirstSearch(search) {
		search.Inner.doSearch('cardio')
	}

	let searchResultBtns
	function testFirstSearch(search) {
		searchResultBtns = search.Inner.dom.resultDiv_terms.select('table').selectAll('.sja_menuoption')
		test.equal(searchResultBtns.size(), 3, 'search result should show 3 buttons')
	}

	let clickedTerm_firstSearch
	function triggerClickResult_firstSearch(search) {
		const btn1 = searchResultBtns.nodes()[0]
		btn1.click()
		clickedTerm_firstSearch = btn1.__data__
	}

	function testClickResult_firstSearch(tree) {
		const termdivs = tree.Inner.dom.holder.selectAll('.termdiv')
		test.ok(termdivs.nodes().length > 3, 'updated tree should show more than 3 terms')
		test.equal(
			termdivs.filter(i => i.id == clickedTerm_firstSearch.id).size(),
			1,
			'clicked term now appears in the updated tree'
		)
	}

	// function triggerSearchExcludedType(search) {
	// 	search.Inner.doSearch('survival')
	// }

	// function testExcludedTypeResult(search) {
	// 	const div = search.Inner.dom.resultDiv_terms.select('table').node()
	// 	test.equal(div?.innerHTML, 'No match', 'should not show excluded types in results')
	// }
})

tape('click_term', test => {
	test.timeoutAfter(1000)

	runpp({
		tree: {
			click_term: modifier_callback,
			disable_terms: [{ id: 'Cardiomyopathy', type: 'condition' }]
		},
		search: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let app
	function runTests(search) {
		search.on('postRender.test', null)
		app = search.Inner.app
		const tree = search.Inner.app.getComponents('tree')
		helpers
			.rideInit({ arg: search, bus: search, eventType: 'postSearch' })
			.use(triggerSearch, { wait: 200 })
			.to(testSearchResult, { wait: 100 })
			.run(testClearedResults, { wait: 100 })
			.done(test)
	}
	function triggerSearch(search) {
		search.Inner.doSearch('cardio')
	}
	function testSearchResult(search) {
		const disabledlabels = search.Inner.dom.resultDiv_terms
			.node()
			.getElementsByClassName('sja_tree_click_term_disabled')
		test.equal(disabledlabels.length, 1, 'should show 1 disabled term')
		const buttons = search.Inner.dom.resultDiv_terms
			.node()
			.getElementsByClassName('sja_filter_tag_btn sja_tree_click_term')
		test.ok(buttons.length > 0, 'should show 1 or more clickable buttons')
		buttons[0].click()
	}
	function modifier_callback(term) {
		test.ok(app.vocabApi.graphable(term), 'click_term() called with a graphable term')
	}
	function testClearedResults(search) {
		const buttons = search.Inner.dom.resultDiv_terms
			.node()
			.getElementsByClassName('sja_filter_tag_btn sja_tree_click_term')
		test.equal(buttons.length, 0, 'should clear search results after a term is clicked')
		test.equal(search.Inner.dom.input.property('value'), '', 'should clear input text field after a term is clicked')
	}
})

tape('tree.click_term2select_tvs', test => {
	test.timeoutAfter(3000)
	test.plan(3)

	runpp({
		tree: {
			click_term2select_tvs: () => {},
			disable_terms: [{ id: 'Cardiomyopathy', type: 'condition' }]
		},
		search: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let tree, app
	function runTests(search) {
		search.on('postRender.test', null)
		app = search.Inner.app.Inner
		tree = app.components.tree
		helpers
			.rideInit({ arg: search, bus: search, eventType: 'postSearch' })
			.use(triggerSearch, { wait: 200 })
			.to(testSearchResult, { wait: 100 })
			.use(triggerTvsMenu)
			.to(testTvsMenu, { wait: 200, bus: tree, eventType: 'postRender' })
			.done(test)
	}
	function triggerSearch(search) {
		search.Inner.doSearch('cardio')
	}
	let buttons
	function testSearchResult(search) {
		buttons = search.Inner.dom.resultDiv_terms.node().getElementsByClassName('sja_filter_tag_btn sja_tree_click_term')
		test.ok(buttons.length > 0, 'should show 1 or more clickable buttons')
	}
	function triggerTvsMenu(search) {
		buttons[0].click()
	}
	function testTvsMenu(search) {
		test.equal(
			tree.Inner.dom.holder.style('display'),
			'none',
			'should hide the tree div when a search result is clicked to a open tvs menu'
		)
		test.notEqual(
			app.components.submenu.Inner.dom.holder.style('display'),
			'none',
			'should show the next div when a search result is clicked to a open tvs menu'
		)
	}
})

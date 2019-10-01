const tape = require('tape')
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('toy', {
  dslabel: 'SJLife',
	genome: 'hg38',
	debug: 1,
	fetchOpts: {
		serverData: helpers.serverData
	}
})

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- toy.app -***-')
	test.end()
})

// To-do: move rx.core tests to a separate spec file
tape('component access', function(test) {
	test.timeoutAfter(1000)
	test.plan(2)

	runpp({
		callbacks: {
			app: {
				'postInit.test': runTests
			}
		}
	})

	function runTests(app) {
		app.on('postInit.test', null)
		testComponentAccess1(app)
		testComponentAccess2(app)
		test.end()
	}

	function testComponentAccess1(app) {
		test.equal(
			app.components() && Object.keys(app.components()).length,
			2,
			'should be able to access app components() with empty argument'
		)
	}

	function testComponentAccess2(app) {
		const search = app.components('controls.search')
		test.equal(
			search && search.Inner && search.Inner.constructor && search.Inner.constructor.name,
			'ToySearch',
			'should be able to access app components() with string argument'
		)
	}
})

tape('default view', function(test) {
	test.timeoutAfter(2000)
	test.plan(5)

	runpp({
		callbacks: {
			app: {
				'postInit.test': runTests
			}
		}
	})

	function runTests(app) {
		app.on('postInit.test', null)
		// more reliable test promise chain format
		// that is less likely to need timeouts
		helpers
			.rideInit({
				bus: app,
				eventType: 'postNotify.test',
				arg: app
			})
			.run(testSearchDisplay, 100)
			.run(testTableWrapper, 100)
			.run(triggerTermAdd, 100)
			.run(testTermAdd, 100)
			.run(triggerTermRemove)
			.run(testTermRemove, 600)
			.run(triggerHideRow)
			.run(testHideRow, 100)
			.done(() => test.end())
	}

	function testSearchDisplay(app) {
		test.equal(app.Inner.dom.holder.selectAll('.tree_search').size(), 1, 'should have one search input')
	}

	function testTableWrapper(app) {
		test.equal(app.Inner.dom.holder.selectAll('.table-wrapper').size(), 0, 'should have no tables displayed')
	}

	function triggerTermAdd(app) {
		// !!! test against action when possible !!!
		// simpler than sequencing clicks, UI events
		app.dispatch({ type: 'term_add', termid: 'agedx' })
		app.dispatch({ type: 'term_add', termid: 'sex' })
	}

	function testTermAdd(app) {
		test.equal(app.Inner.dom.holder.selectAll('.table-wrapper').size(), 2, 'should have 2 tables displayed')
	}

	function triggerTermRemove(app) {
		// !!! test against action when possible !!!
		// simpler than sequencing clicks, UI events
		app.dispatch({ type: 'term_rm', termid: 'agedx' })
	}

	function testTermRemove(app) {
		test.equal(app.Inner.dom.holder.selectAll('.table-wrapper').size(), 1, 'should have 1 table displayed')
	}

	function triggerHideRow(app) {
		app.dispatch({ type: 'term_row_hide', row_name: 'graph' })
	}

	function testHideRow(app) {
		test.equal(
			app.Inner.dom.holder.selectAll('.table-wrapper').selectAll('tr')._groups[0][2].style.opacity,
			'0',
			'should remove row from table'
		)
	}
})

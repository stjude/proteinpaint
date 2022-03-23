const tape = require('tape')
const d3s = require('d3-selection')
const termjson = require('../../../test/testdata/termjson').termjson
const helpers = require('../../../test/front.helpers.js')

/*
Note:
these tests are dependent on TermdbTest termdb data.
if data updates, these tests may also needs to be updated
*/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38'
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- termdb/submenu -***-')
	test.end()
})

tape('no tree.click_term2select_tvs callback', function(test) {
	test.timeoutAfter(2000)

	runpp({
		state: {},
		app: {
			callbacks: {
				postInit: runTests
			}
		}
	})

	function runTests(app) {
		test.equal(app.Inner.components.submenu, undefined, 'should not have a submenu')
		test.end()
		if (test._ok) setTimeout(app.destroy, 1000)
	}
})

tape('with callback, but no submenu.term', function(test) {
	test.timeoutAfter(5000)

	runpp({
		state: {
			submenu: {}
		},
		tree: {
			click_term2select_tvs() {}
		},
		app: {
			callbacks: {
				postInit: runTests
			}
		}
	})

	function runTests(app) {
		test.equal(typeof app.Inner.components.submenu, 'object', 'should have a submenu')
		test.equal(app.Inner.components.tree.Inner.dom.holder.style('display'), 'block', 'should have a visible tree')
		test.equal(app.Inner.components.submenu.Inner.dom.holder.style('display'), 'none', 'should have a hidden submenu')
		test.end()
		if (test._ok) setTimeout(app.destroy, 1000)
	}
})

tape('with callback and submenu.term', function(test) {
	test.timeoutAfter(5000)

	runpp({
		state: {
			submenu: { type: 'tvs', term: termjson['sex'] }
		},
		tree: {
			click_term2select_tvs() {}
		},
		app: {
			callbacks: {
				postInit: runTests
			}
		}
	})

	function runTests(app) {
		test.equal(typeof app.Inner.components.submenu, 'object', 'should have a submenu')
		test.equal(app.Inner.components.tree.Inner.dom.holder.style('display'), 'none', 'should have a hidden tree')
		test.equal(app.Inner.components.submenu.Inner.dom.holder.style('display'), 'block', 'should have a visible submenu')
		test.end()
		if (test._ok) setTimeout(app.destroy, 1000)
	}
})

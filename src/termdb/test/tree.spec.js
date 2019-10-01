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
  serverData: helpers.serverData
})

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- tdb.tree -***-')
	test.end()
})

tape('error handling', function(test) {
	test.timeoutAfter(1000)
	test.plan(2)

	runpp({
		state: {
			genome: 'ahg38'
		},
		callbacks: {
			app: {
				'postRender.test': testWrongGenome
			}
		}
	})
	function testWrongGenome(app) {
		const d = app.Inner.dom.errdiv.selectAll('.sja_errorbar').select('div')
		test.equal(d.text(), 'Error: invalid genome', 'should show for invalid genome')
	}

	runpp({
		state: {
			dslabel: 'xxx',
		},
		callbacks: {
			app: {
				'postRender.test': testWrongDslabel
			}
		}
	})
	function testWrongDslabel(app) {
		const d = app.Inner.dom.errdiv.select('.sja_errorbar').select('div')
		test.equal(d.text(), 'Error: invalid dslabel', 'should show for invalid dslabel')
	}
})

tape('default view', function(test) {
	test.timeoutAfter(1000)
	test.plan(1)

	runpp({
		callbacks: {
			tree: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(tree) {
		tree.on('postRender.test', null)
		helpers
			.rideInit({ arg: tree })
			.run(testDom, 200)
			.done(() => test.end())
	}

	function testDom(tree) {
		test.equal(tree.Inner.dom.holder.selectAll('.termdiv').size(), 4, 'should have 4 root terms')
	}
})

tape('rehydrated from saved state', function(test) {
	test.timeoutAfter(1000)
	test.plan(2)

	runpp({
		state: {
			tree: {
				expandedTerms: ['root', 'Cancer-related Variables', 'Diagnosis']
			}
		},
		callbacks: {
			tree: {
				'postInit.test': runTests
			}
		}
	})

	function runTests(tree) {
		tree.on('postInit.test', null)
		helpers
			.rideInit({ arg: tree })
			.run(testDom, 200)
			.done(() => test.end())
	}

	function testDom(tree) {
		test.equal(tree.Inner.dom.holder.selectAll('.termdiv').size(), 9, 'should have 9 expanded terms')
		test.equal(tree.Inner.dom.holder.selectAll('.termbtn').size(), 7, 'should have 7 term toggle buttons')
	}
})

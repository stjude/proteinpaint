const tape = require('tape')
const helpers = require('../../../test/front.helpers.js')
const select = require('d3-selection').select

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
	test.pass('-***- termdb/tree -***-')
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
			dslabel: 'xxx'
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

tape('default view with user interactions', function(test) {
	test.timeoutAfter(1000)

	runpp({
		callbacks: {
			tree: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(tree) {
		testRoot(tree)
		helpers
			.rideInit({ arg: tree, bus: tree, eventType: 'postRender.test' })
			.use(expandTerm1)
			.to(testExpand1)
			.use(expandTerm2)
			.to(testExpand2)
			.use(clickViewBtn)
			.to(testPlot)
			.use(triggerFold)
			.to(testFold)
			.done(test)
	}

	function testRoot(tree) {
		test.equal(tree.Inner.dom.treeDiv.selectAll('.termdiv').size(), 4, 'should have 4 root terms')
	}

	function expandTerm1(tree) {
		// click the button of the first term
		tree.Inner.dom.treeDiv
			.select('.termbtn')
			.node()
			.click()
	}

	function testExpand1(tree) {
		const childdiv = tree.Inner.dom.treeDiv.select('.termchilddiv')
		test.equal(childdiv.style('display'), 'block', 'child DIV of first term is now visible')
		test.equal(childdiv.selectAll('.termdiv').size(), 3, 'child DIV now contains 3 sub terms')
	}

	function expandTerm2(tree) {
		// term1 has already been expanded
		// from child div of term1, expand the first child term
		/*
		this doesn't work, but must use getElementsByClassName as below
		tree.Inner.dom.treeDiv
			.select('.termchilddiv')
			.select('.termbtn')
			.node()
			.click()
			*/
		tree.Inner.dom.treeDiv
			.select('.termchilddiv')
			.node()
			.getElementsByClassName('termbtn')[0]
			.click()
	}
	function testExpand2(tree) {
		const divs = tree.Inner.dom.treeDiv
			.select('.termchilddiv')
			.select('.termchilddiv')
			.selectAll('.termdiv')
		test.equal(divs.size(), 2, 'should have 2 child terms')
	}
	function clickViewBtn(tree) {
		tree.Inner.dom.treeDiv
			.select('.termchilddiv')
			.select('.termchilddiv')
			.node()
			.getElementsByClassName('termview')[0]
			.click()
	}
	function testPlot(tree) {
		test.equal(Object.keys(tree.Inner.app.state().tree.plots).length, 1, 'now has 1 plot')
		// tree.postRender cannot be used to verify that the plot is successfully rendered
	}

	function triggerFold(tree) {
		tree.Inner.dom.treeDiv
			.select('.termbtn')
			.node()
			.click()
	}

	function testFold(tree) {
		const childdiv = tree.Inner.dom.treeDiv.select('.termchilddiv')
		test.equal(childdiv.style('display'), 'none', 'child DIV is now invisible')
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
				'postRender.test': testDom
			}
		}
	})

	function testDom(tree) {
		test.equal(tree.Inner.dom.treeDiv.selectAll('.termdiv').size(), 9, 'should have 9 expanded terms')
		test.equal(tree.Inner.dom.treeDiv.selectAll('.termbtn').size(), 7, 'should have 7 term toggle buttons')
	}
})

const tape = require('tape')
const helpers = require('../../../test/front.helpers.js')
const graphable = require('../../common/termutils').graphable

/*************************
 reusable helper functions
**************************/

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
	test.pass('-***- termdb/tree -***-')
	test.end()
})

tape('default behavior', function(test) {
	test.timeoutAfter(2000)

	runpp({
		tree: {
			callbacks: {
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
			.use(expandTerm1_child1)
			.to(testExpandTerm1_child1)
			.use(clickViewBtn_term1_child1_child1) // 1st click to show plot
			.to(testPlotCreated)
			.use(clickViewBtn_term1_child1_child1, { wait: 500 }) // 2nd click to hide plot, wait for term.__plot_isloading
			.to(testPlotFolded)
			.use(triggerFold)
			.to(testFold)
			.done(test)
	}

	function testRoot(tree) {
		test.equal(tree.Inner.dom.treeDiv.selectAll('.termdiv').size(), 4, 'should have 4 root terms')
	}

	let termbtn1, childdiv1
	function expandTerm1(tree) {
		const btns = tree.Inner.dom.treeDiv.node().querySelectorAll('.termbtn')
		termbtn1 = [...btns].find(elem => elem.__data__.name.startsWith('Cancer-related'))
		childdiv1 = termbtn1.parentNode.querySelectorAll('.termchilddiv')[0]
		// click the button of the first term
		termbtn1.click()
	}

	function testExpand1(tree) {
		test.equal(childdiv1.style.display, 'block', 'child DIV of first term is now visible')
		test.equal(childdiv1.querySelectorAll('.termdiv').length, 2, 'child DIV now contains 2 sub terms')
	}

	let childdiv2
	function expandTerm1_child1(tree) {
		// term1 has already been expanded
		// from child div of term1, expand the first child term
		/*
		this doesn't work, but must use getElementsByClassName as below
		!!! see reason below due to a surprising d3-selection.select behavior !!!
		
		tree.Inner.dom.treeDiv
			.select('.termchilddiv') // (Cancer-related Variables childdiv) 
			.select('.termbtn') // (Diagnosis button)
			// !!!
			// d3.selection.select will assign the parent elem (Cancer-related Variables childdiv) 
			// data to the select-ed child element (Diagnosis button),
			// and that will break the dispatch action.term since the bound term data 
			// was changed from Diagnosis term to Cancer-related Variables term
			// !!!
			.node()
			.click()
		*/
		/*
		// !!!
		// below works because there is no data binding changes
		// made, like in d3.selection.select
		// 
		// however, it's easier to use the native querySelect or 
		// querySelectorAll methods to ensure that the 
		// same button and divs are selected using
		// the **ordered** Nodelist index [0]
		// !!!
		// 
		tree.Inner.dom.treeDiv
			.select('.termchilddiv')
			.node()
			.getElementsByClassName('termbtn')[0]
			.click()
		*/

		const termbtn2 = childdiv1.querySelectorAll('.termdiv .termbtn')[0]
		childdiv2 = termbtn2.parentNode.querySelectorAll('.termchilddiv')[0]
		// click the button of the first term
		termbtn2.click()
	}
	function testExpandTerm1_child1(tree) {
		test.equal(childdiv2.style.display, 'block', 'child DIV of second term is now visible')
		test.equal(childdiv2.querySelectorAll('.termdiv').length, 2, 'child DIV now contains 2 sub terms')
	}
	function clickViewBtn_term1_child1_child1(tree) {
		// setup an optional middleware to test action type
		tree.Inner.app.middle(inspectAction)

		// clicking view button of term1 > child1 > child1
		// hardcoded to sjlife dataset
		childdiv2.querySelectorAll('.termview')[0].click()
	}

	let plot_action_type = 'plot_show'
	function inspectAction(action) {
		test.equal(action.type, plot_action_type, `view btn click should trigger ${plot_action_type} action`)
		// for second click, will hide plot instead of adding
		if (plot_action_type == 'plot_show') plot_action_type = 'plot_hide'
		// remove this function from middlewares after this test
		return { deactivate: true }
	}

	function testPlotCreated(tree) {
		test.equal(Object.keys(tree.Inner.state.visiblePlotIds).length, 1, 'now has 1 plot')
		// tree.postRender cannot be used to verify that the plot is successfully rendered
		// this is okay, will be tested independently by action-type in plot.spec
	}
	function testPlotFolded(tree) {
		test.equal(childdiv2.querySelectorAll('.termgraphdiv')[0].style.display, 'none', 'graphdiv is now hidden')
	}

	function triggerFold(tree) {
		termbtn1.click()
	}

	function testFold(tree) {
		test.equal(childdiv1.style.display, 'none', 'child DIV is now invisible')
	}
})

tape('click_term', test => {
	test.timeoutAfter(1000)
	runpp({
		tree: {
			click_term: modifier_callback,
			disable_terms: ['diaggrp'],
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(tree) {
		helpers
			.rideInit({ arg: tree, bus: tree, eventType: 'postRender.test' })
			.use(expandTerm1)
			.to(expandTerm1_child1)
			.to(testExpand_child1)
			.done(test)
	}
	let childdiv_term1
	function expandTerm1(tree) {
		const divs = tree.Inner.dom.treeDiv.node().querySelectorAll('.termdiv')
		const term1 = [...divs].find(elem => elem.__data__.name.startsWith('Cancer-related'))
		term1.querySelector('.termbtn').click()
		childdiv_term1 = term1.querySelector('.termchilddiv')
	}
	let childdiv_child1
	function expandTerm1_child1(tree) {
		const child1 = childdiv_term1.querySelector('.termdiv')
		child1.querySelector('.termbtn').click()
		childdiv_child1 = child1.querySelector('.termchilddiv')
	}
	function testExpand_child1(tree) {
		const disabledlabels = childdiv_child1.getElementsByClassName('sja_tree_click_term_disabled termlabel')
		test.ok(disabledlabels.length > 0, 'should have one or more disabled terms')
		const buttons = childdiv_child1.getElementsByClassName('sja_filter_tag_btn sja_tree_click_term termlabel')
		test.ok(buttons.length > 0, 'should have one or more child terms showing as buttons')
		buttons[0].click() // click this button and trigger the next test
	}
	function modifier_callback(term) {
		test.ok(graphable(term), 'modifier callback called with a graphable term')
	}
})

tape('rehydrated from saved state', function(test) {
	test.timeoutAfter(1000)
	test.plan(2)

	runpp({
		debugName: 'tdb',
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Diagnosis'],
				visiblePlotIds: ['diaggrp'],
				plots: {
					diaggrp: {
						id: 'diaggrp',
						term: { id: 'diaggrp' },
						settings: {
							currViews: ['barchart'],
							bar: { orientation: 'vertical' }
						}
					}
				}
			}
		},
		tree: {
			callbacks: {
				'postRender.test': testDom
			}
		}
	})

	function testDom(tree) {
		test.equal(tree.Inner.dom.treeDiv.selectAll('.termdiv').size(), 8, 'should have 8 expanded terms')
		test.equal(tree.Inner.dom.treeDiv.selectAll('.termbtn').size(), 6, 'should have 6 term toggle buttons')
	}
})

tape('error handling', function(test) {
	test.timeoutAfter(1000)
	test.plan(2)

	runpp({
		state: {
			genome: 'ahg38',
			termdbConfig: {}
		},
		app: {
			callbacks: {
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
			termdbConfig: {}
		},
		app: {
			callbacks: {
				'postRender.test': testWrongDslabel
			}
		}
	})
	function testWrongDslabel(app) {
		const d = app.Inner.dom.errdiv.select('.sja_errorbar').select('div')
		test.equal(d.text(), 'Error: invalid dslabel', 'should show for invalid dslabel')
	}
})

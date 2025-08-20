import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { termjson } from '../../test/testdata/termjson.js'

/*
Tests:
	default behavior
	default behavior, MSigDB (genome-level termdb, not ds)
	click_term
	click_term2select_tvs
	rehydrated from saved state
	error handling
	usecase
 */

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		vocab: {
			route: 'termdb',
			dslabel: 'TermdbTest',
			genome: 'hg38-test'
		}
	},
	debug: 1
})

const runppMsigdb = helpers.getRunPp('termdb', {
	state: {
		vocab: {
			route: 'termdb',
			dslabel: 'msigdb',
			genome: 'hg38-test'
		}
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/tree -***-')
	test.end()
})

tape('default behavior', function (test) {
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
			.use(triggerFold)
			.to(testFold)
			.done(test)
	}

	function testRoot(tree) {
		test.equal(tree.Inner.dom.holder.selectAll('.termdiv').size(), 5, 'should have 5 root terms')
	}
	const parentTerm = 'Demographic Variables'
	let termbtn1, childdiv1, parTermObj
	function expandTerm1(tree) {
		const btns = tree.Inner.dom.holder.node().querySelectorAll('.termbtn')
		termbtn1 = [...btns].find(elem => elem.__data__.name.startsWith(parentTerm))
		childdiv1 = termbtn1.parentNode.querySelectorAll('.termchilddiv')[0]
		// click the button of the first term
		termbtn1.click()
	}

	function testExpand1(tree) {
		parTermObj = Object.values(tree.Inner.termsById).find(d => d.name == parentTerm)
		test.equal(childdiv1.style.display, 'block', 'child DIV of first term is now visible')
		test.equal(
			childdiv1.querySelectorAll('.termdiv').length,
			parTermObj.terms.length,
			'child DIV now contains 2 sub terms'
		)
	}

	let childdiv2
	function expandTerm1_child1(tree) {
		// term1 has already been expanded
		// from child div of term1, expand the first child term
		/*
		this doesn't work, but must use getElementsByClassName as below
		!!! see reason below due to a surprising d3-selection.select behavior !!!
		
		tree.Inner.dom.holder
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
		tree.Inner.dom.holder
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
		parTermObj = Object.values(tree.Inner.termsById).find(d => d.name == parentTerm)
		test.equal(childdiv2.style.display, 'block', 'child DIV of second term is now visible')
		test.equal(
			childdiv2.querySelectorAll('.termdiv').length,
			parTermObj.terms[0].terms.length,
			'child DIV now contains 2 sub terms'
		)
	}

	function triggerFold(tree) {
		termbtn1.click()
	}

	function testFold(tree) {
		test.equal(childdiv1.style.display, 'none', 'child DIV is now invisible')
	}
})

tape('default behavior, MSigDB (genome-level termdb, not ds)', function (test) {
	test.timeoutAfter(2000)

	// this test is brief, in that the minified msigdb has only one parent level, and no expandable children

	runppMsigdb({
		tree: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(tree) {
		testRoot(tree)
		helpers.rideInit({ arg: tree, bus: tree, eventType: 'postRender.test' }).use(expandTerm1).to(testExpand1).done(test)
	}

	function testRoot(tree) {
		test.equal(tree.Inner.dom.holder.selectAll('.termdiv').size(), 2, 'should have 2 root terms')
	}
	const parentTerm = 'H: hallmark gene sets'
	let termbtn1, childdiv1, parTermObj
	function expandTerm1(tree) {
		const btns = tree.Inner.dom.holder.node().querySelectorAll('.termbtn')
		termbtn1 = [...btns].find(elem => elem.__data__.name.startsWith(parentTerm))
		childdiv1 = termbtn1.parentNode.querySelectorAll('.termchilddiv')[0]
		// click the button of the first term
		termbtn1.click()
	}

	function testExpand1(tree) {
		parTermObj = Object.values(tree.Inner.termsById).find(d => d.name == parentTerm)
		test.equal(childdiv1.style.display, 'block', 'child DIV of first term is now visible')
		test.equal(
			childdiv1.querySelectorAll('.termdiv').length,
			parTermObj.terms.length,
			'child DIV now contains 2 sub terms'
		)
	}
})

tape('click_term', test => {
	test.timeoutAfter(1000)
	runpp({
		tree: {
			click_term: modifier_callback,
			disable_terms: [termjson['agedx']],
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	let app
	function runTests(tree) {
		app = tree.Inner.app
		helpers
			.rideInit({ arg: tree, bus: tree, eventType: 'postRender.test' })
			.run(expandTerm1)
			.use(expandTerm1_child1, { wait: 100 })
			.to(testExpand_child1, { wait: 100 })
			.done(test)
	}
	let childdiv_term1
	function expandTerm1(tree) {
		const divs = tree.Inner.dom.holder.node().querySelectorAll('.termdiv')
		const term1 = [...divs].find(elem => elem.__data__.name.startsWith('Demographic Variables'))
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
		//Find disabled term button specified in tree.disable_terms
		const disabledlabels = childdiv_child1.querySelectorAll('.sja_tree_click_term_disabled')
		test.ok(disabledlabels.length > 0, 'should have one or more disabled terms')
		//Verify other term buttons enabled
		const buttons = childdiv_child1.getElementsByClassName('sja_filter_tag_btn sja_tree_click_term termlabel')
		test.ok(buttons.length > 0, 'should have one or more child terms showing as buttons')
		buttons[0].click() // click this button and trigger the next test
	}
	function modifier_callback(term) {
		//Check callback works
		test.ok(app.vocabApi.graphable(term), 'modifier callback called with a graphable term')
	}
})

tape('click_term2select_tvs', test => {
	test.timeoutAfter(1000)

	runpp({
		app: {
			callbacks: {
				'postInit.test': runTests
			}
		},
		tree: {
			click_term2select_tvs: modifier_callback,
			disable_terms: [termjson['agedx']]
		}
	})

	function runTests(app) {
		const tree = app.Inner.components.tree
		helpers
			.rideInit({ arg: tree, bus: tree, eventType: 'postRender.test' })
			.use(expandTerm1)
			.to(expandTerm1_child1)
			.to(testExpand_child1)
			.use(triggerTvsMenu, { wait: 100 })
			.to(testTvsMenu, { wait: 100 })
			.done(test)
	}

	let childdiv_term1
	function expandTerm1(tree) {
		const divs = tree.Inner.dom.holder.node().querySelectorAll('.termdiv')
		const term1 = [...divs].find(elem => elem.__data__.name.startsWith('Demographic Variables'))
		term1.querySelector('.termbtn').click()
		childdiv_term1 = term1.querySelector('.termchilddiv')
	}

	let childdiv_child1
	function expandTerm1_child1(tree) {
		const child1 = childdiv_term1.querySelector('.termdiv')
		child1.querySelector('.termbtn').click()
		childdiv_child1 = child1.querySelector('.termchilddiv')
	}

	let buttons
	function testExpand_child1(tree) {
		const disabledlabels = childdiv_child1.getElementsByClassName('sja_tree_click_term_disabled termlabel')
		test.ok(disabledlabels.length > 0, 'should have one or more disabled terms')
		buttons = childdiv_child1.getElementsByClassName('sja_filter_tag_btn sja_tree_click_term termlabel')
		test.ok(buttons.length > 0, 'should have one or more child terms showing as buttons')
	}

	function triggerTvsMenu() {
		buttons[0].click() // click this button and trigger the next test
	}

	function testTvsMenu(tree) {
		const components = tree.Inner.app.Inner.components
		test.equal(typeof components.submenu, 'object', 'should have a submenu')
		test.equal(tree.Inner.dom.holder.style('display'), 'none', 'should have a hidden tree')
		test.equal(components.submenu.Inner.dom.holder.style('display'), 'block', 'should have a visible submenu')
	}

	function modifier_callback(tvs) {
		test.ok(graphable(term), 'modifier callback called with a graphable term')
	}
})

tape('rehydrated from saved state', function (test) {
	test.timeoutAfter(1000)
	test.plan(2)

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Diagnosis']
			}
		},
		tree: {
			callbacks: {
				'postRender.test': testDom
			}
		}
	})

	function testDom(tree) {
		const numTreeTerms = Object.keys(tree.Inner.termsById).length - 1 //exclude {root}
		test.equal(
			tree.Inner.dom.holder.selectAll('.termdiv').size(),
			numTreeTerms,
			`should have ${numTreeTerms} expanded terms`
		)
		const nonLeafTerms = Object.values(tree.Inner.termsById).filter(d => !d?.isleaf && d.id != 'root')
		test.equal(
			tree.Inner.dom.holder.selectAll('.termbtn').size(),
			nonLeafTerms.length,
			'should have 7 term toggle buttons'
		)
	}
})

tape('error handling', function (test) {
	test.timeoutAfter(1000)
	test.plan(2)

	runpp({
		state: {
			vocab: { genome: 'ahg38' },
			termdbConfig: {}
		},
		callbacks: {
			'postInit.test': testWrongGenome
		}
	})
	function testWrongGenome(app) {
		const d = app.Inner.dom.errdiv.selectAll('.sja_errorbar').select('div:nth-child(2)')
		test.equal(d.text(), 'Error: invalid genome', 'should show for invalid genome')
	}

	runpp({
		state: {
			vocab: { dslabel: 'xxx' },
			termdbConfig: {}
		},
		callbacks: {
			'postInit.test': testWrongDslabel
		}
	})
	function testWrongDslabel(app) {
		const d = app.Inner.dom.errdiv.select('.sja_errorbar').select('div:nth-child(2)')
		test.equal(d.text(), 'Error: invalid dslabel', 'should show for genome-level termdb not available')
	}
})

tape('usecase', function (test) {
	test.timeoutAfter(2000)

	runpp({
		state: {
			tree: {
				usecase: { target: 'survival', detail: 'term' },
				expandedTermIds: ['root', 'Survival outcome']
			}
		},
		tree: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(tree) {
		const divs = tree.Inner.dom.holder.node().querySelectorAll('.termdiv')
		test.equal(divs.length, 3, 'should have 3 displayed term divs')
		const labels = [...tree.Inner.dom.holder.node().querySelectorAll('.termlabel')]
		test.equal(
			labels.filter(elem => elem.innerHTML.includes('urvival')).length,
			3,
			'should display any "Survival" term label'
		)
		test.equal(
			labels.filter(elem => elem.innerHTML.includes('Diagnosis Year')).length,
			0,
			'should not display any "Diagnosis Year" term label'
		)
		test.end()
	}
})

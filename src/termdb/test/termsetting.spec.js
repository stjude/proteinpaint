const tape = require('tape')
const termjson = require('../../../test/termdb/termjson').termjson
const helpers = require('../../../test/front.helpers.js')
const d3s = require('d3-selection')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'SJLife',
		genome: 'hg38',
		termfilter: { show_top_ui: false }
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
	test.pass('-***- termsetting (config panel in plot) -***-')
	test.end()
})

tape('caterogical term overlay', function(test) {
	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Demographics/health behaviors', 'Age', 'agedx'],
				visiblePlotIds: ['agedx'],
				plots: {
					agedx: {
						term: { id: 'agedx' },
						term2: { id: 'diaggrp' },
						settings: {
							currViews: ['barchart'],
							controls: {
								term2: { id: 'diaggrp', term: termjson['diaggrp'] }
							},
							barchart: {
								overlay: 'tree'
							}
						}
					}
				}
			}
		},
		plotControls: {
			callbacks: {
				'postInit.test': runTests
			}
		}
	})

	function runTests(plotControls) {
		helpers
			.rideInit({ arg: plotControls, eventType: 'postRender.test' })
			.use(triggerBurgerBtn, { wait: 600 })
			.to(testTerm2Pill, { wait: 600 })
			.run(triggerBluePill)
			.run(testGrpMenu)
			.run(triggerDevideGrpMenu)
			.run(testDevideGrpMenu)
			.use(triggerGrpSelect)
			.to(testBluePill)
			.done(test)
	}

	function triggerBurgerBtn(plotControls) {
		plotControls.Inner.dom.topbar
			.select('div')
			.node()
			.click()
	}

	function testTerm2Pill(plotControls) {
		test.equal(
			plotControls.Inner.dom.config_div.selectAll('.ts_name_btn')._groups[0][1].innerText,
			plotControls.Inner.state.config.term2.term.name,
			'Should have 1 pill for overlay term'
		)
	}

	function triggerBluePill(plotControls) {
		plotControls.Inner.dom.config_div.selectAll('.ts_name_btn')._groups[0][1].click()
	}

	function testGrpMenu(plotControls) {
		const tip = plotControls.Inner.features.config.Inner.inputs.overlay.Inner.pill.Inner.dom.tip
		test.equal(tip.d.selectAll('.group_btn').size(), 2, 'Should have 2 buttons for group config')
		test.equal(tip.d.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
		test.equal(tip.d.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')
	}

	function triggerDevideGrpMenu(plotControls) {
		const tip = plotControls.Inner.features.config.Inner.inputs.overlay.Inner.pill.Inner.dom.tip
		tip.d.selectAll('.group_btn')._groups[0][1].click()
	}

	function testDevideGrpMenu(plotControls) {
		const tip = plotControls.Inner.features.config.Inner.inputs.overlay.Inner.pill.Inner.dom.tip
		test.equal(
			tip.d.selectAll('tr').size(),
			Object.keys(plotControls.Inner.state.config.term2.term.values).length + 3,
			'Should have 3 rows for header and rows for each caterory'
		)
		test.equal(tip.d.selectAll('.apply_btn').size(), 1, 'Should have "Apply" button to apply group changes')
		test.equal(
			tip.d
				.selectAll('tr')
				.selectAll('th')
				.html(),
			'Groups',
			'Should have "Groups" as first column group'
		)
		test.equal(
			tip.d.selectAll('tr').selectAll('th')._groups[0][1].innerText,
			'Categories',
			'Should have "Categories" as first column group'
		)
		test.true(
			tip.d
				.selectAll('tr')
				.selectAll('.grp_rm_btn')
				.size() >= 1,
			'Should have at least 1 "-" button to remove groups'
		)
		test.equal(
			tip.d
				.selectAll('tr')
				.selectAll('.grp_add_btn')
				.size(),
			1,
			'Should have 1 "+" button to add new groups'
		)
		test.true(
			d3s
				.select(tip.d.selectAll('tr')._groups[0][3])
				.selectAll('input')
				.size() >= 3,
			'Should have 3 or more radio buttons for first category'
		)
		test.equal(
			d3s.select(tip.d.selectAll('tr')._groups[0][3]).selectAll('td')._groups[0][4].innerText,
			'Acute lymphoblastic leukemia',
			'Should have first cateogry as "ALL"'
		)
	}

	function triggerGrpSelect(plotControls) {
		const tip = plotControls.Inner.features.config.Inner.inputs.overlay.Inner.pill.Inner.dom.tip
		d3s
			.select(tip.d.selectAll('tr')._groups[0][3])
			.selectAll('input')
			._groups[0][2].click()
		tip.d
			.selectAll('.apply_btn')
			.node()
			.click()
	}

	function testBluePill(plotControls) {
		test.equal(
			plotControls.Inner.dom.config_div.selectAll('.ts_summary_btn')._groups[0][1].innerText,
			'Divided into 2 groups',
			'Should have blue pill changed from group select'
		)
	}
})

tape('Numerical term overlay', function(test) {
	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Diagnosis', 'diaggrp'],
				visiblePlotIds: ['diaggrp'],
				plots: {
					diaggrp: {
						term: { id: 'diaggrp' },
						term2: { id: 'agedx' },
						settings: {
							currViews: ['barchart'],
							controls: {
								term2: { id: 'agedx', term: termjson['agedx'] }
							},
							barchart: {
								overlay: 'tree'
							}
						}
					}
				}
			}
		},
		plotControls: {
			callbacks: {
				'postInit.test': runTests
			}
		}
	})

	function runTests(plotControls) {
		helpers
			.rideInit({ arg: plotControls, eventType: 'postRender.test' })
			.use(triggerBurgerBtn, { wait: 600 })
			.to(testTerm2Pill, { wait: 600 })
			.run(triggerBluePill)
			.run(testGrpMenu)
			// .run(triggerBinChange)  //TODO (draft)
			// .run(testBinChange)  //TODO
			.done(test)
	}

	function triggerBurgerBtn(plotControls) {
		plotControls.Inner.dom.topbar
			.select('div')
			.node()
			.click()
	}

	function testTerm2Pill(plotControls) {
		test.equal(
			plotControls.Inner.dom.config_div.selectAll('.ts_name_btn')._groups[0][1].innerText,
			plotControls.Inner.state.config.term2.term.name,
			'Should have 1 pill for overlay term'
		)
	}

	function triggerBluePill(plotControls) {
		plotControls.Inner.dom.config_div.selectAll('.ts_name_btn')._groups[0][1].click()
	}

	function testGrpMenu(plotControls) {
		const tip = plotControls.Inner.features.config.Inner.inputs.overlay.Inner.pill.Inner.dom.tip
		test.equal(tip.d.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
		test.equal(tip.d.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')
		test.equal(
			d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('td')._groups[0][0].innerText,
			'Bin Size',
			'Should have section for "bin size" edit'
		)
		test.equal(
			d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('td')._groups[0][0].innerText,
			'First Bin',
			'Should have section for "First bin" edit'
		)
		test.equal(
			d3s.select(tip.d.selectAll('tr')._groups[0][2]).selectAll('td')._groups[0][0].innerText,
			'Last Bin',
			'Should have section for "Last bin" edit'
		)
	}

	function triggerBinChange(plotControls) {
		const tip = plotControls.Inner.features.config.Inner.inputs.overlay.Inner.pill.Inner.dom.tip
		const bin_size_input = d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('input')._groups[0][0]

		bin_size_input.value = 5

		//TODO: press 'Enter' to update bins
		// const event = new KeyboardEvent('keydown', {
		//     altKey:false,
		//     bubbles: true,
		//     cancelBubble: false,
		//     cancelable: true,
		//     charCode: 0,
		//     code: 'Enter',
		//     composed: true,
		//     ctrlKey: false,
		//     currentTarget: null,
		//     defaultPrevented: true,
		//     detail: 0,
		//     eventPhase: 0,
		//     isComposing: false,
		//     isTrusted: true,
		//     key: 'Enter',
		//     keyCode: 13,
		//     location: 0,
		//     metaKey: false,
		//     repeat: false,
		//     returnValue: false,
		//     shiftKey: false,
		//     type: 'keydown',
		//     which: 13})
		// bin_size_input.addEventListener('keydown', ()=>{})
		// bin_size_input.dispatchEvent(event)
	}
})

tape('Conditional term overlay', function(test) {
	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Diagnosis', 'diaggrp'],
				visiblePlotIds: ['diaggrp'],
				plots: {
					diaggrp: {
						term: { id: 'diaggrp' },
						term2: { id: 'Arrhythmias' },
						settings: {
							currViews: ['barchart'],
							controls: {
								term2: { id: 'Arrhythmias', term: termjson['Arrhythmias'] }
							},
							barchart: {
								overlay: 'tree'
							}
						}
					}
				}
			}
		},
		plotControls: {
			callbacks: {
				'postInit.test': runTests
			}
		}
	})

	function runTests(plotControls) {
		helpers
			.rideInit({ arg: plotControls, eventType: 'postRender.test' })
			.use(triggerBurgerBtn, { wait: 1000 })
			.to(testTerm2Pill, { wait: 1000 })
			.run(triggerBluePill)
			.run(testGrpMenu)
			.done(test)
	}

	function triggerBurgerBtn(plotControls) {
		plotControls.Inner.dom.topbar
			.select('div')
			.node()
			.click()
	}

	function testTerm2Pill(plotControls) {
		test.equal(
			plotControls.Inner.dom.config_div.selectAll('.ts_name_btn')._groups[0][1].innerText,
			plotControls.Inner.state.config.term2.term.name,
			'Should have 1 pill for overlay term'
		)
	}

	function triggerBluePill(plotControls) {
		plotControls.Inner.dom.config_div.selectAll('.ts_name_btn')._groups[0][1].click()
	}

	function testGrpMenu(plotControls) {
		const tip = plotControls.Inner.features.config.Inner.inputs.overlay.Inner.pill.Inner.dom.tip
		test.equal(tip.d.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
		test.equal(tip.d.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')
	}
})

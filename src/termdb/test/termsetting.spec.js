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
				'postRender.test': runTests
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
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		test.equal(tip.d.selectAll('.group_btn').size(), 2, 'Should have 2 buttons for group config')
		test.equal(tip.d.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
		test.equal(tip.d.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')
	}

	function triggerDevideGrpMenu(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		tip.d.selectAll('.group_btn')._groups[0][1].click()
	}

	function testDevideGrpMenu(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		test.equal(
			tip.d.selectAll('tr').size(),
			Object.keys(plotControls.Inner.state.config.term2.term.values).length + 1,
			'Should have 3 rows for header and rows for each caterory'
		)
		test.equal(tip.d.selectAll('.apply_btn').size(), 1, 'Should have "Apply" button to apply group changes')
		test.equal(
			tip.d
				.selectAll('.group_edit_div')
				.selectAll('label')
				.html(),
			'#groups',
			'Should have "Groups" as first column group'
		)
		test.equal(
			tip.d
				.selectAll('.group_edit_div')
				.selectAll('select')
				.size(),
			1,
			'Should have dropdown for group count change'
		)
		test.true(
			d3s
				.select(tip.d.selectAll('tr')._groups[0][1])
				.selectAll('input')
				.size() >= 3,
			'Should have 3 or more radio buttons for first category'
		)
		test.equal(
			d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('td')._groups[0][4].innerText,
			'Acute lymphoblastic leukemia',
			'Should have first cateogry as "ALL"'
		)
	}

	function triggerGrpSelect(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		d3s
			.select(tip.d.selectAll('tr')._groups[0][1])
			.selectAll('input')
			._groups[0][2].click()
		tip.d
			.selectAll('.apply_btn')
			.node()
			.click()
	}

	function testBluePill(plotControls) {
		test.equal(
			plotControls.Inner.dom.config_div.selectAll('.ts_summary_btn')._groups[0][0].innerText,
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
				'postRender.test': runTests
			}
		}
	})

	// create enter event to use for inputs of bin edit menu
	const enter_event = new KeyboardEvent('keyup', {
		code: 'Enter',
		key: 'Enter',
		keyCode: 13
	})

	function runTests(plotControls) {
		helpers
			.rideInit({ arg: plotControls, eventType: 'postRender.test' })
			.use(triggerBurgerBtn, { wait: 600 })
			.to(testTerm2Pill, { wait: 600 })
			.run(triggerBluePill)
			.run(testGrpMenu)
			.use(triggerBinChange)
			.to(triggerBluePill, { wait: 600 })
			.run(testBinChange)
			.use(triggerFirstBinChange)
			.to(triggerBluePill, { wait: 600 })
			.run(testFirstBinChange)
			.use(triggerLastBinChange)
			.to(triggerBluePill, { wait: 600 })
			.run(testLastBinChange)
			.use(triggerResetBins, { wait: 600 })
			.to(testResetBins)
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
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
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
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		const bin_size_input = d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('input')._groups[0][0]

		bin_size_input.value = 5

		//press 'Enter' to update bins
		bin_size_input.addEventListener('keyup', () => {})
		bin_size_input.dispatchEvent(enter_event)
	}

	function testBinChange(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		test.equal(
			d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('input')._groups[0][0].value,
			'5',
			'Should change "bin size" from input'
		)
	}

	function triggerFirstBinChange(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		const first_bin_input = d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('input')._groups[0][1]

		first_bin_input.value = 7

		//press 'Enter' to update bins
		first_bin_input.addEventListener('keyup', () => {})
		first_bin_input.dispatchEvent(enter_event)
	}

	function testFirstBinChange(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		test.equal(
			d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('input')._groups[0][1].value,
			'7',
			'Should change "first bin" from input'
		)
	}

	function triggerLastBinChange(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		const last_bin_select = d3s.select(tip.d.selectAll('tr')._groups[0][2]).selectAll('select')._groups[0][0]
		last_bin_select.selectedIndex = 1
		last_bin_select.dispatchEvent(new Event('change'))

		const last_bin_input = d3s.select(tip.d.selectAll('tr')._groups[0][2]).selectAll('input')._groups[0][0]

		last_bin_input.value = 20

		//press 'Enter' to update bins
		last_bin_input.addEventListener('keyup', () => {})
		last_bin_input.dispatchEvent(enter_event)
	}

	function testLastBinChange(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		test.equal(
			d3s.select(tip.d.selectAll('tr')._groups[0][2]).selectAll('input')._groups[0][0].value,
			'20',
			'Should change "last bin" from input'
		)
	}

	function triggerResetBins(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		const reset_btn = d3s.select(tip.d.selectAll('tr')._groups[0][4]).selectAll('.sja_menuoption')._groups[0][0]
		reset_btn.click()
	}

	function testResetBins(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		test.equal(
			d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('input')._groups[0][1].value,
			'5',
			'Should reset the bins by "Reset" button'
		)
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
				'postRender.test': runTests
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
			.use(triggerGradeChange, { wait: 1000 })
			.to(testGradeChange)
			.use(triggerGrpSelect)
			.to(testBluePill)
			.run(triggerBluePill)
			.run(testReGrpMenu)
			.use(triggerGrd2SubSelect, { wait: 1000 })
			.to(testGrd2SubSelect)
			.run(triggerBluePill)
			.use(triggerSubChange)
			.to(testSubChange)
			.run(triggerBluePill)
			.use(triggerSub2GrdSelect)
			.to(testTerm2Pill)
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
		test.equal(
			plotControls.Inner.dom.config_div.selectAll('.ts_summary_btn')._groups[0][0].innerText,
			'Max. Grade',
			'Should have bluepill summary btn "By Max Grade" as default'
		)
	}

	function triggerBluePill(plotControls) {
		plotControls.Inner.dom.config_div.selectAll('.ts_name_btn')._groups[0][1].click()
	}

	function testGrpMenu(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		test.equal(tip.d.selectAll('select').size(), 1, 'Should have 1 dropdown to change grade setting')
		test.equal(tip.d.selectAll('.group_btn').size(), 3, 'Should have 3 buttons for group config')
		test.true(
			tip.d.selectAll('.group_btn')._groups[0][0].innerText.includes('Using'),
			'Should have "default" group button be active'
		)
		test.equal(tip.d.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
		test.equal(tip.d.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')
	}

	function triggerGradeChange(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		tip.d.select('select')._groups[0][0].selectedIndex = 1
		tip.d.select('select')._groups[0][0].dispatchEvent(new Event('change'))
	}

	function testGradeChange(plotControls) {
		test.equal(
			plotControls.Inner.dom.config_div.selectAll('.ts_summary_btn')._groups[0][0].innerText,
			'Most Recent Grade',
			'Should have bluepill summary btn changed to "By Most Recent Grade"'
		)
	}

	function triggerGrpSelect(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		tip.d.selectAll('.group_btn')._groups[0][1].click()
	}

	function testBluePill(plotControls) {
		const groupset_idx = plotControls.Inner.state.config.term2.q.groupsetting.predefined_groupset_idx
		const groupset = plotControls.Inner.state.config.term2.term.groupsetting.lst[groupset_idx]
		test.equal(
			plotControls.Inner.dom.config_div.selectAll('.ts_summary_btn')._groups[0][0].innerText,
			groupset.name,
			'Should have bluepill summary btn match group name'
		)
	}

	function testReGrpMenu(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		const groupset_idx = plotControls.Inner.state.config.term2.q.groupsetting.predefined_groupset_idx
		const groupset = plotControls.Inner.state.config.term2.term.groupsetting.lst[groupset_idx]

		test.equal(tip.d.selectAll('select')._groups[0][0].selectedIndex, 1, 'Should have "Most recent" option selected')
		test.equal(
			d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('td')._groups[0][0].innerText,
			groupset.groups[0].name + ':',
			'Should have group 1 name same as predefined group1 name'
		)
		test.equal(
			d3s
				.select(d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('td')._groups[0][1])
				.selectAll('div')
				.size(),
			groupset.groups[0].values.length,
			'Should have same number of grades to group as predefined group1'
		)
		test.equal(
			d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('td')._groups[0][0].innerText,
			groupset.groups[1].name + ':',
			'Should have group 2 name same as predefined group2 name'
		)
		test.equal(
			d3s
				.select(d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('td')._groups[0][1])
				.selectAll('div')
				.size(),
			groupset.groups[1].values.length,
			'Should have same number of grades to group as predefined group2'
		)
		test.true(
			tip.d.selectAll('.group_btn')._groups[0][1].innerText.includes('Use'),
			'Should have "default" group button be inactive'
		)
	}

	function triggerGrd2SubSelect(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		tip.d.selectAll('select')._groups[0][0].selectedIndex = 3
		tip.d.selectAll('select')._groups[0][0].dispatchEvent(new Event('change'))
	}

	function testGrd2SubSelect(plotControls) {
		test.equal(
			plotControls.Inner.dom.config_div.selectAll('.ts_summary_btn')._groups[0][0].innerText,
			'Sub-condition',
			'Should have bluepill summary btn changed to "By Subcondition"'
		)
	}

	function triggerSubChange(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		tip.d.selectAll('.group_btn')._groups[0][2].click()
		d3s
			.select(tip.d.selectAll('tr')._groups[0][3])
			.selectAll('input')
			._groups[0][2].click()
		tip.d
			.selectAll('.apply_btn')
			.node()
			.click()
	}

	function testSubChange(plotControls) {
		test.equal(
			plotControls.Inner.dom.config_div.selectAll('.ts_summary_btn')._groups[0][0].innerText,
			'2 groups of sub-conditions',
			'Should have blue pill summary changed by group change'
		)
	}

	function triggerSub2GrdSelect(plotControls) {
		const tip = plotControls.Inner.components.config.Inner.components.overlay.Inner.pill.Inner.dom.tip
		tip.d.selectAll('select')._groups[0][0].selectedIndex = 0
		tip.d.selectAll('select')._groups[0][0].dispatchEvent(new Event('change'))
	}
})

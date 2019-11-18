const tape = require('tape')
const termjson = require('../../../test/termdb/termjson').termjson
const helpers = require('../../../test/front.helpers.js')

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
})

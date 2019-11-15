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
		plot: {
			callbacks: {
				'postInit.test': runTests
			}
		}
	})

	function runTests(plot) {
		helpers
			.rideInit({ arg: plot, eventType: 'postRender.test' })
			.use(triggerBurgerClick)
			.to(testTerm2Pill, { wait: 600 })
			.done(test)
	}

	function triggerBurgerClick(plot) {
		plot.Inner.components.controls.Inner.dom.topbar
			.select('div')
			.node()
			.click()
	}

	function testTerm2Pill(plot) {
		// console.log(plot)
		test.equal(
			plot.Inner.components.controls.Inner.dom.config_div.selectAll('.ts_name_btn')._groups[0][0].innerText,
			plot.Inner.state.config.term2.term.name,
			'Should have 1 pill for overlay term'
		)
	}
})

const tape = require('tape')
const termjson = require('../../../test/testdata/termjson').termjson
const helpers = require('../../../test/front.helpers.js')

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

function testByTermId(id, runTests) {
	const expandedTermIds = id == 'diaggrp' ? ['root', 'Cancer-related Variables', 'Diagnosis'] : null

	if (!expandedTermIds) throw `unmatched id -> expandedTermIds in plot.controls.config test`

	runpp({
		state: {
			tree: {
				expandedTermIds,
				visiblePlotIds: [id],
				plots: {
					[id]: {
						term: { id: id },
						settings: {
							controls: {
								isOpen: true
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
}

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- termdb/plot.controls.btns -***-')
	test.end()
})

// TODO: test as part of the termInfo component
tape.skip('info btn', function(test) {
	test.timeoutAfter(3000)
	test.plan(1) //(2)
	/*
	runpp({
		state: {
			tree: {
				expandedTermIds: [
					'root',
					'Clinically-assessed Variables',
					'ctcae_graded',
					'Cardiovascular System',
					'Arrhythmias',
					'Cardiac dysrhythmia'
				],
				visiblePlotIds: ['Cardiac dysrhythmia'],
				plots: {
					'Cardiac dysrhythmia': {
						term: {
							//id:
							term: { id: 'Cardiac dysrhythmia' }
							//q: { bar_by_grade: true, value_by_max_grade: true }
						},
						settings: {
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
				'postRender.test': checkVisibleIfTermHasInfo
			}
		}
	})

	function checkVisibleIfTermHasInfo(plotControls) {
		plotControls.on('postRender.test', null)
		const infobtn = plotControls.Inner.components.topbar.Inner.features.infobtn.Inner
		test.notEqual(infobtn.dom.btn.style('display'), 'none', 'should be visible when a term has html info')
	}
	*/
	testByTermId('diaggrp', checkVisibleIfTermHasNoInfo)

	function checkVisibleIfTermHasNoInfo(plotControls) {
		plotControls.on('postRender.test', null)
		const infobtn = plotControls.Inner.components.topbar.Inner.features.infobtn.Inner
		test.equal(infobtn.dom.btn.style('display'), 'none', 'should be hidden when a term has html info')
	}
})

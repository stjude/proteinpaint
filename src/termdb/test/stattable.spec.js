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
	test.pass('-***- termdb/stattable -***-')
	test.end()
})

tape('barchart-dependent display', function(test) {
	test.timeoutAfter(2000)

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Treatment', 'Chemotherapy', 'Alklaying Agents', 'aaclassic_5'],
				visiblePlotIds: ['aaclassic_5'],
				plots: {
					aaclassic_5: {
						term: {
							id: 'aaclassic_5'
						},
						term2: {
							id: "diaggrp"
						},
						config: {
							settings: {
								currViews: ['table']
							}
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(plot) {
		plot.on('postRender.test', null)
		const stattable = plot.Inner.components.stattable
		helpers.rideInit({ arg: stattable, bus: stattable, eventType: 'postRender.test' })
			.run(testHiddenWithNoBarchart)
			//.use(triggerViewBarchart, {wait: 100})
			//.to(testVisibleWithBarchart, {wait: 100})
			.done(test)
	}

	function testHiddenWithNoBarchart(stattable) {
		test.equal(
			stattable.Inner.dom.div.style("display"),
			"none",
			"should have a HIDDEN stattable when the barchart is not in the settings.currViews array"
		)
	}

	function triggerViewBarchart(stattable) {
		stattable.Inner.app.dispatch({
			type: 'plot_edit',
			id: stattable.Inner.id,
			config: {
				settings: { currViews: ["barchart"] } //, "stattable"] }
			}
		})
	}

	function testVisibleWithBarchart(stattable) {
		test.equal(
			stattable.Inner.dom.div.style("display"),
			"block",
			"should have a visible stattable when the barchart is in the settings.currViews array"
		)
	}
})


tape("term.isfloat-dependent display", function(test) {
	test.timeoutAfter(2000)
	test.plan(3)

	runpp({
		state: {
			tree: {
				expandedTermIds: [
					'root', 'Cancer-related Variables', 'Diagnosis'
				],
				visiblePlotIds: ['diaggrp'],
				plots: {
					diaggrp: {
						term: {
							id: 'diaggrp'
						},
						settings: {
							currViews: ['barchart', 'stattable']
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': testHiddenIfCategoricalTerm
			}
		}
	})

	function testHiddenIfCategoricalTerm(plot) {
		plot.on('postRender.test', null)
		test.equal(
			plot.Inner.components.stattable.Inner.dom.div.style("display"),
			"none",
			"should have a hidden stattable when plot.term.iscategorical"
		)
	}

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Outcomes', 'CTCAE Graded Events', 'Cardiovascular System'],
				visiblePlotIds: ['Arrhythmias'],
				plots: {
					Arrhythmias: {
						term: {
							id: 'Arrhythmias'
						},
						settings: {
							currViews: ['barchart', 'stattable']
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': testHiddenIfConditionTerm
			}
		}
	})

	function testHiddenIfConditionTerm(plot) {
		plot.on('postRender.test', null)
		test.equal(
			plot.Inner.components.stattable.Inner.dom.div.style("display"),
			"none",
			"should have a hidden stattable when plot.term.iscondition"
		)
		test.end()
	}

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Demographics/health behaviors', 'Age'],
				visiblePlotIds: ['agedx'],
				plots: {
					agedx: {
						term: {
							id: 'agedx'
						},
						settings: {
							currViews: ['barchart', 'stattable']
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': testVisibleWithNumericTerm
			}
		}
	})

	function testVisibleWithNumericTerm(plot) {
		plot.on('postRender.test', null)
		test.equal(
			plot.Inner.components.stattable.Inner.dom.div.style("display"),
			"block",
			"should have a visible stattable when plot.term is numeric"
		)
	}
})

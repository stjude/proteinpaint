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

function testByTermId(id, runTests) {
	const expandedTermIds =
		id == 'diaggrp'
			? ['root', 'Cancer-related Variables', 'Diagnosis']
			: 'aaclassic_5'
			? ['root', 'Cancer-related Variables', 'Treatment', 'Chemotherapy', 'Alklaying Agents']
			: null

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
							currViews: ['barchart'],
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
	test.pass('-***- termdb/plot.controls.config -***-')
	test.end()
})

tape('overlay input', function(test) {
	test.timeoutAfter(3000)
	test.plan(6)
	testByTermId('diaggrp', checkDisplayInAnyView)

	function checkDisplayInAnyView(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Overlay with') return
			test.notEqual(this.parentNode.style.display, 'none', 'should be visible in barchart view')
			const inputs = [...this.parentNode.querySelectorAll('input')]
			test.equal(inputs.filter(inputIsVisible).length, 2, 'should have 2 options for non-condition term1')
		})
	}

	function inputIsVisible(elem) {
		return elem.parentNode.parentNode.style.display != 'none'
	}

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Outcomes', 'CTCAE Graded Events', 'Cardiovascular System', 'Arrhythmias'],
				visiblePlotIds: ['Arrhythmias'],
				plots: {
					Arrhythmias: {
						term: {
							id: 'Arrhythmias',
							term: termjson['Arrhythmias'],
							q: { bar_by_grade: true, value_by_max_grade: true }
						},
						settings: {
							currViews: ['barchart'],
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

	function runTests(plotControls) {
		helpers
			.rideInit({
				bus: plotControls,
				eventType: 'postRender.test',
				arg: plotControls
			})
			.run(checkChildrenOverlayOption, { wait: 200 })
			.use(triggerGradeOverlayOption)
			.to(checkGradeOverlayOption, { wait: 200 })
			.done(test)
	}

	function checkChildrenOverlayOption(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Overlay with') return
			const inputs = [...this.parentNode.querySelectorAll('input')]
			test.equal(inputs.filter(inputIsVisible).length, 3, 'should have 3 options for condition term1')
			test.equal(
				inputs.filter(
					elem =>
						elem.nextSibling.innerHTML.includes('subconditions') && elem.parentNode.parentNode.style.display != 'none'
				).length,
				1,
				'should have an option to overlay children'
			)
		})
	}

	function triggerGradeOverlayOption(plotControls) {
		plotControls.Inner.app.dispatch({
			type: 'plot_edit',
			id: plotControls.id,
			config: {
				term: {
					id: 'Arrhythmias',
					term: termjson['Arrhythmias'],
					q: { bar_by_children: true, value_by_max_grade: true }
				}
			}
		})
	}

	function checkGradeOverlayOption(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Overlay with') return
			const inputs = [...this.parentNode.querySelectorAll('input')]
			test.equal(inputs.filter(inputIsVisible).length, 3, 'should have 3 options for condition term1')
			test.equal(
				inputs.filter(
					elem => elem.nextSibling.innerHTML.includes('grade') && elem.parentNode.parentNode.style.display != 'none'
				).length,
				1,
				'should have an option to overlay grades'
			)
		})
	}
})

tape('orientation input', function(test) {
	test.timeoutAfter(3000)
	test.plan(2)
	testByTermId('diaggrp', runTests)

	function runTests(plotControls) {
		helpers
			.rideInit({
				bus: plotControls,
				eventType: 'postRender.test',
				arg: plotControls
			})
			.run(checkDisplayInBarchartView)
			.use(triggerNonBarchartView)
			.to(checkDisplayInNonBarchartView, { wait: 50 })
			.done(test)
	}

	function checkDisplayInBarchartView(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Orientation') return
			test.equal(this.parentNode.style.display, 'table-row', 'should be visible in barchart view')
		})
	}

	function triggerNonBarchartView(plotControls) {
		plotControls.Inner.app.dispatch({
			type: 'plot_edit',
			id: plotControls.id,
			config: {
				term2: { term: termjson['agedx'] },
				settings: { currViews: ['table'] }
			}
		})
	}

	function checkDisplayInNonBarchartView(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Orientation') return
			test.equal(this.parentNode.style.display, 'none', 'should be hidden in non-barchart view')
		})
	}
})

tape('scale input', function(test) {
	test.timeoutAfter(5000)
	test.plan(2)
	testByTermId('aaclassic_5', runTests)

	function runTests(plotControls) {
		helpers
			.rideInit({
				bus: plotControls,
				eventType: 'postRender.test',
				arg: plotControls
			})
			.run(checkDisplayInBarchartView)
			.use(triggerNonBarchartView)
			.to(checkDisplayInNonBarchartView)
			.done(test)
	}

	function checkDisplayInBarchartView(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Scale') return
			test.equal(this.parentNode.style.display, 'table-row', 'should be visible in barchart view')
		})
	}

	function triggerNonBarchartView(plotControls) {
		plotControls.Inner.app.dispatch({
			type: 'plot_edit',
			id: plotControls.id,
			config: {
				term2: { id: 'agedx', term: termjson['agedx'] },
				settings: { currViews: ['table'] }
			}
		})
	}

	function checkDisplayInNonBarchartView(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Scale') return
			test.equal(this.parentNode.style.display, 'none', 'should be hidden in non-barchart view')
		})
	}
})

tape('divide by input', function(test) {
	test.timeoutAfter(7000)
	test.plan(4)
	testByTermId('aaclassic_5', runTests)

	function runTests(plotControls) {
		helpers
			.rideInit({
				bus: plotControls,
				eventType: 'postRender.test',
				arg: plotControls
			})
			.run(checkDisplayInBarchartView)
			.use(triggerTableView)
			.to(checkDisplayInTableView)
			.use(triggerBoxplotView)
			.to(checkDisplayInBoxplotView)
			.use(triggerScatterView)
			.to(checkDisplayInScatterView)
			.done(test)
	}

	function checkDisplayInBarchartView(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Divide by') return
			test.equal(this.parentNode.style.display, 'table-row', 'should be visible in barchart view')
		})
	}

	function triggerTableView(plotControls) {
		plotControls.Inner.app.dispatch({
			type: 'plot_edit',
			id: plotControls.id,
			config: {
				term2: { id: 'agedx', term: termjson['agedx'] },
				settings: { currViews: ['table'] }
			}
		})
	}

	function checkDisplayInTableView(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Divide by') return
			test.equal(this.parentNode.style.display, 'none', 'should be hidden in table view')
		})
	}

	function triggerBoxplotView(plotControls) {
		plotControls.Inner.app.dispatch({
			type: 'plot_edit',
			id: plotControls.id,
			config: {
				settings: { currViews: ['boxplot'] }
			}
		})
	}

	function checkDisplayInBoxplotView(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Divide by') return
			test.equal(this.parentNode.style.display, 'none', 'should be hidden in boxplot view')
		})
	}

	function triggerScatterView(plotControls) {
		plotControls.Inner.app.dispatch({
			type: 'plot_edit',
			id: plotControls.id,
			config: {
				settings: { currViews: ['scatter'] }
			}
		})
	}

	function checkDisplayInScatterView(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Divide by') return
			test.equal(this.parentNode.style.display, 'table-row', 'should be hidden in scatter plot view')
		})
	}
})

tape('Primary bins input', function(test) {
	test.timeoutAfter(3000)
	test.plan(2)

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Demographics/health behaviors', 'Age', 'agedx'],
				visiblePlotIds: ['agedx'],
				plots: {
					agedx: {
						term: { id: 'agedx' },
						settings: {
							currViews: []
						}
					}
				}
			}
		},
		plotControls: {
			callbacks: {
				'postRender.test': checkDisplayWithNumericTerm
			}
		}
	})

	function checkDisplayWithNumericTerm(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Customize bins') return
			test.equal(this.parentNode.style.display, 'table-row', 'should be visible with numeric term')
		})
	}

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Diagnosis', 'diaggrp'],
				visiblePlotIds: ['diaggrp'],
				plots: {
					diaggrp: {
						term: { id: 'diaggrp' },
						settings: {
							currViews: []
						}
					}
				}
			}
		},
		plotControls: {
			callbacks: {
				'postRender.test': checkDisplayWithCategoricalTerm
			}
		}
	})

	function checkDisplayWithCategoricalTerm(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Customize bins') return
			test.equal(this.parentNode.style.display, 'none', 'should be hidden with non-numeric term')
		})
	}
})

tape('Bars-as input', function(test) {
	test.timeoutAfter(3000)
	test.plan(2)

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Outcomes', 'CTCAE Graded Events', 'Cardiovascular System', 'Arrhythmias'],
				visiblePlotIds: ['Arrhythmias'],
				plots: {
					Arrhythmias: {
						term: { id: 'Arrhythmias' },
						settings: {
							currViews: ['barchart']
						}
					}
				}
			}
		},
		plotControls: {
			callbacks: {
				'postRender.test': checkDisplayWithConditionTerm
			}
		}
	})

	function checkDisplayWithConditionTerm(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Bars as') return
			test.equal(this.parentNode.style.display, 'table-row', 'should be visible with condition term')
		})
	}

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Demographics/health behaviors', 'sex'],
				visiblePlotIds: ['sex'],
				plots: {
					sex: {
						term: { id: 'sex' },
						settings: {
							currViews: ['barchart']
						}
					}
				}
			}
		},
		plotControls: {
			callbacks: {
				'postRender.test': checkDisplayWithCategoricalTerm
			}
		}
	})

	function checkDisplayWithCategoricalTerm(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Bars as') return
			test.equal(this.parentNode.style.display, 'none', 'should be hidden with non-numeric term')
		})
	}
})

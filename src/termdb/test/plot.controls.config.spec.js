const tape = require('tape')
const termjson = require('../../../test/testdata/termjson').termjson
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'SJLife',
		genome: 'hg38'
	},
	debug: 1
})

function testByTermId(id, runTests) {
	const expandedTermIds =
		id == 'diaggrp'
			? ['root', 'Cancer-related Variables', 'Diagnosis']
			: 'aaclassic_5'
			? ['root', 'Cancer-related Variables', 'Treatment', 'Chemotherapy', 'Alkylating Agents']
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
	test.timeoutAfter(5000)
	test.plan(5)
	testByTermId('diaggrp', checkDisplayInAnyView)

	function checkDisplayInAnyView(plotControls) {
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Overlay') return
			test.notEqual(this.parentNode.style.display, 'none', 'should be visible in barchart view')
		})
	}

	function inputIsVisible(elem) {
		return elem.parentNode.parentNode.style.display != 'none'
	}

	runpp({
		state: {
			tree: {
				expandedTermIds: [
					'root',
					'Clinically-assessed Variables',
					'ctcae_graded',
					'Cardiovascular System',
					'Arrhythmias'
				],
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
			if (this.innerHTML !== 'Overlay') return
			test.pass('should have a visible overlay input')
			test.true(
				this.parentNode.lastChild.innerHTML.toLowerCase().includes('none'),
				'should default to no overlay for a condition term'
			)
		})
	}

	function triggerGradeOverlayOption(plotControls) {
		plotControls.Inner.app.dispatch({
			type: 'plot_edit',
			id: plotControls.id,
			config: {
				term2: {
					id: 'Arrhythmias',
					term: termjson['Arrhythmias'],
					q: { bar_by_children: true, value_by_max_grade: true }
				}
			}
		})
	}

	function checkGradeOverlayOption(plotControls) {
		test.true(
			'activeCohort' in plotControls.Inner.components.config.Inner.components.overlay.Inner.state,
			'should have state.activeCohort'
		)

		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Overlay') return
			test.true(
				this.parentNode.lastChild.innerHTML.toLowerCase().includes('sub-condition'),
				'should overlay subconditions'
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
				term2: { term: termjson['agedx'], q: termjson['agedx'].bins.default },
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
				term2: { id: 'agedx', term: termjson['agedx'], q: termjson['agedx'].bins.default },
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
	test.plan(5)
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
		test.true(
			'activeCohort' in plotControls.Inner.components.config.Inner.components.divideBy.Inner.state,
			'should have state.activeCohort'
		)
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Divide by') return
			test.notEqual(this.parentNode.style.display, 'none', 'should be visible in barchart view')
		})
	}

	function triggerTableView(plotControls) {
		plotControls.Inner.app.dispatch({
			type: 'plot_edit',
			id: plotControls.id,
			config: {
				term2: { id: 'agedx', term: termjson['agedx'], q: termjson['agedx'].bins.default },
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
			test.notEqual(this.parentNode.style.display, 'none', 'should be visible in scatter plot view')
		})
	}
})

tape('Term1 bins', function(test) {
	test.timeoutAfter(3000)
	test.plan(3)

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Demographic Variables', 'Age', 'agedx'],
				visiblePlotIds: ['agedx'],
				plots: {
					agedx: {
						term: { id: 'agedx' },
						settings: {
							currViews: [],
							controls: {
								isOpen: true
							}
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
		test.true(
			'activeCohort' in plotControls.Inner.components.config.Inner.components.term1.Inner.state,
			'should have state.activeCohort'
		)
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML !== 'Customize bins') return
			test.notEqual(this.parentNode.style.display, 'none', 'should be visible with numeric term')
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
							currViews: [],
							controls: {
								isOpen: true
							}
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
		let matched = false
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML === 'Customize bins') matched = true
		})
		test.equal(matched, false, 'should not be found for non-numeric term')
	}
})

tape('Term1 condition, categorical', function(test) {
	test.timeoutAfter(4000)
	test.plan(2)

	runpp({
		state: {
			tree: {
				expandedTermIds: [
					'root',
					'Clinically-assessed Variables',
					'ctcae_graded',
					'Cardiovascular System',
					'Arrhythmias'
				],
				visiblePlotIds: ['Arrhythmias'],
				plots: {
					Arrhythmias: {
						term: { id: 'Arrhythmias' },
						settings: {
							currViews: ['barchart'],
							controls: {
								isOpen: true
							}
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
			if (this.innerHTML !== 'Customize') return
			test.notEqual(this.parentNode.style.display, 'none', 'should be visible with condition term')
		})
	}

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Demographic Variables', 'sex'],
				visiblePlotIds: ['sex'],
				plots: {
					sex: {
						term: { id: 'sex' },
						settings: {
							currViews: ['barchart'],
							controls: {
								isOpen: true
							}
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
		let matched = false
		plotControls.Inner.dom.holder.selectAll('.sja-termdb-config-row-label').each(function() {
			if (this.innerHTML === 'Group grades') matched = true
		})
		test.equal(matched, false, 'should be hidden with non-condition terms')
	}
})

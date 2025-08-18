import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { detectOne, detectStyle } from '../../test/test.helpers.js'

/*
Tests:
	Render summary plot, term: "agedx"
	Barchart tab only, term: "diaggrp"
	Barchart & violin toggles, term: "diaggrp", term2: "agedx"
	Barchart & violin toggles, term: "diaggrp", term2: "agedx"
	Barchart & violin toggles, term: "agedx", term2: "diaggrp"
	Barchart, violin, and scatter toggles, term: "agedx", term2: "hrtavg"
	Overlay continuity, term: "aaclassic_5", term2: "sex"
 */

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: {
			header_mode: 'hide_search',
			activeTab: 1
		},
		vocab: {
			dslabel: 'TermdbTest',
			genome: 'hg38-test'
		}
	},
	debug: 1
})

const tabLabels2Find = ['Barchart', 'Violin', 'Boxplot'] //hardcoded data in summary.js.

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/summary -***-')
	test.end()
})

tape('Render summary plot, term: "agedx"', test => {
	test.timeoutAfter(6000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'barchart',
					term: {
						id: 'agedx'
					}
				}
			]
		},
		summary: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(summary) {
		summary.on('postRender.test', null)

		testHeader(summary, summary.Inner.dom)
		await testToggleButtons(summary, summary.Inner.dom)
		await testOrientation(summary)
		if (test._ok) summary.Inner.app.destroy()
		test.end()
	}

	function testHeader(summary, dom) {
		const headerText = dom.paneTitleDiv.select('div.sjpp-term-header').node()
		const configTerm = summary.Inner.config.term.term.name
		test.equal(
			headerText.innerHTML,
			configTerm,
			`Header text = ${headerText.innerHTML} should match term name = ${configTerm}`
		)
	}

	async function testToggleButtons(summary, dom) {
		const toggles = dom.chartToggles
			.selectAll('div > div> button')
			.nodes()
			.filter(d => d.__data__.isVisible() == true)

		//test correct tabs exist
		let foundLabels = 0
		const notFoundLabels = []
		for (const toggle of toggles) {
			if (tabLabels2Find.some(d => d == toggle.__data__.label)) ++foundLabels
			else notFoundLabels.push(toggle.__data__.label)
		}
		if (notFoundLabels.length) test.fail(`Should not render tab(s) = ${notFoundLabels}`)
		test.equal(tabLabels2Find.length, foundLabels, `Should render tabs: ${tabLabels2Find}`)

		//Toggle to violin
		const foundTestPlot = await detectOne({
			elem: summary.Inner.dom.holder.body.node(),
			selector: '.sjpp-violin-plot',
			trigger() {
				toggles.find(d => d.__data__.childType == 'violin').click()
			}
		})
		test.ok(foundTestPlot, `Should render violin after toggle`)
		test.equal(summary.Inner.state.config.childType, 'violin', `Should toggle to childType = violin`)
		// Toggle back to barchart
		await detectStyle({
			elem: summary.Inner.dom.plotDivs.barchart.node(),
			matcher(mutations) {
				for (const m of mutations) {
					if (m.attributeName == 'style' && m.target.style.display === '') return m
				}
			},
			trigger() {
				toggles.find(d => d.__data__.childType == 'barchart').click()
			}
		})
		test.equal(summary.Inner.state.config.childType, 'barchart', `Should toggle back to childType = 'barchart'`)
	}

	async function testOrientation(summary) {
		await summary.Inner.app.dispatch({
			type: 'plot_edit',
			id: summary.Inner.id,
			config: {
				settings: { barchart: { orientation: 'vertical' } }
			}
		})
		test.notEqual(
			summary.Inner.config.settings.barchart.orientation,
			summary.Inner.config.settings.violin.orientation,
			`Orientation change for barchart should not affect violin`
		)
	}
})

tape('Barchart tab only, term: "diaggrp"', test => {
	test.timeoutAfter(3000)
	const message = `Should only show barchart tab in header`

	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'barchart',
					term: {
						id: 'diaggrp'
					}
				}
			]
		},
		summary: {
			callbacks: {
				'postRender.test': runTest
			}
		}
	})

	async function runTest(summary) {
		const toggles = summary.Inner.dom.chartToggles
			.selectAll('div > div> button')
			.nodes()
			.filter(d => d.__data__.isVisible() == true)
		test.ok(toggles.length == 1, `Should only render one tab`)
		if (toggles[0].__data__.childType == 'barchart') test.pass(message)
		else test.fail(message)

		if (test._ok) summary.Inner.app.destroy()
		test.end()
	}
})

tape('Barchart & violin toggles, term: "diaggrp", term2: "agedx"', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'barchart',
					term: {
						id: 'diaggrp'
					},
					term2: {
						id: 'agedx'
					}
				}
			]
		},
		summary: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(summary) {
		summary.on('postRender.test', null)
		await detectOne({ elem: summary.Inner.dom.holder.body.node(), selector: '.pp-bars-svg' })
		await testToggleButtons(summary, summary.Inner.dom)
		if (test._ok) summary.Inner.app.destroy()
		test.end()
	}

	async function testToggleButtons(summary, dom) {
		const toggles = dom.chartToggles
			.selectAll('div > div> button')
			.nodes()
			.filter(d => d.__data__.isVisible() == true)

		//Toggle to violin
		toggles.find(d => d.__data__.childType == 'violin').click()
		const foundTestPlot = await detectOne({
			elem: dom.holder.body.node(),
			selector: '.sjpp-violin-plot'
		})
		test.ok(foundTestPlot, `Should render violin after toggle`)
		test.equal(summary.Inner.state.config.childType, 'violin', `Should toggle to childType = violin`)

		//Toggle back to barchart
		await detectStyle({
			elem: dom.plotDivs.barchart.node(),
			matcher(mutations) {
				for (const m of mutations) {
					if (m.attributeName == 'style' && m.target.style.display === '') return m
				}
			},
			trigger() {
				toggles.find(d => d.__data__.childType == 'barchart').click()
			}
		})
		test.equal(summary.Inner.state.config.childType, 'barchart', `Should toggle back to childType = 'barchart'`)
	}
})

tape('Barchart & violin toggles, term: "agedx", term2: "diaggrp"', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'barchart',
					term: {
						id: 'agedx'
					},
					term2: {
						id: 'diaggrp'
					}
				}
			]
		},
		summary: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(summary) {
		summary.on('postRender.test', null)

		const toggles = summary.Inner.dom.chartToggles
			.selectAll('div > div> button')
			.nodes()
			.filter(d => d.__data__.isVisible() == true)

		testToggleButtonRendering(toggles)
		await testToggleButtons(summary, toggles)

		if (test._ok) summary.Inner.app.destroy()
		test.end()
	}

	function testToggleButtonRendering(toggles) {
		let foundLabels = 0
		for (const toggle of toggles) {
			if (tabLabels2Find.some(d => d == toggle.__data__.label)) ++foundLabels
		}
		test.equal(
			tabLabels2Find.length,
			toggles.length,
			`Should render ${tabLabels2Find.length} tabs: ${tabLabels2Find} for <2 numeric terms`
		)
	}

	async function testToggleButtons(summary, toggles) {
		//Toggle to violin
		toggles.find(d => d.__data__.childType == 'violin').click()
		const foundTestPlot = await detectOne({
			elem: summary.Inner.dom.holder.body.node(),
			selector: '.sjpp-violin-plot'
		})
		test.ok(foundTestPlot, `Should render violin after toggle`)
		test.equal(summary.Inner.state.config.childType, 'violin', `Should toggle to childType = violin`)

		//Toggle back to barchart
		await detectStyle({
			elem: summary.Inner.dom.plotDivs.barchart.node(),
			matcher(mutations) {
				for (const m of mutations) {
					if (m.attributeName == 'style' && m.target.style.display === '') return m
				}
			},
			trigger() {
				toggles.find(d => d.__data__.childType == 'barchart').click()
			}
		})
		test.equal(summary.Inner.state.config.childType, 'barchart', `Should toggle back to childType = 'barchart'`)
	}
})

tape('Barchart, violin, and scatter toggles, term: "agedx", term2: "hrtavg"', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'barchart',
					term: {
						id: 'agedx'
					},
					term2: {
						id: 'hrtavg'
					}
				}
			]
		},
		summary: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(summary) {
		summary.on('postRender.test', null)
		const sandboxDom = summary.Inner.dom

		const toggles = sandboxDom.chartToggles
			.selectAll('div > div> button')
			.nodes()
			.filter(d => d.__data__.isVisible() == true)

		testToggleButtonRendering(toggles)
		await testToggling(summary, toggles)

		if (test._ok) summary.Inner.app.destroy()
		test.end()
	}

	function testToggleButtonRendering(toggles) {
		const tabLabels2Find2 = [...tabLabels2Find]
		tabLabels2Find2.push('Scatter')
		let foundLabels = 0
		for (const toggle of toggles) {
			if (tabLabels2Find2.some(d => d == toggle.__data__.label)) ++foundLabels
		}
		test.equal(
			tabLabels2Find2.length,
			toggles.length,
			`Should render ${tabLabels2Find2.length} tabs: ${tabLabels2Find2} for 2 numeric terms`
		)
	}

	async function testToggling(summary, toggles) {
		//Toggle to violin
		toggles.find(d => d.__data__.childType == 'violin').click()
		const foundTestPlot = await detectOne({
			elem: summary.Inner.dom.holder.body.node(),
			selector: '.sjpp-violin-plot'
		})
		test.ok(foundTestPlot, `Should render violin after toggle`)
		test.equal(summary.Inner.state.config.childType, 'violin', `Should toggle to childType = violin`)

		//Toggle back to barchart
		await detectStyle({
			elem: summary.Inner.dom.plotDivs.barchart.node(),
			matcher(mutations) {
				for (const m of mutations) {
					if (m.attributeName == 'style' && m.target.style.display === '') return m
				}
			},
			trigger() {
				toggles.find(d => d.__data__.childType == 'barchart').click()
			}
		})
		test.equal(summary.Inner.state.config.childType, 'barchart', `Should toggle back to childType = 'barchart'`)
	}
})

tape('Overlay continuity, term: "aaclassic_5", term2: "sex"', test => {
	test.timeoutAfter(3000)
	const testTerm = 'sex'

	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'barchart',
					term: {
						id: 'aaclassic_5'
					},
					term2: {
						id: testTerm
					}
				}
			]
		},
		summary: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(summary) {
		summary.on('postRender.test', null)

		await testOverlay(summary)

		if (test._ok) summary.Inner.app.destroy()
		test.end()
	}

	async function testOverlay(summary) {
		const plots = summary.Inner.components.plots
		summary.Inner.dom.chartToggles
			.selectAll('div > div> button')
			.nodes()
			.find(d => d.__data__.childType == 'violin')
			.click()
		// NOTE: detect a rendered violin viz element, not the holder which may still be empty
		// by the time test.equal is called below
		await detectOne({ elem: summary.Inner.dom.holder.body.node(), selector: '.sjpp-violin-plot' })
		test.equal(
			plots.violin.Inner.config.term2.term.id,
			testTerm,
			`Overlay term = ${testTerm} carried over to violin plot`
		)
	}
})

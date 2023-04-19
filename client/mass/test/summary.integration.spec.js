import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { select, selectAll } from 'd3-selection'
import { detectOne, detectGte } from '../../test/test.helpers.js'

/*
Tests:
	Render summary plot, term: "agedx"
	Barchart tab only, term: "diaggrp"
	Barchart & violin toggles, term: "diaggrp", term2: "agedx"
	Barchart & violin toggles, term: "diaggrp", term2: "agedx"
	Barchart & violin toggles, term: "agedx", term2: "diaggrp"
	Barchart & violin toggles, term: "agedx", term2: "hrtavg"
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

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- termdb/barchart -***-')
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
		const sandboxDom = summary.Inner.dom

		testHeader(summary, sandboxDom)
		await testToggleButtons(summary, sandboxDom)
		await testOrientation(summary)

		if (test._ok) summary.Inner.app.destroy()
		test.end()
	}

	function testHeader(summary, sandboxDom) {
		const headerText = sandboxDom.paneTitleDiv.select('div.sjpp-term-header').node()
		const configTerm = summary.Inner.config.term.term.name
		test.equal(
			headerText.innerHTML,
			configTerm,
			`Header text = ${headerText.innerHTML} should match term name = ${configTerm}`
		)
	}

	async function testToggleButtons(summary, sandboxDom) {
		const toggles = sandboxDom.chartToggles
			.selectAll('div > div> button')
			.nodes()
			.filter(d => d.__data__.isVisible() == true)

		//test correct tabs exist
		const tabLabels2Find = ['Barchart', 'Violin'] //hardcoded data in summary.js.
		let foundLabels = 0
		const notFoundLabels = []
		for (const toggle of toggles) {
			if (tabLabels2Find.some(d => d == toggle.__data__.label)) ++foundLabels
			else notFoundLabels.push(toggle.__data__.label)
		}
		if (notFoundLabels.length) test.fail(`Should not render tab(s) = ${notFoundLabels}`)
		test.equal(tabLabels2Find.length, foundLabels, `Should render tabs: ${tabLabels2Find}`)

		//Toggle to violin
		toggles.find(d => d.__data__.childType == 'violin').click()
		const foundTestPlot = await detectOne({
			elem: summary.Inner.dom.holder.body.node(),
			selector: '#sjpp-vp-violinDiv'
		})
		test.ok(foundTestPlot, `Should render violin after toggle`)
		test.equal(summary.Inner.state.config.childType, 'violin', `Should toggle to childType = violin`)

		//Toggle back to barchart
		toggles.find(d => d.__data__.childType == 'barchart').click()
		const foundOrigPlot = await detectOne({ elem: summary.Inner.dom.holder.body.node(), selector: '.pp-sbar-div' })
		test.ok(foundOrigPlot, `Should render barchart after toggle`)
		test.equal(summary.Inner.state.config.childType, 'barchart', `Should toggle back to childType = 'barchart'`)
	}

	async function testOrientation(summary) {
		summary.Inner.app.dispatch({
			type: 'plot_edit',
			id: summary.Inner.id,
			config: {
				settings: { barchart: { orientation: 'vertical' } }
			}
		})
		await detectGte({ elem: summary.Inner.dom.plotDivs.barchart.node(), selector: '.bars-collabels' })
		test.notEqual(
			summary.Inner.config.settings.barchart.orientation,
			summary.Inner.config.settings.violin.orientation,

			summary.Inner.config.settings.barchart.orientation != summary.Inner.config.settings.violin.orientation,
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
		const sandboxDom = summary.Inner.dom

		await testToggleButtons(summary, sandboxDom)

		if (test._ok) summary.Inner.app.destroy()
		test.end()
	}

	async function testToggleButtons(summary, sandboxDom) {
		const toggles = sandboxDom.chartToggles
			.selectAll('div > div> button')
			.nodes()
			.filter(d => d.__data__.isVisible() == true)

		//Toggle to violin
		toggles.find(d => d.__data__.childType == 'violin').click()
		const foundTestPlot = await detectOne({
			elem: summary.Inner.dom.holder.body.node(),
			selector: '#sjpp-vp-violinDiv'
		})
		test.ok(foundTestPlot, `Should render violin after toggle`)
		test.equal(summary.Inner.state.config.childType, 'violin', `Should toggle to childType = violin`)

		//Toggle back to barchart
		toggles.find(d => d.__data__.childType == 'barchart').click()
		const foundOrigPlot = await detectOne({ elem: summary.Inner.dom.holder.body.node(), selector: '.pp-sbar-div' })
		test.ok(foundOrigPlot, `Should render barchart after toggle`)
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
		const sandboxDom = summary.Inner.dom

		await testToggleButtons(summary, sandboxDom)

		if (test._ok) summary.Inner.app.destroy()
		test.end()
	}

	async function testToggleButtons(summary, sandboxDom) {
		const toggles = sandboxDom.chartToggles
			.selectAll('div > div> button')
			.nodes()
			.filter(d => d.__data__.isVisible() == true)

		//Toggle to violin
		toggles.find(d => d.__data__.childType == 'violin').click()
		const foundTestPlot = await detectOne({
			elem: summary.Inner.dom.holder.body.node(),
			selector: '#sjpp-vp-violinDiv'
		})
		test.ok(foundTestPlot, `Should render violin after toggle`)
		test.equal(summary.Inner.state.config.childType, 'violin', `Should toggle to childType = violin`)

		//Toggle back to barchart
		toggles.find(d => d.__data__.childType == 'barchart').click()
		const foundOrigPlot = await detectOne({ elem: summary.Inner.dom.holder.body.node(), selector: '.pp-sbar-div' })
		test.ok(foundOrigPlot, `Should render barchart after toggle`)
		test.equal(summary.Inner.state.config.childType, 'barchart', `Should toggle back to childType = 'barchart'`)
	}
})

tape('Barchart & violin toggles, term: "agedx", term2: "hrtavg"', test => {
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

		await testToggleButtons(summary, sandboxDom)

		if (test._ok) summary.Inner.app.destroy()
		test.end()
	}

	async function testToggleButtons(summary, sandboxDom) {
		const toggles = sandboxDom.chartToggles
			.selectAll('div > div> button')
			.nodes()
			.filter(d => d.__data__.isVisible() == true)

		//Toggle to violin
		toggles.find(d => d.__data__.childType == 'violin').click()
		const foundTestPlot = await detectOne({
			elem: summary.Inner.dom.holder.body.node(),
			selector: '#sjpp-vp-violinDiv'
		})
		test.ok(foundTestPlot, `Should render violin after toggle`)
		test.equal(summary.Inner.state.config.childType, 'violin', `Should toggle to childType = violin`)

		//Toggle back to barchart
		toggles.find(d => d.__data__.childType == 'barchart').click()
		const foundOrigPlot = await detectOne({ elem: summary.Inner.dom.holder.body.node(), selector: '.pp-sbar-div' })
		test.ok(foundOrigPlot, `Should render barchart after toggle`)
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
		const plotsConfig = summary.Inner.components.plots
		summary.Inner.dom.chartToggles
			.selectAll('div > div> button')
			.nodes()
			.find(d => d.__data__.childType == 'violin')
			.click()
		await detectOne({ elem: summary.Inner.dom.holder.body.node(), selector: '#sjpp-vp-violinDiv' })
		test.equal(
			plotsConfig.violin.Inner.config.term2.id,
			testTerm,
			`Overlay term = ${testTerm} carried over to violin plot`
		)
	}
})

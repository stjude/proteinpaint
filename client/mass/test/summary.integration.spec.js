import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { select, selectAll } from 'd3-selection'

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

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- termdb/barchart -***-')
	test.end()
})

tape('Render summary plot', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'barchart',
					term: {
						id: 'aaclassic_5'
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

		await testToggleButtons(summary)
		await testRendering(summary)

		// if (test._ok) summary.Inner.app.destroy()
		test.end()
	}

	async function testToggleButtons(summary) {
		const toggles = summary.Inner.dom.chartToggles.nodes().filter(d => d.__data__.isVisible() == true)
		//Toggle to violin
		toggles.find(d => d.__data__.childType == 'violin').click()
		await sleep(500)
		test.equal(summary.Inner.state.config.childType, 'violin', `Should toggle to childType = violin`)

		const foundTestPlot = summary.Inner.dom.plotDivs.violin.selectAll('#sjpp-vp-violinDiv').node()
		test.ok(foundTestPlot, `Should render violin after toggle`)

		//Toggle back to barchart
		toggles.find(d => d.__data__.childType == 'barchart').click()
		await sleep(500)
		test.equal(summary.Inner.state.config.childType, 'barchart', `Should toggle back to childType = 'barchart'`)

		const foundOrigPlot = summary.Inner.dom.plotDivs.barchart.selectAll('.pp-sbar-div').node()
		test.ok(foundOrigPlot, `Should render barchart after toggle`)
	}

	async function testRendering(summary) {
		summary.Inner.app.dispatch({
			type: 'plot_edit',
			id: summary.Inner.id,
			config: {
				settings: { barchart: { orientation: 'vertical' } }
			}
		})
		await sleep(500)
		test.ok(
			summary.Inner.config.settings.barchart.orientation != summary.Inner.config.settings.violin.orientation,
			`Orientation change for barchart should not affect violin`
		)
	}
})

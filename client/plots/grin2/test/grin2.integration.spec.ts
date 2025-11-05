import tape from 'tape'
import { getRunPp } from '../../../test/front.helpers.js'
import { detectOne } from '../../../test/test.helpers.js'

/**************
 test sections

grin2
***************/

tape('\n', function (test) {
	test.comment('-***- plots/grin2-***-')
	test.end()
})

tape('grin2', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'grin2'
				}
			]
		},
		grin2: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	async function runTests(g) {
		test.ok(g.Inner.dom.runButton, 'Run button is created')

		// click submit button to run analysis
		g.Inner.dom.runButton.node().dispatchEvent(new Event('click'), { bubbles: true })
		const svg = await detectOne({ elem: g.Inner.dom.div.node(), selector: '[data-testid="sjpp-manhattan"]' })
		test.ok(svg, '<svg> is rendered')

		if (test['_ok']) g.Inner.app.destroy()
		test.end()
	}
})

tape('grin2 fusion-only', function (test) {
	runpp({
		state: {
			plots: [{ chartType: 'grin2' }]
		},
		grin2: {
			callbacks: {
				'postRender.test': runFusionTest
			}
		}
	})

	async function runFusionTest(g) {
		try {
			// Use the DOM handles
			const snvInput = g.Inner.dom.snvindelCheckbox.node() as HTMLInputElement
			const cnvInput = g.Inner.dom.cnvCheckbox.node() as HTMLInputElement
			const fusionInput = g.Inner.dom.fusionCheckbox.node() as HTMLInputElement
			const svInput = g.Inner.dom.svCheckbox.node() as HTMLInputElement

			test.ok(snvInput && cnvInput && fusionInput && svInput, 'All lesion data type checkbox inputs are present')

			// Toggle checkboxes to fusion only
			snvInput.checked = false
			snvInput.dispatchEvent(new Event('input', { bubbles: true }))
			cnvInput.checked = false
			cnvInput.dispatchEvent(new Event('input', { bubbles: true }))
			fusionInput.checked = true
			fusionInput.dispatchEvent(new Event('input', { bubbles: true }))

			// Run analysis
			g.Inner.dom.runButton.node().dispatchEvent(new Event('click', { bubbles: true }))

			// await new Promise(r => setTimeout(r, 1000))
			// Confirm plot rendered
			const svg = await detectOne({
				elem: g.Inner.dom.div.node(),
				selector: '[data-testid="sjpp-manhattan"]'
			})
			// await new Promise(r => setTimeout(r, 10000))
			test.ok(svg, 'Fusion-only run rendered <svg>')

			if (test['_ok']) g.Inner.app.destroy()
		} catch (e) {
			test.fail(e instanceof Error ? e.message : String(e))
		} finally {
			test.end()
		}
	}
})

/*************************
 reusable helper functions
**************************/

const runpp = getRunPp('mass', {
	state: {
		nav: { activeTab: 1 },
		vocab: { dslabel: 'TermdbTest', genome: 'hg38-test' }
	},
	debug: 1
})

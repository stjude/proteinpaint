import tape from 'tape'
import { getRunPp } from '../../../test/front.helpers.js'
import { detectOne } from '../../../test/test.helpers.js'

/**************
 test sections

grin2
fusion only
cnv only
snvindel only
all data types unchecked
***************/

tape('\n', function (test) {
	test.comment('-***- plots/grin2-***-')
	test.end()
})

tape('grin2', function (test) {
	test.timeoutAfter(10000)
	let hasRun = false
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
		if (hasRun) return // Prevent multiple executions
		hasRun = true
		try {
			test.ok(g.Inner.dom.runButton, 'Run button is created')

			// click submit button to run analysis
			g.Inner.dom.runButton.node().dispatchEvent(new Event('click'), { bubbles: true })

			await validateGRIN2(g, test)
			test.end()
		} catch (e) {
			test.fail(e instanceof Error ? e.message : String(e))
			test.end()
		}
	}
})

tape('grin2 fusion-only', function (test) {
	test.timeoutAfter(10000)
	let hasRun = false
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
		if (hasRun) return
		hasRun = true
		try {
			const { snvInput, cnvInput, fusionInput, svInput } = getGRIN2Checkboxes(g)

			test.ok(snvInput && cnvInput && fusionInput && svInput, 'All lesion data type checkbox inputs are present')

			// Toggle checkboxes to fusion only
			snvInput.checked = false
			snvInput.dispatchEvent(new Event('input', { bubbles: true }))
			cnvInput.checked = false
			cnvInput.dispatchEvent(new Event('input', { bubbles: true }))
			fusionInput.checked = true
			fusionInput.dispatchEvent(new Event('input', { bubbles: true }))
			svInput.checked = false
			svInput.dispatchEvent(new Event('input', { bubbles: true }))

			// Run analysis
			g.Inner.dom.runButton.node().dispatchEvent(new Event('click', { bubbles: true }))

			// Validate results
			await validateGRIN2(g, test)
			test.end()
		} catch (e) {
			test.fail(e instanceof Error ? e.message : String(e))
			test.end()
		}
	}
})

// TODO: No SV data in termdbtest. Will write one once we have some

tape('grin2 cnv-only', function (test) {
	test.timeoutAfter(10000)
	let hasRun = false

	runpp({
		state: {
			plots: [{ chartType: 'grin2' }]
		},
		grin2: {
			callbacks: {
				'postRender.test': runCNVTest
			}
		}
	})

	async function runCNVTest(g) {
		if (hasRun) return
		hasRun = true

		try {
			delete g.Inner.app.opts.grin2.callbacks['postRender.test']

			const { snvInput, cnvInput, fusionInput, svInput } = getGRIN2Checkboxes(g)
			test.ok(snvInput && cnvInput && fusionInput && svInput, 'All lesion data type checkbox inputs are present')

			// Toggle checkboxes to cnv only
			snvInput.checked = false
			snvInput.dispatchEvent(new Event('input', { bubbles: true }))
			cnvInput.checked = true
			cnvInput.dispatchEvent(new Event('input', { bubbles: true }))
			fusionInput.checked = false
			fusionInput.dispatchEvent(new Event('input', { bubbles: true }))
			svInput.checked = false
			svInput.dispatchEvent(new Event('input', { bubbles: true }))

			// Run analysis
			g.Inner.dom.runButton.node().dispatchEvent(new Event('click', { bubbles: true }))

			await validateGRIN2(g, test)
			test.end()
		} catch (e) {
			test.fail(e instanceof Error ? e.message : String(e))
			test.end()
		}
	}
})

tape('grin2 snvindel-only', function (test) {
	test.timeoutAfter(10000)
	let hasRun = false

	runpp({
		state: {
			plots: [{ chartType: 'grin2' }]
		},
		grin2: {
			callbacks: {
				'postRender.test': runSNVIndelTest
			}
		}
	})

	async function runSNVIndelTest(g) {
		if (hasRun) return
		hasRun = true

		try {
			delete g.Inner.app.opts.grin2.callbacks['postRender.test']

			const { snvInput, cnvInput, fusionInput, svInput } = getGRIN2Checkboxes(g)
			test.ok(snvInput && cnvInput && fusionInput && svInput, 'All lesion data type checkbox inputs are present')

			// Toggle checkboxes to snvindel only
			snvInput.checked = true
			snvInput.dispatchEvent(new Event('input', { bubbles: true }))
			cnvInput.checked = false
			cnvInput.dispatchEvent(new Event('input', { bubbles: true }))
			fusionInput.checked = false
			fusionInput.dispatchEvent(new Event('input', { bubbles: true }))
			svInput.checked = false
			svInput.dispatchEvent(new Event('input', { bubbles: true }))

			// Run analysis
			g.Inner.dom.runButton.node().dispatchEvent(new Event('click', { bubbles: true }))

			await validateGRIN2(g, test)
			test.end()
		} catch (e) {
			test.fail(e instanceof Error ? e.message : String(e))
			test.end()
		}
	}
})

tape('grin2 all-data-types-unchecked disables run button', function (test) {
	test.timeoutAfter(10000)
	let hasRun = false

	runpp({
		state: {
			plots: [{ chartType: 'grin2' }]
		},
		grin2: {
			callbacks: {
				'postRender.test': runDtUncheckedTest
			}
		}
	})

	async function runDtUncheckedTest(g) {
		if (hasRun) return
		hasRun = true

		try {
			delete g.Inner.app.opts.grin2.callbacks['postRender.test']

			const { snvInput, cnvInput, fusionInput, svInput } = getGRIN2Checkboxes(g)
			test.ok(snvInput && cnvInput && fusionInput && svInput, 'All data type checkboxes exist')

			// Uncheck all data types
			snvInput.checked = false
			snvInput.dispatchEvent(new Event('input', { bubbles: true }))
			cnvInput.checked = false
			cnvInput.dispatchEvent(new Event('input', { bubbles: true }))
			fusionInput.checked = false
			fusionInput.dispatchEvent(new Event('input', { bubbles: true }))
			svInput.checked = false
			svInput.dispatchEvent(new Event('input', { bubbles: true }))

			// Check Run button is disabled
			const runBtn = g.Inner.dom.runButton.node() as HTMLButtonElement
			test.equal(runBtn.disabled, true, 'Run button is disabled when no data types are selected')

			g.Inner.app.destroy()
			test.end()
		} catch (e) {
			test.fail(e instanceof Error ? e.message : String(e))
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

/**
 * Validates that GRIN2 plot and table are rendered
 * @param g - GRIN2 component instance
 * @param test - Tape test instance
 * @returns Promise<boolean> - true if validation passes
 */
async function validateGRIN2(g: any, test: any): Promise<boolean> {
	const svg = await detectOne({
		elem: g.Inner.dom.div.node(),
		selector: '[data-testid="sjpp-manhattan"]'
	})
	test.ok(svg, 'Manhattan plot <svg> is rendered')

	const table = await detectOne({
		elem: g.Inner.dom.div.node(),
		selector: '[data-testid="sjpp-grin2-top-genes-table"]'
	})
	test.ok(table, 'GRIN2 results table is rendered')

	if (svg && table) {
		g.Inner.app.destroy()
	}

	return !!(svg && table)
}

/**
 * Gets all GRIN2 checkbox inputs
 * @param g - GRIN2 component instance
 * @returns Object containing all checkbox inputs
 */
function getGRIN2Checkboxes(g: any) {
	return {
		snvInput: g.Inner.dom.snvindelCheckbox.node() as HTMLInputElement,
		cnvInput: g.Inner.dom.cnvCheckbox.node() as HTMLInputElement,
		fusionInput: g.Inner.dom.fusionCheckbox.node() as HTMLInputElement,
		svInput: g.Inner.dom.svCheckbox.node() as HTMLInputElement
	}
}

import tape from 'tape'
import { getRunPp } from '../../../test/front.helpers.js'
import { detectOne } from '../../../test/test.helpers.js'

/**************
 test sections
For each section we test if the svg plot and table are rendered

grin2 default
fusion only
cnv only
snvindel only
all data types unchecked

***************/

tape('\n', function (test) {
	test.comment('-***- plots/grin2-***-')
	test.end()
})

tape('grin2 default', function (test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [{ chartType: 'grin2' }]
		},
		grin2: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	async function runTests(g) {
		if (alreadyRun(g)) return
		await validateGRIN2(g, test)

		if (test['_ok']) g.Inner.app.destroy()
		test.end()
	}
})

tape('grin2 fusion-only', function (test) {
	test.timeoutAfter(10000)
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
		if (alreadyRun(g)) return
		const { snvInput, cnvInput, fusionInput, svInput } = getGRIN2Checkboxes(g)

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
		getRunButton(g).dispatchEvent(new Event('click', { bubbles: true }))

		// Validate results
		await validateGRIN2(g, test)

		if (test['_ok']) g.Inner.app.destroy()
		test.end()
	}
})

// TODO: No SV data in termdbtest. Will write one once we have some

tape('grin2 cnv-only', function (test) {
	test.timeoutAfter(10000)

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
		if (alreadyRun(g)) return

		const { snvInput, cnvInput, fusionInput, svInput } = getGRIN2Checkboxes(g)

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
		getRunButton(g).dispatchEvent(new Event('click', { bubbles: true }))

		await validateGRIN2(g, test)

		if (test['_ok']) g.Inner.app.destroy()
		test.end()
	}
})

tape('grin2 snvindel-only', function (test) {
	test.timeoutAfter(20000) // adding maf filter can time out at 10s
	const mafFilter = {
		type: 'tvslst',
		join: '',
		in: true,
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: {
						id: 'tumor_DNA',
						name: 'Tumor DNA',
						parent_id: null,
						child_ids: ['tumor_DNA_WGS'],
						isleaf: true,
						type: 'float',
						default: true,
						min: 0,
						max: 1,
						tvs: { ranges: [{ start: 0.1, startinclusive: true, stopunbounded: true }] }
					},
					ranges: [{ start: 0.1, startinclusive: false, startunbounded: false, stopunbounded: true }]
				}
			}
		],
		$id: 0,
		tag: 'filterUiRoot'
	}

	runpp({
		state: {
			plots: [{ chartType: 'grin2', settings: { snvindelOptions: { mafFilter } } }]
		},
		grin2: {
			callbacks: {
				'postRender.test': runSNVIndelTest
			}
		}
	})

	async function runSNVIndelTest(g) {
		if (alreadyRun(g)) return

		const { snvInput, cnvInput, fusionInput, svInput } = getGRIN2Checkboxes(g)

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
		getRunButton(g).dispatchEvent(new Event('click', { bubbles: true }))

		await validateGRIN2(g, test)

		if (test['_ok']) g.Inner.app.destroy()
		test.end()
	}
})

tape('grin2 all-data-types-unchecked disables run button', function (test) {
	test.timeoutAfter(10000)

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
		if (alreadyRun(g)) return

		const { snvInput, cnvInput, fusionInput, svInput } = getGRIN2Checkboxes(g)

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
		test.equal(getRunButton(g).disabled, true, 'Run button is disabled when no data types are selected')

		if (test['_ok']) g.Inner.app.destroy()
		test.end()
	}
})

/*************************
 reusable helper functions
**************************/

const runpp = getRunPp('mass', {
	state: {
		nav: { activeTab: -1 },
		vocab: { dslabel: 'TermdbTest', genome: 'hg38-test' }
	},
	debug: 1
})

/**
 * Returns the controls container DOM node where checkboxes and the run button live.
 */
function getControlsRoot(g: any): HTMLElement {
	return g.Inner.dom.controls.node()
}

/**
 * Returns the GRIN2 run button DOM element.
 */
function getRunButton(g: any): HTMLButtonElement {
	return getControlsRoot(g).querySelector('[data-testid="sjpp-grin2-run-button"]') as HTMLButtonElement
}

/**
 * Validates that GRIN2 plot and table are rendered
 * @param g - GRIN2 component instance
 * @param test - Tape test instance
 * @returns Promise<boolean> - true if validation passes
 */
async function validateGRIN2(g: any, test: any) {
	const runButton = getRunButton(g)
	test.ok(runButton, 'Run button is created')

	// click submit button to run analysis
	runButton.dispatchEvent(new Event('click', { bubbles: true }))
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

	if (test['_ok']) g.Inner.app.destroy()
}

/**
 * Gets all GRIN2 checkbox inputs by querying the controls DOM via stable data-testids.
 * @param g - GRIN2 component instance
 * @returns Object containing all checkbox inputs
 */
function getGRIN2Checkboxes(g: any) {
	const root = getControlsRoot(g)
	return {
		snvInput: root.querySelector('[data-testid="sjpp-grin2-checkbox-snvindel"]') as HTMLInputElement,
		cnvInput: root.querySelector('[data-testid="sjpp-grin2-checkbox-cnv"]') as HTMLInputElement,
		fusionInput: root.querySelector('[data-testid="grin2-checkbox-fusion"]') as HTMLInputElement,
		svInput: root.querySelector('[data-testid="sjpp-grin2-checkbox-sv"]') as HTMLInputElement
	}
}

/* in test, postRender is trigger twice:
1. on showing input ui (haven't run analysis yet)
2. when grin2 finished running, it dispatches plot_edit to save ui choices and set settings.runAnalysis=true

thus use this helper to prevent running postRender callback a 2nd time and errors
later look into fixing grin2 to do plot_save instead of plot_edit on running to prevent 2nd trigger of postRender
and thus no need for this helper
*/
function alreadyRun(g: any) {
	return g.Inner.app.getState().plots[0].settings.runAnalysis
}

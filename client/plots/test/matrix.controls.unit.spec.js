import tape from 'tape'
import { MatrixControls } from '../matrix.controls'
import { select } from 'd3-selection'
import { getPlotConfig } from '../matrix.config'
import { Menu } from '#dom/menu'
import * as helpers from '../../test/test.helpers'

/*************************
 reusable helper functions
**************************/

// return unique copies so that each test does not reuse
// the same data rows that are already sorted in another test
async function getArgs(_settings = {}) {
	const app = { vocabApi: { termdbConfig: {} }, tip: new Menu(), opts: {} }
	const config = await getPlotConfig(
		{
			settings: {
				matrix: {
					sortSamplesTieBreakers: [{ $id: 'sample', sortSamples: { by: 'sample' } }],
					sortByMutation: 'presence',
					sortByCNV: false,
					hiddenVariants: [],
					..._settings
				}
			}
		},
		app
	)

	const holder = select('body').append('div')
	const controlsDiv = holder.append('div')
	const svg = holder.append('svg')

	return new MatrixControls(
		{
			id: 1,
			app,
			parent: {
				app,
				dom: {
					holder,
					svg,
					seriesesG: svg.append('g'),
					scroll: holder.append('div')
				},
				getState() {
					return {
						//isVisible: true,
						config
						// filter: appState.termfilter.filter,
						// filter0, // read-only, invisible filter currently only used for gdc dataset
						// hasVerifiedToken: this.app.vocabApi.hasVerifiedToken(),
						// tokenVerificationMessage: this.app.vocabApi.tokenVerificationMessage,
						// vocab: appState.vocab,
						// termdbConfig: appState.termdbConfig,
						// clusterMethod: config.settings.hierCluster?.clusterMethod,
						// distanceMethod: config.settings.hierCluster?.distanceMethod,
						// nav: appState.nav
					}
				},
				config,
				settings: config.settings
			},
			holder: controlsDiv
		},
		{
			plots: [config]
		}
	)
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- plots/matrix.controls -***-')
	test.end()
})

// TODO: delete these tests if and when the new sorter UI is used
tape('basic sorter UI', async test => {
	test.timeoutAfter(1000)
	test.plan(6)
	const controls = await getArgs({ sortSamplesBy: 'asListed' })
	const samplesBtn = [...controls.opts.holder.node().querySelectorAll(':scope>button')].find(
		elem => elem.innerHTML === 'Samples'
	)
	samplesBtn.click()
	const radio0 = await helpers.detectOne({
		elem: controls.parent.app.tip.d.node(),
		selector: 'input[value="consequence"]'
	})

	controls.parent.app.dispatch = function (action) {
		test.equal(
			action.type,
			'plot_edit',
			'should dispatch a plot_edit action on clicking Sort Sample: SSM by consequence radio button'
		)

		test.equal(
			action.config?.settings?.matrix?.sortByMutation,
			'consequence',
			'should set the correct sortByMutation value when clicking Sort Sample: SSM by consequence radio button'
		)

		test.equal(
			action.config?.settings?.matrix?.sortOptions?.a.sortPriority[0].tiebreakers[1]?.isOrdered,
			true,
			'should set the correct sortOptions tiebreaker to isOrdered when clicking Sort Sample: SSM by consequence radio button'
		)
	}

	radio0.click()

	const radio1 = await helpers.detectOne({
		elem: controls.parent.app.tip.d.node(),
		selector: 'input[value="presence"]'
	})

	controls.parent.app.dispatch = function (action) {
		test.equal(
			action.type,
			'plot_edit',
			'should dispatch a plot_edit action on clicking Sort Sample: SSM by presence radio button'
		)

		test.equal(
			action.config?.settings?.matrix?.sortByMutation,
			'presence',
			'should set the correct sortByMutation value when clicking Sort Sample: SSM by presence radio button'
		)

		test.equal(
			action.config?.settings?.matrix?.sortOptions?.a.sortPriority[0].tiebreakers[1]?.isOrdered,
			false,
			'should set the correct sortOptions tiebreaker to isOrdered when clicking Sort Sample: SSM by presence radio button'
		)

		if (test._ok) {
			controls.parent.app.tip.clear().hide()
			controls.opts.holder.remove()
		}
	}

	radio1.click()
	test.end()
})

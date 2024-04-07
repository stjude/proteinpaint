import tape from 'tape'
import { getSorterUi } from '../matrix.sorterUi.js'
import { getPlotConfig } from '../matrix.config'
import { initByInput } from '../controls.config'
import { select } from 'd3-selection'
import { copyMerge } from '#rx'

/*************************
 reusable helper functions
**************************/

let i = 0

async function getControls(_opts = {}) {
	const holder = select('body').append('div').attr('class', 'sja_root_holder').append('table').append('tr')
	const parent = {
		id: `_${i++}_${Math.random()}`,
		app: {
			dispatch:
				_opts.dispatch ||
				(action => {
					copyMerge(config, action.config)
					uiApi.main()
				}),
			vocabApi: {
				termdbConfig: {}
			}
		},
		dom: {
			holder
		}
	}

	const config = await getPlotConfig({}, parent.app)
	parent.config = config
	const controls = { parent }
	const opts = { controls, holder, debug: true }
	const uiApi = getSorterUi(opts)
	//const input = initByInput.custom(uiOpts)
	return { uiApi, controls, config, parent: controls.parent, opts }
}

/**************
 test sections
***************/

tape('default setup', async test => {
	const { uiApi, controls, config, parent, opts } = await getControls()
	const s = parent.config.settings.matrix
	const activeOption = s.sortOptions[s.sortSamplesBy]
	test.equal(
		opts.holder.node().querySelectorAll('thead').length,
		// 2 theads, 1 for hardcoded manual selected rows + 1 for sort by case names
		// 1 thead for main table heading
		activeOption.sortPriority.length + 2 + 1,
		'should have the expected number of thead'
	)
	if (test._ok) uiApi.destroy()
	test.end()
})

tape('simulated section drag/drop', async test => {
	const { uiApi, controls, config, parent, opts } = await getControls()
	const s = config.settings.matrix
	const ui = uiApi.Inner
	const activeOptionBeforeDrag = structuredClone(ui.activeOption)
	const th = opts.holder
		.selectAll('th')
		.filter(d => d?.types?.includes('geneVariant'))
		.node()
	const sectionData = th.__data__
	ui.trackDraggedSection.call(th, {}, sectionData)

	const i = ui.activeOption.sortPriority.indexOf(sectionData)
	ui.adjustSortPriority({}, ui.activeOption.sortPriority[i + 1])

	test.deepEqual(
		activeOptionBeforeDrag.sortPriority,
		config.settings.matrix.sortOptions[s.sortSamplesBy].sortPriority,
		'should not adjust the sortPriority/table before clicking apply, after drag/drop'
	)

	ui.apply()

	test.deepEqual(
		activeOptionBeforeDrag.sortPriority.reverse(),
		config.settings.matrix.sortOptions[s.sortSamplesBy].sortPriority,
		'should adjust the sortPriority/table after clicking apply'
	)

	if (test._ok) uiApi.destroy()
	test.end()
})

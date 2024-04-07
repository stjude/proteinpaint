import tape from 'tape'
import { getSorterUi } from '../matrix.sorterUi.js'
import { getPlotConfig } from '../matrix.config'
import { initByInput } from '../controls.config'
import { select } from 'd3-selection'

/*************************
 reusable helper functions
**************************/

let i = 0

async function getControls({ dispatch }) {
	const holder = select('body').append('div').attr('class', 'sja_root_holder').append('table').append('tr')
	const controls = {
		parent: {
			id: `_${i++}_${Math.random()}`,
			app: {
				dispatch,
				vocabApi: {
					termdbConfig: {}
				}
			},
			dom: {
				holder
			}
		}
	}

	const config = await getPlotConfig({}, controls.parent.app)
	controls.parent.config = config
	const ui = getSorterUi({ controls, holder })
	//const input = initByInput.custom(uiOpts)
	return { ui, controls, config, parent: controls.parent }
}

/**************
 test sections
***************/

tape('default setup', async test => {
	const { ui, controls, config, parent } = await getControls({ dispatch: () => {} })
	const s = parent.config.settings.matrix
	console.log(s)
	test.end()
})

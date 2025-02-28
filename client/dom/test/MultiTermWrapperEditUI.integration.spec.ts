import tape from 'tape'
import * as d3 from 'd3-selection'
import { MultiTermWrapperEditUI } from '../MultiTermWrapperEditUI.ts'
import { vocabInit } from '../../termdb/vocabulary'

/**
 * Tests
 * 	- Default Multi term edit UI
 */

/*************************
 reusable helper functions
**************************/
function getHolder() {
	return d3.select('body').append('div').style('max-width', '800px').style('border', '1px solid #555')
}

function getTestOpts(_opts, genome = 'hg38-test', dslabel = 'TermdbTest') {
	const state = {
		vocab: { route: 'termdb', genome, dslabel },
		termfilter: {},
		activeCohort: 0
	}
	const app = Object.assign(_opts.app || {}, {
		getState() {
			return state
		},
		opts: { state }
	})
	const vocabApi = _opts.vocabApi || vocabInit({ app, state })
	app.vocabApi = vocabApi

	const opts = {
		app,
		vocabApi,
		holder: _opts.holder,
		twList: [],
		headerText: 'Test top text',
		buttonLabel: 'Test button label',
		customInputs: {
			placeholder: 'Test placeholder'
		},
		callback: () => {
			//Comment so the linter doesn't complain
		}
	} as any

	Object.assign(opts, _opts)

	return opts
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.pass('-***- dom/MultiTermEditUI -***-')
	test.end()
})

tape('Default Multi term edit UI', async test => {
	test.timeoutAfter(1000)

	const holder = getHolder() as any
	const testOpts = getTestOpts({ holder })
	const ui = new MultiTermWrapperEditUI(testOpts)
	await ui.renderUI()

	const menu = holder.selectAll('div[data-testid="sjpp-multi-tw-edit-ui"]')._parents
	test.equal(menu.length, 1, 'Should render edit UI')

	test.end()
})

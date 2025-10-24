import tape from 'tape'
import { NumericHandler } from '../NumericHandler.ts'
import { termjson } from '../../../test/testdata/termjson'
import { TwRouter } from '#tw'
import * as d3s from 'd3-selection'
import { agedx as agedxViolinData } from '../../../test/testdata/violinPlotData.js'
import { sleep } from '../../../test/test.helpers.js'

/*************************
 reusable helper functions
**************************/

async function getNumericHandler(_opts: any = {}) {
	const term = structuredClone(termjson.agedx)
	if (term.bins.default.type == 'regular-bin') term.bins.default.bin_size = 500
	const rawTw = {
		term,
		q: {
			mode: 'discrete',
			//type: 'regular-bin',
			...term.bins.default
		}
	}
	const tw = await TwRouter.initRaw(rawTw)

	const handler = new NumericHandler({
		termsetting: {
			tw,
			term: rawTw.term,
			q: rawTw.q,
			opts: {
				numericEditMenuVersion: ['continuous', 'discrete', 'binary', 'spline'],
				// _opts will any matching override previous opts key-values
				..._opts
			},
			api: {
				async runCallback() {
					const self = handler.termsetting
					const q = (handler.editHandler as any).q
					self.tw = await TwRouter.initRaw({ term: self.term, q }, self.opts)
				}
			},
			dom: {
				tip: {
					hide() {
						//holder.remove()
					}
				}
			},
			vocabApi: {
				getViolinPlotData() {
					return agedxViolinData
				},
				getPercentile() {
					return {
						values: [0.03537315665, 3.13072460515, 8.164619357749999, 17.8726813385]
					}
				}
			}
		}
	})

	const holder = d3s
		.select('body')
		.append('div')
		.style('width', 'fit-content')
		.style('margin', '20px')
		.style('padding', '5px')
		.style('border', '1px solid #000')

	return {
		rawTw,
		tw,
		handler,
		holder,
		destroy: () => {
			if (handler.editHandler && 'destroy' in handler.editHandler) handler.editHandler.destroy()
			if (typeof handler.destroy == 'function') handler.destroy()
			holder.remove()
		}
	}
}

/**************
 test sections
 **************/

tape('\n', test => {
	test.comment('-***- NumericHandler.unit.spec -***-')
	test.end()
})

tape('tabs data and pill status', async test => {
	const { handler, destroy } = await getNumericHandler()
	test.deepEqual(
		handler.tabs.map(t => t.label),
		['Continuous', 'Discrete', 'Cubic spline', 'Binary'],
		'sets the expected tab data'
	)

	test.deepEqual(handler.getPillStatus(), { text: 'bin size=500' }, `should give the expected pill status`)
	if ((test as any)._ok) destroy()
	test.end()
})

tape('editHandler', async test => {
	const { handler, destroy } = await getNumericHandler()

	handler.density_data = { min: 0, max: 100 }

	await handler.setEditHandler(handler.tabs[0])
	test.equal(
		handler.editHandler.constructor.name,
		'NumContEditor',
		`sets the expected editHandler for mode='continuous'`
	)

	await handler.setEditHandler(handler.tabs[1])
	test.equal(
		handler.editHandler.constructor.name,
		'NumDiscreteEditor',
		`sets the expected editHandler for mode='discrete'`
	)

	await handler.setEditHandler(handler.tabs[2])
	test.equal(handler.editHandler.constructor.name, 'NumSplineEditor', `sets the expected editHandler for mode='binary'`)

	await handler.setEditHandler(handler.tabs[3])
	test.equal(handler.editHandler.constructor.name, 'NumBinaryEditor', `sets the expected editHandler for mode='spline'`)
	if ((test as any)._ok) destroy()
	test.end()
})

tape('showEditMenu, multiple modes', async test => {
	const { handler, holder, destroy } = await getNumericHandler()
	await handler.showEditMenu(holder)
	await sleep(0)
	test.equal(handler.editHandler.dom.density_div.selectAll('svg').size(), 1, `should render a density plot svg`)
	test.equal(
		handler.dom.topBar?.selectAll('.sj-toggle-button').size(),
		4,
		`should render 4 tabs, one toggle button for each mode`
	)
	test.equal(handler.dom.btnDiv?.selectAll('button').size(), 2, `should render an apply and reset button`)

	test.deepEqual(handler.getPillStatus(), { text: 'bin size=500' }, 'should have the expected initial pill status')
	const tabBtns = handler.dom.topBar.node().querySelectorAll('button')
	tabBtns[2].click()
	await sleep(10)
	// assume that the first button is Apply
	handler.dom.btnDiv.select('button').node().click()
	await sleep(10)
	test.deepEqual(
		handler.getPillStatus(),
		{ text: 'cubic spline' },
		'should have a different pill status after switching q.modes'
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('showEditMenu, single mode', async test => {
	const { handler, holder, destroy } = await getNumericHandler({ numericEditMenuVersion: ['binary'] })
	await handler.showEditMenu(holder)
	await sleep(0)
	test.equal(handler.editHandler.dom.density_div.selectAll('svg').size(), 1, `should render a density plot svg`)
	test.equal(
		handler.dom.topBar?.selectAll('.sj-toggle-button').size(),
		undefined,
		`should not render mode toggle buttons`
	)
	test.equal(handler.dom.btnDiv?.selectAll('button').size(), 2, `should render an apply and reset button`)
	if ((test as any)._ok) destroy()
	test.end()
})

tape('apply and reset', async test => {
	test.timeoutAfter(50)
	test.plan(2)

	const { handler, holder, destroy } = await getNumericHandler()

	handler.editHandler = {
		getEditedQ() {
			test.pass('should trigger editHandler.getEditedQ() from applyEdits()')
			return { mode: 'discrete', type: 'regular-bin' }
		},
		undoEdits() {
			test.pass('should trigger editHandler.undoEdits() from undoEdits()')
		}
	} as any

	try {
		await handler.renderButtons(holder)
		const btns = holder.node()?.querySelectorAll('button')
		if (btns?.length) {
			btns[0].click()
			btns[1].click()
		}
		if ((test as any)._ok) destroy()
		test.end()
	} catch (e) {
		test.fail('should trigger editHandler.getEditedQ and .undoEdits(): ' + e)
	}
})

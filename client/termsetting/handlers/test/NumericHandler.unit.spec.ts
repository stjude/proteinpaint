import tape from 'tape'
import { NumericHandler } from '../NumericHandler.ts'
import { termjson } from '../../../test/testdata/termjson'
import { TwRouter } from '#tw'

/*************************
 reusable helper functions
**************************/

async function getNumericHandler() {
	const rawTw = {
		term: termjson.agedx,
		q: {
			mode: 'discrete',
			//type: 'regular-bin',
			...termjson.agedx.bins.default
		}
	}
	const tw = await TwRouter.initRaw(rawTw)

	const handler = new NumericHandler({
		termsetting: {
			tw,
			term: rawTw.term,
			q: rawTw.q,
			opts: {
				numericEditMenuVersion: ['continuous', 'discrete', 'binary', 'spline']
			},
			api: {
				runCallback() {}
			},
			dom: {
				tip: {
					hide() {}
				}
			},
			vocabApi: {
				getViolinPlotData() {
					return {}
				}
			}
		}
	})

	return { rawTw, tw, handler }
}

/**************
 test sections
 **************/

tape('\n', test => {
	test.comment('-***- NumericHandler.unit.spec -***-')
	test.end()
})

tape('tabs data', async test => {
	const { handler } = await getNumericHandler()
	test.deepEqual(
		handler.tabs.map(t => t.label),
		['Continuous', 'Discrete', 'Cubic spline', 'Binary'],
		'sets the expected tab data'
	)
	test.end()
})

tape('editHandler', async test => {
	const { handler } = await getNumericHandler()

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
	if ((test as any)._ok) handler.destroy()
	test.end()
})

tape('showEditMenu', async test => {
	const { handler } = await getNumericHandler()
	const div = {
		selectAll() {
			return div
		},
		append() {
			return div
		},
		style() {
			return div
		},
		attr() {
			return div
		},
		classed() {
			return div
		},
		property() {
			return div
		},
		html() {
			return div
		},
		data() {
			return {
				enter() {
					return div
				},
				classed() {
					return div
				}
			}
		},
		each() {
			return div
		},
		on() {
			return div
		},
		remove() {}
	}
	handler.showEditMenu(div)
	if ((test as any)._ok) handler.destroy()
	test.end()
})

tape('apply and reset', async test => {
	test.timeoutAfter(50)
	test.plan(2)
	const { handler } = await getNumericHandler()
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
		handler.applyEdits()
		handler.undoEdits()
		if ((test as any)._ok) handler.destroy()
		test.end()
	} catch (e) {
		test.fail('should trigger editHandler.getEditedQ and .undoEdits(): ' + e)
	}
})

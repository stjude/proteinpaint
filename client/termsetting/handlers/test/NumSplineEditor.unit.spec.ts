import tape from 'tape'
import { NumericHandler } from '../NumericHandler.ts'
import { termjson } from '../../../test/testdata/termjson'
import { sleep } from '../../../test/test.helpers'
import { agedx as agedxViolinData } from '../../../test/testdata/violinPlotData.js'
import { TwRouter } from '#tw'
import * as d3s from 'd3-selection'

/*************************
 reusable helper functions
**************************/

async function getNumericHandler(opts: any = {}) {
	const term = JSON.parse(JSON.stringify(termjson.agedx))
	const rawTw = {
		term,
		q: {
			mode: 'spline',
			//[{value: 0.04}, {value: 3.13}, {value: 8.16}, {value: 17.87}]
			knots: [{ value: 10 }, { value: 100 }, { value: 500 }, { value: 1000 }]
		}
	}

	let handler: any = {}
	const vocabApi = {
		state: {
			termfilter: { filter: { type: 'tvslst', in: '', lst: [] } }
		},
		getViolinPlotData() {
			return agedxViolinData
		},
		getPercentile() {
			return {
				values: [0.03537315665, 3.13072460515, 8.164619357749999, 17.8726813385]
			}
		}
	}

	const tw = await TwRouter.initRaw(rawTw, { vocabApi })

	handler = new NumericHandler({
		termsetting: {
			tw,
			term: rawTw.term,
			q: rawTw.q,
			opts: {
				numericEditMenuVersion: ['spline'],
				usecase: opts.usecase
			},
			api: {
				runCallback() {}
			},
			dom: {
				tip: {
					hide() {}
				}
			},
			vocabApi
		}
	})

	const holder = d3s
		.select('body')
		.append('div')
		.style('position', 'relative')
		.style('width', 'fit-content')
		.style('margin', '20px')
		.style('padding', '5px')
		.style('border', '1px solid #000')

	handler.dom.editDiv = holder

	await handler.setEditHandler(handler.tabs[0])
	return {
		rawTw,
		tw,
		handler,
		editHandler: handler.editHandler,
		holder,
		destroy: () => {
			if ('destroy' in handler.editHandler) handler.editHandler.destroy()
			if (typeof handler.destroy == 'function') handler.destroy()
			holder.remove()
		}
	}
}

/**************
 test sections
 **************/

tape('\n', test => {
	test.comment('-***- NumBinaryEditor.unit.spec -***-')
	test.end()
})

tape('handler methods', async test => {
	const { editHandler, destroy } = await getNumericHandler()
	test.deepEqual(editHandler.getPillStatus(), { text: 'cubic spline' }, 'should give the expected status')
	editHandler.termsetting.tw.q = { mode: 'discrete' }
	test.deepEqual(
		await editHandler.getDefaultQ(),
		{ mode: 'spline', knots: [{ value: '0.04' }, { value: '3.13' }, { value: '8.16' }, { value: '17.87' }] },
		'should give the expected defaultQ'
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('initial rendered UI', async test => {
	const { editHandler, holder, destroy } = await getNumericHandler()
	await editHandler.showEditMenu(holder)
	test.equal(editHandler.dom?.density_div.selectAll('svg').size(), 1, `should render a density plot svg`)

	const lines = [...editHandler.handler.density.dom.binsize_g.node().querySelectorAll('line')]
	test.equal(lines.length, 4, `should render 4 draggable lines in the density plot`)
	test.deepEqual(
		lines.map(l => l.getAttribute('x1')),
		['11', '21', '63', '116'],
		`should render the draggable lines in the expected x-positions`
	)
	test.equal(
		editHandler.dom.customKnotsInput.property('value'),
		'10\n100\n500\n1000',
		'should display line-separated values in the knots inputs'
	)
	test.equal(editHandler.dom.knot_select_div.selectAll('select').size(), 1, `should render an auto-compute dropdown`)
	test.equal(
		editHandler.dom.knot_select_div.select('select').property('value'),
		'4',
		`should default to 4 knots for auto-compute`
	)

	const density_div = editHandler.dom.density_div.node()
	await editHandler.showEditMenu(holder)
	test.equal(
		density_div,
		editHandler.dom.density_div.node(),
		`should not re-render the menu when the holder has not changed`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('knots interactivity', async test => {
	const { editHandler, holder, destroy } = await getNumericHandler()
	await editHandler.showEditMenu(holder)

	const newKnots = [10, 200, 600, 3000]
	editHandler.dom.customKnotsInput.property('value', newKnots.join('\n'))
	editHandler.dom.customKnotsInput.node().dispatchEvent(new Event('change', { bubbles: true }))
	const lines = [...editHandler.handler.density.dom.binsize_g.node().querySelectorAll('line')]
	test.deepEqual(
		lines.map(l => l.getAttribute('x1')),
		['11', '31', '74', '328'],
		`should re-render the draggable lines in the updated x-positions`
	)

	test.deepEqual(
		editHandler.getEditedQ(false),
		{ mode: 'spline', knots: newKnots.map(value => ({ value })) },
		`should give the expected edited q object`
	)

	editHandler.undoEdits()
	await sleep(0)
	{
		const lines = [...editHandler.handler.density.dom.binsize_g.node().querySelectorAll('line')]
		test.equal(lines.length, 4, `should render 4 draggable lines in the density plot`)
		test.deepEqual(
			lines.map(l => l.getAttribute('x1')),
			['11', '21', '63', '116'],
			`should render the draggable lines in the expected x-positions`
		)
	}

	if ((test as any)._ok) destroy()
	test.end()
})

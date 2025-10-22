import tape from 'tape'
import { NumericHandler } from '../NumericHandler.ts'
import type { NumDiscreteEditor } from '../NumDiscreteEditor.ts'
import type { NumCustomBinEditor } from '../NumCustomBinEditor.ts'
import { termjson } from '../../../test/testdata/termjson'
import { agedx as agedxViolinData } from '../../../test/testdata/violinPlotData.js'
import { TwRouter } from '#tw'
import * as d3s from 'd3-selection'

/*************************
 reusable helper functions
**************************/

const pct50 = 6.3475409836
const pct70 = 1000.36986301355

async function getNumericHandler(opts: any = {}) {
	const term = JSON.parse(JSON.stringify(termjson.agedx))
	const rawTw = {
		term,
		q: {
			mode: 'discrete',
			type: 'custom-bin',
			preferredBins: 'median'
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
				values: handler?.editHandler?.q.cutoffPercentile === 70 ? [pct70] : [pct50]
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
				numericEditMenuVersion: ['discrete'],
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

	handler.density_data = { min: agedxViolinData.min, max: agedxViolinData.max }

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
	const binsEditor: NumCustomBinEditor = handler.editHandler.editorsByType['custom-bin']

	return {
		rawTw,
		tw,
		handler,
		editHandler: handler.editHandler satisfies NumDiscreteEditor,
		binsEditor,
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
	test.comment('-***- NumCustomBinEditor.unit.spec -***-')
	test.end()
})

tape('handler methods', async test => {
	const { binsEditor, destroy } = await getNumericHandler()
	test.deepEqual(binsEditor.getPillStatus(), { text: '2 bins' }, 'should give the expected status')
	test.deepEqual(
		binsEditor.getDefaultQ(),
		{
			mode: 'discrete',
			type: 'custom-bin',
			isAtomic: true,
			lst: [
				{
					startunbounded: true,
					stop: 6.35,
					stopinclusive: false,
					label: '<6.35',
					range: '<span style="font-family:Times;font-style:italic;">x</span> <6.35'
				},
				{
					start: 6.35,
					startinclusive: true,
					stopunbounded: true,
					label: '≥6.35',
					range: '<span style="font-family:Times;font-style:italic;">x</span> ≥6.35'
				}
			],
			hiddenValues: {}
		},
		`should give the expected default tw.q object`
	)

	binsEditor.tw.q = { mode: 'continuous' } as any
	test.deepEqual(
		binsEditor.getDefaultQ(),
		{
			mode: 'discrete',
			type: 'custom-bin',
			lst: [
				{
					startunbounded: true,
					startinclusive: false,
					stopinclusive: false,
					stop: 2355,
					label: '<2355',
					range: '<span style="font-family:Times;font-style:italic;">x</span> <2355'
				},
				{
					stopunbounded: true,
					startinclusive: true,
					stopinclusive: false,
					start: 2355,
					label: '≥2355',
					range: '<span style="font-family:Times;font-style:italic;">x</span> ≥2355'
				}
			]
		},
		`should give the expected default tw.q object if the mode is not discrete`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('initial rendered UI', async test => {
	const { editHandler, binsEditor, holder, destroy } = await getNumericHandler()
	await editHandler.showEditMenu(holder)

	test.equal(binsEditor.dom.customBinBoundaryInput?.size(), 1, `should render a textarea input for custom bin entries`)

	const textInputs = binsEditor.dom.inputsDiv.node().querySelectorAll(`input[type='text']`)
	test.equal(textInputs.length, 2, `should render 2 number inputs to match tw.q.lst[]`)

	const ranges = binsEditor.dom.inputsDiv.node().querySelectorAll('div[name="range"]')
	test.equal(ranges[0].innerText, 'x <6.35', `should render the expected first bin range`)
	test.equal(ranges[1].innerText, 'x ≥6.35', `should render the expected last bin range`)

	const binInputs = binsEditor.dom.inputsDiv.node().querySelectorAll('input')
	test.equal(binInputs[0].value, '<6.35', `should render the expected first bin input value`)
	test.equal(binInputs[1].value, '≥6.35', `should render the expected last bin input value`)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('edit interactivity', async test => {
	const { editHandler, binsEditor, holder, destroy } = await getNumericHandler()
	await editHandler.showEditMenu(holder)

	const newKnots = [10, 200, 600, 3000]
	binsEditor.dom.customBinBoundaryInput.property('value', newKnots.join('\n'))
	binsEditor.dom.customBinBoundaryInput.node().dispatchEvent(new Event('change', { bubbles: true }))
	const lines = [...editHandler.handler.density.dom.binsize_g.node().querySelectorAll('line')]
	test.deepEqual(
		lines.map(l => l.getAttribute('x1')),
		['11', '31', '74', '328'],
		`should re-render the draggable lines in the updated x-positions`
	)

	test.deepEqual(
		binsEditor.getEditedQ(false),
		{
			mode: 'discrete',
			type: 'custom-bin',
			lst: [
				{
					startunbounded: true,
					stop: 10,
					startinclusive: false,
					stopinclusive: true,
					label: '≤10',
					range: '<span style="font-family:Times;font-style:italic;">x</span> ≤10'
				},
				{
					start: 10,
					startinclusive: false,
					stopinclusive: true,
					stop: 200,
					label: '>10 to 200',
					range: '10 < <span style="font-family:Times;font-style:italic;">x</span> ≤ 200'
				},
				{
					start: 200,
					startinclusive: false,
					stopinclusive: true,
					stop: 600,
					label: '>200 to 600',
					range: '200 < <span style="font-family:Times;font-style:italic;">x</span> ≤ 600'
				},
				{
					start: 600,
					startinclusive: false,
					stopinclusive: true,
					stop: 3000,
					label: '>600 to 3000',
					range: '600 < <span style="font-family:Times;font-style:italic;">x</span> ≤ 3000'
				},
				{
					start: 3000,
					startinclusive: false,
					stopinclusive: false,
					stopunbounded: true,
					label: '>3000',
					range: '<span style="font-family:Times;font-style:italic;">x</span> >3000'
				}
			]
		},
		`should give the expected edited q object`
	)

	const inputsDiv = binsEditor.dom.inputsDiv.node()
	await binsEditor.render(editHandler.dom.binsDiv.node().firstChild)
	test.equal(
		inputsDiv,
		binsEditor.dom.inputsDiv.node(),
		`should not re-render the menu when the holder has not changed`
	)

	editHandler.undoEdits()
	{
		const lines = [...editHandler.handler.density.dom.binsize_g.node().querySelectorAll('line')]
		test.equal(lines.length, 1, `should render 1 draggable line in the density plot`)
		test.deepEqual(
			lines.map(l => l.getAttribute('x1')),
			['11'],
			`should render the draggable lines in the expected x-positions`
		)
	}

	if ((test as any)._ok) destroy()
	test.end()
})

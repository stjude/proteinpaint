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

/* a term with valueConversion{} stores its values in one unit (e.g. day) and is read by users in
another (e.g. year). q.lst keeps the stored unit, while the textarea and the density plot show the
user-facing one. 365.25 days is 1 year */
const DAY_TO_YEAR = 1 / 365.25

function getConvertedTerm() {
	const term = JSON.parse(JSON.stringify(termjson.agedx))
	term.valueConversion = { fromUnit: 'day', toUnit: 'year', scaleFactor: DAY_TO_YEAR }
	return term
}

async function getNumericHandler(opts: any = {}) {
	const term = opts.term || JSON.parse(JSON.stringify(termjson.agedx))
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
		getViolinBox() {
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

/* drag a rendered boundary line, as a user does: d3 emits a drag event for the move and another
for the release, so the boundary callback is called twice with the same x */
function simulateDrag(elem, xOffset) {
	const box = elem.getBoundingClientRect()
	for (const [type, clientX] of [
		['mousedown', box.x],
		['mousemove', box.x + xOffset],
		['mouseup', box.x + xOffset]
	] as [string, number][]) {
		elem.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY: box.y, view: window }))
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

	const input0 = binsEditor.dom.customBinLabelInput.node()
	input0.value = '- TEST -'
	input0.dispatchEvent(new Event('change', { bubbles: true }))

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
					label: '- TEST -',
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

tape('dragging a boundary line with more than one boundary', async test => {
	const { editHandler, binsEditor, holder, destroy } = await getNumericHandler()
	await editHandler.showEditMenu(holder)

	// two boundaries, so that the dragged one and the untouched one must both survive
	binsEditor.dom.customBinBoundaryInput.property('value', [10, 200].join('\n'))
	binsEditor.dom.customBinBoundaryInput.node().dispatchEvent(new Event('change', { bubbles: true }))

	// drag the second line, as NumericDensity does on each drag and again on drag end
	const drag = value => (binsEditor.getBoundaryOpts().callback as any)({ index: 1 }, value)
	drag(500)
	drag(500)

	test.equal(
		binsEditor.dom.customBinBoundaryInput.property('value'),
		'10\n500',
		`should list one boundary per line, keeping the boundary that was not dragged`
	)
	test.deepEqual(
		binsEditor.q.lst.map(bin => ('start' in bin ? bin.start : null)),
		[null, 10, 500],
		`should keep every bin, moving only the dragged boundary`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('dragging a bin boundary line towards its neighboring line', async test => {
	const { editHandler, binsEditor, holder, destroy } = await getNumericHandler()
	await editHandler.showEditMenu(holder)

	binsEditor.dom.customBinBoundaryInput.property('value', [10, 200].join('\n'))
	binsEditor.dom.customBinBoundaryInput.node().dispatchEvent(new Event('change', { bubbles: true }))
	const getLines = () => [...editHandler.handler.density.dom.binsize_g.node().querySelectorAll('line')]
	const getBoundaries = () => binsEditor.dom.customBinBoundaryInput.property('value').split('\n')
	test.equal(getLines().length, 2, `should render one line per boundary`)

	/* q.lst is kept sorted and the callback addresses a boundary by the index of its line, so a
	boundary dragged past its neighbor would be written back as the neighbor by the next drag event,
	and a boundary dragged onto its neighbor would be merged with it. either leaves the textarea
	holding fewer boundaries than the plot is showing lines */
	simulateDrag(getLines()[0], 400)
	test.deepEqual(getBoundaries(), ['188.4', '200'], `should stop the dragged boundary below the neighboring one`)
	test.deepEqual(
		binsEditor.q.lst.map(bin => ('start' in bin ? bin.start : null)),
		[null, 188.4, 200],
		`should keep every bin when a drag is stopped at the neighboring line`
	)
	test.equal(getLines().length, 2, `should keep one line per boundary when a drag is stopped at the neighboring line`)

	// a drag that stays on its own side of the neighbor moves only the boundary it was started on
	simulateDrag(getLines()[0], -10)
	test.deepEqual(getBoundaries(), ['94.2', '200'], `should move only the dragged boundary`)
	test.deepEqual(
		binsEditor.q.lst.map(bin => ('start' in bin ? bin.start : null)),
		[null, 94.2, 200],
		`should keep every bin, moving only the dragged boundary`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('returning to the tab with unapplied bin boundary edits', async test => {
	const { editHandler, binsEditor, holder, destroy } = await getNumericHandler()
	await editHandler.showEditMenu(holder)

	// edit the boundaries, without clicking Apply
	binsEditor.dom.customBinBoundaryInput.property('value', [10, 200].join('\n'))
	binsEditor.dom.customBinBoundaryInput.node().dispatchEvent(new Event('change', { bubbles: true }))
	const getLineXs = () =>
		[...editHandler.handler.density.dom.binsize_g.node().querySelectorAll('line')].map(l => l.getAttribute('x1'))
	const editedLineXs = getLineXs()

	// toggling to Continuous and back re-renders this editor into the holder it is already in
	await binsEditor.render(editHandler.dom.binsDiv.node().firstChild)

	test.deepEqual(getLineXs(), editedLineXs, `should leave the boundary lines at the edited positions`)
	test.equal(
		binsEditor.dom.customBinBoundaryInput.property('value'),
		'10\n200',
		`should leave the edited bin boundaries in the textarea`
	)
	test.deepEqual(
		binsEditor.q.lst.map(bin => ('start' in bin ? bin.start : null)),
		[null, 10, 200],
		`should leave the bins parsed from the edits in q`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('converted term', async test => {
	const { editHandler, binsEditor, holder, destroy } = await getNumericHandler({ term: getConvertedTerm() })
	await editHandler.showEditMenu(holder)

	// the default boundary comes from the median of the stored values, and reads in years
	test.equal(
		binsEditor.dom.customBinBoundaryInput.property('value'),
		String(Number((pct50 * DAY_TO_YEAR).toFixed(2))),
		`should fill the boundary textarea in years`
	)

	// enter boundaries in years
	binsEditor.dom.customBinBoundaryInput.property('value', [5, 10].join('\n'))
	binsEditor.dom.customBinBoundaryInput.node().dispatchEvent(new Event('change', { bubbles: true }))
	test.deepEqual(
		binsEditor.q.lst.map(bin => ('start' in bin ? bin.start : null)),
		[null, 1826.25, 3652.5],
		`should store boundaries typed in years as days`
	)

	const editedQ = binsEditor.getEditedQ(false)
	test.deepEqual(
		editedQ.lst.map(bin => ({ start: 'start' in bin ? bin.start : null, stop: 'stop' in bin ? bin.stop : null })),
		[
			{ start: null, stop: 1826.25 },
			{ start: 1826.25, stop: 3652.5 },
			{ start: 3652.5, stop: null }
		],
		`should give an edited q whose bins are in days`
	)
	test.deepEqual(
		editedQ.lst.map(bin => bin.label),
		['≤5y', '>5y to 10y', '>10y'],
		`should label the bins in years`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

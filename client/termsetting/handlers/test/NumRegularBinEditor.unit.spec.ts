import tape from 'tape'
import { NumericHandler } from '../NumericHandler.ts'
import type { NumDiscreteEditor } from '../NumDiscreteEditor.ts'
import type { NumRegularBinEditor } from '../NumRegularBinEditor.ts'
import { termjson } from '../../../test/testdata/termjson'
import { agedx as agedxViolinData } from '../../../test/testdata/violinPlotData.js'
import { TwRouter } from '#tw'
import * as d3s from 'd3-selection'

/*************************
 reusable helper functions
**************************/

async function getNumericHandler(opts: any = {}) {
	const term = JSON.parse(JSON.stringify(termjson.agedx))
	if (term.bins.default.type == 'regular-bin') term.bins.default.bin_size = 500

	const rawTw = {
		term,
		q: term.bins.default
	}

	let handler: any = {}
	const vocabApi = {
		state: {
			termfilter: { filter: { type: 'tvslst', in: '', lst: [] } }
		},
		getViolinPlotData() {
			return agedxViolinData
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
	const binsEditor: NumRegularBinEditor = handler.editHandler.editorsByType['regular-bin']

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
	test.comment('-***- NumRegularBinEditor.unit.spec -***-')
	test.end()
})

tape('handler methods', async test => {
	const { binsEditor, destroy } = await getNumericHandler()
	test.deepEqual(
		binsEditor.getDefaultQ(),
		{
			type: 'regular-bin',
			label_offset: 1,
			bin_size: 500,
			first_bin: { startunbounded: true, stop: 2 },
			isAtomic: true,
			mode: 'discrete',
			hiddenValues: {},
			label_offset_ignored: false
		},
		`should give the expected default tw.q object`
	)

	binsEditor.tw.q = { mode: 'continuous' } as any
	test.deepEqual(
		binsEditor.getDefaultQ(),
		{
			type: 'regular-bin',
			label_offset: 1,
			bin_size: 500,
			first_bin: { startunbounded: true, stop: 2 },
			isAtomic: true,
			mode: 'discrete',
			hiddenValues: {},
			label_offset_ignored: false
		},
		`should give the expected default tw.q object if the mode is not discrete`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('initial rendered UI', async test => {
	const { editHandler, binsEditor, holder, destroy } = await getNumericHandler()
	await editHandler.showEditMenu(holder)
	test.equal(binsEditor.dom.binsTable.selectAll('tr').size(), 3, `should render a boundary inputs table with 3 rows`)
	const numberInputs = binsEditor.dom.binsTable.node().querySelectorAll(`input[type='number']`)
	test.equal(
		numberInputs.length,
		3,
		`should render 3 number inputs for bin size, first bin stop, and optional last bin start`
	)
	test.equal(
		numberInputs[2].parentNode?.style.display,
		'none',
		`should hide the input for last bin start, if not specified in q`
	)

	const radios = binsEditor.dom.binsTable.node().querySelectorAll(`input[type='radio']`)
	test.equal(radios.length, 2, `should render 2 radio inputs for optional last bin`)
	test.equal(radios[0].checked, true, `should checked the automatic last bin start radio`)
	test.equal(radios[1].checked, false, `should not check the fixed last bin start radio`)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('edit interactivity', async test => {
	const { editHandler, binsEditor, holder, destroy } = await getNumericHandler()
	await editHandler.showEditMenu(holder)
	binsEditor.dom.bin_size_input.property('value', 300)
	binsEditor.dom.bin_size_input.node().dispatchEvent(new Event('change', { bubbles: true }))
	binsEditor.dom.first_stop_input.property('value', 100)
	binsEditor.dom.first_stop_input.node().dispatchEvent(new Event('change', { bubbles: true }))
	binsEditor.dom.fixed_radio.property('checked', true)
	binsEditor.dom.fixed_radio.node().dispatchEvent(new Event('input', { bubbles: true }))
	binsEditor.dom.last_start_input.property('value', 1000)
	binsEditor.dom.last_start_input.node().dispatchEvent(new Event('change', { bubbles: true }))

	test.equal(
		binsEditor.dom.last_start_input.style('display'),
		'inline-block',
		`should display the last start input when fixed stop option is selected`
	)

	test.deepEqual(
		editHandler.getEditedQ(false),
		{
			mode: 'discrete',
			type: 'regular-bin',
			startinclusive: false,
			stopinclusive: true,
			bin_size: 300,
			first_bin: { startunbounded: true, stop: 100 },
			rounding: '.0f',
			last_bin: { start: 1000, stopunbounded: true }
		},
		`should give the expected edited tw.q object`
	)

	{
		const lines = [...editHandler.handler.density.dom.binsize_g.node().querySelectorAll('line')]
		test.deepEqual(
			lines.filter(l => l.style.display !== 'none').map(l => l.getAttribute('x1')),
			['21', '52', '84', '116'],
			`should render 4 lines in the expected x-positions of the density plot`
		)
	}

	const binsTable = binsEditor.dom.binsTable.node()
	await binsEditor.render(editHandler.dom.binsDiv.node().firstChild)
	test.equal(
		binsTable,
		binsEditor.dom.binsTable.node(),
		`should not re-render the menu when the holder has not changed`
	)

	await editHandler.undoEdits()
	{
		const lines = [...editHandler.handler.density.dom.binsize_g.node().querySelectorAll('line')]
		test.deepEqual(
			lines.map(l => l.getAttribute('x1')),
			['10', '63', '116', '169', '223', '276', '329', '382', '435', '488'],
			`should render a draggable line in the expected x-position`
		)
	}

	if ((test as any)._ok) destroy()
	test.end()
})

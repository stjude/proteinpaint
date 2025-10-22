import tape from 'tape'
import { NumericHandler } from '../NumericHandler.ts'
import type { NumDiscreteEditor } from '../NumDiscreteEditor.ts'
import { termjson } from '../../../test/testdata/termjson'
import { agedx as agedxViolinData } from '../../../test/testdata/violinPlotData.js'
import { TwRouter } from '#tw'
import * as d3s from 'd3-selection'

/*************************
 reusable helper functions
**************************/

async function getNumericHandler(opts: any = {}) {
	const term = structuredClone(termjson.agedx)
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
	return {
		rawTw,
		tw,
		handler,
		editHandler: handler.editHandler satisfies NumDiscreteEditor,
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
	test.comment('-***- NumDiscreteEditor.unit.spec -***-')
	test.end()
})

tape('handler methods', async test => {
	const { editHandler, destroy } = await getNumericHandler()
	test.deepEqual(editHandler.getPillStatus(), { text: 'bin size=500' }, 'should give the expected status')
	editHandler.setDefaultBoundaryInclusion()
	test.equal(editHandler.boundaryInclusion, 'stopinclusive', 'should set the expected default boundaryInclusion')

	editHandler.termsetting.tw.q = {
		mode: 'discrete',
		type: 'custom-bin',
		lst: [
			{ start: 0, stop: 5, startinclusive: true },
			{ start: 5, stop: 10, startinclusive: true }
		]
	}
	editHandler.setDefaultBoundaryInclusion()
	test.equal(
		editHandler.boundaryInclusion,
		'startinclusive',
		'should set the expected default boundaryInclusion for custom-bin'
	)

	editHandler.termsetting.tw.q = { mode: 'continuous' }
	editHandler.setDefaultBoundaryInclusion()
	test.equal(
		editHandler.boundaryInclusion,
		'stopinclusive',
		`should set the expected default boundaryInclusion when q.mode != 'discrete'`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('initial rendered UI', async test => {
	const { editHandler, holder, destroy } = await getNumericHandler()
	await editHandler.showEditMenu(holder)
	test.equal(editHandler.dom?.density_div.selectAll('svg').size(), 1, `should render a density plot svg`)
	test.equal(
		editHandler.dom.boundaryInclusionDiv.selectAll('option').size(),
		2,
		`should render a boundary inclusion dropdown with 2 options`
	)
	test.equal(
		editHandler.dom.boundaryInclusionDiv.select('select').property('value'),
		'stopinclusive',
		`should default to startinclusive boundary inclusion input value`
	)
	test.deepEqual(
		[...editHandler.dom.binsDiv.node().querySelectorAll(`button[data-testid='sja_toggle_button']`)].map(
			b => b.firstChild.innerText
		),
		['Same bin size', 'Varying bin sizes'],
		`should render 2 toggle buttons, one each for regular-bin and custom-bin menu`
	)

	const boundaryInclusionDiv = editHandler.dom.boundaryInclusionDiv.node()
	await editHandler.showEditMenu(holder)
	test.equal(
		boundaryInclusionDiv,
		editHandler.dom.boundaryInclusionDiv.node(),
		`should not re-render the menu when the holder has not changed`
	)

	editHandler.dom.boundaryInput.property('value', 'startinclusive')
	editHandler.dom.boundaryInput.node().dispatchEvent(new Event('change', { bubbles: true }))
	test.deepEqual(
		editHandler.getEditedQ(false),
		{
			mode: 'discrete',
			type: 'regular-bin',
			startinclusive: true,
			stopinclusive: false,
			bin_size: 500,
			first_bin: { startunbounded: true, stop: 2 },
			rounding: '.0f'
		},
		`should give the expected edited tw.q object`
	)

	await editHandler.undoEdits()
	test.deepEqual(
		editHandler.getEditedQ(false),
		{
			mode: 'discrete',
			type: 'regular-bin',
			startinclusive: false,
			stopinclusive: true,
			bin_size: 500,
			first_bin: { startunbounded: true, stop: 2 },
			rounding: '.0f'
		},
		`should give the expected edited tw.q object`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

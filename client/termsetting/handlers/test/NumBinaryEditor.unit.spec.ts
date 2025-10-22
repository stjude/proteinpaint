import tape from 'tape'
import { NumericHandler } from '../NumericHandler.ts'
import type { NumBinaryEditor } from '../NumBinaryEditor.ts'
import { termjson } from '../../../test/testdata/termjson'
import { sleep } from '../../../test/test.helpers'
import { agedx as agedxViolinData } from '../../../test/testdata/violinPlotData.js'
import { TwRouter } from '#tw'
import * as d3s from 'd3-selection'

/*************************
 reusable helper functions
**************************/

const pct50 = 6.3475409836
const pct70 = 1000.36986301355

async function getNumericHandler(opts: any = {}) {
	const rawTw = {
		term: termjson.agedx,
		q: {
			mode: 'binary'
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
				numericEditMenuVersion: ['binary'],
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

	handler.density_data = { min: 0, max: 100 }

	//handler.density.

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
		editHandler: handler.editHandler satisfies NumBinaryEditor,
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
	test.deepEqual(editHandler.getPillStatus(), { text: 'binary' }, 'should give the expected status')
	editHandler.termsetting.tw.q = { mode: 'continuous' }
	test.deepEqual(
		await editHandler.getDefaultQ(),
		{
			mode: 'binary',
			type: 'custom-bin',
			lst: [
				{
					startunbounded: true,
					startinclusive: false,
					stopinclusive: false,
					stop: 50,
					label: '<50',
					range: '<span style="font-family:Times;font-style:italic;">x</span> <50'
				},
				{
					stopunbounded: true,
					startinclusive: true,
					stopinclusive: false,
					start: 50,
					label: '≥50',
					range: '<span style="font-family:Times;font-style:italic;">x</span> ≥50'
				}
			],
			cutoffType: 'normal'
		},
		'should give the expected defaultQ'
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
		editHandler.dom.cutoff_div.selectAll(`input[type='number']`).size(),
		2,
		`should render cutoff inputs, absolute and in percentile`
	)
	test.equal(
		editHandler.dom.cutoff_div.selectAll(`input[type='checkbox']`).size(),
		1,
		`should render cutoff option for percentile`
	)
	test.equal(editHandler.dom.cutoffInputPercentile.style('display'), 'none', `should hide percentile input by default`)

	editHandler.dom.cutoffPercentileCheckbox.property('checked', true)
	editHandler.dom.cutoffPercentileCheckbox.node().dispatchEvent(new Event('input', { bubbles: true }))
	await sleep(0)
	test.equal(
		editHandler.dom.cutoffInputPercentile.style('display'),
		'inline-block',
		`should show the percentile input when the checkbox is checked`
	)
	test.equal(
		editHandler.dom.cutoffInputPercentile.property('value'),
		'50',
		`should default to 50% percentile input value`
	)

	const newCutoff = 6.3475409836
	const ranges = editHandler.dom.inputsDiv.node().querySelectorAll('div[name="range"]')
	test.equal(ranges[0].innerText, `x ≤${newCutoff}`, `should render the expected first bin range`)
	test.equal(ranges[1].innerText, `x >${newCutoff}`, `should render the expected last bin range`)

	const binInputs = editHandler.dom.inputsDiv.node().querySelectorAll('input')
	test.equal(binInputs[0].value, `≤${newCutoff}`, `should render the expected first bin input value`)
	test.equal(binInputs[1].value, `>${newCutoff}`, `should render the expected last bin input value`)
	if ((test as any)._ok) destroy()
	test.end()
})

tape('cutoff interactivity', async test => {
	const { editHandler, holder, destroy } = await getNumericHandler()
	console.log(184)
	await editHandler.showEditMenu(holder)
	console.log(185)
	const lines = editHandler.handler.density.dom.binsize_g.selectAll('line')
	test.equal(lines.size(), 1, `should render only one draggable line in the density plot`)
	const line = lines.node()
	const x1 = Number(line.getAttribute('x1'))

	editHandler.dom.boundaryInclusionSelect.property('value', 'startinclusive')
	editHandler.dom.boundaryInclusionSelect.node().dispatchEvent(new Event('change', { bubbles: true }))
	const newCutoff = 500
	editHandler.dom.cutoffInput.property('value', newCutoff)
	editHandler.dom.cutoffInput.node().dispatchEvent(new Event('change', { bubbles: true }))

	const ranges = editHandler.dom.inputsDiv.node().querySelectorAll('div[name="range"]')
	test.equal(ranges[0].innerText, `x <${newCutoff}`, `should render the expected first bin range`)
	test.equal(ranges[1].innerText, `x ≥${newCutoff}`, `should render the expected last bin range`)

	const binInputs = editHandler.dom.inputsDiv.node().querySelectorAll('input')
	test.equal(binInputs[0].value, `<${newCutoff}`, `should render the expected first bin input value`)
	test.equal(binInputs[1].value, `≥${newCutoff}`, `should render the expected last bin input value`)
	const line2 = editHandler.handler.density.dom.binsize_g.select('line').node()
	test.true(x1 <= Number(line2.getAttribute('x1')), 'should trigger the density line to move to the right')

	editHandler.dom.cutoffPercentileCheckbox.property('checked', true)
	editHandler.dom.cutoffPercentileCheckbox.node().dispatchEvent(new Event('input', { bubbles: true }))
	editHandler.dom.cutoffInputPercentile.property('value', 70)
	editHandler.dom.cutoffInputPercentile.node().dispatchEvent(new Event('change', { bubbles: true }))
	await sleep(0)
	{
		const lines = [...editHandler.handler.density.dom.binsize_g.node().querySelectorAll('line')]
		test.deepEqual(
			lines.map(l => l.getAttribute('x1')),
			['116'],
			`should re-render a draggable line in the updated x-position`
		)

		const ranges = editHandler.dom.inputsDiv.node().querySelectorAll('div[name="range"]')
		test.equal(ranges[0].innerText, `x <${pct70}`, `should render the expected first bin range`)
		test.equal(ranges[1].innerText, `x ≥${pct70}`, `should render the expected last bin range`)

		const binInputs = editHandler.dom.inputsDiv.node().querySelectorAll('input')
		test.equal(binInputs[0].value, `<${pct70}`, `should render the expected first bin input value`)
		test.equal(binInputs[1].value, `≥${pct70}`, `should render the expected last bin input value`)
	}

	test.deepEqual(
		editHandler.getEditedQ(false),
		{
			mode: 'binary',
			type: 'custom-bin',
			lst: [
				{
					startunbounded: true,
					stop: pct70,
					startinclusive: false,
					stopinclusive: false,
					label: `<${pct70}`,
					range: `<span style="font-family:Times;font-style:italic;">x</span> <${pct70}`
				},
				{
					start: pct70,
					startinclusive: true,
					stopinclusive: false,
					stopunbounded: true,
					label: `≥${pct70}`,
					range: `<span style="font-family:Times;font-style:italic;">x</span> ≥${pct70}`
				}
			]
		},
		`should give the expected edited q object`
	)

	const density_div = editHandler.dom.density_div.node()
	await editHandler.showEditMenu(holder)
	test.equal(
		density_div,
		editHandler.dom.density_div.node(),
		`should not re-render the menu when the holder has not changed`
	)

	await editHandler.undoEdits()
	await sleep(0)
	{
		const lines = [...editHandler.handler.density.dom.binsize_g.node().querySelectorAll('line')]
		test.deepEqual(
			lines.map(l => l.getAttribute('x1')),
			['11'],
			`should render a draggable line in the expected x-position`
		)
	}
	if ((test as any)._ok) destroy()
	test.end()
})

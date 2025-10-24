import tape from 'tape'
import { NumericHandler } from '../NumericHandler.ts'
import type { NumContEditor } from '../NumContEditor.ts'
import { termjson } from '../../../test/testdata/termjson'
import { agedx as agedxViolinData } from '../../../test/testdata/violinPlotData.js'
import { TwRouter } from '#tw'
import * as d3s from 'd3-selection'

/*************************
 reusable helper functions
**************************/

async function getNumericHandler(opts: any = {}) {
	const rawTw = {
		term: termjson.agedx,
		q: {
			mode: 'continuous'
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
			vocabApi: {
				getViolinPlotData() {
					return agedxViolinData
				}
			}
		}
	})

	//handler.density.

	const holder = d3s
		.select('body')
		.append('div')
		.style('position', 'relative')
		.style('width', 'fit-content')
		.style('margin', '20px')
		.style('padding', '5px')
		.style('border', '1px solid #000')

	await handler.setEditHandler(handler.tabs[0])
	return {
		rawTw,
		tw,
		handler,
		editHandler: handler.editHandler as NumContEditor,
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
	test.comment('-***- NumContEditor.unit.spec -***-')
	test.end()
})

tape('no opts.usecase', async test => {
	const { editHandler, holder, destroy } = await getNumericHandler()
	await editHandler.showEditMenu(holder)
	test.equal(editHandler.dom?.density_div.selectAll('svg').size(), 1, `should render a density plot svg`)
	test.equal(
		editHandler.dom.inputsDiv.selectAll('option').size(),
		4,
		`should render scale dropdown with the expected number of options`
	)
	test.equal(
		editHandler.dom.inputsDiv.selectAll(`input[type='checkbox']`).size(),
		0,
		`should not render a checkbox for z-score conversion`
	)
	const scaleValue = 100
	editHandler.dom?.scaleSelect.property('value', scaleValue)
	editHandler.dom?.scaleSelect.node().dispatchEvent(new Event('change', { bubbles: true }))
	test.equal(editHandler.q.scale, scaleValue, `should set q.scale to ${scaleValue}`)

	test.deepEqual(
		editHandler.getEditedQ(),
		{ mode: 'continuous', isAtomic: true, hiddenValues: {}, scale: 100 },
		`should give the expected edited q object`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape(`opts.usecase={target: 'matrix'}`, async test => {
	const { editHandler, holder, destroy } = await getNumericHandler({ usecase: { target: 'matrix' } })
	await editHandler.showEditMenu(holder)
	test.equal(editHandler.dom?.density_div.selectAll('svg').size(), 1, `should render a density plot svg`)
	test.equal(
		editHandler.dom?.inputsDiv.selectAll('option').size(),
		4,
		`should render scale dropdown with the expected number of options`
	)
	test.equal(
		editHandler.dom?.inputsDiv.selectAll(`input[type='checkbox']`).size(),
		1,
		`should render a checkbox for z-score conversion`
	)
	const scaleValue = 1000
	editHandler.dom.scaleSelect.property('value', scaleValue)
	editHandler.dom.scaleSelect.node().dispatchEvent(new Event('change', { bubbles: true }))
	editHandler.dom.convert2ZCheckbox.property('checked', true)
	editHandler.dom.convert2ZCheckbox.node().dispatchEvent(new Event('input', { bubbles: true }))
	test.equal(editHandler.q.scale, undefined, `should delete q.scale when convert2ZCheckbox is checked`)
	editHandler.dom.scaleSelect.property('value', scaleValue)
	editHandler.dom.scaleSelect.node().dispatchEvent(new Event('change', { bubbles: true }))
	test.equal(
		editHandler.dom.convert2ZCheckbox.property('checked'),
		false,
		`should set convert2ZCheckbox to false when scale is set to >1`
	)

	test.deepEqual(
		editHandler.getEditedQ(),
		{ mode: 'continuous', isAtomic: true, hiddenValues: {}, convert2ZScore: false, scale: 1000 },
		`should give the expected edited q object`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

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
	const term = JSON.parse(JSON.stringify(termjson.agedx))
	if (opts.valueConversion) term.valueConversion = opts.valueConversion
	const rawTw = {
		term,
		q: Object.assign({ mode: 'continuous' }, opts.q)
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
				getViolinBox() {
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
		5,
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
		5,
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

tape('log10(X+1) scaling option', async test => {
	const { editHandler, holder, destroy } = await getNumericHandler({ usecase: { target: 'matrix' } })
	await editHandler.showEditMenu(holder)
	const select = editHandler.dom.scaleSelect
	const change = value => {
		select.property('value', value)
		select.node().dispatchEvent(new Event('change', { bubbles: true }))
	}

	change('100')
	change('log10p1')
	test.equal(editHandler.q.transform, 'log10p1', `should set q.transform='log10p1'`)
	test.equal(editHandler.q.scale, undefined, `should delete q.scale when log10(X+1) is selected`)
	test.deepEqual(
		editHandler.getEditedQ(),
		{ mode: 'continuous', isAtomic: true, hiddenValues: {}, convert2ZScore: false, transform: 'log10p1' },
		`should give the expected edited q object`
	)

	change('10')
	test.equal(editHandler.q.transform, undefined, `should delete q.transform when a Per N option is selected`)
	test.equal(editHandler.q.scale, 10, `should set q.scale when a Per N option is selected`)

	change('log10p1')
	editHandler.dom.convert2ZCheckbox.property('checked', true)
	editHandler.dom.convert2ZCheckbox.node().dispatchEvent(new Event('input', { bubbles: true }))
	test.equal(editHandler.q.transform, undefined, `should delete q.transform when convert2ZCheckbox is checked`)
	test.equal(select.property('value'), '1', `should reset the dropdown to No Scaling when convert2ZCheckbox is checked`)

	change('1')
	test.deepEqual(
		editHandler.getEditedQ(),
		{ mode: 'continuous', isAtomic: true, hiddenValues: {}, convert2ZScore: true },
		`should have neither q.scale nor q.transform for No Scaling`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('log10(X+1) is selected for a tw with q.transform', async test => {
	const { editHandler, holder, destroy } = await getNumericHandler({ q: { transform: 'log10p1' } })
	await editHandler.showEditMenu(holder)
	test.equal(editHandler.dom.scaleSelect.property('value'), 'log10p1', `should select the log10(X+1) option`)
	test.equal(editHandler.getEditedQ().transform, 'log10p1', `should keep q.transform in the edited q`)
	if ((test as any)._ok) destroy()
	test.end()
})

tape('no log10(X+1) option for a term with valueConversion', async test => {
	const { editHandler, holder, destroy } = await getNumericHandler({
		valueConversion: { fromUnit: 'day', toUnit: 'year', scaleFactor: '0.00274' }
	})
	await editHandler.showEditMenu(holder)
	const values = editHandler.dom.scaleSelect
		.selectAll('option')
		.nodes()
		.map((o: any) => o.value)
	test.deepEqual(values, ['1', '10', '100', '1000'], `should not render the log10(X+1) option`)
	if ((test as any)._ok) destroy()
	test.end()
})

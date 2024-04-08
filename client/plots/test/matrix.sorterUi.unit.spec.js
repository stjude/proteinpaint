import tape from 'tape'
import { getSorterUi } from '../matrix.sorterUi.js'
import { getPlotConfig } from '../matrix.config'
import { initByInput } from '../controls.config'
import { select } from 'd3-selection'
import { copyMerge } from '#rx'

/*************************
 reusable helper functions
**************************/

let i = 0

async function getControls(_opts = {}) {
	const holder = select('body').append('div').attr('class', 'sja_root_holder').append('table').append('tr')
	const parent = {
		id: `_${i++}_${Math.random()}`,
		app: {
			dispatch:
				_opts.dispatch ||
				(action => {
					copyMerge(config, action.config)
					uiApi.main()
				}),
			vocabApi: {
				termdbConfig: {}
			}
		},
		dom: {
			holder
		}
	}

	const config = await getPlotConfig({}, parent.app)
	parent.config = config
	const controls = { parent }
	const opts = { controls, holder, debug: true }
	const uiApi = getSorterUi(opts)
	//const input = initByInput.custom(uiOpts)
	return { uiApi, controls, config, parent: controls.parent, opts }
}

/**************
 test sections
***************/

tape('default setup', async test => {
	const { uiApi, controls, config, parent, opts } = await getControls()
	const s = parent.config.settings.matrix
	const activeOption = s.sortOptions[s.sortSamplesBy]
	test.equal(
		opts.holder.node().querySelectorAll('thead').length,
		// 2 theads, 1 for hardcoded manual selected rows + 1 for sort by case names
		// 1 thead for main table heading
		activeOption.sortPriority.length + 2 + 1,
		'should have the expected number of thead'
	)
	if (test._ok) uiApi.destroy()
	test.end()
})

tape('section visibility toggling', async test => {
	const { uiApi, controls, config, parent, opts } = await getControls()
	const s = config.settings.matrix
	const ui = uiApi.Inner
	const activeOptionBeforeDrag = structuredClone(ui.activeOption)
	const thead = opts.holder
		.selectAll('thead')
		.filter(d => d?.types?.includes('geneVariant'))
		.node()

	test.equal(
		thead.nextSibling.style.display,
		'none',
		'should have a hiddden table section for gene mutation before toggling'
	)

	thead.firstChild.firstChild.click()

	test.equal(
		opts.holder
			.selectAll('thead')
			.filter(d => d?.types?.includes('geneVariant'))
			.node().nextSibling.style.display,
		'',
		'should have a visible table section for gene mutation after toggling'
	)

	if (test._ok) uiApi.destroy()
	test.end()
})

tape('simulated section drag/drop', async test => {
	const { uiApi, controls, config, parent, opts } = await getControls()
	const s = config.settings.matrix
	const ui = uiApi.Inner
	const activeOptionBeforeDrag = structuredClone(ui.activeOption)
	const th = opts.holder
		.selectAll('th')
		.filter(d => d?.types?.includes('geneVariant'))
		.node()
	const sectionData = th.__data__
	ui.trackDraggedSection.call(th, {}, sectionData)

	// since this simulated test does not trigger actual drag and drop,
	// must make sure that the correct event handler is tested here
	test.equal(
		select(th.parentNode.parentNode).on('drop'),
		ui.adjustSortPriority,
		'should attach the correct drop handler for section thead'
	)

	const i = ui.activeOption.sortPriority.indexOf(sectionData)
	ui.adjustSortPriority({}, ui.activeOption.sortPriority[i + 1])

	test.deepEqual(
		activeOptionBeforeDrag.sortPriority,
		config.settings.matrix.sortOptions[s.sortSamplesBy].sortPriority,
		'should not adjust the sortPriority/table before clicking apply, after drag/drop'
	)

	ui.apply()

	test.deepEqual(
		activeOptionBeforeDrag.sortPriority.reverse(),
		config.settings.matrix.sortOptions[s.sortSamplesBy].sortPriority,
		'should adjust the sortPriority/table after clicking apply'
	)

	if (test._ok) uiApi.destroy()
	test.end()
})

tape('simulated tiebreaker drag/drop', async test => {
	const { uiApi, controls, config, parent, opts } = await getControls()
	const s = config.settings.matrix
	const ui = uiApi.Inner
	const activeOptionBeforeDrag = structuredClone(ui.activeOption)
	const thead0 = opts.holder
		.selectAll('thead')
		.filter(d => d?.types?.includes('geneVariant'))
		.node()

	thead0.firstChild.firstChild.click()

	const thead1 = opts.holder
		.selectAll('thead')
		.filter(d => d?.types?.includes('geneVariant'))
		.node()

	const trs = thead1.nextSibling.querySelectorAll('tr')

	// since this simulated test does not trigger actual drag and drop,
	// must make sure that the correct event handler is tested here
	test.equal(
		select(trs[0].firstChild).on('drop'),
		ui.adjustTieBreakers,
		'should attach the correct drop handler for tiebreaker label'
	)

	const tbData = trs[0].__data__
	ui.trackDraggedTieBreaker.call(trs[0], { target: trs[0].firstChild.nextSibling }, tbData)

	const activeTieBreakers = ui.activeOption.sortPriority[0].tiebreakers
	const i = activeTieBreakers.indexOf(tbData)
	console.log(activeTieBreakers[i + 1].label)
	ui.adjustTieBreakers({ preventDefault: () => undefined }, activeTieBreakers[i + 1])

	const thead2 = opts.holder
		.selectAll('thead')
		.filter(d => d?.types?.includes('geneVariant'))
		.node()
	const trs2 = [...thead2.nextSibling.querySelectorAll('tr')]
	test.deepEqual(
		trs2.slice(0, 2).map(elem => elem.__data__),
		activeOptionBeforeDrag.sortPriority[0].tiebreakers.slice(0, 2).reverse(),
		'should visibly switch the first two tiebreaker rows'
	)

	test.deepEqual(
		activeOptionBeforeDrag.sortPriority[0].tiebreakers,
		config.settings.matrix.sortOptions[s.sortSamplesBy].sortPriority[0].tiebreakers,
		'should not adjust the tiebreakers before clicking apply, after drag/drop'
	)

	ui.apply()

	test.deepEqual(
		activeTieBreakers,
		config.settings.matrix.sortOptions[s.sortSamplesBy].sortPriority[0].tiebreakers,
		'should adjust the tiebreakers after clicking apply'
	)

	if (test._ok) uiApi.destroy()
	test.end()
})

tape('tiebreaker disabled', async test => {
	const { uiApi, controls, config, parent, opts } = await getControls()
	const s = config.settings.matrix
	const ui = uiApi.Inner
	const activeOptionBeforeDrag = structuredClone(ui.activeOption)
	const thead0 = opts.holder
		.selectAll('thead')
		.filter(d => d?.types?.includes('geneVariant'))
		.node()

	thead0.firstChild.firstChild.click()

	const thead1 = opts.holder
		.selectAll('thead')
		.filter(d => d?.types?.includes('geneVariant'))
		.node()

	const trs = thead1.nextSibling.querySelectorAll('tr')

	test.equal(
		select(trs[1].firstChild).select('input').property('checked'),
		true,
		'should not check the row for protein-changing tiebreaker'
	)

	test.equal(
		select(trs[2].firstChild).select('input').property('checked'),
		false,
		'should not check the row for CNV tiebreaker'
	)

	select(trs[2].firstChild).select('input').node().click()
	const activeTieBreakers = ui.activeOption.sortPriority[0].tiebreakers
	ui.apply()

	test.deepEqual(
		activeTieBreakers[2].disabled,
		config.settings.matrix.sortOptions[s.sortSamplesBy].sortPriority[0].tiebreakers[2]?.disabled,
		'should adjust the CNV tiebreaker disabled after clicking apply'
	)

	if (test._ok) uiApi.destroy()
	test.end()
})

tape('simulated value drag/drop', async test => {
	const { uiApi, controls, config, parent, opts } = await getControls()
	const ui = uiApi.Inner
	const a = structuredClone(config.settings.matrix.sortOptions.a)
	ui.expandedSection = a.sortPriority[0].label
	a.sortPriority[0].tiebreakers[1].isOrdered = true
	uiApi.main({
		sortOptions: { a }
	})

	const activeOptionBeforeDrag = structuredClone(ui.activeOption)

	const thead1 = opts.holder
		.selectAll('thead')
		.filter(d => d?.types?.includes('geneVariant'))
		.node()
	const valuesDiv = thead1.nextSibling.querySelectorAll('tr')[1].querySelector('.sjpp-matrix-sorter-ui-value')
	const lastVal = select(valuesDiv.lastChild)

	// since this simulated test does not trigger actual drag and drop,
	// must make sure that the correct event handler is tested here
	test.equal(lastVal.on('drop'), ui.adjustValueOrder, 'should attach the correct drop handler for value label')

	const activeOrder = ui.activeOption.sortPriority[0].tiebreakers[1].order
	const activeOrderBeforeDrag = structuredClone(activeOrder)
	const value = lastVal.datum()
	ui.trackDraggedValue.call(lastVal.node(), { target: lastVal.node() }, value)
	ui.adjustValueOrder({ preventDefault: () => undefined }, activeOrder[0])

	const thead2 = opts.holder
		.selectAll('thead')
		.filter(d => d?.types?.includes('geneVariant'))
		.node()
	const valuesDiv2 = thead2.nextSibling.querySelectorAll('tr')[1].querySelector('.sjpp-matrix-sorter-ui-value')
	const lastVal2 = select(valuesDiv2.lastChild)
	const n = activeOrderBeforeDrag.length

	test.deepEqual(
		[valuesDiv2.firstChild.__data__, valuesDiv2.lastChild.__data__],
		[activeOrderBeforeDrag[n - 1], activeOrderBeforeDrag[n - 2]],
		'should visibly switch the first first and last values'
	)

	const s = config.settings.matrix
	test.deepEqual(
		activeOrderBeforeDrag,
		s.sortOptions[s.sortSamplesBy].sortPriority[0].tiebreakers[1].order,
		'should not adjust the tiebreaker.order before clicking apply, after drag/drop'
	)

	ui.apply()

	test.deepEqual(
		activeOrder,
		s.sortOptions[s.sortSamplesBy].sortPriority[0].tiebreakers[1].order,
		'should adjust the tiebreaker.order after clicking apply'
	)

	if (test._ok) uiApi.destroy()
	test.end()
})

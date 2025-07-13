import tape from 'tape'
import { select } from 'd3-selection'
import { copyMerge } from '#rx'
import { getSorterUi } from '../matrix.sorterUi.js'
import { getPlotConfig, setComputedConfig } from '../matrix.config'
import { initByInput } from '../../controls.config'

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
					setComputedConfig(config)
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

	const config = await getPlotConfig(_opts, parent.app)
	setComputedConfig(config)
	parent.config = config
	//config.settings.matrix.hiddenVariants = _opts.hiddenVariants || []
	//config.settings.matrix.filterByClass = _opts.filterByClass || {}
	const controls = { parent }
	const opts = { controls, holder, debug: true, setComputedConfig }
	const uiApi = getSorterUi(opts)
	//const input = initByInput.custom(uiOpts)
	return { uiApi, controls, config, parent: controls.parent, opts }
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/matrix.sorterUi -***-')
	test.end()
})

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
	const prevSettings = structuredClone(s)
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
		prevSettings.sortOptions[s.sortSamplesBy].sortPriority,
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
	const prevSettings = structuredClone(s)
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
		select(trs[0]).on('drop'),
		ui.adjustTieBreakers,
		'should attach the correct drop handler for tiebreaker label'
	)

	const tbData = trs[0].__data__
	ui.trackDraggedTieBreaker.call(trs[0], { target: trs[0].firstChild.nextSibling }, tbData)

	const activeTieBreakers = ui.activeOption.sortPriority[0].tiebreakers
	const i = activeTieBreakers.indexOf(tbData)
	ui.adjustTieBreakers({ preventDefault: () => undefined }, activeTieBreakers[i + 1])

	const thead2 = opts.holder
		.selectAll('thead')
		.filter(d => d?.types?.includes('geneVariant'))
		.node()
	const trs2 = [...thead2.nextSibling.querySelectorAll('tr')]
	test.deepEqual(
		trs2.slice(0, 2).map(elem => elem.__data__),
		activeOptionBeforeDrag.sortPriority[0].tiebreakers.slice(1, 3).reverse(),
		'should visibly switch the first two tiebreaker rows'
	)

	test.deepEqual(
		activeOptionBeforeDrag.sortPriority[0].tiebreakers,
		prevSettings.sortOptions[s.sortSamplesBy].sortPriority[0].tiebreakers,
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
		select(trs[0].lastChild).select('button').node(),
		null,
		`should not have an enable/disable toggle button for the protein-changing tiebreaker that is not configured with 'mayToggle: true'`
	)

	test.equal(
		select(trs[1].lastChild).select('button').html(),
		'Enable',
		'should indicate that the CNV tiebreaker is not active'
	)

	select(trs[1].lastChild).select('button').node().click()
	const activeTieBreakers = ui.activeOption.sortPriority[0].tiebreakers
	ui.apply()

	test.deepEqual(
		activeTieBreakers[1].disabled,
		config.settings.matrix.sortOptions[s.sortSamplesBy].sortPriority[0].tiebreakers[1]?.disabled,
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
	const valuesDiv = thead1.nextSibling.querySelectorAll('tr')[0].querySelector('.sjpp-matrix-sorter-ui-value')
	const lastVal = select(valuesDiv.lastChild)

	// since this simulated test does not trigger actual drag and drop,
	// must make sure that the correct event handler is tested here
	test.equal(lastVal.on('drop'), ui.adjustValueOrder, 'should attach the correct drop handler for value label')

	const activeOrder = ui.activeOption.sortPriority[0].tiebreakers[1].order
	const activeOrderBeforeDrag = structuredClone(activeOrder)
	const value = lastVal.datum()
	ui.trackDraggedValue.call(lastVal.node(), { target: lastVal.node() }, value)
	ui.adjustValueOrder({ preventDefault: () => undefined }, valuesDiv.firstChild.__data__)

	const thead2 = opts.holder
		.selectAll('thead')
		.filter(d => d?.types?.includes('geneVariant'))
		.node()
	const valuesDiv2 = thead2.nextSibling.querySelectorAll('tr')[0].querySelector('.sjpp-matrix-sorter-ui-value')
	const lastVal2 = select(valuesDiv2.lastChild)
	const n = activeOrderBeforeDrag.length

	test.deepEqual(
		[valuesDiv2.firstChild.__data__?.key, valuesDiv2.lastChild.__data__?.key],
		[activeOrderBeforeDrag[n - 1], activeOrderBeforeDrag[n - 2]],
		'should visibly switch the last value to first'
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

tape('hidden values', async test => {
	const filterByClass = {
		// CNV_amp: 'value',
		// CNV_loss: 'value',
		// Utr3: 'value',
		// Utr5: 'value',
		// S: 'value',
		// Intron: 'value',
		noncoding: 'value'
	}
	const legendValueFilter = Object.freeze({
		isAtomic: true,
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				legendGrpName: 'test',
				type: 'tvs',
				tvs: {
					isnot: true,
					legendFilterType: 'geneVariant_soft', // indicates this matrix legend filter is soft filter
					term: { type: 'geneVariant' },
					values: [{ dt: 1, mclasslst: Object.keys(filterByClass) }]
				}
			}
		]
	})

	const { uiApi, controls, config, parent, opts } = await getControls({
		legendValueFilter: structuredClone(legendValueFilter)
	})
	// config is a reference to the mutable object
	const s = config.settings.matrix
	const ui = uiApi.Inner
	const tipNode = ui.dom.tip.d.node()
	const a = config.settings.matrix.sortOptions.a
	ui.expandedSection = a.sortPriority[0].label
	a.sortPriority[0].tiebreakers[1].isOrdered = true
	a.sortPriority[0].tiebreakers[1].notUsed = ['S']
	uiApi.main({
		sortOptions: { a }
	})

	const origConfig = structuredClone(config)

	const thead1 = opts.holder
		.selectAll('thead')
		.filter(d => d?.types?.includes('geneVariant'))
		.node()
	const tr1 = thead1.nextSibling.querySelectorAll('tr')[0]
	const valuesDiv = tr1.querySelector('.sjpp-matrix-sorter-ui-value')
	const m = valuesDiv.querySelectorAll(':scope>div').length
	//const valueDivsBeforeDrop = valuesDiv.querySelectorAll(':scope > div')
	const hiddenBtn = tr1.querySelector('[data-testid=sjpp-matrix-sorter-ui-hidden-add]')
	hiddenBtn.click()

	const unusedVals = tipNode.querySelector('[data-testid=sjpp-matrix-sorter-ui-hidden-vals]')
	const n = 1
	test.equal(
		unusedVals.querySelectorAll(':scope>div').length,
		1,
		`should have the expected number of addable hidden values on load`
	)

	valuesDiv.firstChild.click()
	const tr1_a = opts.holder
		.selectAll('thead')
		.filter(d => d?.types?.includes('geneVariant'))
		.node()
		.nextSibling.querySelectorAll('tr')[0]

	const valuesDiv_a = tr1_a.querySelector('.sjpp-matrix-sorter-ui-value')
	const hiddenBtn_a = tr1_a.querySelector('[data-testid=sjpp-matrix-sorter-ui-hidden-add]')
	hiddenBtn_a.click()
	const unusedVals_a = tipNode.querySelector('[data-testid=sjpp-matrix-sorter-ui-hidden-vals]')
	test.deepEqual(
		[valuesDiv_a.querySelectorAll(':scope>div').length, unusedVals_a.querySelectorAll(':scope>div').length],
		[m - 1, n + 1],
		`should increase the expected number of used and unused values by 1, after clicking on a visible sorter value`
	)

	test.deepEqual(origConfig, config, 'should not adjust the tiebreaker.order + notUsed arrays before clicking apply')

	ui.apply()

	const s0 = origConfig.settings.matrix
	const tb = s0.sortOptions.a.sortPriority[0].tiebreakers[1] //.order
	if (!tb.notUsed) tb.notUsed = []
	tb.notUsed.unshift(tb.order.shift())

	test.deepEqual(
		config.settings.matrix.sortOptions.a,
		origConfig.settings.matrix.sortOptions.a,
		'should adjust the tiebreaker.order + notUsed after clicking apply'
	)

	if (test._ok) uiApi.destroy()
	test.end()
})

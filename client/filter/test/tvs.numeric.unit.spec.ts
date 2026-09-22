import tape from 'tape'
import * as d3s from 'd3-selection'
import { handler } from '../tvs.numeric.js'
import { TVSInit } from '../tvs'
import { filterInit } from '../FilterStateless'
import { FrontendVocab } from '#termdb/FrontendVocab'
import { detectChildText, sleep } from '../../test/test.helpers'

/* Tests
	get_pill_label: maf filter total depth
	maf filter menu: total depth input
	maf filter pill: total depth after edit
*/

/**************
 helper functions
***************/

function getMafTvs(minAllelicDepth?: number) {
	const tvs: any = {
		term: { id: 'AD', name: 'MAF', type: 'integer', mafFilterMode: 'maf' },
		ranges: [{ start: 0.1, startinclusive: false, stopunbounded: true }]
	}
	if (minAllelicDepth !== undefined) tvs.minAllelicDepth = minAllelicDepth
	return tvs
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- filter/tvs.numeric unit tests -***-')
	test.end()
})

tape('get_pill_label: maf filter total depth', test => {
	{
		const txt = handler.get_pill_label(getMafTvs(10)).txt
		test.true(txt.includes('0.1'), 'should show the maf range cutoff')
		test.true(txt.includes('Total depth &ge; 10'), 'should show the total depth cutoff of a maf filter tvs')
	}
	{
		// a typed cutoff is shown as given, down to the lowest the input allows
		const txt = handler.get_pill_label(getMafTvs(1)).txt
		test.true(txt.includes('Total depth &ge; 1'), 'should show a total depth cutoff of 1')
	}
	{
		const txt = handler.get_pill_label(getMafTvs()).txt
		test.false(txt.includes('Total depth'), 'should not show a total depth cutoff when it is not set')
	}
	{
		// the depth gate only applies to a maf-mode term
		const tvs = getMafTvs(10)
		tvs.term.mafFilterMode = 'totalDepth'
		const txt = handler.get_pill_label(tvs).txt
		test.false(txt.includes('Total depth &ge;'), 'should not show a total depth cutoff for a non-maf mode term')
	}
	{
		// depth applies to the pill of a multi-range maf tvs, which has no range text to carry it
		const tvs = getMafTvs(10)
		tvs.ranges.push({ start: 0.5, stopunbounded: true })
		const txt = handler.get_pill_label(tvs).txt
		test.equal(txt, '2 intervals, Total depth &ge; 10', 'should append the total depth cutoff to the interval count')
	}
	test.end()
})

tape('maf filter menu: total depth input', async test => {
	const holder = d3s.select('body').append('div')
	// FrontendVocab has no getViolinBox(), so fillMenu() falls back to addRangeTableNoDensity(),
	// the same no-density ui a bcf maf filter term gets
	const term = { id: 'tumor_DNA', name: 'Tumor DNA', type: 'float', mafFilterMode: 'maf', min: 0, max: 1 }
	let appliedTvs: any
	const pill = await TVSInit({
		vocabApi: new FrontendVocab({ state: { vocab: { terms: [term] } } }),
		holder,
		debug: true,
		callback: (tvs: any) => (appliedTvs = tvs)
	})

	// showMenu() renders into the given holder, as filter.js does when a pill is clicked
	const menuDiv = d3s.select('body').append('div')
	const openMenu = async (tvs: any) => {
		menuDiv.selectAll('*').remove()
		await pill.main({ tvs })
		await pill.Inner.showMenu(menuDiv)
	}
	const depthValue = () => menuDiv.select('input[type=number]').property('value')
	const clickApply = () => (menuDiv.select('button').node() as HTMLButtonElement).click()

	await openMenu({ term, ranges: [{ start: 0.1, startinclusive: true, stopunbounded: true }] })
	test.equal(depthValue(), '', 'should open the depth input blank for a tvs without a cutoff')

	// apply the range without typing a depth
	clickApply()
	test.equal('minAllelicDepth' in appliedTvs, false, 'should not apply a minAllelicDepth for a blank depth input')

	// edit the same tvs: the depth input must not have been filled in by the apply above
	await openMenu(appliedTvs)
	test.equal(depthValue(), '', 'should keep the depth input blank when editing the applied tvs')

	// a typed cutoff round-trips
	menuDiv.select('input[type=number]').property('value', '10')
	clickApply()
	test.equal(appliedTvs.minAllelicDepth, 10, 'should apply a typed depth cutoff')
	await openMenu(appliedTvs)
	test.equal(depthValue(), '10', 'should fill the depth input from the applied cutoff')

	// clearing the cutoff drops it, rather than reverting to the no-op depth of 1
	menuDiv.select('input[type=number]').property('value', '')
	clickApply()
	test.equal('minAllelicDepth' in appliedTvs, false, 'should drop the cutoff when the depth input is cleared')

	menuDiv.remove()
	holder.remove()
	test.end()
})

tape('maf filter pill: total depth after edit', async test => {
	const holder = d3s.select('body').append('div')
	const term = { id: 'tumor_DNA', name: 'Tumor DNA', type: 'float', mafFilterMode: 'maf', min: 0, max: 1 }
	// as dom/variantConfig.ts renders a maf filter
	let activeFilter: any
	const filter = await filterInit({
		emptyLabel: '+',
		holder,
		debug: true,
		header_mode: 'hide_search',
		vocab: { terms: [term] },
		callback: async (f: any) => (activeFilter = f)
	})
	const tvslst = {
		type: 'tvslst',
		join: '',
		in: true,
		lst: [{ type: 'tvs', tvs: { term, ranges: [{ start: 0.1, startinclusive: true, stopunbounded: true }] } }]
	}
	await filter.main(tvslst)

	const pillLabel = () => holder.select('.value_btn').html()
	test.false(pillLabel().includes('Total depth'), 'should show no depth cutoff before editing')
	test.true(pillLabel().includes('0.1'), 'should show the maf range before editing')

	// edit the one pill: type a depth and apply
	const menuDiv = d3s.select('body').append('div')
	const pill = filter.Inner.pills[Object.keys(filter.Inner.pills)[0]]
	await pill.Inner.showMenu(menuDiv)
	menuDiv.select('input[type=number]').property('value', '10')
	// applying refreshes the filter, which re-renders the pill asynchronously
	const valueBtn = await detectChildText({
		target: holder.node(),
		selector: '.value_btn',
		trigger: () => (menuDiv.select('button').node() as HTMLButtonElement).click()
	})

	test.equal(activeFilter.lst[0].tvs.minAllelicDepth, 10, 'should store the applied depth cutoff in the filter')
	// the rendered pill holds the &ge; entity as its character
	test.true(
		valueBtn[0].textContent.includes('Total depth \u2265 10'),
		'should show the applied depth cutoff in the pill'
	)
	// the superseded value button is only removed at the end of its exit transition
	await sleep(100)
	test.equal(holder.selectAll('.value_btn').size(), 1, 'should leave a single value button in the edited pill')

	menuDiv.remove()
	holder.remove()
	test.end()
})

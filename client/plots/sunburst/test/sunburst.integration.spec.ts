import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
import { getActiveCohortStr } from '#mass/charts'
import { dtfusionrna, dtsv } from '#shared/common.js'
import { filterJoin } from '#filter'

/*
Tests:
	- Render rings of a sample-level and a patient-level term
	- Select wedges and create a group
	- Create a group with the plot filter
	- Edit rings in the Rings box
	- Pass a changed filter to the Rings box pills
	- Select the wedge at the centre
	- Show the available data of a selection
	- Offer GRIN2 for selected samples with mutation data
	- Summarize a dictionary term in the selected group
	- Compare exactly two selected wedges with differential gene expression
	- Split survival curves by selected wedge
*/

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: { header_mode: 'hidden' },
		dslabel: 'TermdbTest',
		genome: 'hg38-test'
	},
	debug: 1
})

const ALL = 'Acute lymphoblastic leukemia'

/** resolves with the first truthy value of `get()`, checked every 50ms, so a test waits only as long as
 *  a slow runner needs; rejects after `maxTime` */
async function waitFor(get: () => any, maxTime = 5000) {
	const start = Date.now()
	for (;;) {
		const v = get()
		if (v) return v
		if (Date.now() - start > maxTime) throw `waitFor() timed out: ${get}`
		await new Promise(r => setTimeout(r, 50))
	}
}

/** the visible wedge of a category */
function getWedge(sunburst, name: string) {
	return sunburst.Inner.chart.renderer.dom.paths
		.filter((d: any, i: number, els: any[]) => d.data.name == name && els[i].getAttribute('fill-opacity') == '1')
		.node()
}

/** Replace chart.app so launched plots are recorded instead of created; with chartTypes, the
 *  chart also sees a copy of termdbConfig with those chart types for the active cohort, which the
 *  test may edit. Call restore() in finally. */
function stubApp(chart, chartTypes?: string[]) {
	const app = chart.app
	const state = app.getState()
	const cohort = getActiveCohortStr(state)
	const termdbConfig = chartTypes
		? { ...app.vocabApi.termdbConfig, supportedChartTypes: { [cohort]: chartTypes } }
		: app.vocabApi.termdbConfig
	const stub = {
		cohort,
		termdbConfig,
		launched: undefined as any,
		restore: () => (chart.app = app)
	}
	chart.app = {
		vocabApi: chartTypes ? { vocab: app.vocabApi.vocab, termdbConfig } : app.vocabApi,
		getState: () => (chartTypes ? { ...state, termdbConfig } : app.getState()),
		dispatch: async action => {
			stub.launched = action
		}
	}
	return stub
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/sunburst -***-')
	test.end()
})

tape('Compare exactly two selected wedges with differential gene expression', test => {
	test.timeoutAfter(30000)
	runpp({
		state: { plots: [{ chartType: 'sunburst', twLst: [{ id: 'diaggrp' }] }] },
		sunburst: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(sunburst) {
		sunburst.on('postRender.test', null)
		const inner = sunburst.Inner
		const chart = inner.chart
		const holder = inner.opts.holder.append('div')
		const row = () => holder.select('[data-testid=sjpp-sunburst-data-differentialExpression]')
		const stub = stubApp(chart, ['DA'])
		const { termdbConfig, cohort } = stub
		let beforeLaunch = false
		chart.beforeLaunch = () => {
			beforeLaunch = true
		}
		async function render() {
			chart.dataShown = true
			holder.selectAll('*').remove()
			await chart.renderData(holder, chart.selectedCount())
			test.ok(holder.select('.sja_errorbar').empty(), 'Should load availability without errors')
		}
		try {
			const all = getWedge(sunburst, ALL).__data__
			const hodgkin = getWedge(sunburst, 'Hodgkin lymphoma').__data__
			chart.toggle(all)
			await render()
			test.ok(row().empty(), 'Should not offer a comparison for one wedge')
			chart.toggle(hodgkin)
			await render()
			test.equal(
				row().select('span').text(),
				'Differential Gene Expression Analysis',
				'Should offer differential expression for two wedges with RNA-seq counts'
			)
			const expected = chart.comparisonGroups()
			test.ok(expected[0].name.includes(ALL), 'Should use the first-selected wedge as control')
			test.ok(expected[1].name.includes('Hodgkin lymphoma'), 'Should use the second-selected wedge as case')
			row().node().click()
			const menu = await waitFor(() => chart.dataMenu?.dnode)
			const run = await waitFor(() => menu.querySelector('[data-testid=sjpp-da-run-btn]'), 10000)
			test.ok(
				menu.textContent.includes('CONTROL') && menu.textContent.includes('CASE'),
				'Should show the shared group-count panel'
			)
			test.ok(
				menu.textContent.includes('edgeR') && menu.textContent.includes('Limma'),
				'Should show the shared analysis methods'
			)
			test.notOk(stub.launched, 'Should not create a plot until Run is clicked')
			run.click()
			await waitFor(() => stub.launched)
			test.ok(beforeLaunch, 'Should use the launch hook for the About tab')
			test.equal(stub.launched.config.chartType, 'differentialAnalysis', 'Should launch the differential analysis plot')
			test.equal(stub.launched.config.termType, 'geneExpression', 'Should compare gene expression')
			// the server resolves each group by its own filter alone, so a group carries the global filter too
			const globalFilter = chart.app.getState().termfilter.filter
			test.ok(globalFilter?.lst?.length, 'Should have a global filter to scope the groups to')
			test.deepEqual(
				stub.launched.config.samplelst.groups.map(g => ({ name: g.name, filter: g.filter })),
				expected.map(g => ({ name: g.name, filter: filterJoin([g.filter, globalFilter]) })),
				'Should scope the distinct control and case filters to the global filter, in selection order'
			)
			test.ok(
				stub.launched.config.samplelst.groups.every(g => g.sampleCount > 0),
				'Should pass RNA-seq sample counts to the analysis'
			)
			test.notOk(
				document.querySelector('[data-testid=sjpp-sunburst-differential-menu]'),
				'Should close the panel after launching'
			)

			chart.groupFilter = expected[0].filter
			await render()
			test.ok(row().empty(), 'Should not offer a comparison when one wedge has no eligible RNA-seq samples')
			const filtered = chart.comparisonGroups()
			test.equal(filtered[1].filter.join, 'and', 'Should join each wedge filter with the plot filter')
			test.deepEqual(
				filtered[1].filter.lst[1],
				expected[0].filter.lst[0],
				'Should preserve the local plot filter for each comparison group'
			)
			chart.groupFilter = undefined
			termdbConfig.supportedChartTypes = { [cohort]: ['summary'] }
			await render()
			test.ok(row().empty(), 'Should not offer differential expression when unsupported')
			termdbConfig.supportedChartTypes = { [cohort]: ['DA'] }
			const queries = termdbConfig.queries
			termdbConfig.queries = { ...queries, rnaseqGeneCount: undefined }
			await render()
			test.ok(row().empty(), 'Should not offer differential expression without a count query')
			termdbConfig.queries = queries
			const third = chart.renderer.root.children.find(d => d != all && d != hodgkin)
			chart.toggle(third)
			await render()
			test.ok(row().empty(), 'Should not offer a comparison for three wedges')
			chart.toggle(third)
			chart.toggle(all)
			chart.toggle(all)
			const reordered = chart.comparisonGroups()
			test.ok(reordered[0].name.includes('Hodgkin lymphoma'), 'Should update control when selection order changes')
		} catch (e) {
			test.fail(String(e))
		} finally {
			stub.restore()
			holder.remove()
			inner.app.destroy()
			test.end()
		}
	}
})

tape('Split survival curves by selected wedge', test => {
	test.timeoutAfter(20000)
	runpp({
		state: { plots: [{ chartType: 'sunburst', twLst: [{ id: 'diaggrp' }] }] },
		sunburst: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(sunburst) {
		sunburst.on('postRender.test', null)
		const inner = sunburst.Inner
		const chart = inner.chart
		const holder = inner.opts.holder.append('div')
		const stub = stubApp(chart)
		const localFilter = {
			type: 'tvslst',
			join: '',
			in: true,
			lst: [{ type: 'tvs', tvs: { term: { id: 'sex', type: 'categorical', name: 'Sex' }, values: [{ key: '1' }] } }]
		}
		chart.groupFilter = localFilter
		try {
			const nodes = [getWedge(sunburst, ALL).__data__, getWedge(sunburst, 'Hodgkin lymphoma').__data__]
			nodes.push(chart.renderer.root.children.find(d => !nodes.includes(d)))
			for (const [i, node] of nodes.entries()) {
				chart.toggle(node)
				chart.dataShown = true
				holder.selectAll('*').remove()
				await chart.renderData(holder, chart.selectedCount())
				test.ok(holder.select('.sja_errorbar').empty(), 'Should load survival availability')
				const row = holder.select('[data-testid=sjpp-sunburst-data-survival-os]').node()
				test.ok(row, `Should offer survival for ${i + 1} selected wedges`)
				stub.launched = undefined
				row.click()
				const launched = (await waitFor(() => stub.launched)).config
				test.equal(launched.chartType, 'survival', 'Should launch one survival plot')
				test.equal(launched.term.id, 'os', 'Should use the clicked survival term')
				test.deepEqual(launched.filter, chart.plotFilter(), 'Should restrict the plot to the selected union')
				if (i == 0) {
					test.notOk(launched.term2, 'Should preserve a single curve for one wedge')
					continue
				}
				test.equal(launched.term2.term.type, 'samplelst', 'Should group curves using the custom-variable mechanism')
				const groups = chart.comparisonGroups()
				test.equal(launched.term2.q.groups.length, i + 1, 'Should create one curve group per wedge')
				test.deepEqual(
					launched.term2.q.groups.map(g => ({ name: g.name, filter: g.filter })),
					groups.map(g => ({ name: g.name, filter: g.filter })),
					'Should preserve wedge order and each wedge filter with the local plot filter'
				)
				for (const group of groups) {
					test.equal(
						launched.term2.term.values[group.name].color,
						group.color,
						'Should retain the wedge color for its survival curve'
					)
				}
			}
		} catch (e) {
			test.fail(String(e))
		} finally {
			stub.restore()
			holder.remove()
			inner.app.destroy()
			test.end()
		}
	}
})

tape('Offer GRIN2 for selected samples with mutation data', test => {
	test.timeoutAfter(20000)
	runpp({
		state: { plots: [{ chartType: 'sunburst', twLst: [{ id: 'diaggrp' }] }] },
		sunburst: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(sunburst) {
		sunburst.on('postRender.test', null)
		const inner = sunburst.Inner
		const chart = inner.chart
		getWedge(sunburst, ALL).dispatchEvent(new MouseEvent('click', { bubbles: true }))
		const stub = stubApp(chart, ['grin2'])
		const { termdbConfig, cohort } = stub
		let beforeLaunch = false
		chart.beforeLaunch = () => {
			beforeLaunch = true
		}
		const holder = inner.opts.holder.append('div')
		const button = () => holder.select('[data-testid=sjpp-sunburst-grin2]')
		async function render() {
			holder.selectAll('*').remove()
			await chart.renderData(holder, chart.selectedCount())
			test.ok(holder.select('.sja_errorbar').empty(), 'Should load data availability without errors')
		}
		try {
			await render()
			test.ok(button().empty(), 'Should not offer GRIN2 before Show available data is clicked')
			holder.select('[data-testid=sjpp-sunburst-show-data]').node().click()
			// The click redraws the sidebar; use the same render path for each dataset configuration below.
			for (const queries of [
				{ snvindel: {} },
				{ cnv: {} },
				{ svfusion: { dtLst: [dtfusionrna] } },
				{ singleSampleMutation: { cnvTypes: ['copyNumber'] } }
			]) {
				termdbConfig.queries = queries
				await render()
				test.equal(button().text(), 'Run GRIN2', `Should offer GRIN2 with ${Object.keys(queries)[0]} data`)
			}
			button().node().click()
			await waitFor(() => stub.launched)
			test.ok(beforeLaunch, 'Should run the launch hook used by the About tab')
			test.equal(stub.launched.type, 'plot_create', 'Should create a plot')
			test.equal(stub.launched.config.chartType, 'grin2', 'Should open GRIN2')
			test.deepEqual(stub.launched.config.filter, chart.plotFilter(), 'Should give GRIN2 the selection as its filter')
			test.equal(stub.launched.config.filter.lst[0].tvs.values[0].key, ALL, 'Should filter GRIN2 by the selected wedge')

			termdbConfig.queries = { snvindel: {} }
			termdbConfig.supportedChartTypes = { [cohort]: ['summary'] }
			await render()
			test.ok(button().empty(), 'Should not offer GRIN2 when disabled for the active cohort')
			termdbConfig.supportedChartTypes = { otherCohort: ['grin2'] }
			await render()
			test.ok(button().empty(), "Should not use another cohort's GRIN2 setting")
			termdbConfig.supportedChartTypes = { [cohort]: ['grin2'] }
			termdbConfig.queries = {}
			await render()
			test.ok(button().empty(), 'Should not offer GRIN2 without supported mutation queries')
			termdbConfig.queries = { svfusion: { dtLst: [dtsv] } }
			await render()
			test.ok(button().empty(), 'Should not offer GRIN2 when the selection lacks the supported mutation data')
		} catch (e) {
			test.fail(String(e))
		} finally {
			stub.restore()
			holder.remove()
			inner.app.destroy()
			test.end()
		}
	}
})

tape('Render rings of a sample-level and a patient-level term', test => {
	test.timeoutAfter(10000)
	runpp({
		state: { plots: [{ chartType: 'sunburst', twLst: [{ id: 'diaggrp' }, { id: 'sex' }] }] },
		sunburst: { callbacks: { 'postRender.test': runTests } }
	})

	function runTests(sunburst) {
		sunburst.on('postRender.test', null)
		const root = sunburst.Inner.chart.renderer.root
		// counts are of the default active cohort
		test.equal(root.value, 60, 'Should count the 60 cohort samples with a diagnosis group')
		test.equal(root.children.length, 7, 'Should render 7 diagnosis group wedges')
		const all = root.children.find(d => d.data.name == ALL)
		test.equal(all?.value, 36, `Should count 36 ${ALL} samples`)
		test.deepEqual(
			all.children.map(d => d.data.name).sort(),
			['Female', 'Male'],
			'Should nest the patient-level sex under the diagnosis group'
		)
		test.equal(
			all.children.reduce((s, d) => s + d.value, 0),
			36,
			'Should map the patient sex onto each sample'
		)
		test.ok(getWedge(sunburst, ALL), 'Should show the first ring')
		test.ok(getWedge(sunburst, 'Female'), 'Should show the second ring')
		if (test['_ok']) sunburst.Inner.app.destroy()
		test.end()
	}
})

tape('Select wedges and create a group', test => {
	test.timeoutAfter(10000)
	runpp({
		state: { plots: [{ chartType: 'sunburst', twLst: [{ id: 'diaggrp' }, { id: 'sex' }] }] },
		sunburst: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(sunburst) {
		sunburst.on('postRender.test', null)
		const inner = sunburst.Inner
		const createButton = () => inner.chart.dom.sel.body.select('[data-testid=sjpp-sunburst-create-group]')
		test.ok(createButton().empty(), 'Should not render Create group without selected wedges')
		const all = getWedge(sunburst, ALL)
		test.equal(
			getComputedStyle(inner.chart.renderer.dom.svg.node()).userSelect,
			'none',
			'Should disable text selection only within the chart SVG'
		)
		for (const { shiftKey, button, prevented } of [
			{ shiftKey: true, button: 0, prevented: true },
			{ shiftKey: false, button: 0, prevented: false },
			{ shiftKey: true, button: 2, prevented: false }
		]) {
			const event = new MouseEvent('mousedown', { shiftKey, button, bubbles: true, cancelable: true })
			all.dispatchEvent(event)
			test.equal(
				event.defaultPrevented,
				prevented,
				`Should ${prevented ? '' : 'not '}prevent text-selection default for shift=${shiftKey}, button=${button}`
			)
		}
		all.dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }))
		test.deepEqual(
			[...inner.chart.selected.values()].map(d => d.data.name),
			[ALL],
			'Should select an inner wedge on shift-click'
		)

		const female = all.__data__.children.find(d => d.data.name == 'Female')
		inner.chart.toggle(female)
		test.equal(inner.chart.selected.size, 1, 'Should not add a wedge already contained in a selected wedge')

		const hodgkin = getWedge(sunburst, 'Hodgkin lymphoma')
		hodgkin.dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }))
		test.equal(inner.chart.selected.size, 2, 'Should select a second wedge')
		test.equal(inner.chart.selectedCount(), 41, 'Should count the samples of both wedges')

		const btn = inner.chart.dom.sel.body.select('[data-testid=sjpp-sunburst-create-group]')
		test.equal(btn.text(), 'Create group of 41 samples', 'Should label the action with the sample count')
		btn.node().click()
		const groups = await waitFor(() => inner.app.getState().groups?.length && inner.app.getState().groups)
		test.equal(groups.length, 1, 'Should add one group')
		test.equal(groups[0].name, `${ALL} or Hodgkin lymphoma`, 'Should name the group after the selected wedges')
		test.equal(groups[0].filter.join, 'or', 'Should join the wedges by "or"')
		test.deepEqual(
			groups[0].filter.lst.map(f => f.tvs.values.map(v => v.key)),
			[[ALL], ['Hodgkin lymphoma']],
			'Should select each wedge by its diagnosis group'
		)
		test.equal(inner.chart.selected.size, 0, 'Should clear the selection once the group is created')
		test.ok(createButton().empty(), 'Should remove Create group when the selection is cleared')
		test.ok(
			inner.chart.dom.sel.body.text().includes('added; find it in the GROUPS tab'),
			'Should still show the group-created confirmation'
		)
		if (test['_ok']) inner.app.destroy()
		test.end()
	}
})

tape('Create a group with the plot filter', test => {
	test.timeoutAfter(10000)
	const sexTvs = { type: 'tvs', tvs: { term: { id: 'sex', type: 'categorical', name: 'Sex' }, values: [{ key: '1' }] } }
	runpp({
		state: {
			plots: [
				{
					chartType: 'sunburst',
					twLst: [{ id: 'diaggrp' }],
					filter: { type: 'tvslst', join: '', in: true, lst: [sexTvs] }
				}
			]
		},
		sunburst: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(sunburst) {
		sunburst.on('postRender.test', null)
		const inner = sunburst.Inner
		const all = getWedge(sunburst, ALL)
		all.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		test.equal(inner.chart.selected.size, 1, 'Should select an outermost wedge on click')
		inner.chart.dom.sel.body.select('[data-testid=sjpp-sunburst-create-group]').node().click()
		const groups = await waitFor(() => inner.app.getState().groups?.length && inner.app.getState().groups)
		const f = groups[0].filter
		test.equal(f.join, 'and', 'Should join the plot filter and the wedge by "and"')
		test.deepEqual(
			f.lst.map(item => item.tvs.term.id).sort(),
			['diaggrp', 'sex'],
			'Should select the group by the plot filter and the wedge category'
		)
		if (test['_ok']) inner.app.destroy()
		test.end()
	}
})

tape('Edit rings in the Rings box', test => {
	test.timeoutAfter(10000)
	runpp({
		state: { plots: [{ chartType: 'sunburst', twLst: [{ id: 'diaggrp' }, { id: 'sex' }] }] },
		sunburst: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(sunburst) {
		sunburst.on('postRender.test', null)
		const inner = sunburst.Inner
		const rings = inner.chart.dom.rings.body
		test.equal(rings.selectAll('.sjpp-sunburst-ring').size(), 2, 'Should show one line per ring')
		const infoBtn = rings.select('.sjpp-sunburst-ringpill > div:nth-child(4)').node()
		test.equal(getComputedStyle(infoBtn).display, 'none', 'Should hide the info button')
		// remove the second ring from its pill menu; the option of the menu that is shown, as the menus of
		// earlier tests may still be in the document
		rings.selectAll('.ts_pill').nodes()[1].click()
		const removeOpt = await waitFor(() =>
			[...document.querySelectorAll('.sja_menu_div .sja_menuoption')].find(
				(n: any) => n.textContent == 'Remove' && n.closest('.sja_menu_div').style.display != 'none'
			)
		).catch(() => undefined)
		test.ok(removeOpt, 'Should offer Remove in the pill menu')
		if (!removeOpt) return test.end()
		sunburst.on('postRender.test', testRemoved)
		removeOpt.click()

		function testRemoved() {
			sunburst.on('postRender.test', null)
			test.deepEqual(
				inner.state.config.twLst.map(tw => tw.term.id),
				['diaggrp'],
				'Should remove the ring from the plot config'
			)
			test.equal(rings.selectAll('.sjpp-sunburst-ring').size(), 1, 'Should show one line after removing a ring')
			test.equal(inner.chart.renderer.root.height, 1, 'Should redraw the chart with one ring')
			if (test['_ok']) inner.app.destroy()
			test.end()
		}
	}
})

tape('Pass a changed filter to the Rings box pills', test => {
	test.timeoutAfter(10000)
	runpp({
		state: { plots: [{ chartType: 'sunburst', twLst: [{ id: 'diaggrp' }, { id: 'sex' }] }] },
		sunburst: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(sunburst) {
		sunburst.on('postRender.test', null)
		const inner = sunburst.Inner
		const pills = inner.chart.dom.rings.body.selectAll('.ts_pill').nodes()
		sunburst.on('postRender.test', testFilter)
		await inner.app.dispatch({
			type: 'filter_replace',
			filter: {
				type: 'tvslst',
				join: '',
				in: true,
				lst: [{ type: 'tvs', tvs: { term: { id: 'sex', type: 'categorical', name: 'Sex' }, values: [{ key: '1' }] } }]
			}
		})

		async function testFilter() {
			sunburst.on('postRender.test', null)
			test.deepEqual(
				inner.chart.dom.rings.body.selectAll('.ts_pill').nodes(),
				pills,
				'Should keep the pills when only the filter changes'
			)
			const filter = inner.state.termfilter.filter
			test.equal(inner.ringPills.length, 3, 'Should have a pill per ring and + Add ring')
			for (const [i, { pill }] of inner.ringPills.entries())
				test.deepEqual(pill.Inner.filter, filter, `Should pass the changed filter to pill ${i + 1}`)
			if (test['_ok']) inner.app.destroy()
			test.end()
		}
	}
})

tape('Select the wedge at the centre', test => {
	test.timeoutAfter(10000)
	runpp({
		state: { plots: [{ chartType: 'sunburst', twLst: [{ id: 'diaggrp' }, { id: 'sex' }] }] },
		sunburst: { callbacks: { 'postRender.test': runTests } }
	})

	function runTests(sunburst) {
		sunburst.on('postRender.test', null)
		const inner = sunburst.Inner
		const btn = inner.chart.dom.selectFocus
		test.equal(btn.style('display'), 'none', 'Should hide SELECT at the root')
		// zoomTo() sets the centre, the path and SELECT at once; only the arcs are animated
		getWedge(sunburst, ALL).dispatchEvent(new MouseEvent('click', { bubbles: true }))
		test.equal(inner.chart.renderer.focus.data.name, ALL, 'Should zoom into the clicked wedge')
		test.equal(
			inner.chart.renderer.dom.crumbs.text(),
			`All samples›${ALL}`,
			'Should show the zoom path above the chart'
		)
		test.notEqual(btn.style('display'), 'none', 'Should show SELECT when zoomed in')
		btn.node().dispatchEvent(new MouseEvent('click', { bubbles: true }))
		test.deepEqual(
			[...inner.chart.selected.values()].map(d => d.data.name),
			[ALL],
			'Should select the wedge at the centre'
		)
		test.ok(btn.text().startsWith('SELECTED'), 'Should mark the centre as selected')
		const bold = inner.chart.dom.rings.body
			.selectAll('.sjpp-sunburst-ringnum')
			.nodes()
			.map((n: any) => n.style.fontWeight)
		test.deepEqual(bold, ['normal', 'bold'], 'Should mark only the ring shown around the centre')
		inner.chart.renderer.dom.crumbs.select('.sjpp-sunburst-crumb').node().dispatchEvent(new MouseEvent('click'))
		test.equal(inner.chart.renderer.focus.depth, 0, 'Should zoom out from the path')
		if (test['_ok']) inner.app.destroy()
		test.end()
	}
})

tape('Summarize a dictionary term in the selected group', test => {
	test.timeoutAfter(20000)
	let inner: any
	let expectedFilter: any
	runpp({
		state: {
			plots: [
				{
					chartType: 'sunburst',
					twLst: [{ id: 'diaggrp' }],
					filter: {
						type: 'tvslst',
						join: '',
						in: true,
						lst: [
							{
								type: 'tvs',
								tvs: { term: { id: 'sex', type: 'categorical', name: 'Sex' }, values: [{ key: '1' }] }
							}
						]
					}
				}
			]
		},
		sunburst: {
			callbacks: {
				'postRender.test': async sunburst => {
					sunburst.on('postRender.test', null)
					inner = sunburst.Inner
					getWedge(sunburst, ALL).dispatchEvent(new MouseEvent('click', { bubbles: true }))
					const card = inner.chart.dom.sel.body
					test.ok(
						card.select('[data-testid=sjpp-sunburst-data-summarize]').empty(),
						'Should hide Summarize until Show available data is clicked'
					)
					card.select('[data-testid=sjpp-sunburst-show-data]').node().click()
					expectedFilter = inner.chart.plotFilter()
					const summarize = card.select('[data-testid=sjpp-sunburst-data-summarize]')
					test.equal(summarize.select('span').text(), 'Summarize', 'Should label the summary row')
					test.equal(
						summarize.node().lastChild.textContent,
						' ›',
						'Should show only the navigation arrow without a sample count in the summary row'
					)
					summarize.node().click()
					await selectTerm()
				}
			}
		},
		summary: {
			callbacks: {
				'postRender.test': summary => {
					summary.on('postRender.test', null)
					const config = inner.app.getState().plots.find(p => p.chartType == 'summary')
					test.equal(config.term.term.id, 'sex', 'Should summarize the selected dictionary term')
					test.deepEqual(config.filter, expectedFilter, 'Should preserve the wedge selection and plot filter')
					test.ok(
						!inner.app.getState().plots.some(p => p.chartType == 'dictionary'),
						'Should not create a dictionary plot'
					)
					test.notOk(
						document.querySelector('[data-testid=sjpp-sunburst-summary-menu]'),
						'Should remove the dictionary popover after selecting a term'
					)
					inner.app.destroy()
					test.end()
				}
			}
		}
	})

	async function selectTerm() {
		try {
			const holder = await waitFor(() => inner.chart.dataMenu?.dnode)
			test.equal(inner.app.getState().plots.length, 1, 'Should open the picker without creating another plot')
			const demographic = await waitFor(() =>
				[...holder.querySelectorAll('.termbtn')].find((n: any) => n.__data__?.name == 'Demographic Variables')
			)
			demographic.click()
			const sex = await waitFor(() =>
				[...holder.querySelectorAll('.sja_tree_click_term')].find((n: any) => n.__data__?.id == 'sex')
			)
			sex.click()
		} catch (e) {
			test.fail(String(e))
			inner.app.destroy()
			test.end()
		}
	}
})

tape('Show the available data of a selection', test => {
	test.timeoutAfter(20000)
	runpp({
		state: { plots: [{ chartType: 'sunburst', twLst: [{ id: 'diaggrp' }, { id: 'sex' }] }] },
		sunburst: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(sunburst) {
		sunburst.on('postRender.test', null)
		const inner = sunburst.Inner
		const card = inner.chart.dom.sel.body
		const section = () => card.select('[data-testid=sjpp-sunburst-group-data]')
		test.ok(section().empty(), 'Should not offer the available data without a selection')

		getWedge(sunburst, ALL).dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }))
		const showBtn = section().select('[data-testid=sjpp-sunburst-show-data]')
		test.equal(showBtn.text(), 'Show available data', 'Should offer to show the available data of the selection')
		const children = [...card.node().children]
		const createGroup = card.select('[data-testid=sjpp-sunburst-create-group]').node()
		test.ok(
			children.indexOf(section().node()) < children.findIndex(c => c.contains(createGroup)),
			'Should show the button above the create-group action'
		)

		showBtn.node().click()
		const expRow = await waitFor(
			() => section().select('[data-testid=sjpp-sunburst-data-geneExpression]').node(),
			10000
		)
		test.equal(
			section().select('[data-testid=sjpp-sunburst-data-title]').text(),
			'36 samples',
			'Should name the number of selected samples'
		)
		const count = (row: any) => Number(row.lastChild.textContent.replace(/[^0-9]/g, ''))
		test.ok(count(expRow) > 0 && count(expRow) <= 36, 'Should count the selected samples with gene expression data')
		const methRow = section().select('[data-testid=sjpp-sunburst-data-dnaMethylation]').node()
		test.ok(methRow && count(methRow) > 0, 'Should count the selected samples with DNA methylation data')
		test.ok(
			section().select('[data-testid=sjpp-sunburst-data-rnaseqGeneCount]').empty(),
			'Should not list the counts of differential expression, which compares groups'
		)

		// gene selection stays in a popover until a gene is chosen
		const plots = inner.app.getState().plots.length
		expRow.click()
		const expressionMenu = await waitFor(() => inner.chart.dataMenu?.dnode)
		await waitFor(() => expressionMenu.querySelector('.sja_genesearchinput'))
		const searchMenus = [...inner.chart.dataPicker.Inner.geneSearchMenus]
		test.equal(searchMenus[0].d.node().parent_menu, expressionMenu, 'Should associate suggestions with the picker')
		test.equal(inner.app.getState().plots.length, plots, 'Should not create a plot for gene selection')
		test.equal(
			expressionMenu.querySelector('[data-testid=sjpp-gene-exp-input-termType]')?.textContent,
			'GENE EXPRESSION',
			'Should show the expression selection form'
		)
		inner.chart.closeDataPicker()
		for (const menu of searchMenus) {
			test.notOk(menu.d.node().isConnected, 'Should remove the search menus with the picker')
		}

		// the methylation row opens the term search, for the selected samples
		methRow.click()
		const dict = await waitFor(() => inner.app.getState().plots.find(p => p.chartType == 'dictionary'))
		test.deepEqual(
			dict.spawnConfig.filter,
			inner.chart.plotFilter(),
			'Should give a methylation plot the selection as filter'
		)

		// a mutation row counts the assayed samples and opens the genome browser of the selected samples
		const assayRows = section().selectAll('[data-testid^=sjpp-sunburst-data-assay-]').nodes()
		test.deepEqual(
			assayRows.map((n: any) => n.getAttribute('data-testid')),
			['1.germline', '1.somatic', '2', '4'].map(k => `sjpp-sunburst-data-assay-${k}`),
			'Should list the assayed samples for each kind of mutation data'
		)
		const assayed = assayRows.find((n: any) => count(n) > 0) as any
		test.ok(assayed, 'Should count selected samples assayed for mutations')
		assayed.click()
		const gb = await waitFor(() => inner.app.getState().plots.find(p => p.chartType == 'genomeBrowser'))
		test.deepEqual(gb.filter, inner.chart.plotFilter(), 'Should open the genome browser with the selection as filter')
		test.equal(gb.snvindel?.shown, true, 'Should show the mutation track')

		// a survival row counts the samples with a value for the term and opens its survival curve
		const osRow = section().select('[data-testid=sjpp-sunburst-data-survival-os]').node()
		test.ok(osRow && count(osRow) > 0 && count(osRow) <= 36, 'Should count the selected samples with overall survival')
		osRow.click()
		const surv = await waitFor(() => inner.app.getState().plots.find(p => p.chartType == 'survival'))
		test.equal(surv.term.term.id, 'os', 'Should open the survival curve of the term')
		test.deepEqual(surv.filter, inner.chart.plotFilter(), 'Should give the survival plot the selection as filter')

		// Hide goes back to the button, which shows the data again
		section().select('[data-testid=sjpp-sunburst-hide-data]').node().click()
		test.ok(section().select('[data-testid^=sjpp-sunburst-data-]').empty(), 'Should hide the data')
		section().select('[data-testid=sjpp-sunburst-show-data]').node().click()
		await waitFor(() => section().select('[data-testid=sjpp-sunburst-data-geneExpression]').node(), 10000)
		test.pass('Should show the data again from the button')

		// a change of the selection hides the data
		inner.chart.toggle(getWedge(sunburst, ALL).__data__)
		getWedge(sunburst, 'Hodgkin lymphoma').dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }))
		test.ok(
			section().select('[data-testid=sjpp-sunburst-show-data]').node(),
			'Should offer the button again for a new selection'
		)
		if (test['_ok']) inner.app.destroy()
		test.end()
	}
})

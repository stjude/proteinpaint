import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/*
Tests:
	- Render rings of a sample-level and a patient-level term
	- Select wedges and create a group
	- Create a group with the plot filter
	- Edit rings in the Rings box
	- Pass a changed filter to the Rings box pills
	- Select the wedge at the centre
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
		if (Date.now() - start > maxTime) throw 'waitFor() timed out'
		await new Promise(r => setTimeout(r, 50))
	}
}

/** the visible wedge of a category */
function getWedge(sunburst, name: string) {
	return sunburst.Inner.chart.renderer.dom.paths
		.filter((d: any, i: number, els: any[]) => d.data.name == name && els[i].getAttribute('fill-opacity') == '1')
		.node()
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/sunburst -***-')
	test.end()
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
		const all = getWedge(sunburst, ALL)
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

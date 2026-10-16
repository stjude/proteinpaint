import tape from 'tape'
import * as d3s from 'd3-selection'
import * as helpers from '../../../test/front.helpers.js'
import { AboutSunburst } from '../aboutSunburst'

/*
Tests:
	- Render the default rings and follow the global filter
	- Create a group and open the full chart
*/

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: { activeTab: 0 },
		dslabel: 'TermdbTest',
		genome: 'hg38-test'
	},
	debug: 1
})

const sexTvs = { type: 'tvs', tvs: { term: { id: 'sex', type: 'categorical', name: 'Sex' }, values: [{ key: '1' }] } }

/** resolves with the first truthy value of `get()`, checked every 50ms; rejects after `maxTime` */
async function waitFor(get: () => any, maxTime = 5000) {
	const start = Date.now()
	for (;;) {
		const v = get()
		if (v) return v
		if (Date.now() - start > maxTime) throw 'waitFor() timed out'
		await new Promise(r => setTimeout(r, 50))
	}
}

/** an About tab sunburst on the app of a launched mass, with the app's About component */
function launch(test, callback: (sunburst: AboutSunburst, app: any, holder: any) => Promise<void>) {
	runpp({
		about: {
			callbacks: {
				'postRender.test': async about => {
					about.on('postRender.test', null)
					const app = about.Inner.app
					const holder = d3s.select('body').append('div')
					let opened = 0
					const sunburst: any = new AboutSunburst(holder, app, () => opened++)
					sunburst.opened = () => opened
					try {
						await callback(sunburst, app, holder)
					} catch (e) {
						test.fail(String(e))
					}
					if (test['_ok']) {
						sunburst.chart.destroy()
						app.destroy()
						holder.remove()
					}
					test.end()
				}
			}
		}
	})
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/sunburst/aboutSunburst -***-')
	test.end()
})

tape('Render the default rings and follow the global filter', test => {
	test.timeoutAfter(10000)
	launch(test, async (sunburst, app) => {
		await sunburst.update(app.getState())
		const chart = sunburst.chart
		// the dataset's default rings, whichever they are
		const defaultIds = app.vocabApi.termdbConfig.sunburst.twLst.map(tw => tw.id)
		test.deepEqual(
			sunburst.twLst!.map(tw => tw.term.id),
			defaultIds,
			'Should use the dataset default rings'
		)
		const total = chart.renderer.root.value
		test.ok(total > 0, `Should count the cohort samples (${total})`)
		test.equal(
			chart.dom.rings.body.selectAll('.sjpp-sunburst-ring').size(),
			defaultIds.length,
			'Should list one line per ring in the Rings box'
		)
		test.equal(chart.dom.rings.body.selectAll('.ts_pill').size(), 0, 'Should not offer ring pills to edit')

		const root = chart.renderer.root
		await sunburst.update(app.getState())
		test.equal(chart.renderer.root, root, 'Should not re-fetch for an unchanged filter')

		await app.dispatch({
			type: 'filter_replace',
			filter: { type: 'tvslst', in: true, join: '', tag: 'filterUiRoot', lst: [sexTvs] }
		})
		await sunburst.update(app.getState())
		const n = chart.renderer.root.value
		test.ok(n > 0 && n < total, `Should count only the samples of the global filter (${n} of ${total})`)
	})
})

tape('Create a group and open the full chart', test => {
	test.timeoutAfter(10000)
	launch(test, async (sunburst: any, app) => {
		await sunburst.update(app.getState())
		const chart = sunburst.chart
		// any first-ring wedge
		const wedge = chart.renderer.root.children[0]
		chart.toggle(wedge)
		chart.dom.sel.body.select('[data-testid=sjpp-sunburst-create-group]').node().click()
		const groups = await waitFor(() => app.getState().groups?.length && app.getState().groups)
		test.equal(groups.length, 1, 'Should add one group')
		test.equal(groups[0].name, wedge.data.name, 'Should name the group after the selected wedge')

		chart.dom.rings.body.select('[data-testid=sjpp-about-sunburst-open]').node().click()
		test.equal(sunburst.opened(), 1, 'Should open the full chart from the Rings box')
	})
})

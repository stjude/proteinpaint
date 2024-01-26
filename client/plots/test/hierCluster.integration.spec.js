import * as helpers from '../../test/front.helpers.js'
import tape from 'tape'
import { sleep, detectOne, detectGte, detectLst } from '../../test/test.helpers.js'
import { select } from 'd3-selection'
import { appInit } from '../plot.app.js'
import { withBCR, noBCR, twoGenes } from '../../test/testdata/fake-hcdata'
import { fillTermWrapper } from '#termsetting'

/*************************
 reusable helper functions
**************************/

async function requestData() {
	const lst = this.config.termgroups[0].lst
	await sleep(this.__wait || 0)
	return !lst.length ? {} : lst.length < 3 ? twoGenes : lst.find(tw => tw.term.name == 'BCR') ? withBCR : noBCR
}

async function getHierClusterApp(_opts = {}) {
	const holder = select('body').append('div')
	const defaults = {
		debug: true,
		holder,
		genome: 'hg38-test',
		state: {
			genome: 'hg38-test',
			dslabel: 'TermdbTest',
			termfilter: { filter0: _opts.filter0 },
			plots: [
				{
					chartType: 'hierCluster',
					settings: {
						hierCluster: {
							termGroupName: 'Gene Expression (CGC genes only)'
						}
					},
					// force empty termgroups, genes since the instance requestData() will not have expression data,
					// and will cause a non-trival error if using the actual requestData(), which will be mocked below
					termgroups: [], // _opts.termgroups || [],
					// !!! there will be an initial load error since this is an empty geneset,
					// !!! but will be ignored since it's not relevant to this test
					genes: []
					//genes,
					//settings
				}
			]
		},
		app: {
			features: ['recover'],
			callbacks: _opts?.app?.callbacks || {}
		},
		recover: {
			undoHtml: 'Undo',
			redoHtml: 'Redo',
			resetHtml: 'Restore',
			adjustTrackedState(state) {
				const s = structuredClone(state)
				delete s.termfilter.filter0
				return s
			}
		},
		hierCluster: _opts?.hierCluster || {}
	}

	const opts = Object.assign(defaults, _opts)
	const app = await appInit(opts)
	holder.select('.sja_errorbar').node()?.lastChild.click()
	const hc = app.Inner.components.plots[0].Inner
	// mock requestData() directly on the instance itself and without modifying the HierCluster.prototype
	hc.requestData = requestData
	const termgroups = structuredClone(hc.config.termgroups)
	termgroups[0].lst = await Promise.all(
		(_opts.genes || []).map(async g =>
			fillTermWrapper({
				term: { name: g.gene, type: 'geneVariant' }
			})
		)
	)
	await app.dispatch({
		type: 'plot_edit',
		id: hc.id,
		config: { termgroups }
	})
	return { app, hc }
}

/**************
 test sections
***************/

// !!! These do not test clustering algorithm, it uses fake data to test only
// the client-side, such as rendering and avoiding race conditions

tape('\n', function (test) {
	test.pass('-***- plots/hierCluster.js -***-')
	test.end()
})

tape('basic render', async test => {
	test.timeoutAfter(1000)
	const { app, hc } = await getHierClusterApp({
		genes: [{ gene: 'AKT1' }, { gene: 'TP53' }, { gene: 'BCR' }, { gene: 'KRAS' }]
	})
	test.equal(hc.dom.termLabelG.selectAll('.sjpp-matrix-label').size(), 4, 'should render 4 gene rows')
	if (test._ok) app.destroy()
	test.end()
})

tape('avoid race condition', async test => {
	// !!!
	// to allow an app or chart code to fail due to race condition,
	// hardcode a constant value or comment out the ++ for the sequenceID
	// in rx/index.js getStoreApi().write()
	// !!!
	test.timeoutAfter(1000)
	const { app, hc } = await getHierClusterApp({
		genes: [{ gene: 'AKT1' }, { gene: 'TP53' }, { gene: 'BCR' }, { gene: 'KRAS' }]
	})
	const termgroups = structuredClone(hc.config.termgroups)
	termgroups[0].lst = [
		await fillTermWrapper({ term: { name: 'AKT1', type: 'geneVariant' } }),
		await fillTermWrapper({ term: { name: 'TP53', type: 'geneVariant' } })
	]
	const responseDelay = 10
	hc.__wait = responseDelay
	await Promise.all([
		app.dispatch({
			type: 'plot_edit',
			id: hc.id,
			config: { termgroups }
		}),
		(async () => {
			await sleep(1)
			hc.__wait = 0
			const termgroups = structuredClone(hc.config.termgroups)
			termgroups[0].lst = [
				await fillTermWrapper({ term: { name: 'AKT1', type: 'geneVariant' } }),
				await fillTermWrapper({ term: { name: 'TP53', type: 'geneVariant' } }),
				await fillTermWrapper({ term: { name: 'KRAS', type: 'geneVariant' } })
			]
			app.dispatch({
				type: 'plot_edit',
				id: hc.id,
				config: { termgroups }
			})
		})()
	])
	// run tests after the delayed response, as part of simulating the race condition
	await sleep(responseDelay + 10)
	test.equal(hc.dom.termLabelG.selectAll('.sjpp-matrix-label').size(), 3, 'should render 3 gene rows')
	const rects = hc.dom.seriesesG.selectAll('.sjpp-mass-series-g rect')
	const hits = rects.filter(d => d.key !== 'BCR' && d.value.class != 'WT' && d.value.class != 'Blank')
	test.equal(
		rects.size(),
		156,
		'should have the expected total number of matrix cell rects, inlcuding WT and not tested'
	)
	test.equal(hits.size(), 156, 'should have the expected number of matrix cell rects with hits')
	if (test._ok) app.destroy()
	test.end()
})

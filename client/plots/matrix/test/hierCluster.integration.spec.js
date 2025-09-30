import tape from 'tape'
import * as helpers from '#test/front.helpers.js'
import { sleep, detectOne, detectGte, detectLst, detectAttr } from '#test/test.helpers.js'
import { select } from 'd3-selection'
import { appInit } from '#plots/plot.app.js'
import { fillTermWrapper } from '#termsetting'
import { TermTypes, NUMERIC_DICTIONARY_TERM } from '#shared/terms.js'

/**************
 test sections

basic render
localFilter
avoid race condition
dendrogram click

***************/

tape('\n', function (test) {
	test.comment('-***- plots/hierCluster.js -***-')
	test.end()
})

tape('basic render', async test => {
	test.timeoutAfter(4000)
	const { app, hc } = await getHierClusterApp({ terms: getGenes() })
	test.equal(hc.dom.termLabelG.selectAll('.sjpp-matrix-label').size(), 4, 'should render 4 gene rows')
	test.equal(hc.dom.sampleLabelG.selectAll('.sjpp-matrix-label').size(), 60, 'should render 60 sample columns') // update "60" when data changes
	if (test._ok) app.destroy()
	test.end()
})

tape('localFilter', async test => {
	test.timeoutAfter(4000)
	const { app, hc } = await getHierClusterApp({
		terms: getGenes(),
		localFilter: {
			type: 'tvslst',
			join: '',
			in: true,
			lst: [{ type: 'tvs', tvs: { term: { id: 'diaggrp' }, values: [{ key: 'Acute lymphoblastic leukemia' }] } }]
		}
	})
	test.equal(hc.dom.sampleLabelG.selectAll('.sjpp-matrix-label').size(), 36, 'should render 36 sample columns') // update "36" when data changes
	if (test._ok) app.destroy()
	test.end()
})

tape('avoid race condition', async test => {
	// !!!
	// to allow an app or chart code to fail due to race condition,
	// hardcode a constant value or comment out the ++ for the sequenceID
	// in rx/index.js getStoreApi().write()
	// !!!
	test.timeoutAfter(4000)
	test.plan(3)
	const { app, hc } = await getHierClusterApp({ terms: getGenes() })
	const termgroups = structuredClone(hc.config.termgroups)
	termgroups[0].lst = await Promise.all([
		fillTermWrapper({ term: { gene: 'AKT1', name: 'AKT1', type: 'geneExpression' } }, app.vocabApi),
		fillTermWrapper({ term: { gene: 'TP53', name: 'TP53', type: 'geneExpression' } }, app.vocabApi)
	])
	const responseDelay = 250
	hc.__wait = responseDelay
	hc.origRequestData = hc.requestData
	hc.requestData = async () => {
		const lst = hc.config.termgroups[0].lst
		await sleep(hc.__wait || 0)
		return await hc.origRequestData({})
	}

	const prom = {}
	const postRenderTest = new Promise(resolve => {
		prom.resolve = resolve
	})
	app.on('postRender.test1', () => {
		app.on('postRender.test1', null)
		prom.resolve()
	})

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
			termgroups[0].lst = await Promise.all([
				fillTermWrapper({ term: { gene: 'AKT1', name: 'AKT1', type: 'geneExpression' } }, app.vocabApi),
				fillTermWrapper({ term: { gene: 'TP53', name: 'TP53', type: 'geneExpression' } }, app.vocabApi),
				fillTermWrapper({ term: { gene: 'KRAS', name: 'KRAS', type: 'geneExpression' } }, app.vocabApi)
			])
			await app.dispatch({
				type: 'plot_edit',
				id: hc.id,
				config: { termgroups }
			})
		})()
	])

	await postRenderTest
	await sleep(responseDelay + 500)
	// run tests after the delayed response, as part of simulating the race condition
	test.equal(hc.dom.termLabelG.selectAll('.sjpp-matrix-label').size(), 3, 'should render 3 gene rows')
	const rects = hc.dom.seriesesG.selectAll('.sjpp-mass-series-g rect')
	const hits = rects.filter(d => d.key !== 'BCR' && d.value.class != 'WT' && d.value.class != 'Blank')
	test.equal(
		rects.size(),
		180,
		'should have the expected total number of matrix cell rects, inlcuding WT and not tested'
	)
	test.equal(hits.size(), 180, 'should have the expected number of matrix cell rects with hits')
	if (test._ok) app.destroy()
})

tape('dendrogram click', async function (test) {
	test.timeoutAfter(5000)
	test.plan(3)

	let numRenders = 0
	const { app, hc } = await getHierClusterApp({ terms: getGenes() })

	const img = await detectOne({ elem: hc.dom.topDendrogram.node(), selector: 'image' })
	const svgBox = hc.dom.svg.node().getBoundingClientRect()
	const imgBox = img.getBBox()
	// helper to see onscreen the x, y position of the click
	// select('body')
	// 	.append('div')
	// 	.style('position', 'absolute')
	// 	.style('top', svgBox.y + imgBox.y + imgBox.height/2)
	// 	.style('left', svgBox.x + hc.dimensions.xOffset + imgBox.x + imgBox.width/2)
	// 	.style('width', '5px').style('height', '5px')
	// 	.style('background-color', '#00f')

	img.dispatchEvent(
		new MouseEvent('click', {
			//'view': window,
			bubbles: true,
			cancelable: true,
			clientX: svgBox.x + hc.dimensions.xOffset + imgBox.x + imgBox.width / 2,
			clientY: svgBox.y + imgBox.y + imgBox.height / 2
		})
	)

	// not able to nail down all the expected dataURI strings based on env
	// const dataUriEnd = hc.dom.topDendrogram.select('image')?.attr('href').slice(-60) || ''
	// const expectedUriEnd =
	// 	window.devicePixelRatio === 1 && window.navigator.userAgent.includes('Electron')
	// 		? `VXLf89aL9WK9WC/DBawX62X4bDm168v/A9duR9df7eS8AAAAAElFTkSuQmCC`
	// 		: window.devicePixelRatio === 1
	// 		? `IyHnD+cP5w/nj/4CjhfHS/9qObXnl/8PkgA61yIPYtsAAAAASUVORK5CYII=`
	// 		: window.navigator.userAgent?.includes(`Electron`) // headless test
	// 		? `PgFeeOlp0S+88MJLnwAvvPS06Je9vfwCG6yWyx1uowQAAAAASUVORK5CYII=` // retina screen, headless
	// 		: `8NLTol944YWXPgFeeOlp0S+88HK+lx/PjoLLYOCCJQAAAABJRU5ErkJggg==` // retina screen
	//
	// test.equal(dataUriEnd, expectedUriEnd, `should rerender with the expected dataURI after a dendrogram click`)

	test.deepEqual(
		hc.clickedClusterIds,
		[
			46, 54, 37, 28, 27, 51, 53, 44, 49, 25, 34, 11, 20, 41, 45, 29, 33, 17, 15, 2, 38, 42, 30, 36, 22, 9, 14, 3, 4,
			31, 13, 26, 1, 16, 8, 10, 5, 6, 7, 23, 47, 48, 35, 43, 21, 32, 18, 24, 56
		],
		`should give the expected clickedClusterIds`
	)

	test.deepEqual(
		['Zoom in', 'List 50 samples'],
		[...hc.dom.dendroClickMenu.d.node().querySelectorAll('.sja_menuoption')].map(elem => elem.__data__.label),
		'should show the expected menu options on dendrogram click'
	)

	hc.dom.dendroClickMenu.d.node().querySelector('.sja_menuoption').parentNode.lastChild.click()
	await sleep(5)
	test.equal(
		hc.dom.dendroClickMenu.d.node().querySelectorAll('.sjpp_row_wrapper').length,
		50,
		'should list the expected number of samples'
	)
	if (test._ok) {
		hc.dom.dendroClickMenu.clear().hide()
		app.destroy()
	}
})

tape('numericDictTerm', async function (test) {
	// leave it here in case it's used later: bins:{ default:{"type": "regular-bin", "startinclusive": true, "bin_size": 0.1, "first_bin": { "stop": 0.1 }, "last_bin": { "start": 0.7 }} }
	const terms = [
		{
			id: 'aaclassic_5', // tw.id must be provided
			term: { id: 'aaclassic_5', name: 'a1', type: 'float' }, // requires {id,name,type}; term.name doesn't need to be real, unique name works
			q: { mode: 'continuous' } // set to continuous to avoid validating tw.term.bins
		},
		{ id: 'hrtavg', term: { id: 'hrtavg', name: 'a2', type: 'float' }, q: { mode: 'continuous' } },
		{ id: 'agedx', term: { id: 'agedx', name: 'a3', type: 'float' }, q: { mode: 'continuous' } }
	]
	const { app, hc } = await getHierClusterApp({ terms, dataType: NUMERIC_DICTIONARY_TERM })
	test.equal(hc.dom.termLabelG.selectAll('.sjpp-matrix-label').size(), 3, 'should render 3 rows')
	if (test._ok) app.destroy()
	test.end()
})

/*************************
 reusable helper functions
**************************/

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
					dataType: _opts.dataType || TermTypes.GENE_EXPRESSION,
					settings: {
						hierCluster: {
							termGroupName: 'Gene Expression (CGC genes only)'
						},
						matrix: {
							// the matrix autocomputes the colw based on available screen width,
							// need to set an exact screen width for consistent tests using getBBox()
							availContentWidth: 1200
						}
					},
					// force empty termgroups, genes since the instance requestData() will not have expression data,
					// and will cause a non-trival error if using the actual requestData(), which will be mocked below
					termgroups: [], // _opts.termgroups || [],
					// !!! there will be an initial load error since this is an empty geneset,
					// !!! but will be ignored since it's not relevant to this test
					terms: _opts.terms || [],
					localFilter: _opts.localFilter
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
	holder.select('.sja_errorbar').node()?.lastChild?.click()
	const hc = Object.values(app.Inner.components.plots).find(
		p => p.type == 'hierCluster' || p.chartType == 'hierCluster'
	).Inner
	return { app, hc }
}
function getGenes() {
	// return a copy for each test, to avoid unexpected changes in reusing scoped variables
	return [
		{ gene: 'AKT1', type: 'geneExpression' },
		{ gene: 'TP53', type: 'geneExpression' },
		{ gene: 'BCR', type: 'geneExpression' },
		{ gene: 'KRAS', type: 'geneExpression' }
	]
}

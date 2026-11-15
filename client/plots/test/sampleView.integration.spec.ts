import * as helpers from '../../test/front.helpers.js'
import tape from 'tape'
import { detectOne, detectLst, detectZero, detectGte } from '../../test/test.helpers.js'

/**
 Tests:
    - No .samples[]
    - Multiple samples
    - Single .sample{}
    - Whole slide images
 */

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38-test',
		nav: { header_mode: 'hidden' }
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sampleView -***-')
	test.end()
})

tape('No .samples[]', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleView'
				}
			]
		},
		sampleView: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(sampleView) {
		const sv = sampleView.Inner

		const findDownloadButton = sv.dom.downloadbt.node()
		test.true(
			findDownloadButton.disabled == false && findDownloadButton.type == 'submit',
			`Should render download button.`
		)

		// TermdbTest enables disco and the methylation array plot
		const tiles = sv.dom.plotsDiv.select('[data-testid="sjpp-sampleview-tiles"]')
		for (const key of ['dictionary', 'disco', 'ssgq:MethylationArray']) {
			test.equal(
				tiles.selectAll(`[data-testid="sjpp-sampleview-tile-${key}"]`).size(),
				1,
				`Should render the ${key} tile.`
			)
		}

		if (test['_ok']) sv.app.destroy()
		test.end()
	}
})

tape('Multiple samples', function (test) {
	// expanding the scatter tile renders a full scatter plot
	test.timeoutAfter(20000)

	const samples = [
		{ sampleId: 96, sampleName: '3416' },
		{ sampleId: 41, sampleName: '2646' }
	]

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleView',
					samples
				}
			]
		},
		sampleView: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(sampleView) {
		// run once: switching samples or expanding a tile rerenders
		sampleView.on('postRender.test', null)
		const sv = sampleView.Inner

		const buttons = sv.dom.switcherDiv.selectAll('button').nodes()
		test.deepEqual(
			buttons.map(b => b.textContent),
			samples.map(s => s.sampleName),
			'Should render a switcher button per sample.'
		)
		test.equal(sv.activeSample.sampleName, '3416', 'Should show the first sample by default.')

		// both samples are in the prebuilt TermdbTest TSNE: its tile face shows the plot's dots
		const dots = await detectLst({
			elem: sv.dom.plotsDiv.node(),
			selector: '[data-testid="sjpp-sampleview-tile-scatter:TermdbTest TSNE"] svg circle',
			matchAs: '>='
		})
		test.ok(dots.length > 2, 'Should draw the dots of the plot on the scatter tile.')
		const scatterTile = sv.dom.plotsDiv.select('[data-testid="sjpp-sampleview-tile-scatter:TermdbTest TSNE"]')

		// the expanded scatter rings the highlighted samples in a layer that ignores the mouse, with its tools
		// on the left of the chart as in a standalone scatter
		const scatterSelector = '[data-testid="sjpp-sampleview-tile-scatter:TermdbTest TSNE"]'
		scatterTile.select('[aria-label="Expand TermdbTest TSNE"]').node().click()
		// expanding rerenders the tile grid, so the tile is selected again
		const rings = await detectLst({
			elem: sv.dom.plotsDiv.node(),
			selector: `${scatterSelector} [data-testid="sjpp-scatter-highlight"]`,
			count: 2
		})
		test.equal(rings.length, 2, 'Should ring both samples on the expanded scatter.')
		test.equal(
			getComputedStyle(rings[0].parentNode).pointerEvents,
			'none',
			'Should draw the rings in a layer that ignores the mouse.'
		)
		const expandedTile = sv.dom.plotsDiv.select(scatterSelector)
		const [toolsDiv, chartDiv] = expandedTile.select('[data-testid="sjpp-scatter-holder"]').node().firstChild.children
		test.equal(
			toolsDiv.getBoundingClientRect().top,
			chartDiv.getBoundingClientRect().top,
			'Should place the scatter tools beside the chart, not above it.'
		)
		expandedTile.select('[aria-label="Collapse TermdbTest TSNE"]').node().click()

		// 3416 has no single-cell data or slides in TermdbTest
		const scTile = await detectZero({
			elem: sv.dom.plotsDiv.node(),
			selector: '[data-testid="sjpp-sampleview-tile-singleCell"]'
		})
		test.notOk(scTile, 'Should leave out the single-cell tile for 3416.')
		const wsiTile = await detectZero({
			elem: sv.dom.plotsDiv.node(),
			selector: '[data-testid="sjpp-sampleview-tile-wsi"]'
		})
		test.notOk(wsiTile, 'Should leave out the whole slide images tile for 3416, which has no slide.')

		// the disco tile face is the disco plot of 3416, which has mutation data, cropped to its ring
		const discoFace = await detectOne({
			elem: sv.dom.plotsDiv.node(),
			selector: '[data-testid="sjpp-sampleview-tile-disco"] svg[data-testid="sjpp_disco_plot"][viewBox]'
		})
		test.equal(discoFace.getAttribute('width'), '172', 'Should fit the disco plot of 3416 to the face.')
		test.equal(getComputedStyle(discoFace).pointerEvents, 'none', 'Should not handle the mouse on the disco face.')
		const discoToggle = sv.dom.plotsDiv
			.select('[data-testid="sjpp-sampleview-tile-disco"] [aria-label="Expand Disco plot"]')
			.node()

		// expanding draws the full disco plot from the loaded data; one tile is expanded at a time
		discoToggle.click()
		test.equal(discoToggle.getAttribute('aria-expanded'), 'true', 'Should expand the disco tile.')
		const disco = await detectOne({
			elem: sv.dom.plotsDiv.node(),
			selector: '[data-testid="sjpp-sampleview-tile-disco"] [data-testid="sjpp-disco-svgDiv"]'
		})
		test.ok(disco, 'Should render the full disco plot of 3416 in the expanded tile.')
		const dictToggle = sv.dom.plotsDiv.select('[aria-label="Expand Dictionary"]').node()
		dictToggle.click()
		test.equal(dictToggle.getAttribute('aria-expanded'), 'true', 'Should expand the dictionary tile.')
		test.equal(discoToggle.getAttribute('aria-expanded'), 'false', 'Should collapse the disco tile.')
		dictToggle.click()

		// 3416 has two tracks in the TermdbTest track table: the face lists them, and expanding opens the
		// genome browser as from the charts, with a hidden local filter of 3416
		const trackSelector = '[data-testid="sjpp-sampleview-tile-genomeBrowser"]'
		const trackToggle = await detectOne({
			elem: sv.dom.plotsDiv.node(),
			selector: `${trackSelector} [aria-label="Expand Genome browser"]`
		})
		const trackFace = sv.dom.plotsDiv.select(trackSelector).text()
		test.ok(trackFace.includes('bw 1') && trackFace.includes('bed 1'), 'Should list the tracks of 3416 on the face.')
		trackToggle.click()
		// the gene search box, among other inputs such as the sample type checkboxes
		const searchInput = await detectOne({
			elem: sv.dom.plotsDiv.node(),
			selector: `${trackSelector} [data-testid="sja_genesearchinput"]`
		})
		test.ok(searchInput, 'Should open the genome browser on its search box, as from the charts.')
		test.equal(
			sv.dom.plotsDiv.selectAll(`${trackSelector} .sjpp_filter_div`).size(),
			0,
			'Should not show the local filter of the genome browser.'
		)
		const gb = sv.getChildConfigs().find(p => p.childKey == 'genomeBrowser:3416')
		const values: any = Object.values(gb?.filter.lst[0].tvs.term.values || {})[0]
		test.deepEqual(
			values?.list.map(v => v.sampleId),
			[samples[0].sampleId],
			'Should filter the genome browser to 3416.'
		)
		sv.dom.plotsDiv.select(`${trackSelector} [aria-label="Collapse Genome browser"]`).node().click()

		// switching to 2646, which has no mutation or methylation array data or tracks, leaves out those tiles
		buttons[1].click()
		for (const key of ['disco', 'ssgq:MethylationArray', 'genomeBrowser']) {
			const tile = await detectZero({
				elem: sv.dom.plotsDiv.node(),
				selector: `[data-testid="sjpp-sampleview-tile-${key}"]`
			})
			test.notOk(tile, `Should leave out the ${key} tile for 2646.`)
		}
		test.equal(sv.activeSample.sampleName, '2646', 'Should switch to 2646.')
		test.equal(
			sv.dom.plotsDiv.selectAll('[data-testid="sjpp-sampleview-tile-scatter:TermdbTest TSNE"]').size(),
			1,
			'Should keep the scatter tile, which has 2646.'
		)
		if (test['_ok']) sv.app.destroy()
		test.end()
	}
})

tape('Single .sample{}', function (test) {
	test.timeoutAfter(20000)

	// A single pre-chosen sample, as dispatched by the mass omnisearch's "Sample View" button and by a
	// scatter point click. Its data renders without any typing; the search box shows the sample name so
	// it does not read as "type a sample name to see details".
	const sample = { sampleId: 41, sampleName: '2646' }

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleView',
					sample
				}
			]
		},
		sampleView: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(sampleView) {
		// run once: switching samples or expanding a tile rerenders
		sampleView.on('postRender.test', null)
		const sv = sampleView.Inner

		const input = sv.dom.sampleDiv.select('input').node()
		test.equal(input?.value, sample.sampleName, `Should prefill the search box with ${sample.sampleName}.`)

		test.equal(sv.activeSample?.sampleName, sample.sampleName, `Should show the tiles of ${sample.sampleName}.`)

		// 2646 has single-cell data in TermdbTest: expanding opens the single-cell app on 2646, fixed to it
		const scSelector = '[data-testid="sjpp-sampleview-tile-singleCell"]'
		const scToggle = await detectOne({
			elem: sv.dom.plotsDiv.node(),
			selector: `${scSelector} [aria-label="Expand Single cell"]`
		})
		scToggle.click()
		const plotBtns = await detectGte({
			elem: sv.dom.plotsDiv.node(),
			selector: `${scSelector} [data-testid^="sjpp-sc-plot-btn-"]`,
			count: 1
		})
		test.ok(plotBtns.length, 'Should open the single-cell app with the plot buttons of 2646.')
		// a plot button opens the plot in the app: the app's own child plot, two levels below sample view
		plotBtns[0].click()
		const sandbox = await detectOne({
			elem: sv.dom.plotsDiv.node(),
			selector: `${scSelector} [data-testid^="sjpp-sc-sandbox-"]`
		})
		test.ok(sandbox, 'Should open the plot of a plot button in the single-cell app.')
		const sc = sv.getChildConfigs().find(p => p.childKey == 'sc:2646')
		test.deepEqual(sc?.settings.sc.item, { sID: '2646' }, 'Should open the single-cell app on 2646.')
		test.equal(
			sv.dom.plotsDiv.selectAll(`${scSelector} [data-testid="sjpp-sc-item-table-select-btn"]`).size(),
			0,
			'Should not show the sample select button of the single-cell app.'
		)
		test.equal(
			(sv.dom.plotsDiv.select(`${scSelector} #sjpp-sc-item-table`).node() as HTMLElement)?.style.display,
			'none',
			'Should hide the sample table of the single-cell app.'
		)
		const scValues: any = Object.values(sc?.filter.lst[0].tvs.term.values || {})[0]
		test.deepEqual(
			scValues?.list.map(v => v.sampleId),
			[sample.sampleId],
			'Should filter the single-cell app to 2646.'
		)
		test.equal(
			sv.dom.plotsDiv.selectAll(`${scSelector} .sjpp_filter_div`).size(),
			0,
			'Should not show the local filter of the single-cell app.'
		)
		// collapsing rerenders the grid, so the dictionary tile is selected after it
		sv.dom.plotsDiv.select(`${scSelector} [aria-label="Collapse Single cell"]`).node().click()

		// the expanded dictionary tile shows the sample's values in the term tree
		const dictToggle = await detectOne({
			elem: sv.dom.plotsDiv.node(),
			selector: '[data-testid="sjpp-sampleview-tile-dictionary"] [aria-label="Expand Dictionary"]'
		})
		dictToggle.click()
		const table = await detectOne({
			elem: sv.dom.plotsDiv.node(),
			selector: '[data-testid="sjpp-sampleview-dictionary"]'
		})
		const findSample = [...table.querySelectorAll('th')].some(n => n.textContent === sample.sampleName)
		test.ok(findSample, `Should render ${sample.sampleName} data without typing in the search box.`)

		if (test['_ok']) sv.app.destroy()
		test.end()
	}
})

tape('Whole slide images', function (test) {
	test.timeoutAfter(20000)

	// 2660 has one plain slide in TermdbTest
	const sample = { sampleId: 42, sampleName: '2660' }

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleView',
					sample
				}
			]
		},
		sampleView: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(sampleView) {
		// run once: expanding a tile rerenders
		sampleView.on('postRender.test', null)
		const sv = sampleView.Inner
		const wsiSelector = '[data-testid="sjpp-sampleview-tile-wsi"]'

		// the face is the thumbnail of the slide, served as an image
		const img: any = await detectOne({
			elem: sv.dom.plotsDiv.node(),
			selector: `${wsiSelector} [data-testid="sjpp-sampleview-wsi-thumbnail"]`
		})
		test.ok(img?.getAttribute('src').includes('wsitiles/tile/0/0/0'), 'Should show the thumbnail of the slide of 2660.')

		// expanding opens the slide viewer fixed to 2660, on its plain slides
		sv.dom.plotsDiv.select(`${wsiSelector} [aria-label="Expand Whole slide images"]`).node().click()
		const viewer = await detectOne({ elem: sv.dom.plotsDiv.node(), selector: `${wsiSelector} .ol-viewport` })
		test.ok(viewer, 'Should open the slide viewer in the expanded tile.')
		const wsi = sv.getChildConfigs().find(p => p.childKey == 'wsi:2660')
		test.deepEqual(
			[wsi?.sample, wsi?.imageType],
			[{ sID: '2660' }, 'wsi'],
			'Should fix the slide viewer to the plain slides of 2660.'
		)

		if (test['_ok']) sv.app.destroy()
		test.end()
	}
})

// TODO: create a test to not allow admin session recovery by public or user
tape.skip('', function (test) {
	// const runpp = helpers.getRunPp('mass', {
	// 	state: {
	// 		dslabel: 'ProtectedTest',
	// 		genome: 'hg38-test',
	// 		nav: { header_mode: 'hidden' }
	// 	},
	// 	debug: 1
	// })
	test.end()
})

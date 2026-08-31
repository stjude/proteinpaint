import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/* Tests
    spatial OME-TIFF image renders the map with overlays and the burger menu
    plain SVS image renders the map without the spatial machinery

Both run the mass wsi plot against the TermdbTest fixture:
    sample 2660         image1/CMU-1-Small-Region.svs (ds.queries.w2.wsiFolder)
    sample TCGA-22-1017 image1/image1_morphology.ome.tif + image1_spatial.h5ad
                        (ds.queries.w2.folder; 791 cells, 5 cell types)
The spatial settings below pin every value main() would otherwise seed or
reconcile (genes, overlay toggles, annotation level), so each test renders
exactly once and postRender fires with the finished viewer.
*/

/** Poll for a selector under `root` — the OL canvas may already exist when
 postRender fires (a MutationObserver armed then would never see it) or appear
 on the next animation frame, so polling covers both. */
async function waitForSelector(root: Element, selector: string, ms = 15000) {
	const t0 = Date.now()
	while (Date.now() - t0 < ms) {
		const found = root.querySelectorAll(selector)
		if (found.length) return found
		await new Promise(r => setTimeout(r, 100))
	}
	throw new Error(`'${selector}' did not render within ${ms}ms`)
}

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: { header_mode: 'hidden' },
		dslabel: 'TermdbTest',
		genome: 'hg38-test'
	},
	debug: 1
})

tape('\n', test => {
	test.comment('-***- plots/w2/wsi -***-')
	test.end()
})

tape('spatial OME-TIFF image renders the map with overlays and the burger menu', test => {
	test.timeoutAfter(30000) // meta/tiles/boundaries spawn python server-side

	runpp({
		state: {
			plots: [
				{
					chartType: 'wsi',
					settings: {
						wsi: {
							selectedSampleIndex: 1, // samples sort as ['2660', 'TCGA-22-1017']
							// preset '' skips the one-time seeding dispatch; the fixture's
							// spatial h5ad carries no expression (sc expression lives in
							// scrna/geneExpHdf5), so no genes are requested
							geneExpression: '',
							showCellTypes: true, // cell-type fills + legend on
							showGeneExpression: false, // fills are mutually exclusive with cell types
							annotationLevel: 0 // strokes/tooltip at every zoom
						}
					}
				}
			]
		},
		wsi: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(wsi) {
		wsi.on('postRender.test', null) // run once
		try {
			const dom = wsi.Inner.dom

			// the sample table renders selectable samples (how many is server
			// data, covered by unit tests — only the structure is asserted here)
			test.ok(dom.table.selectAll('input[type=radio]').size() >= 1, 'sample table renders selectable samples')

			// the spatial burger menu is shown for a spatial image
			test.notEqual(dom.controls.style('display'), 'none', 'burger menu is shown')

			// the OL map rendered the slide (canvas appears on the first render frame)
			const canvases = await waitForSelector(dom.viewer.node(), '.ol-viewport canvas')
			test.ok(canvases.length >= 1, 'OpenLayers canvas rendered for the tiff slide')

			// the cell-type overlay legend, fed by the h5ad through the mass
			// path. Which types and counts appear is server data (unit-tested);
			// here only the structure: a titled legend with count-suffixed rows
			const [legend] = await waitForSelector(dom.viewer.node(), 'div[data-testid="sjpp-wsi-typelegend"]')
			test.equal(legend.firstChild?.textContent, 'Cell type', 'legend is titled Cell type')
			const rows = [...legend.children].slice(1).map((r: any) => r.textContent)
			test.ok(rows.length >= 1, 'legend lists at least one cell type')
			test.ok(
				rows.every(r => / \(\d+\)$/.test(r)),
				'every legend row ends with a cell count'
			)

			// the hover tooltip element is armed (hidden until a cell is hovered)
			const tooltips = await waitForSelector(dom.viewer.node(), 'div[data-testid="sjpp-wsi-tooltip"]')
			test.equal(tooltips.length, 1, 'hover tooltip is armed')
		} catch (e) {
			test.fail(`spatial viewer test error: ${e}`) // never leave tape hanging
		}
		test.end()
	}
})

tape('plain SVS image renders the map without the spatial machinery', test => {
	test.timeoutAfter(30000) // first tiles may spawn python server-side

	runpp({
		state: {
			plots: [
				{
					chartType: 'wsi',
					settings: { wsi: { selectedSampleIndex: 0 } } // sample 2660, the plain .svs
				}
			]
		},
		wsi: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(wsi) {
		wsi.on('postRender.test', null) // run once
		try {
			const dom = wsi.Inner.dom

			// the OL map rendered the slide
			const canvases = await waitForSelector(dom.viewer.node(), '.ol-viewport canvas')
			test.ok(canvases.length >= 1, 'OpenLayers canvas rendered for the svs slide')

			// none of the spatial machinery exists for a plain slide
			test.equal(dom.controls.style('display'), 'none', 'burger menu is hidden')
			test.equal(dom.viewer.selectAll('div[data-testid="sjpp-wsi-typelegend"]').size(), 0, 'no cell-type legend')
			test.equal(dom.viewer.selectAll('div[data-testid="sjpp-wsi-tooltip"]').size(), 0, 'no hover tooltip')
		} catch (e) {
			test.fail(`svs viewer test error: ${e}`) // never leave tape hanging
		}
		test.end()
	}
})

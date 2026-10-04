import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/* Tests
    spatial OME-TIFF image renders the map with overlays and the burger menu
    plain SVS image renders the map without the spatial machinery
    fixed-sample plain-WSI mode renders the pinned sample without the spatial machinery

Both run the mass wsi plot against the TermdbTest fixture:
    sample 2660         image1/CMU-1-Small-Region.svs (ds.queries.w2.wsiFolder)
    sample TCGA-22-1017 image1/image1_morphology.ome.tif + image1_spatial.h5ad
                        (ds.queries.w2.folder; 791 cells, 5 cell types)
Spatial images are only reachable in fixed-sample mode (config.sample, the
sc app's Spatial button path); the standalone plot lists plain slides only.
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

/** Poll until `cond()` is truthy, or fail — used below to confirm the
 loading indicator (wsi.direct.ts's showLoading/hideLoading) settles back to
 hidden instead of getting stuck visible once a mode's own data has arrived. */
async function waitForCondition(cond: () => boolean, message: string, ms = 15000) {
	const t0 = Date.now()
	while (Date.now() - t0 < ms) {
		if (cond()) return
		await new Promise(r => setTimeout(r, 100))
	}
	throw new Error(`${message} did not become true within ${ms}ms`)
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
					sample: { sID: 'TCGA-22-1017' }, // fixed-sample mode, the sc app's Spatial path
					settings: {
						wsi: {
							geneExpression: 'PTPRC', // preset: skips the one-time seeding dispatch
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

			// fixed-sample mode: the sample is already chosen, no picker table
			test.equal(dom.table.style('display'), 'none', 'sample table is hidden in fixed-sample mode')

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
			if (test['_ok']) wsi.Inner.app.destroy()
		} catch (e) {
			test.fail(`spatial viewer test error: ${e}`) // never leave tape hanging
		}
		test.end()
	}
})

tape('scale bar is torn down on re-render, not leaked as a stray fixed element', test => {
	test.timeoutAfter(30000) // meta/tiles spawn python server-side

	runpp({
		state: {
			plots: [
				{
					chartType: 'wsi',
					sample: { sID: 'TCGA-22-1017' },
					settings: { wsi: { annotationLevel: 0 } }
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
			await waitForSelector(dom.viewer.node(), '.ol-viewport canvas')

			const [bar] = await waitForSelector(document.body, '.sjpp-wsi-scalebar')
			test.equal(
				document.querySelectorAll('.sjpp-wsi-scalebar').length,
				1,
				'exactly one scale bar after the first render'
			)
			// owned by the map's own target (removed along with it on
			// re-render), not appended straight to document.body
			test.ok(dom.viewer.node().contains(bar), "scale bar's DOM parent is inside the viewer, not document.body")

			// a settings change re-runs View.ts's renderViewer(), which clears
			// and rebuilds the map -- the OLD scale bar + its window-level
			// scroll/resize listeners must not survive this
			await wsi.Inner.app.dispatch({
				type: 'plot_edit',
				id: wsi.Inner.id,
				config: { settings: { wsi: { annotationLevel: 1 } } }
			})
			await waitForSelector(dom.viewer.node(), '.ol-viewport canvas')
			await waitForSelector(document.body, '.sjpp-wsi-scalebar')
			test.equal(
				document.querySelectorAll('.sjpp-wsi-scalebar').length,
				1,
				'still exactly one scale bar after a re-render -- the old one was torn down, not leaked'
			)

			if (test['_ok']) wsi.Inner.app.destroy()
		} catch (e) {
			test.fail(`scale bar teardown test error: ${e}`) // never leave tape hanging
		}
		test.end()
	}
})

tape('raster mode: a cellCountLimit below the fixture cell count renders the raster overlay, not vector', test => {
	test.timeoutAfter(30000) // meta/cellcount/overlaytile spawn python server-side

	runpp({
		state: {
			plots: [
				{
					chartType: 'wsi',
					sample: { sID: 'TCGA-22-1017' }, // fixed-sample mode; this image has 791 cells
					settings: {
						wsi: {
							geneExpression: 'PTPRC',
							showCellTypes: true, // cell-type fills: the raster overlay's only mode (wsi.direct.ts)
							showGeneExpression: false,
							annotationLevel: 0,
							cellCountLimit: 20 // far below the fixture's 791 cells: forces raster mode
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

			const canvases = await waitForSelector(dom.viewer.node(), '.ol-viewport canvas')
			test.ok(canvases.length >= 1, 'OpenLayers canvas rendered for the tiff slide')

			// raster mode's own legend (no per-cell counts — see wsi.direct.ts)
			const [legend] = await waitForSelector(dom.viewer.node(), 'div[data-testid="sjpp-wsi-raster-typelegend"]')
			test.equal(legend.firstChild?.textContent, 'Cell type', 'raster legend is titled Cell type')
			const rows = [...legend.children].slice(1).map((r: any) => r.textContent)
			test.ok(rows.length >= 1, 'raster legend lists at least one cell type')
			test.ok(
				rows.every(r => !/\(\d+\)$/.test(r)),
				'raster legend rows carry no per-cell count, unlike vector mode'
			)

			// vector mode's own legend must NOT be showing at the same time
			test.equal(
				dom.viewer.selectAll('div[data-testid="sjpp-wsi-typelegend"]').size(),
				0,
				'vector mode legend absent while in raster mode'
			)

			// the lasso is disabled in raster mode (too many cells in view for a
			// selection/enrichment flow to stay cheap — see setLassoEnabled)
			const [lassoBtn] = await waitForSelector(dom.viewer.node(), '[data-testid="sjpp-wsi-lasso-btn"] button')
			test.equal((lassoBtn as HTMLElement).style.cursor, 'not-allowed', 'lasso button shows as disabled')

			// the disabled button's own aria-label tooltip (client/src/style.css's
			// [aria-label]:hover:after, z-index:10000 -- but that's scoped to its
			// own stacking context) must still win against the cell-type legend's
			// position:fixed z-index:10, or the tooltip explaining WHY it's
			// disabled is unreadable underneath the legend
			const [lassoCtl] = await waitForSelector(dom.viewer.node(), '[data-testid="sjpp-wsi-lasso-btn"]')
			test.ok(
				Number(getComputedStyle(lassoCtl as HTMLElement).zIndex) > 10,
				'lasso control z-index beats the cell-type legend, so its tooltip is not hidden underneath it'
			)

			// the loading indicator (shown while /cellcount + the raster tiles'
			// own render latency are in flight) must settle back to hidden once
			// the overlay tiles actually load, not get stuck visible
			const [loading] = await waitForSelector(dom.viewer.node(), 'div[data-testid="sjpp-wsi-loading"]')
			await waitForCondition(
				() => (loading as HTMLElement).style.display == 'none',
				'loading indicator hidden once the raster tiles finish'
			)
			test.pass('loading indicator settled back to hidden, not stuck visible')

			if (test['_ok']) wsi.Inner.app.destroy()
		} catch (e) {
			test.fail(`raster mode test error: ${e}`) // never leave tape hanging
		}
		test.end()
	}
})

tape('raster mode: gene expression renders instead of cell types when showCellTypes is off', test => {
	test.timeoutAfter(30000) // meta/cellcount/overlaytile spawn python server-side

	runpp({
		state: {
			plots: [
				{
					chartType: 'wsi',
					sample: { sID: 'TCGA-22-1017' }, // fixed-sample mode; this image has 791 cells
					settings: {
						wsi: {
							geneExpression: 'PTPRC',
							showCellTypes: false, // off: the raster overlay falls back to gene expression
							showGeneExpression: true,
							annotationLevel: 0,
							cellCountLimit: 20 // far below the fixture's 791 cells: forces raster mode
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

			const canvases = await waitForSelector(dom.viewer.node(), '.ol-viewport canvas')
			test.ok(canvases.length >= 1, 'OpenLayers canvas rendered for the tiff slide')

			// raster mode's own gene legend (gradient rows, not type swatches)
			const [legend] = await waitForSelector(dom.viewer.node(), 'div[data-testid="sjpp-wsi-raster-genelegend"]')
			const rows = [...legend.children].map((r: any) => r.textContent)
			test.ok(
				rows.some(r => r.includes('PTPRC')),
				'raster gene legend names the requested gene'
			)

			// neither the type-fill raster legend nor vector mode's own legend
			// should be showing while the raster overlay is in gene-expression mode
			test.equal(
				dom.viewer.selectAll('div[data-testid="sjpp-wsi-raster-typelegend"]').size(),
				0,
				'raster type legend absent while raster is in gene-expression mode'
			)
			test.equal(
				dom.viewer.selectAll('div[data-testid="sjpp-wsi-typelegend"]').size(),
				0,
				'vector mode legend absent while in raster mode'
			)

			if (test['_ok']) wsi.Inner.app.destroy()
		} catch (e) {
			test.fail(`raster gene-expression test error: ${e}`) // never leave tape hanging
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
			if (test['_ok']) wsi.Inner.app.destroy()
		} catch (e) {
			test.fail(`svs viewer test error: ${e}`) // never leave tape hanging
		}
		test.end()
	}
})

tape('fixed-sample plain-WSI mode renders the pinned sample without the spatial machinery', test => {
	test.timeoutAfter(30000) // first tiles may spawn python server-side

	// the omnisearch "Whole Slide Images" action's config: sample pinned,
	// imageType 'wsi'. Would regress to spatial if imageType were dropped —
	// 2660 has NO spatial image, so this render only succeeds on the plain path
	runpp({
		state: {
			plots: [
				{
					chartType: 'wsi',
					sample: { sID: '2660' },
					imageType: 'wsi'
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

			// fixed-sample mode: the sample is already chosen, no picker table
			test.equal(dom.table.style('display'), 'none', 'sample table is hidden in fixed-sample mode')

			// the OL map rendered the pinned sample's plain slide; an imageType
			// regression would instead show the "No spatial image" error, no canvas
			const canvases = await waitForSelector(dom.viewer.node(), '.ol-viewport canvas')
			test.ok(canvases.length >= 1, 'OpenLayers canvas rendered for the pinned plain slide')
			test.equal(dom.error.text(), '', 'no error banner')

			// plain mode: none of the spatial machinery
			test.equal(dom.controls.style('display'), 'none', 'burger menu is hidden')
			test.equal(dom.viewer.selectAll('div[data-testid="sjpp-wsi-typelegend"]').size(), 0, 'no cell-type legend')
			if (test['_ok']) wsi.Inner.app.destroy()
		} catch (e) {
			test.fail(`fixed-sample plain viewer test error: ${e}`) // never leave tape hanging
		}
		test.end()
	}
})

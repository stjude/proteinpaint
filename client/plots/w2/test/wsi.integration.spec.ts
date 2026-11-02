import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
import { clearServerDataCache } from '../../../common/dofetch.js'

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

tape('scale bar keeps its corner anchored (right/bottom) when zooming changes its own width', test => {
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

			// right/bottom, not left/top: a widening bar (update()'s own
			// bar.style.width, picked fresh per zoom level) must grow away
			// from its anchored corner, not push that corner off the map
			const cs = getComputedStyle(bar as HTMLElement)
			test.ok(
				cs.right !== 'auto',
				'positioned with right, not left, so its own width changes keep the right edge fixed'
			)
			test.ok(
				cs.bottom !== 'auto',
				'positioned with bottom, not top, so its own height changes keep the bottom edge fixed'
			)

			const rectBefore = (bar as HTMLElement).getBoundingClientRect()
			const labelBefore = bar.querySelector('div:last-child')?.textContent

			// a few zoom-in clicks: the resolution change runs update(), which
			// picks a new "nice" µm length -- almost certainly a different bar
			// width than the initial one
			const zoomIn = await waitForSelector(dom.viewer.node(), '.ol-zoom-in')
			for (let i = 0; i < 4; i++) (zoomIn[0] as HTMLElement).click()
			await waitForCondition(
				() => bar.querySelector('div:last-child')?.textContent !== labelBefore,
				'scale bar label changes after zooming (confirms update() actually ran)'
			)

			const rectAfter = (bar as HTMLElement).getBoundingClientRect()
			test.ok(
				Math.abs(rectAfter.right - rectBefore.right) < 1,
				`right edge stays put despite the width change (before=${rectBefore.right}, after=${rectAfter.right})`
			)
			test.ok(
				Math.abs(rectAfter.bottom - rectBefore.bottom) < 1,
				`bottom edge stays put despite the height change (before=${rectBefore.bottom}, after=${rectAfter.bottom})`
			)

			if (test['_ok']) wsi.Inner.app.destroy()
		} catch (e) {
			test.fail(`scale bar corner-anchoring test error: ${e}`) // never leave tape hanging
		}
		test.end()
	}
})

tape('scale bar repositions on a layout shift that fires neither scroll nor resize', test => {
	test.timeoutAfter(30000) // meta/tiles spawn python server-side

	runpp({
		state: {
			plots: [
				{
					chartType: 'wsi',
					sample: { sID: 'TCGA-22-1017' },
					// a short, explicit height: the default (much taller) viewerHeight
					// would already extend past the test window's own bottom edge, so
					// reposition()'s own clamp-to-viewport logic would keep the bar's
					// computed position identical before and after the shift below --
					// still correctly clamped, just not a useful signal for this test
					settings: { wsi: { annotationLevel: 0, viewerHeight: '200px' } }
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
			const rectBefore = (bar as HTMLElement).getBoundingClientRect()

			// body-level padding, not a sibling inserted next to the viewer: it
			// shifts normal document flow (the map included) regardless of
			// whatever flex/grid/absolute scheme the sandbox around it happens
			// to use, so this can't fail to move the map for layout reasons
			// unrelated to what's under test. Mimics the burger menu's settings
			// panel opening (controls.config.js toggles its own height/
			// visibility style) -- a plain style mutation above the map,
			// pushing it down WITHOUT firing scroll or resize, which is exactly
			// the case this test's layoutObserver exists for.
			const sanityRectBefore = dom.viewer.node().getBoundingClientRect()
			document.body.style.paddingTop = '200px'
			await waitForCondition(
				() => dom.viewer.node().getBoundingClientRect().top - sanityRectBefore.top > 50,
				'sanity check: the injected style mutation actually shifted the map down'
			)

			await waitForCondition(
				() => (bar as HTMLElement).getBoundingClientRect().top - rectBefore.top > 50,
				'scale bar follows the map down after a pure style mutation, with no scroll/resize event'
			)
			test.pass('scale bar repositioned without any scroll/resize event firing')

			if (test['_ok']) wsi.Inner.app.destroy()
		} catch (e) {
			test.fail(`scale bar layout-shift test error: ${e}`) // never leave tape hanging
		} finally {
			document.body.style.paddingTop = '' // never leave the page's own layout mutated on failure either
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

tape('fit moveend suppressed during initial build; subsequent zoom still triggers updateMode', test => {
	test.timeoutAfter(30000)

	// Instrument the page BEFORE the viewer initializes. The legend alone
	// cannot prove a build survived the fit's moveend: without the
	// suppression guard, that moveend cancels the build via a modeGeneration
	// bump and starts a replacement — firstBuild is already false, so the
	// replacement skips the fit, completes, and renders an identical legend.
	//
	// The probe: hold the annotations response open so the fit's moveend
	// deterministically lands while annotations are in flight, then count
	// what starts during that window:
	// - wsitiles/cellcount: every updateMode's first request — a new one
	//   after annotations began means the moveend spawned a replacement
	// - wsitiles/annotations: a second request IS the replacement build
	//
	// The wrapper stays DORMANT during the first render: the page's very
	// first layout of this plot fires extra legitimate moveends (OL's
	// initial-render moveend plus a container-resize one while the sandbox
	// settles), each of which lawfully restarts updateMode — counting there
	// is meaningless. The probe is armed for a SECOND, fresh viewer init
	// (via a settings dispatch) in the already-settled layout, where the
	// only moveend after the fit is the fit's own.
	const nativeFetch = window.fetch
	let armed = false
	let cellcountStarts = 0
	let annotationsStarts = 0
	let cellcountAtFirstAnnotations = -1
	const reqLog: string[] = [] // dumped only on failure
	window.fetch = function (...args: Parameters<typeof fetch>) {
		const url = String(args[0] instanceof Request ? args[0].url : args[0])
		if (!armed) return nativeFetch.apply(window, args)
		if (url.includes('wsitiles/')) {
			const bbox = (url.match(/bbox=([^&]*)/) || [])[1] || ''
			reqLog.push(`${Math.round(performance.now())}ms ${url.split('?')[0].split('wsitiles/')[1]} bbox=${bbox}`)
		}
		if (url.includes('wsitiles/cellcount')) cellcountStarts++
		if (url.includes('wsitiles/annotations')) {
			annotationsStarts++
			if (cellcountAtFirstAnnotations < 0) cellcountAtFirstAnnotations = cellcountStarts
			// 1500ms: far longer than the one or two frames the fit's moveend
			// needs to fire, far shorter than the test timeout
			return new Promise(r => setTimeout(r, 1500)).then(() => nativeFetch.apply(window, args))
		}
		return nativeFetch.apply(window, args)
	}

	runpp({
		state: {
			plots: [
				{
					chartType: 'wsi',
					sample: { sID: 'TCGA-22-1017' },
					settings: {
						wsi: {
							geneExpression: 'PTPRC',
							showCellTypes: true,
							showGeneExpression: false,
							annotationLevel: 0,
							// a height no other test uses: dofetch3's module-level cache
							// is shared by every spec bundled into this page, and another
							// test zooming the SAME plot at the SAME viewport size seeds
							// it with this test's exact cellcount/annotations URLs — a
							// cache hit skips fetch() entirely, bypassing the wrapper
							// above and the performance-timeline proof below.
							viewerHeight: '437px'
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
		wsi.on('postRender.test', null)
		try {
			const dom = wsi.Inner.dom

			// Phase 1: first render at 437px — just let the layout settle.
			await waitForSelector(dom.viewer.node(), '.ol-viewport canvas')
			const [legend] = await waitForSelector(dom.viewer.node(), 'div[data-testid="sjpp-wsi-typelegend"]')
			test.ok(legend, 'initial build completed')
			let [loading] = await waitForSelector(dom.viewer.node(), 'div[data-testid="sjpp-wsi-loading"]')
			await waitForCondition(
				() => (loading as HTMLElement).style.display === 'none',
				'loading settled after initial build'
			)

			// Phase 2: arm the probe and trigger a FRESH viewer init via a
			// settings change in the now-settled layout. The new height also
			// makes every URL unique (dofetch3's page-wide cache would
			// otherwise serve repeats without ever reaching the wrapper).
			// In this quiet init the surviving buildVector performs the fit
			// (any build cancelled by OL's initial-render moveend dies before
			// consuming firstBuild), so during the held-open annotations
			// window the fit's own moveend is the only possible event — the
			// guard must swallow it, leaving the request counts frozen.
			armed = true
			await wsi.Inner.app.dispatch({
				type: 'plot_edit',
				id: wsi.Inner.id,
				config: { settings: { wsi: { viewerHeight: '438px' } } }
			})
			await waitForCondition(
				() => !dom.viewer.node().contains(legend),
				'old viewer torn down by the settings re-render'
			)
			const [legend2] = await waitForSelector(dom.viewer.node(), 'div[data-testid="sjpp-wsi-typelegend"]')
			test.ok(legend2, 're-rendered build completed')

			// the regression assertions: with the guard, the fit's moveend is
			// swallowed, so NOTHING new starts while annotations are held open.
			// Without it, the moveend starts a replacement updateMode (a new
			// cellcount) whose buildVector re-fetches annotations.
			test.equal(annotationsStarts, 1, 'exactly one annotations request — the fit did not spawn a replacement build')
			test.equal(
				cellcountStarts,
				cellcountAtFirstAnnotations,
				'no updateMode started while annotations were in flight — the fit moveend was suppressed'
			)
			if (annotationsStarts !== 1 || cellcountStarts !== cellcountAtFirstAnnotations)
				test.comment(`armed-phase requests: ${JSON.stringify(reqLog)}`)

			// stop delaying before the navigation phase below
			armed = false
			window.fetch = nativeFetch
			;[loading] = await waitForSelector(dom.viewer.node(), 'div[data-testid="sjpp-wsi-loading"]')
			await waitForCondition(
				() => (loading as HTMLElement).style.display === 'none',
				'loading settled after the re-rendered build'
			)

			// The suppression must be one-shot: a later, user-driven moveend
			// has to reach updateMode. Every non-suppressed moveend fetches
			// wsitiles/cellcount for the new viewport (tiles never hit that
			// endpoint), so a fresh cellcount entry in the performance
			// resource timeline is unambiguous proof the event was handled.
			// (A full boundaries refetch can't be forced through the UI here:
			// the initial fetch covered the padded whole-slide bbox, and OL
			// clamps every reachable view inside it.)
			performance.setResourceTimingBufferSize(1000)
			performance.clearResourceTimings()
			const [zoomIn] = await waitForSelector(dom.viewer.node(), '.ol-zoom-in')
			;(zoomIn as HTMLElement).click()

			await waitForCondition(
				() => performance.getEntriesByType('resource').some(e => e.name.includes('wsitiles/cellcount')),
				'cellcount fetched for the zoomed viewport'
			)
			test.pass('zoom moveend reached updateMode — suppression was one-shot, navigation resumed')

			// and the viewer settles cleanly after that updateMode
			await waitForCondition(
				() => (loading as HTMLElement).style.display === 'none',
				'loading settled after the post-zoom updateMode'
			)
			test.equal(
				dom.viewer.node().querySelectorAll('div[data-testid="sjpp-wsi-typelegend"]').length,
				1,
				'type legend still present after the zoom'
			)

			if (test['_ok']) wsi.Inner.app.destroy()
		} catch (e) {
			test.fail(`fit moveend suppression test error: ${e}`)
		} finally {
			window.fetch = nativeFetch // never leave the delaying wrapper installed for later specs
		}
		test.end()
	}
})

tape('navigation during the initial build is not dropped; the build never leaves moveend suppressed', test => {
	test.timeoutAfter(30000)

	// Holds the first build's annotations open, then navigates while it is
	// still in flight (the user's drag overlapping the initial fit). That
	// moveend is real navigation, not the fit's own, so it must not be
	// swallowed: afterwards the viewer settles with its legend, and a LATER
	// user zoom still reaches updateMode (pendingFitExtent was cleared).
	const nativeFetch = window.fetch
	let armed = false
	let annotationsStarts = 0
	let cellcountStarts = 0
	let releaseAnnotations: () => void = () => {}
	const gate = new Promise<void>(r => (releaseAnnotations = r))
	window.fetch = function (...args: Parameters<typeof fetch>) {
		const url = String(args[0] instanceof Request ? args[0].url : args[0])
		if (armed && url.includes('wsitiles/cellcount')) cellcountStarts++
		if (armed && url.includes('wsitiles/annotations')) {
			annotationsStarts++
			return gate.then(() => nativeFetch.apply(window, args))
		}
		return nativeFetch.apply(window, args)
	}

	runpp({
		state: {
			plots: [
				{
					chartType: 'wsi',
					sample: { sID: 'TCGA-22-1017' },
					settings: {
						wsi: {
							geneExpression: 'PTPRC',
							showCellTypes: true,
							showGeneExpression: false,
							annotationLevel: 0,
							viewerHeight: '439px' // unique height: dofetch3's page-wide cache must not hide requests
						}
					}
				}
			]
		},
		wsi: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(wsi) {
		wsi.on('postRender.test', null)
		try {
			const dom = wsi.Inner.dom
			const [legend] = await waitForSelector(dom.viewer.node(), 'div[data-testid="sjpp-wsi-typelegend"]')
			test.ok(legend, 'initial build completed')

			// fresh init in the settled layout, annotations held open
			armed = true
			// dispatch awaits the initial build, so don't await it until after navigating
			const dispatched = wsi.Inner.app.dispatch({
				type: 'plot_edit',
				id: wsi.Inner.id,
				config: { settings: { wsi: { viewerHeight: '440px' } } }
			})
			await waitForCondition(() => annotationsStarts > 0, 'annotations request in flight')
			const [zoomOut] = await waitForSelector(dom.viewer.node(), '.ol-zoom-out')
			const cellcountBeforeNavigation = cellcountStarts
			;(zoomOut as HTMLElement).click() // navigation while annotations are still held
			await new Promise(r => setTimeout(r, 400)) // let the zoom animation settle independently of the held request
			releaseAnnotations()
			await dispatched
			await waitForCondition(
				() => cellcountStarts > cellcountBeforeNavigation,
				'zoom navigation reached updateMode after annotations were released'
			)

			const [legend2] = await waitForSelector(dom.viewer.node(), 'div[data-testid="sjpp-wsi-typelegend"]')
			test.ok(legend2, 'viewer settled with a legend after navigating mid-build')
			armed = false
			window.fetch = nativeFetch
			const [loading] = await waitForSelector(dom.viewer.node(), 'div[data-testid="sjpp-wsi-loading"]')
			await waitForCondition(() => (loading as HTMLElement).style.display === 'none', 'loading settled')

			// moveend must not be left suppressed once the build is over
			performance.setResourceTimingBufferSize(1000)
			performance.clearResourceTimings()
			const [zoomIn] = await waitForSelector(dom.viewer.node(), '.ol-zoom-in')
			;(zoomIn as HTMLElement).click()
			await waitForCondition(
				() => performance.getEntriesByType('resource').some(e => e.name.includes('wsitiles/cellcount')),
				'later zoom reached updateMode'
			)
			test.pass('moveend not left suppressed after the build')

			if (test['_ok']) wsi.Inner.app.destroy()
		} catch (e) {
			test.fail(`mid-build navigation test error: ${e}`)
		} finally {
			releaseAnnotations()
			window.fetch = nativeFetch
		}
		test.end()
	}
})

tape('missing meta cellTypes: dense start recovers the vocabulary; raster/vector switches reuse it', test => {
	test.timeoutAfter(90000) // raster tiles + a vector build per zoom phase spawn python server-side

	// meta.cellTypes is optional (the h5ad scan can fail). Two independent
	// discovery paths read it and must both recover via annotations?types=1:
	// the viewer (wsi.direct.ts), which on a DENSE initial view decides its
	// raster fills BEFORE buildVector()'s viewport-scoped annotations fetch
	// could discover the types; and the controls (Wsi.ts fetchCellTypes), which
	// feeds the 'Types shown' filter and main()'s stale-filter reconciliation.
	// Force both by stripping cellTypes out of the real meta response, then walk
	// raster -> vector -> raster: cellCountLimit 600 sits between the whole-slide
	// count (the fixture's 791 cells) and the max-zoom viewport's own count
	// (~390 at the pinned 439px height and 0.2125 mpp), so zooming in reliably
	// crosses into vector mode and zooming back out returns to raster, all
	// inside ONE viewer.
	const nativeFetch = window.fetch
	const annotationsUrls: string[] = [] // every wsitiles/annotations request this viewer makes
	let typesBody: any // the annotations?types=1 response body
	window.fetch = function (...args: Parameters<typeof fetch>) {
		const url = String(args[0] instanceof Request ? args[0].url : args[0])
		if (url.includes('wsitiles/meta')) {
			// serve the real meta minus cellTypes: the failed-scan shape
			return nativeFetch.apply(window, args).then(async res => {
				const body = await res.json()
				delete body.cellTypes
				return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
			})
		}
		if (url.includes('wsitiles/annotations')) {
			annotationsUrls.push(url)
			if (url.includes('types=1'))
				return nativeFetch.apply(window, args).then(async res => {
					typesBody = await res
						.clone()
						.json()
						.catch(() => null)
					return res
				})
		}
		return nativeFetch.apply(window, args)
	}
	// the page-wide dofetch3 cache already holds this sample's FULL meta from
	// the specs above — cleared so the stripped version is what this viewer gets
	clearServerDataCache()
	// overlay tiles load as <img>, not fetch(): the resource timing buffer is
	// the only place their URLs (carrying ?colors=) can be read back from
	performance.setResourceTimingBufferSize(1000)
	performance.clearResourceTimings()

	runpp({
		state: {
			plots: [
				{
					chartType: 'wsi',
					sample: { sID: 'TCGA-22-1017' },
					settings: {
						wsi: {
							geneExpression: 'PTPRC', // preset: skips the one-time seeding dispatch
							showCellTypes: true, // the recovery only runs for the cell-type fills
							showGeneExpression: false,
							annotationLevel: 0,
							cellCountLimit: 600, // whole-slide view (791 cells) is dense, the max-zoom view (~390) is not
							viewerHeight: '439px' // pins the max-zoom count above; also keeps bbox URLs unique page-wide
						}
					}
				}
			]
		},
		wsi: {
			callbacks: { 'postRender.test': runTests }
		}
	})

	async function runTests(wsi) {
		wsi.on('postRender.test', null) // run once
		try {
			const dom = wsi.Inner.dom
			await waitForSelector(dom.viewer.node(), '.ol-viewport canvas')
			const vectorLegend = () =>
				dom.viewer.node().querySelector('div[data-testid="sjpp-wsi-typelegend"]') as HTMLElement | null
			const rasterLegend = () =>
				dom.viewer.node().querySelector('div[data-testid="sjpp-wsi-raster-typelegend"]') as HTMLElement | null

			/** type -> swatch color off a legend box, 'rgb(r,g,b)' with no spaces */
			const legendColors = (legend: Element, stripCount = false) => {
				const colors: { [t: string]: string } = {}
				for (const row of [...legend.children].slice(1)) {
					// each row: swatch span + text span (vector rows suffix ' (count)')
					const raw = row.lastChild?.textContent || ''
					const name = stripCount ? raw.replace(/ \(\d+\)$/, '') : raw
					colors[name] = ((row.firstChild as HTMLElement).style.background || '').replace(/\s/g, '')
				}
				return colors
			}

			/** click a zoom button until cond() holds, letting each moveend's updateMode settle */
			async function zoomUntil(selector: string, cond: () => boolean, label: string) {
				const [btn] = await waitForSelector(dom.viewer.node(), selector)
				const [loading] = await waitForSelector(dom.viewer.node(), 'div[data-testid="sjpp-wsi-loading"]')
				for (let i = 0; i < 10; i++) {
					if (cond()) return
					;(btn as HTMLElement).click()
					await new Promise(r => setTimeout(r, 400)) // OL animates the zoom; moveend (-> updateMode) fires after
					await waitForCondition(() => (loading as HTMLElement).style.display === 'none', `${label}: loading settled`)
				}
				if (!cond()) throw new Error(`${label}: not reached within 10 zoom clicks`)
			}

			// ---- phase 1: dense start -> raster mode, fills from the RECOVERED vocabulary
			const [legend1] = await waitForSelector(dom.viewer.node(), 'div[data-testid="sjpp-wsi-raster-typelegend"]')
			test.equal(vectorLegend(), null, 'no vector legend on the dense start')

			// the recovery requests (one per discovery path) and their answer
			const recoveryUrls = annotationsUrls.filter(u => u.includes('types=1'))
			const recoveryCount = recoveryUrls.length // baseline: must not grow on mode switches
			test.ok(recoveryCount >= 1, 'the type vocabulary was recovered via annotations?types=1')
			test.ok(
				recoveryUrls.every(u => !u.includes('bbox=')),
				'every recovery request is whole-vocabulary (carries no bbox)'
			)
			const recovered: string[] = Array.isArray(typesBody?.cellTypes) ? typesBody.cellTypes : []
			test.ok(recovered.length >= 1, 'types=1 answered the type vocabulary')
			test.deepEqual(
				Object.keys(typesBody || {}),
				['cellTypes'],
				'types=1 returns ONLY the vocabulary, no per-cell annotations'
			)

			// the controls side (Wsi.ts fetchCellTypes): the same recovery feeds
			// the 'Types shown' filter. An empty list would hide the filter row and
			// skip main()'s stale-filter reconciliation even though the overlay
			// itself recovered — so the filter's presence is the regression signal.
			const [filterSelect] = await waitForSelector(dom.controls.node(), 'select[aria-label="Cell type filter"]')
			const optionVals = [...(filterSelect as HTMLSelectElement).options].map(o => o.value).filter(Boolean)
			test.deepEqual(optionVals, recovered, "'Types shown' filter lists exactly the recovered types")

			// the raster legend lists exactly the recovered types
			const rasterColors = legendColors(legend1)
			test.deepEqual(
				Object.keys(rasterColors),
				recovered,
				'raster legend rows are exactly the recovered types, in order'
			)

			// the recovered colors reach the raster tile URLs
			try {
				await waitForCondition(
					() => performance.getEntriesByType('resource').some(e => e.name.includes('wsitiles/overlaytile')),
					'an overlay tile loaded',
					30000 // cold-start PNG render; two extra python type-scan jobs share the server
				)
			} catch (e) {
				const wsitiles = performance
					.getEntriesByType('resource')
					.map((r: any) => `${r.name.split('wsitiles/')[1]?.split('?')[0]} ${Math.round(r.responseEnd)}ms`)
					.filter(s => s && !s.startsWith('undefined'))
				test.comment(`wsitiles resource entries at timeout: ${JSON.stringify(wsitiles)}`)
				throw e
			}
			const tileUrl = performance
				.getEntriesByType('resource')
				.map(e => e.name)
				.find(n => n.includes('wsitiles/overlaytile'))!
			const urlColors = JSON.parse(decodeURIComponent(tileUrl.match(/colors=([^&]*)/)![1]))
			test.deepEqual(Object.keys(urlColors).sort(), [...recovered].sort(), 'tile URL colors= keys the recovered types')
			test.ok(
				recovered.every(t => rasterColors[t] === `rgb(${urlColors[t]})`.replace(/\s/g, '')),
				'raster legend swatches carry the same colors as the tile URLs'
			)

			// ---- phase 2: zoom in below cellCountLimit -> vector mode reuses the vocabulary
			await zoomUntil('.ol-zoom-in', () => !!vectorLegend(), 'zoom-in to vector mode')
			test.equal(rasterLegend()!.style.display, 'none', 'raster legend hidden in vector mode')
			const vecColors = legendColors(vectorLegend()!, true)
			const vecNames = Object.keys(vecColors)
			test.ok(
				vecNames.length >= 1 && vecNames.every(t => recovered.includes(t)),
				'vector legend types all come from the recovered vocabulary'
			)
			test.ok(
				vecNames.every(t => vecColors[t] === `rgb(${urlColors[t]})`.replace(/\s/g, '')),
				"vector legend swatches keep the raster tiles' own colors"
			)

			// ---- phase 3: zoom back out -> raster again, still on the one recovery
			await zoomUntil(
				'.ol-zoom-out',
				() => !vectorLegend() && rasterLegend()?.style.display === 'block',
				'zoom-out back to raster mode'
			)
			test.pass('zoomed back out: vector legend torn down, raster legend restored')
			test.equal(
				annotationsUrls.filter(u => u.includes('types=1')).length,
				recoveryCount,
				'no further recovery request across the mode switches'
			)
			test.ok(
				annotationsUrls.some(u => u.includes('bbox=')),
				'vector mode fetched its own viewport-scoped annotations'
			)
			test.ok(
				annotationsUrls.every(u => u.includes('types=1') || u.includes('bbox=')),
				'every per-cell annotations request was viewport-scoped: whole-sample annotations never fetched'
			)

			if (test['_ok']) wsi.Inner.app.destroy()
		} catch (e) {
			test.fail(`missing-cellTypes recovery test error: ${e}`)
		} finally {
			window.fetch = nativeFetch // never leave the stripping wrapper installed for later specs
			clearServerDataCache() // nor the stripped meta cached page-wide
		}
		test.end()
	}
})

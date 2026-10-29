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

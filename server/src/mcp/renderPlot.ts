import puppeteer from 'puppeteer'

/** Screenshot a rendered ProteinPaint Mass 'summary' plot by driving a real (headless) browser
 * against the already-running dev server. Mass charts are only ever rendered client-side
 * (D3/SVG in a browser DOM) — there is no server-side path that turns a plot config into an
 * image — so this mirrors how the client's own e2e-playwright tests exercise the app
 * (e2e-playwright/TermdbTest/massNav.e2e.spec.ts): load the Mass UI with the plot pre-seeded via
 * the `?mass=<json>` URL param (client/src/app.parseurl.js), on a non-COHORT nav tab (the default
 * COHORT tab, index 0, hides chart sandboxes), and wait for the actual bar elements
 * (`.bars-cell-grp`) to appear before capturing — `networkidle0` never resolves against a dev
 * server, which keeps a persistent hot-reload websocket open.
 *
 * ppServerUrl: base URL of the running PP dev server, e.g. http://localhost:3000
 * genome/dslabel: dataset to open
 * plot: the plot config object (e.g. { chartType: 'summary', term: {...}, term2?: {...} }) */
export async function screenshotSummaryPlot(
	ppServerUrl: string,
	genome: string,
	dslabel: string,
	plot: any
): Promise<Buffer> {
	const state = { genome, dslabel, nav: { activeTab: 1 }, plots: [plot] }
	const url = `${ppServerUrl}/?mass=${encodeURIComponent(JSON.stringify(state))}`

	const browser = await puppeteer.launch({ headless: true })
	try {
		const page = await browser.newPage()
		await page.setViewport({ width: 1100, height: 850 })
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
		await page.waitForSelector('.bars-cell-grp', { timeout: 20000 })
		// let the bar-resize/fade-in transitions settle (bars.renderer.ts staggers this ~510ms)
		await new Promise(r => setTimeout(r, 800))

		const box = await page.evaluate(() => {
			// This callback runs inside the browser page (via Puppeteer), not in this Node file —
			// `document` is a real global there, just not one ESLint's server/**/*.ts Node-only
			// global set (eslint.config.js) knows about.
			// eslint-disable-next-line no-undef
			const el = document.querySelector('.sjpp-sandbox')
			const r = el!.getBoundingClientRect()
			return { x: r.x, y: r.y, width: r.width, height: r.height }
		})
		// crop to the sandbox's bottom edge (plus the nav above it) instead of the whole, mostly
		// empty page; cap the height in case a plot renders unexpectedly tall.
		const clip = { x: 0, y: 0, width: 1100, height: Math.min(3000, Math.ceil(box.y + box.height + 20)) }
		const png = await page.screenshot({ type: 'png', clip })
		return Buffer.from(png)
	} finally {
		await browser.close()
	}
}

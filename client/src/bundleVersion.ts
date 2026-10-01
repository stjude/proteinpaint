import { select as d3select } from 'd3-selection'

/*
	Detect and notify when the client code in an already loaded page does not match
	the client bundle that the server currently serves, as may happen:
	- after a new deployment, when a page that was loaded earlier requests a code chunk
	  that no longer exists, since chunk filenames have a content hash (see front/webpack.config.js)
	- during a rolling deployment, when an updated page requests code or data
	  from a host that is still running the previous version
*/

export type BundleStatus = 'outdated' | 'ahead' | 'same' | 'unknown'

// the startup version check only applies to a page that loaded the PP server's own /bin/proteinpaint.js bundle,
// and not to an embedder portal that bundles the client package separately from the server's release
export const bundleCheck = { enabled: false }

const noticeClass = 'sja_pp_bundle_notice'

// a placeholder version string that was not replaced on publish will not match
export function isVersion(v: any): v is string {
	return typeof v == 'string' && /^\d+\.\d+\.\d+/.test(v)
}

// compare only the major.minor.patch numbers, ignore any prerelease suffix
export function compareVersions(a: string, b: string): number {
	const x = a.split('-')[0].split('.').map(Number)
	const y = b.split('-')[0].split('.').map(Number)
	for (let i = 0; i < 3; i++) {
		if (x[i] != y[i]) return x[i] < y[i] ? -1 : 1
	}
	return 0
}

/*
	pageVersion: the client version of the loaded page
	servedVersion: the client version of the bundle that the server currently serves
*/
export function getBundleStatus(pageVersion: any, servedVersion: any): BundleStatus {
	if (!isVersion(pageVersion) || !isVersion(servedVersion)) return 'unknown'
	const c = compareVersions(pageVersion, servedVersion)
	return c < 0 ? 'outdated' : c > 0 ? 'ahead' : 'same'
}

// called on startup, with the served client version from the /genomes response
export function checkBundleVersion(pageVersion: any, servedVersion: any) {
	if (!bundleCheck.enabled) return
	const status = getBundleStatus(pageVersion, servedVersion)
	if (status == 'outdated' || status == 'ahead') showBundleNotice(status)
}

/*
	called after a code chunk could not be loaded, even after retries (see front/src/index.js)

	e: a webpack ChunkLoadError, where e.request is the chunk URL, for example
	   https://ppserver/bin/123.abcd1234.proteinpaint.js
*/
export async function notifyChunkLoadError(e: any, pageVersion: any) {
	let status: BundleStatus = 'unknown'
	try {
		const url = typeof e?.request == 'string' ? e.request : ''
		const i = url.lastIndexOf('/bin/')
		if (i != -1) {
			// the chunk URL prefix includes any server basepath
			const res = await fetch(`${url.slice(0, i)}/healthcheck`, { cache: 'no-store' }).then(r => r.json())
			status = getBundleStatus(pageVersion, res?.versionInfo?.deps?.['@sjcrh/proteinpaint-client']?.bundled)
		}
	} catch (_) {
		// the server may be restarting or unreachable, fall back to a generic notice
	}
	showBundleNotice(status)
}

export function showBundleNotice(status: BundleStatus) {
	const message =
		status == 'outdated'
			? 'A newer version of ProteinPaint is available. Please reload this page to continue.'
			: status == 'ahead'
			? 'ProteinPaint is being updated on the server. Please wait a moment and try again.'
			: 'Some ProteinPaint code could not be loaded, possibly due to a network issue or an update. Please reload this page.'

	// reuse an existing notice, to not stack the same notice for multiple failed chunks or app instances
	let div = d3select(document.body).select(`.${noticeClass}`)
	if (div.empty()) {
		div = d3select(document.body)
			.append('div')
			.attr('class', noticeClass)
			.attr('role', 'alert')
			.style('position', 'fixed')
			.style('top', '10px')
			.style('left', '50%')
			.style('transform', 'translateX(-50%)')
			.style('max-width', 'calc(100% - 32px)')
			.style('z-index', 100000)
			.style('padding', '10px 15px')
			.style('border', '1px solid #d4b106')
			.style('border-radius', '5px')
			.style('background-color', '#fffbe6')
			.style('color', '#000')
			.style('font-family', 'Arial, sans-serif')
			.style('font-size', '14px')
			.style('box-shadow', '0 2px 6px rgba(0,0,0,0.2)') as any
	}
	div.selectAll('*').remove()
	div.attr('data-status', status)
	div.append('span').text(message)
	if (status != 'ahead') {
		div
			.append('button')
			.style('margin-left', '10px')
			.text('Reload')
			.on('click', () => window.location.reload())
	}
	div
		.append('button')
		.style('margin-left', '10px')
		.attr('aria-label', 'Dismiss')
		.text('×')
		.on('click', () => div.remove())
}

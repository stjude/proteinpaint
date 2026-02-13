import serverconfig from './serverconfig.js'
import ky from 'ky'

// track AbortController instance by filter0 object,
// to get a signal to cancel active requests after a client
// connection closes unexpectedly
export const abortCtrlBy = {
	filter0: new WeakMap(),
	signal: new WeakMap()
}

// xfetch = extended fetch with retry support (needed for GDC API)
// First two arguments are the same as native fetch,
export async function xfetch(url, opts = {}) {
	// console.log(12, opts.signal) // change to console.trace() to determine code that need to pass q.__abortSignal
	if (xfetchTracker) {
		// count the number of external requests to the same URL within
		// the same expressjs request handler call
		if (!xfetchTracker.has(url)) xfetchTracker.set(url, 0)
		const i = xfetchTracker.get(url)
		xfetchTracker.set(url, i + 1)
	}

	if (opts.json && !opts.body) opts.body = opts.json
	let filter0
	if (opts.body && typeof opts.body != 'string') {
		// q.__abortSignal, which becomes opts.signal, here may be converted to an empty object
		// by creating a JSON.parse(JSON.stringify(q.__abortSignal)), need to detect that as an invalid opts.signal
		if (!opts.signal || (opts.signal !== null && typeof opts.signal === 'object' && !Object.keys(opts.signal).length)) {
			// the nested query processing failed to pass req.query.__abortSignal from the app.middleware,
			// resort to the alternative method of finding the applicable abortSignal that's tracked by req.query,filter0;
			// if filter0 is null, this will not return anything
			filter0 = opts.body.case_filters?.content?.find(f => abortCtrlBy.filter0.has(f))
			if (filter0) opts.signal = abortCtrlBy.filter0.get(filter0)?.signal
		}
		// console.log(24, opts.signal, filter0, opts.body.case_filters?.content)
		opts.body = JSON.stringify(opts.body)
	}
	// if (serverconfig.debugmode) console.log(`(!) xfetch() opts.signal=`, opts.signal, 'filter value=', filter0?.content[0]?.content?.value)

	// 1/27/2026, retry per Phil's suggestion in https://gdc-ctds.atlassian.net/browse/SV-2709
	if (!opts.retry) opts.retry = getRetry(url)

	return await ky(url, opts)
		.then(async r => {
			const contentType = r.headers.get('content-type')
			const payload = contentType == 'application/json' ? await r.json() : await r.text()
			if (!r.ok || (typeof r?.status == 'number' && r?.status > 399 && r.status < 500)) {
				// catch HTTP 4xx that are due to client request,
				// not network or server errors that are considered recoverable
				throw `error from ${url}: ` + (payload.message || payload.error || JSON.stringify(payload))
			} else if (r?.status >= 500) {
				// server-side error, such as during maintenance period;
				// may use isRecoverableError() above to detect
				throw e
			}
			return payload
		})
		.catch(e => {
			throw e
		})
}

const retriesByHostpath = serverconfig.retriesByHostpath || {
	// 'gdc.cancer.gov/gene_expression/values': {
	// 	limit: 3,
	// 	backoffLimit: 10000
	// },
	'gdc.cancer.gov': {
		limit: 2,
		backoffLimit: 10000
	}
}

function getRetry(url) {
	for (const [hostpath, retry] of Object.entries(retriesByHostpath)) {
		if (url.includes(hostpath)) return retry
	}
	return undefined
}

let xfetchTracker = null
export function trackXfetch(tracker) {
	if (tracker !== null && !(tracker instanceof Map)) throw `xfetch tracker must be either null or a Map instance`

	if (!tracker) {
		if (xfetchTracker) console.log(Object.fromEntries(xfetchTracker.entries()))
	} else {
		if (xfetchTracker) {
			// console.warn(`replacing an active xfetchTracker`)
			xfetchTracker.clear()
		}

		// cleanup in case the caller does not do a follow-up `trackXfetch(null)`
		setTimeout(() => {
			xfetchTracker = null
		}, 60000)
	}

	xfetchTracker = tracker
}

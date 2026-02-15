import serverconfig from './serverconfig.js'
import ky from 'ky'
import { isAbortError } from './utils.js'

// track AbortController instance by filter0 object,
// to get a signal to cancel active requests after a client
// connection closes unexpectedly
export const abortCtrlBy = {
	filter0: new WeakMap(),
	signal: new WeakMap()
}

// xfetch = extended fetch with retry support (needed for GDC API)
// First two arguments are the same as native fetch
export async function xfetch(url, opts = {}) {
	if (opts.json && !opts.body) opts.body = opts.json
	if (opts.body && typeof opts.body != 'string') {
		// q.__abortSignal, which becomes opts.signal, here may be converted to an empty object when creating
		// a JSON.parse(JSON.stringify(q.__abortSignal)) copy, need to detect that as an invalid opts.signal
		if (!opts.signal || (opts.signal !== null && typeof opts.signal === 'object' && !Object.keys(opts.signal).length)) {
			// the nested query processing failed to pass req.query.__abortSignal from the app.middleware,
			// resort to the alternative method of finding the applicable abortSignal that's tracked by req.query,filter0
			// if content or filter0 is empty, this will not set opts.signal
			const content = opts.body.case_filters?.content
			const filter0 = Array.isArray(content) && content.find(f => abortCtrlBy.filter0.has(f))
			if (filter0) opts.signal = abortCtrlBy.filter0.get(filter0)?.signal
		}
		opts.body = JSON.stringify(opts.body)
	}

	mayCollectTrackedInfo(url, opts)

	// 1/27/2026, retry per Phil's suggestion in https://gdc-ctds.atlassian.net/browse/SV-2709
	if (!opts.retry) opts.retry = getRetry(url)
	if (!opts.timeout) opts.timeout = false // force any empty timeout value to boolean false, in case ky is strict

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
			// prevent re-aborting the same signal
			if (!opts.signal?.aborted) abortCtrlBy.signal.get(opts.signal)?.abort()
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

/********************
  Diagnostic helpers
*********************/

let xfetchTracker = null,
	i = 0

// trackXfetch()
// - is expected to be called towards the beginning of a route handler or helper like getData(),
//   so that all calls to xfetch() within the same request could be tracked by url, init.body, etc
// - once a tracker is cleared, the number of requests per unique URL/path?params will be logged
//
// @tracker
// - if empty/null, it will clear the tracker and stop all tracking
// - if a Map instance, will replace the current or undefined tracker
//
export function trackXfetch(tracker) {
	if (!serverconfig.debugmode) return
	if (tracker !== null && !(tracker instanceof Map)) throw `xfetch tracker must be either null or a Map instance`

	if (!tracker) {
		i = 0 // reset the request counter for simulating which browser request to abort/cancel with an error response
		if (xfetchTracker) {
			console.log(`(i) Number of requests per URL/path?param`)
			console.log(Object.fromEntries(xfetchTracker.entries()))
			console.log(`(i) Non-unique requests by URL/path?param + body`)
			console.log(Object.fromEntries(uniqueReqTracker.entries().filter(t => t[1] > 1)))
		}
	} else {
		if (xfetchTracker) {
			// i++; if (i == 1) throw `--- test abort of 2nd request ---`
			// console.warn(`replacing an active xfetchTracker`)
			xfetchTracker.clear()
			uniqueReqTracker.clear()
		}
		// cleanup in case the caller does not do a follow-up `trackXfetch(null)`
		setTimeout(() => {
			xfetchTracker = null
		}, 60000)

		uniqueReqTracker.clear()
	}

	xfetchTracker = tracker
}

const uniqueReqTracker = new Map()

// trackByUrl will populate xfetchTracker and uniqueReqTracker
// when called from inside xfetch()
function mayCollectTrackedInfo(url, opts) {
	// console.trace(12, opts.signal) // uncomment to determine upstream code that need to pass q.__abortSignal
	if (!xfetchTracker || !serverconfig.debugmode) return
	// count the number of external requests to the same URL within
	// the same expressjs request handler call
	if (!xfetchTracker.has(url)) xfetchTracker.set(url, 0)
	const i = xfetchTracker.get(url)
	xfetchTracker.set(url, i + 1)

	const body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
	const key = '[' + url + ']' + (body || '')
	if (!uniqueReqTracker.has(key)) uniqueReqTracker.set(key, 0)
	uniqueReqTracker.set(key, uniqueReqTracker.get(key) + 1)
}

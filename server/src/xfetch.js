import serverconfig from './serverconfig.js'
import ky from 'ky'
import { isAbortError } from './utils.js'
import { getHostpathOptions } from './xfetch.hostpath.ts'

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
	if (!opts.headers) opts.headers = {}
	if (
		opts.method?.toUpperCase() == 'POST' &&
		!Object.keys(opts.headers).find(k => k.toLowerCase() == 'content-type') &&
		isJSON(opts.body)
	)
		opts.headers['Content-Type'] = 'application/json'

	mayCollectTrackedInfo(url, opts)

	// 1/27/2026, retry per Phil's suggestion in https://gdc-ctds.atlassian.net/browse/SV-2709
	if (!opts.retry) opts.retry = getRetry(url)
	if (!opts.timeout) opts.timeout = false // force any empty timeout value to boolean false, in case ky is strict

	return await ky(url, opts)
		.then(async r => {
			const contentType = r.headers.get('content-type')
			const payload = contentType == 'application/json' ? await r.json() : await r.text()
			// a non-2xx response is reached here only with the ky option throwHttpErrors: false, which no caller
			// sets; otherwise ky throws an HTTPError, which mayReplaceNetworkError() may replace
			if (!r.ok || (typeof r?.status == 'number' && r?.status > 399 && r.status < 500)) {
				throw `error from ${url}: ` + (payload.message || payload.error || JSON.stringify(payload))
			}
			return payload
		})
		.catch(e => {
			// prevent re-aborting the same signal, but if not yet aborted, then
			// trigger an abort to affect all other signal listeners, since failure
			// in one request in a set of awaited parallel requests means that the
			// Promise.all() will fail anyway
			if (!opts.signal?.aborted) abortCtrlBy.signal.get(opts.signal)?.abort()
			removeCredentials(e)
			throw mayReplaceNetworkError(e, url)
		})
}

const unavailableStatus = new Set([429, 500, 502, 503, 504])

/* An external API that is busy, or a connection to it that fails or is cut off, gives an error with a message
from a native library, such as 'terminated' or 'fetch failed', which is not meaningful to a user. That error is
logged with its cause and replaced with one that a user can act on, which the networkErrorMessage option of the
matching hostpath may set, see xfetch.hostpath.ts. The replacement keeps the network error code, such as ECONNRESET, that isRecoverableError() checks, and
the HTTP response that a caller may check. */
export function mayReplaceNetworkError(e, url) {
	if (!isNetworkError(e)) return e
	// the message of a ky error has the full request url, so only the name and the cause or status are logged
	const detail = e instanceof TypeError ? `: ${e.message}` : ''
	console.log(
		`xfetch ${getUrlPath(url)}: ${e.name}${detail}`,
		e.cause?.code || e.cause?.message || e.response?.status || ''
	)
	const err = new Error(getNetworkErrorMessage(url), { cause: e })
	err.name = 'NetworkError'
	const code = e.code || e.cause?.code
	if (code) err.code = code
	if (e.response) err.response = e.response
	return err
}

function isNetworkError(e) {
	if (!e || typeof e != 'object' || isAbortError(e)) return false
	if (e.name == 'TimeoutError') return true
	if (e.name == 'HTTPError') return unavailableStatus.has(e.response?.status)
	return e instanceof TypeError && (e.message == 'terminated' || e.message == 'fetch failed')
}

// a message that names the API may be set as the networkErrorMessage option of a hostpath, see xfetch.hostpath.ts
const defaultNetworkErrorMessage = 'The server is busy or not responding. Please try again in a few minutes.'

function getNetworkErrorMessage(url) {
	return getHostpathOptions(url)?.networkErrorMessage || defaultNetworkErrorMessage
}

// the url without its query string, which may have identifiers that should not be logged
function getUrlPath(url) {
	return String(url).split('?')[0]
}

// the request headers that can have a user credential, such as those of getHostHeaders() of the GDC dataset
const credentialHeaders = ['cookie', 'x-auth-token', 'authorization']

/* an error from ky, such as HTTPError or TimeoutError, has the request and the ky options, both with the request
headers; these are removed, so that a caller that logs the whole error does not log a credential */
export function removeCredentials(e) {
	for (const headers of [e?.request?.headers, e?.options?.headers]) {
		if (typeof headers?.delete != 'function') continue
		for (const h of credentialHeaders) headers.delete(h)
	}
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
	i = 0,
	// the pending timeout that clears an abandoned tracker, see trackXfetch()
	trackerTimeout = null

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

	// the previous cleanup timeout must not outlive the tracker it was meant to clear,
	// or it would null out a tracker started by a later call
	if (trackerTimeout) {
		clearTimeout(trackerTimeout)
		trackerTimeout = null
	}

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
		// cleanup in case the caller does not do a follow-up `trackXfetch(null)`.
		// unref'd: this diagnostic-only timer must not keep the process alive, which
		// would otherwise stall the exit of a test run or script by up to a minute
		trackerTimeout = setTimeout(() => {
			xfetchTracker = null
			trackerTimeout = null
		}, 60000)
		trackerTimeout.unref?.()

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

function isJSON(str) {
	if (typeof str != 'string') return false
	try {
		JSON.parse(str)
		return true
	} catch (e) {
		return false
	}
}

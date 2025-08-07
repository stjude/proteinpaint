import { deepFreeze } from '#rx'
import { encode, getDataName, processResponse } from '#shared/index.js'
import { mayShowAuthUi, mayAddJwtToRequest, includeEmbedder, setDsAuthOk } from './auth.js'
export * from './auth.js'
export { processFormData } from '#shared/index.js'

/*
	path: URL
	arg: HTTP request body
	opts: see dofetch2() opts argument
*/
export function dofetch(path, arg, opts = null) {
	if (opts && typeof opts == 'object') {
		if (opts.serverData && typeof opts.serverData == 'object') {
			if (!dofetch.serverData) {
				dofetch.serverData = opts.serverData
			} else if (!opts.serverData) {
				opts.serverData = dofetch.serverData
			}
		}
		return dofetch2(
			path,
			{
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(arg)
			},
			opts
		)
	} else {
		// path should be "path" but not "/path"
		if (path[0] == '/') {
			path = path.slice(1)
		}

		const jwt = sessionStorage.getItem('jwt')
		if (jwt) {
			arg.jwt = jwt
		}

		let url = path
		const host = sessionStorage.getItem('hostURL') || window.testHost || ''
		if (host) {
			// hostURL can end with / or not, must use 'host/path'
			if (host.endsWith('/')) {
				url = host + path
			} else {
				url = host + '/' + path
			}
		}

		return fetch(
			new Request(url, {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(arg)
			})
		).then(r => r.json())
	}
}

export function dofetch2(path, init = {}, opts = {}) {
	/*
	path"" string URL path

	init{}
		will be supplied as the second argument to
		the native fetch api, so the method, headers, body
		may be optionally supplied in the "init" argument
		see https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch

	opts{}: all other optional arguments that are not related to the native fetch init argument
		.serverData{}              an object for caching fetch Promise 
	*/
	// path should be "path" but not "/path"
	if (path[0] == '/') {
		path = path.slice(1)
	}

	let url = path
	const host = sessionStorage.getItem('hostURL') || window.testHost || ''
	if (host) {
		// hostURL can end with / or not, must use 'host/path'
		if (host.endsWith('/')) {
			url = host + path
		} else {
			url = host + '/' + path
		}
	}

	// create a reference to be able to detect body params, easier than
	// getting params once converted to a URL
	const body = init.body || {}
	// this may convert a GET into a POST method, and
	// encode the payload either in the URL or request body
	url = mayAdjustRequest(url, init)

	if (!init.headers) {
		init.headers = {}
	}

	if (!init.headers['content-type'] && init.body) {
		init.headers['content-type'] = 'application/json'
	}

	// this jwt is site-wide for a particular PP host, not dslabel-specific
	const jwt = sessionStorage.getItem('jwt')
	if (jwt) {
		init.headers.authorization = 'Bearer ' + jwt
	}

	/*
		this is client-side "gatekeeper", will not proceed
		to the usual request handling unless no credentials
		are required or a valid session has already been established
	*/
	return mayShowAuthUi(init, url).then(async () => {
		if (!jwt) mayAddJwtToRequest(init, body, url)
		if (opts.serverData) {
			return namedFetch(url, init, opts)
		} else {
			return fetch(url, init).then(processResponse)
		}
	})
}

// key: opts.serverData object
// value: array of cached dataNames
const optsServerDataNames = new WeakMap() // do not prevent garbage collection of unneeded opts.serverData in consumer code
/*
	namedFetch()
	- same arguments and behavior as ezFetch() above, except opts.serverData is expected to cache response by computed data name
	- preserves the caching expectations from 
	
	opts{}
	serverData: optional plain object to store response by dataName (string) keys
		- if a computed dataName is found as a key in this object, the cached response will be reused to fulfill the fetch
		- note that the plain object as storage is to support legacy dofetch code
*/
export async function namedFetch(url, init, opts = {}) {
	if (!opts.serverData) throw `use ezFetch() if a fetched response is not meant to be cached`
	if (typeof opts.serverData != 'object') throw `opts.serverData is not an object`

	let result
	const dataName = await getDataName(url, init)
	if (opts.serverData[dataName])
		result = opts.serverData[dataName].clone
			? await processResponse(opts.serverData[dataName].clone())
			: structuredClone(opts.serverData[dataName])

	if (!result || (typeof result != 'object' && !(result instanceof Promise))) {
		delete opts.serverData[dataName]
		result = undefined
	}

	if (!result) {
		try {
			const res = await fetch(url, init)
			result = await processResponse(res.clone())
			// in case this fetch was cancelled with AbortController.signal,
			// then the result may be another Promise instead of a data object,
			// as observed when rapidly changing the gdc cohort filter
			if (typeof result == 'object' && !(result instanceof Promise)) {
				// TODO: make decoded caching as default, since storing as a
				// fetch Response interface can be problematic when the fetch is aborted
				if (opts.cacheAs == 'decoded') {
					// should prefer to store results as a deeply frozen object instead of a Response interface,
					// but must not return the same object to be reused by different requests
					deepFreeze(result)
					opts.serverData[dataName] = result
					result = structuredClone(result)
				} else {
					// per https://developer.mozilla.org/en-US/docs/Web/API/Response/clone,
					// **should not use (.clone) to read very large bodies in parallel** at different speeds,
					// may also mean(?) to not persist/store the Response for a long time as is being done here
					opts.serverData[dataName] = res
				}
			}
		} catch (e) {
			delete opts.serverData[dataName]
			throw e
		}
	}

	// manage opts.serverData cache size
	if (!optsServerDataNames.has(opts.serverData)) optsServerDataNames.set(opts.serverData, [])
	const keys = optsServerDataNames.get(opts.serverData)
	const i = keys.indexOf(dataName)
	if (i > 0) {
		// move this cached response as the most recent entry, by object key
		keys.splice(i, 1)
	}
	keys.unshift(dataName)
	const maxKeys = 360
	while (keys.length > maxKeys) {
		const oldestDataKey = keys.pop() // delete the dataName from the tracking array
		delete opts.serverData[oldestDataKey]
	}
	return result
}

const defaultServerDataCache = {}
export function dofetch3(path, init = {}, opts = {}) {
	/*
		This is a convenience function that sets a default serverData object
	*/
	opts.serverData = defaultServerDataCache
	return dofetch2(path, init, opts)
}

export function clearServerDataCache(opts = {}) {
	const cache = opts?.serverData || defaultServerDataCache
	if (!cache) return
	for (const k of Object.keys(cache)) {
		delete cache[k]
	}
}

const urlMaxLength = 2000 // if a GET url is longer than this, will be converted to POST of the same route

/*	
	url: full request url with host/path

	init {}
		same as the init argument for dofetch2
		will be supplied as the second argument to
		the native fetch api, so the method, headers, body
		may be optionally supplied in the "init" argument
		see https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch
*/
function mayAdjustRequest(url, init) {
	const hostname = window.location.hostname
	const method = (init.method && init.method.toUpperCase()) || 'GET'
	if (method == 'POST') {
		// assume a minimal URL path + parameters for a POST request
		// since the payload will be in the request body
		if (typeof init.body == 'string') init.body = JSON.parse(init.body)
		if (!init.body.embedder && includeEmbedder) init.body.embedder = hostname
		init.body = JSON.stringify(init.body)
		return url
	}

	if (method != 'GET' && method != 'DELETE' && method != 'PUT') {
		throw `unsupported init.method='${method}': must be undefined or GET or POST or DELETE or PUT`
	}

	if (init.body) {
		// init.body should be an object, to be converted to either
		// (a) GET URL search parameter strings, OR
		// (b) POST body, JSON-encoded
		if (!init.body.embedder && includeEmbedder) init.body.embedder = hostname

		const params = encode(init.body)
		if (!url.includes('?')) url += '?'
		url += params
	}

	if (!url.includes('embedder=') && includeEmbedder) {
		const sep = url.includes('?') ? '&' : '?'
		url += `${sep}embedder=${hostname}`
	}

	if (url.length < urlMaxLength) {
		// the request body has been encoded as URL parameters, so can delete it
		if (init.body) delete init.body
		return url
	}

	// convert to a POST request because the URL is too long
	// !!! NOTE: the requested server route must support both GET and POST, for example, app.all('/route', handler)
	init.method = 'POST'
	const [hostpath, query] = url.split('?') // must use url but not path

	if (init.body) {
		// assumes that all or most of the url string length were from parameters in the init.body argument to dofetch2
		init.body = JSON.stringify(init.body)
	} else {
		// the url parameters were provided directly in the path argument to dofetch2()
		const params = {}
		// decode URL search parameters, if available
		if (query)
			// TODO: !!! use urljson.decode here !!!
			query.split('&').forEach(p => {
				const [k, v] = p.split('=')
				const decodedVal = decodeURIComponent(v)
				try {
					params[k] = JSON.parse(decodedVal)
				} catch {
					params[k] = decodedVal
				}
			})
		if (!params.embedder && includeEmbedder) params.embedder = hostname
		init.body = JSON.stringify(params)
	}

	return hostpath
}

// see opts argument to setDsAuthOk
export function setAuth(opts) {
	setDsAuthOk(opts, dofetch3)
}

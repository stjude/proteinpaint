import { deepFreeze } from '#rx'
import { encode, getDataName, processResponse, memFetch } from '#shared/index.js'
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
	path "" string URL path

	init {}
		will be supplied as the second argument to
		the native fetch api, so the method, headers, body
		may be optionally supplied in the "init" argument
		see https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch

	opts {}
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
		if (!opts.serverData) {
			return fetch(url, init).then(processResponse)
		} else {
			return await memFetch(url, init, opts)
		}
	})
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

	if (method != 'GET' && method != 'DELETE') {
		throw `unsupported init.method='${method}': must be undefined or GET or POST or DELETE`
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

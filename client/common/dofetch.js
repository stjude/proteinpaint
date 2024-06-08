import { select } from 'd3-selection'
import { deepFreeze } from '#rx'
import { encode } from '#shared/urljson'

const jwtByDsRouteStr = localStorage.getItem('jwtByDsRoute') || `{}`
const jwtByDsRoute = JSON.parse(jwtByDsRouteStr)

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

const cachedServerDataKeys = []
const maxNumOfServerDataKeys = 360

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
		const dataName = url + ' | ' + init.method + ' | ' + init.body

		if (opts.serverData) {
			let result
			if (opts.serverData[dataName]) {
				result = opts.serverData[dataName].clone
					? await processResponse(opts.serverData[dataName].clone())
					: structuredClone(opts.serverData[dataName])
			}
			if (!result || typeof result != 'object' || result instanceof Promise) {
				delete opts.serverData[dataName]
				result = undefined
			}

			if (!result) {
				// to-do: support opt.freeze to enforce Object.freeze(data.json())
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
			// manage the number of stored keys in serverData
			const i = cachedServerDataKeys.indexOf(dataName)
			if (i !== -1) cachedServerDataKeys.splice(i, 1)
			cachedServerDataKeys.unshift(dataName)
			if (cachedServerDataKeys.length > maxNumOfServerDataKeys) {
				const oldestDataname = cachedServerDataKeys.pop()
				delete opts.serverData[oldestDataname]
			}
			return result
		} else {
			return fetch(url, init).then(processResponse)
		}
	})
}

/* 
r: a native fetch response argument

potentially allow "application/octet-stream" as response type
in such case it will not try to parse it as json
also the caller should just call dofetch2() without a serverData{}
rather than dofetch3
*/
function processResponse(r) {
	const ct = r.headers.get('content-type') // content type is always present
	if (!ct) throw `missing response.header['content-type']`
	if (ct.includes('/json')) {
		return r.json()
	}
	if (ct.includes('/text')) {
		return r.text()
	}
	// call blob() as catch-all
	// https://developer.mozilla.org/en-US/docs/Web/API/Response
	return r.blob()
}

const defaultServerDataCache = {}
export function dofetch3(path, init = {}, opts = {}) {
	/*
		This is a convenience function that sets a default serverData object
	*/
	opts.serverData = defaultServerDataCache
	return dofetch2(path, init, opts)
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

const dsAuthOk = new Set()
let dsAuth,
	authUi,
	authUiHolder,
	includeEmbedder = false

/*
	opts{}
	.dsAuth: required, array of dataset names that require login
	.authUi: optional, a custom login UI function to launch as needed
	.holder: optional, a d3-wrapped selection to hold the auth UI
*/
export function setAuth(opts) {
	dsAuth = opts.dsAuth
	authUi = opts.ui || defaultAuthUi
	authUiHolder = opts.holder || select('body')
	for (const auth of dsAuth) {
		// fillin all the dslabels that has an active session
		// so that an unnecessary login form will not be shown
		if (auth.insession) dsAuthOk.add(auth)
	}
	includeEmbedder = opts.dsAuth?.length > 0 || false
}

export function isInSession(dslabel, route) {
	return dslabel && [...dsAuthOk].find(d => d.dslabel == dslabel && d.route == route)
}

/* 
	mayShowAuthUi() is the client-side "gatekeeper"
	method to check if a dataset requires credentials
*/
async function mayShowAuthUi(init, path) {
	const ok = { status: 'ok' }
	if (!dsAuth) return ok
	for (const a of dsAuth) {
		const body = JSON.parse(init.body || `{}`)
		const params = (path.split('?')[1] || '').split('&').reduce((obj, kv) => {
			const [key, value] = kv.split('=')
			obj[key] = value
			return obj
		}, {})
		const q = Object.assign({}, body, params)
		const route = ((path.split('?')[0] || '').split('//')[1] || '').split('/').slice(1).join('/')
		if (q.dslabel == a.dslabel && (a.route == '/**' || route == a.route)) {
			if (dsAuthOk.has(a)) return ok
			// dofetch should show the authUi only when all routes ('/**') are protected
			// otherwise, the authUi should be opened only when requesting data from a protected route,
			// that will be determined within feature code such as for 'termdb', 'burden', etc
			else if (a.route != '/**') return ok
			else if (a.type == 'basic') return await authUi(a.dslabel, a)
			else if (a.type == 'jwt') {
				// assume the embedder/portal provides the login UI
				// so no need to do anything here
			} else if (a.type == 'forbidden') {
				alert('Forbidden access')
				// don't do anything
			} else throw `unsupported dsAuth type='${a.type}'`
		}
	}
	return ok
}

/*
	this is the default login UI, may be overriden
	by an optional different form, for example if PP 
	is embedded in another portal
*/
async function defaultAuthUi(dslabel, auth) {
	const mask = authUiHolder
		.append('div')
		.style('position', 'fixed')
		.style('top', 0)
		.style('left', 0)
		.style('height', '100%')
		.style('width', '100%')
		.style('margin', 0)
		.style('padding', '20px')
		.style('background-color', 'rgb(150,150,150)')

	const form = mask.append('div').style('opacity', 1)
	form.append('div').html(`Restricted dataset '${dslabel}'`)
	form.append('span').html('Please enter password ')

	const pwd = form.append('input').attr('type', 'password')
	pwd.node().focus()

	const btn = form.append('button').html('Submit')
	return new Promise((resolve, reject) => {
		function login() {
			fetch('/dslogin', {
				method: 'POST',
				headers: {
					authorization: `Basic ${btoa(pwd.property('value'))}`
				},
				body: JSON.stringify({ dslabel, route: auth.route, embedder: window.location.hostname })
			})
				.then(res => res.json())
				.then(res => {
					if (res.error) throw res.error
					mask.remove()
					dsAuthOk.add(auth)
					if (res.jwt) {
						if (!jwtByDsRoute[dslabel]) jwtByDsRoute[dslabel] = {}
						jwtByDsRoute[dslabel][res.route] = res.jwt
						localStorage.setItem('jwtByDsRoute', JSON.stringify(jwtByDsRoute))
					}
					resolve(dslabel)
				})
				.catch(e => {
					alert('login error: ' + e)
					// allow to reuse the login UI, do not hide or reject
					// mask.remove()
					// reject(e)
				})
		}
		btn.on('click', login)
		pwd.on('change', login)
	})
}

function mayAddJwtToRequest(init, body, url) {
	if (init.headers.authorization) return
	let dslabel = body?.dslabel // || body.mass?.vocab.dslabel || body.tracks?.find(t => t.dslabel)?.dslabel
	if (!dslabel) {
		const param = url
			.split('?')[1]
			?.split('&')
			.find(kv => kv.includes('dslabel'))
		if (!param) return
		let value = decodeURIComponent(param.split('=')[1])
		if (value.startsWith('{') && value.endsWith('}')) {
			value = JSON.parse(value)
			dslabel = value.dslabel || value.mass?.vocab.dslabel || value.tracks?.find(t => t.dslabel)?.dslabel
		} else {
			dslabel = value
		}
	}
	if (!dslabel || !jwtByDsRoute[dslabel]) return
	const h = url.split('//')
	const route = (h[1] || h[0]).split('/')[1].split('?')[0]
	const jwt = jwtByDsRoute[dslabel][route] || jwtByDsRoute[dslabel]['/**']
	if (jwt) init.headers.authorization = 'Bearer ' + btoa(jwt)
}

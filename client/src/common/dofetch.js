import { select } from 'd3-selection'

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
const maxNumOfServerDataKeys = 20

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

	// this may convert a GET into a POST method, and
	// encode the payload either in the URL or request body
	url = mayAdjustRequest(url, init)

	if (!init.headers) {
		init.headers = {}
	}

	if (!init.headers['content-type'] && init.body) {
		init.headers['content-type'] = 'application/json'
	}

	const jwt = sessionStorage.getItem('jwt')
	if (jwt) {
		init.headers.authorization = 'Bearer ' + jwt
	}

	/*
		this is client-side "gatekeeper", will not proceed
		to the usual request handling unless no credentials
		are required or a valid session has already been established
	*/
	return mayShowAuthUi(init, path).then(() => {
		const dataName = url + ' | ' + init.method + ' | ' + init.body

		if (opts.serverData) {
			if (!(dataName in opts.serverData)) {
				// to-do: support opt.freeze to enforce Object.freeze(data.json())
				opts.serverData[dataName] = fetch(url, init)
			}

			// manage the number of stored keys in serverData
			const i = cachedServerDataKeys.indexOf(dataName)
			if (i !== -1) cachedServerDataKeys.splice(i, 1)
			cachedServerDataKeys.unshift(dataName)
			if (cachedServerDataKeys.length > maxNumOfServerDataKeys) {
				const oldestDataname = cachedServerDataKeys.pop()
				delete opts.serverData[oldestDataname]
			}

			return opts.serverData[dataName].then(r => processResponse(r.clone()))
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
	const method = (init.method && init.method.toUpperCase()) || 'GET'
	if (method == 'POST') {
		// assume a minimal URL path + parameters for a POST request
		// since the payload will be in the request body
		if (typeof init.body == 'object') init.body = JSON.stringify(init.body)
		return url
	}

	if (method != 'GET') {
		throw `unsupported init.method='${method}': must be undefined or GET or POST`
	}

	if (init.body) {
		// init.body should be an object, to be converted to either
		// (a) GET URL search parameter strings, OR
		// (b) POST body, JSON-encoded
		const params = []
		for (const key in init.body) {
			const value = init.body[key]
			if (typeof value == 'object') params.push(`${key}=${encodeURIComponent(JSON.stringify(value))}`)
			else params.push(`${key}=${value}`)
		}

		if (!url.includes('?')) url += '?'
		url += params.join('&')
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
			query.split('&').forEach(p => {
				const [k, v] = p.split('=')
				const decodedVal = decodeURIComponent(v)
				try {
					params[k] = JSON.parse(decodedVal)
				} catch {
					params[k] = decodedVal
				}
			})
		init.body = JSON.stringify(params)
	}

	return hostpath
}

const dsAuthOk = new Set()
let dsAuth, authUi, authUiHolder

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
		if (auth.insession) dsAuthOk.add(auth.dslabel)
	}
}

/* 
	mayShowAuthUi() is the client-side "gatekeeper"
	method to check if a dataset requires credentials
*/
async function mayShowAuthUi(init, path) {
	const ok = { status: 'ok' }
	if (!dsAuth) return ok
	for (const a of dsAuth) {
		if (init.body?.includes(`"dslabel":${a.dslabel}`) || path.includes(`dslabel=${a.dslabel}`)) {
			if (dsAuthOk.has(a.dslabel)) return ok
			return await authUi(a.dslabel)
		}
	}
	return ok
}

/*
	this is the default login UI, may be overriden
	by an optional different form, for example if PP 
	is embedded in another portal
*/
async function defaultAuthUi(dslabel) {
	const mask = authUiHolder
		.append('div')
		.style('position', 'fixed')
		.style('height', '100%')
		.style('width', '100%')
		.style('margin', 0)
		.style('padding', '20px')
		.style('background-color', 'rgba(0,0,0,0.2)')

	const form = mask.append('div').style('opacity', 1)
	form.append('div').html(`Restricted dataset '${dslabel}'`)
	//form.append('br')
	form.append('span').html('Please enter a password ')
	const pwd = form.append('input').attr('type', 'password')
	const btn = form.append('button').html('Submit')
	return new Promise((resolve, reject) => {
		function login() {
			fetch('/dslogin', {
				method: 'POST',
				headers: {
					authorization: `Basic ${btoa(pwd.property('value'))}`
				},
				body: JSON.stringify({ dslabel })
			})
				.then(res => res.json())
				.then(res => {
					if (res.error) throw res.error
					mask.remove()
					dsAuthOk.add(dslabel)
					resolve(dslabel)
				})
				.catch(e => {
					mask.remove()
					reject(e)
				})
		}
		btn.on('click', login)
		pwd.on('change', login)
	})
}

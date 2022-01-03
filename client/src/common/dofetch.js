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

	if (!init.headers) {
		init.headers = {}
	}

	if (!init.headers['content-type']) {
		init.headers['content-type'] = 'application/json'
	}

	const jwt = sessionStorage.getItem('jwt')
	if (jwt) {
		init.headers.authorization = 'Bearer ' + jwt
	}

	const dataName = url + ' | ' + init.method + ' | ' + init.body

	if (opts.serverData) {
		if (!(dataName in opts.serverData)) {
			// will cache data as text to not share parsed response object
			// to-do: support opt.freeze to enforce Object.freeze(data.json())
			opts.serverData[dataName] = fetch(url, init).then(data => data.text())
		}

		// manage the number of stored keys in serverData
		const i = cachedServerDataKeys.indexOf(dataName)
		if (i !== -1) cachedServerDataKeys.splice(i, 1)
		cachedServerDataKeys.unshift(dataName)
		if (cachedServerDataKeys.length > maxNumOfServerDataKeys) {
			const oldestDataname = cachedServerDataKeys.pop()
			delete opts.serverData[oldestDataname]
		}

		return opts.serverData[dataName].then(str => JSON.parse(str))
	} else {
		return fetch(url, init).then(r => r.json())
	}
}

const defaultServerDataCache = {}
export function dofetch3(path, init = {}, opts = {}) {
	/*
		This is a convenience function that sets a default serverData object
	*/
	opts.serverData = defaultServerDataCache
	return dofetch2(path, init, opts)
}

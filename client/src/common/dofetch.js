// track fetch urls to restrict
// simultaneous reporting for the same issue
const fetchTimers = {}
const fetchReported = {}
const maxAcceptableFetchResponseTime = 15000 // disable with 0, or default to 15000 milliseconds
const maxNumReportsPerSession = 2

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
		return dofetch2(path, { method: 'POST', body: JSON.stringify(arg) }, opts)
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

		trackfetch(url, arg)

		return fetch(new Request(url, { method: 'POST', body: JSON.stringify(arg) })).then(data => {
			if (fetchTimers[url]) {
				clearTimeout(fetchTimers[url])
			}
			return data.json()
		})
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

	const jwt = sessionStorage.getItem('jwt')
	if (jwt) {
		if (!init.headers) {
			init.headers = {}
		}
		init.headers.authorization = 'Bearer ' + jwt
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

	const dataName = url + ' | ' + init.method + ' | ' + init.body

	if (opts.serverData) {
		if (!(dataName in opts.serverData)) {
			trackfetch(url, init)
			opts.serverData[dataName] = fetch(url, init).then(data => {
				if (fetchTimers[url]) {
					clearTimeout(fetchTimers[url])
				}
				// stringify to not share parsed response object
				// to-do: support opt.freeze to enforce Object.freeze(data.json())
				const prom = data.text()
				return prom
			})
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
		trackfetch(url, init)
		return fetch(url, init).then(data => {
			if (fetchTimers[url]) {
				clearTimeout(fetchTimers[url])
			}
			return data.json()
		})
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

function trackfetch(url, arg) {
	if (maxAcceptableFetchResponseTime < 1) return

	// report slowness if the fetch does not respond
	// within the acceptableResponseTime;
	// if the server does respond in time,
	// this timer will just be cleared by the
	// fetch promise handler
	if (
		!fetchTimers[url] &&
		!fetchReported[url] &&
		Object.keys(fetchReported).length <= maxNumReportsPerSession &&
		(window.location.hostname == 'proteinpaint.stjude.org' || sessionStorage.hostURL == 'proteinpaint.stjude.org')
	) {
		fetchTimers[url] = setTimeout(() => {
			// do not send multiple reports for the same page
			fetchReported[url] = 1

			const opts = {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					issue: 'slow response',
					url, // server route
					arg, // request body
					page: window.location.href
				})
			}

			fetch('https://pecan.stjude.cloud/api/issue-tracker', opts)
		}, maxAcceptableFetchResponseTime)
	}
}

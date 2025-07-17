import { hash } from './hash.js'
import { encode } from './urljson.js'

/*
	ezFetch()
	fetch wrapper with automatic response content-type detection and handling

	- this addresses issues with ky.json() or got.json(), where a HTTP 404 NOT FOUND
		response with text/html can break error handling/logging, making it harder to debug

	- this also automatically handles multipart responses 

	arguments:
	url
	init{headers?, body?}
	- first two arguments are same as native fetch
*/
export async function ezFetch(_url, init = {}) {
	const url = mayAdjustRequest(_url, init)

	return fetch(url, init).then(async r => {
		const response = await processResponse(r)
		if (!r.ok) {
			console.log('ezFetch error ' + r.status)
			console.log(response)
			throw response
		}
		return response
	})
}

function mayAdjustRequest(url, init) {
	const method = init.method?.toUpperCase() || 'GET'
	if (method == 'POST') {
		if (!init.headers) init.headers = {}
		if (init.body) {
			if (!init.headers['content-type']) init.headers['content-type'] = 'application/json'
			if (init.headers['content-type'].toLowerCase() == 'application/json') {
				// if consumer code has pre-encoded the body, parse to verify correctness
				if (typeof init.body == 'string') init.body = JSON.parse(init.body)
				init.body = JSON.stringify(init.body)
			}
		}
		return url
	}
	// default to GET method per native fetch
	if (init.body) {
		if (typeof init.body != 'object') throw `init.body should be an object`
		// init.body should be an object, to be converted to GET URL search parameter strings
		if (!url.includes('?')) url += '?'
		return `${url}${encode(init.body)}`
	}
}

/* 
r: a native fetch response argument

potentially allow "application/octet-stream" as response type
in such case it will not try to parse it as json
also the caller should just call dofetch2() without a serverData{}
rather than dofetch3
*/
export async function processResponse(r) {
	const ct = r.headers.get('content-type') // content type is always present
	if (!ct) throw `missing response.header['content-type']`
	if (ct.includes('/json')) {
		return r.json()
	}
	if (ct.includes('/text') || ct.includes('text/')) {
		return r.text()
	}
	if (ct.includes('multipart')) {
		if (ct.startsWith('multipart/form-data')) return processFormData(r)
		else throw `cannot handle response content-type: '${ct}'`
	}
	// call blob() as catch-all
	// https://developer.mozilla.org/en-US/docs/Web/API/Response
	return r.blob()
}

/*
	expected response format
	--boundary-text-from-HTTP-headers-content-type
	header-key1: header-value1
	header-key2: header-value2

	...json, text, blob, value, etc...
	--boundary-text-from-HTTP-headers-content-type
	... same format as previous chunk ...

	--boundary-text-from-HTTP-headers-content-type--
*/

export async function processFormData(res) {
	const decoder = new TextDecoder()
	const data = {}
	try {
		const form = await res.formData()
		// The key of each form entry is a string, and the value is either a string or a Blob.
		// see https://developer.mozilla.org/en-US/docs/Web/API/FormData/entries
		for (const [key, value] of form.entries()) {
			if (value.type) {
				// value is a Blob
				data[key] = { headers: { 'content-type': value.type }, body: value }
			} else {
				// value is a string, assume to be application/x-jsonlines (one json encoded value per line)
				// and convert into an array of json-decoded values
				const body = !value ? [] : value.trim().split('\n').map(JSON.parse)
				data[key] = { headers: { 'content-type': 'application/json' }, body }
			}
		}
		return data
	} catch (e) {
		throw e
	}
}

// key: request object reference or conputed string dataName
// value: fetch promise or response
const dataCache = new Map()
// NOTE: when caching by request object reference,
// consumer code must call deleteCache(q) at the end of the request handling

// when caching by string dataName, track entries to manage the cache size
const cachedDataNames = []
// maximum number of cached dataNames, oldest will be deleted if 1000 is exceeded
const maxNumOfDataKeys = 360

/*
	memFetch()
	- fetch wrapper that saves cached responses into memory and recovers them for matching subsequent requests
	- recommended for caching responses in the backend, with the opts.q argument to cache per expressjs request object
	- should call deleteCache(request) at the end of request handling, to free unneeded cache
	
	See the usage note for getDataName() to avoid non-unique request/response.
	
	Arguments:
	url
	init{headers?, body?}
	- first two arguments are same as native fetch

	opts{q}
	q?: request object (passed by reference, not copy)
		- if provided, will be used as cache data key 
	  - if not provided, then a string cache data key will be computed from the request url, body, headers
*/
export async function memFetch(url, init, opts = {}) {
	const dataKey = opts.q || (await getDataName(url, init))
	let result = dataCache.get(dataKey)

	if (!result || (typeof result != 'object' && !(result instanceof Promise))) {
		dataCache.delete(dataKey)
		result = undefined
	}

	if (!result) {
		try {
			// do not await so that this same promise may be reused by all subsequent requests with the same dataKey
			dataCache.set(
				dataKey,
				fetch(url, init).then(async r => {
					const response = await processResponse(r)
					if (!r.ok) {
						console.log(response)
						throw 'memFetch error ' + r.status
					}
					// to-do: support opt.freeze to enforce deep freeze of data.json()
					dataCache.set(dataKey, response)
					return dataCache.get(dataKey)
				})
			)
			result = dataCache.get(dataKey)
		} catch (e) {
			delete dataCache.delete(dataKey)
			throw e
		}
	}
	if (typeof dataKey === 'string') manageCacheSize(dataKey)
	return result
}

export function deleteCache(key) {
	delete dataCache.delete(key)
}

export function manageCacheSize(dataKey) {
	// manage the number of stored keys in dataCache
	const i = cachedDataNames.indexOf(dataKey)
	if (i !== -1) cachedDataNames.splice(i, 1) // if the dataKey already exists, delete from current place in tracking array to move to front
	cachedDataNames.unshift(dataKey) // add the dataKey to the front of the tracking array
	while (cachedDataNames.length > maxNumOfDataKeys) {
		const oldestDataname = cachedDataNames.pop() // delete the dataKey from the tracking array
		dataCache.delete(oldestDataname)
	}
}

/*
	NOTE: When used in client-side code, an HttpOnly cookie for a logged in user will not be
	tracked in init.headers below. 
*/
export async function getDataName(url, init) {
	// IMPORTANT: must ensure dataName is unique to either public or logged-in user
	const dataName = url + ' | ' + init.method + ' | ' + init.body + ' | ' + JSON.stringify(init.headers)
	return await hash(dataName)
}

//
export function clearCache(opts = {}) {
	if (!opts.serverData) {
		dataCache.clear()
		return
	}
	if (typeof opts.serverData != 'object') throw `opts.serverData is not an object`
	for (const k of Object.keys(opts.serverData)) {
		delete opts.serverData[k]
	}
	if (optsServerDataNames.has(opts.serverData)) optsServerDataNames.delete(opts.serverData)
}

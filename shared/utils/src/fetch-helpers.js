import { hash } from './hash.js'
import { encode } from './urljson.js'
import { deepFreeze } from './helpers.js'

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
export async function ezFetch(_url, init = {}, opts = {}) {
	const url = opts.autoMethod ? mayAdjustRequest(_url, init) : _url
	if (typeof init.body === 'object') init.body = JSON.stringify(init.body)

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
	// if (!r.ok) {
	//   throw new Error(`HTTP error! status: ${r.status}`)
	// }
	const ct = r.headers.get('content-type') // content type is always present
	if (!ct) throw `missing response.header['content-type']`
	if (ct.includes('/json')) {
		const payload = await r.json()
		// server should use a standard HTTP response status 400+, 500+
		// so that !r.ok will already be caught when wrapping fetch with try-catch
		// if (payload.error || payload.status == '') throw payload
		// if (payload.status === 'error') throw payload.message || payload
		return payload
	}
	if (ct.includes('/text') || ct.includes('text/')) {
		return r.text()
	}
	if (ct.includes('multipart')) {
		if (ct.startsWith('multipart/form-data')) return processFormData(r)
		else throw `cannot handle response content-type: '${ct}'`
	}
	if (ct == 'application/x-ndjson-nestedkey') {
		return processNDJSON_nestedKey(r)
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

async function processNDJSON_nestedKey(r) {
	// 1. Pipe through TextDecoder to convert bytes to text
	const stream = r.body.pipeThrough(new TextDecoderStream())
	const reader = stream.getReader()
	let rootObj = {}

	let buffer = ''

	while (true) {
		const { value, done } = await reader.read()
		if (done) break

		// 2. Add new chunk to buffer
		buffer += value

		// 3. Split by newline
		let parts = buffer.split('\n')

		// 4. Keep the last partial line in the buffer
		buffer = parts.pop()

		// 5. Process complete lines
		for (const line of parts) {
			if (line.trim()) {
				const [keys, data] = JSON.parse(line) //; console.log(143, keys, data) // Process JSON data
				if (!keys.length) rootObj = data
				else {
					const lastKey = keys.pop()
					let target = rootObj
					for (const k of keys) target = target[k]
					target[lastKey] = data
				}
			}
		}
	}
	return rootObj
}

// key: request object reference or computed string dataName
// value: {
//   response: fetch promise or response,
//   exp: expiration timestamp
// }
const dataCache = new Map()
// maximum number of cached dataNames, oldest will be deleted if this is exceeded
const maxNumOfDataKeys = 10
const cacheLifetime = 1000 * 60 * 5
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
  - when passing opts.client, may include other applicable options inside the init{} object, such as retry

	opts{client}

  client: use this http client instead of native fetch
    - since fetch-helpers is shared between server and frontend workspaces, 
      cannot directly import non-native modules at the beginning of this code file 
    - for server side usage, client may be `xfetch()`, `ky` or other libraries 
*/
export async function memFetch(url, init, opts = {}) {
	if (typeof init.body === 'object') init.body = JSON.stringify(init.body)
	const dataKey = opts.q || (await getDataName(url, init))
	const { response, exp } = dataCache.get(dataKey) || {}
	const now = Date.now()
	let result = response // either a Promise or actual data

	if (result) {
		// extend the expiration, since exp is more about managing the cache size
		// and not the validity of the cached response. A response for the current
		// dataName req.url + body + headers is technically valid until a new data version
		// gets published.
		dataCache.set(dataKey, { response, exp: now + cacheLifetime })
		return result
	} else {
		try {
			// IMPORTANT: do not await so that this same promise may be reused
			// by subsequent requests with the same dataKey
			result = opts.client
				? opts.client(url, init, Object.assign(opts, { client: undefined })).then(response => {
						// replace the cached promise result with the actual data,
						// since persisting a cached promise for a long time is likely not best practice
						dataCache.set(dataKey, { response, exp: Date.now() + cacheLifetime })
						return response
				  })
				: fetch(url, init).then(async r => {
						const response = await processResponse(r)
						if (!r.ok) {
							console.trace(response)
							throw (
								'memFetch error ' +
								r.status +
								': ' +
								(typeof response == 'object' ? response.message || response.error : response)
							)
						}
						// replace the cached promise result with the actual data,
						// since persisting a cached promise for a long time is likely not best practice
						dataCache.set(dataKey, { response: deepFreeze(response), exp: Date.now() + cacheLifetime })
						return response
				  })

			dataCache.set(dataKey, { response: result, exp: Date.now() + cacheLifetime })
			manageCacheSize(now)
			return result
		} catch (e) {
			// delete this cache only if it is a promise;
			// do not delete a valid resolved data cache
			if (dataCache.get(dataKey) instanceof Promise) delete dataCache.delete(dataKey)
			throw e
		}
	}
}

export function deleteCache(key) {
	dataCache.delete(key)
}

export function manageCacheSize(_now) {
	const now = _now || Date.now()
	const keyExp = []
	for (const [key, result] of dataCache.entries()) {
		if (result.exp < now) dataCache.delete(key)
		else keyExp.push({ key, exp: result.exp })
	}
	if (dataCache.size > maxNumOfDataKeys) {
		const oldestEntries = keyExp.sort((a, b) => a.exp - b.exp).slice(maxNumOfDataKeys)
		for (const entry of oldestEntries) dataCache.delete(entry.key)
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
export function clearMemFetchDataCache(opts = {}) {
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

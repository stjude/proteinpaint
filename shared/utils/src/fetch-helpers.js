import { hash } from './hash.js'

const defaultDataCache = {}
const cachedServerDataKeys = []
const maxNumOfServerDataKeys = 1000

/*
	fetch wrapper that saves cached responses into memory 
	and recovers them for matching subsequent requests
	
	See the usage note for getDataName() to avoid non-unique request/response. 
*/
export async function memFetch(url, init, opts = {}) {
	console.log(12, url)
	const dataName = await getDataName(url, init)
	const dataCache = opts.serverData || defaultDataCache

	let result
	if (dataCache[dataName]) {
		result = dataCache[dataName]
	}
	if (!result || typeof result != 'object') {
		delete dataCache[dataName]
		result = undefined
	}

	if (!result) {
		// to-do: support opt.freeze to enforce Object.freeze(data.json())
		try {
			dataCache[dataName] = await fetch(url, init).then(async r => {
				console.log(29, '----  fetch.then() in memFetch  ----', url)
				if (!r.ok) throw 'memFetch error ' + r.status
				dataCache[dataName] = await r.json()
				return dataCache[dataName]
			})
			result = dataCache[dataName]
		} catch (e) {
			delete dataCache[dataName]
			throw e
		}
	}
	// manage the number of stored keys in dataCache
	const i = cachedServerDataKeys.indexOf(dataName)
	if (i !== -1) cachedServerDataKeys.splice(i, 1)
	cachedServerDataKeys.unshift(dataName)
	if (cachedServerDataKeys.length > maxNumOfServerDataKeys) {
		const oldestDataname = cachedServerDataKeys.pop()
		delete dataCache[oldestDataname]
	}
	return result
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
	if (ct.includes('/text')) {
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

export function clearServerDataCache(opts = {}) {
	const cache = opts?.serverData || defaultServerDataCache
	if (!cache) return
	for (const k of Object.keys(cache)) {
		delete cache[k]
	}
}

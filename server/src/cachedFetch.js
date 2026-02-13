import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import serverconfig from './serverconfig.js'
import { xfetch } from './xfetch.js'

const extApiCache = serverconfig.features?.extApiCache || {}
const extApiResponseDir = path.join(serverconfig.cachedir, 'extApiResponse')
if (serverconfig.features?.extApiCache) {
	if (!fs.existsSync(extApiResponseDir)) {
		fs.mkdirSync(extApiResponseDir, { recursive: true })
	}
	for (const substr in extApiCache) {
		const cacheDir = path.join(extApiResponseDir, extApiCache[substr])
		if (!fs.existsSync(cacheDir)) {
			fs.mkdirSync(cacheDir, { recursive: true })
		}
	}
}

/**
 * wrapper for ky that will cache a response into a FILE by default,
 * if there is a matching cachedir and use.noCache != true.
 *
 * Previously, this wrapped native fetch, but ky supports retry
 * which is needed for GDC API requests.
 *
 * Returns  {body: JSON-decoded body}
 *
 * @param url           string with optional
 * @param opts          {method, header, body, ...} similar to native fetch, got/ky/node-fetch
 * 											defaults:
 * 												method: GET
 * 												content-tyoe: 'application/json'
 *                        accept: 'application/json'
 * @param use{}	      non-fetch options to customize the client and/or response properties
 *  .noCache          (default=false) override the default behavior
 * 	.metaKey          string key to use when attaching a caching metadata object to the response
 *
 *  .client           HTTP client with get, post methods, like ky or got
 *
 *  .getErrMessage(body)  for fetch responses that does not use standard HTTP response error codes,
 *                        the response payload itself may carry the error message, the consumer code
 *                        may provide this option so that the error message can be detected and extracted
 *
 * !!! NOTE !!!: to clear the cache, `rm [cachedir]/extApiResponse/*`
 */
export async function cachedFetch(url, opts = {}, use = {}) {
	let cacheDir
	for (const substr in extApiCache) {
		if (url.includes(substr)) {
			cacheDir = path.join(extApiResponseDir, extApiCache[substr])
		}
	}

	// assume that a non-relative url indicates an external API

	if (!url.includes(':/')) throw `cannot use cachedFetch wuth a relative URL: ${url}`
	const id =
		cacheDir &&
		crypto
			.createHash('sha1')
			.update(`${url} ${JSON.stringify(opts.body)}`)
			.digest('hex')
	const cacheFile = cacheDir && path.join(cacheDir, id)

	// default headers
	// forced lowercase keys, the client is expected to normalize the HTTP request header
	// to the correct casing, not done in this function
	const headers = { 'content-type': 'application/json', accept: 'application/json' }
	if (opts.headers) {
		// opts.headers can override the expected default JSON content-type
		for (const key in opts.headers) {
			// force lowercase to ensure override
			headers[key.toLowerCase()] = opts.headers[key].toLowerCase()
		}
	}

	let body
	if (cacheFile && fs.existsSync(cacheFile) && !use.noCache) {
		try {
			// console.log(`Using cache file ${cacheFile}`)
			const content = fs.readFileSync(cacheFile)?.toString('utf-8').trim()
			body = headers.accept.includes('json') ? JSON.parse(content) : content
			const err = use.getErrMessage?.(body) || ''
			if (err) throw err
		} catch (e) {
			console.log(e)
			throw e
		}
	}

	if (!body) {
		try {
			const method = opts.method?.toLowerCase() || 'get'
			let payload
			if (!use.client) {
				opts.headers = headers
				// NOTES:
				// - For now, will use nodeFetch where simultaneous long-running requests can cause terminated or socket hangup errors.
				// - In Node 20, it looks like undici (which is used by experimental native fetch in Node 20) may not be performing garbage cleanup
				// and freeing-up resources like sockets. This issue seems to be fixed in Node 22, which will be active in October 2024.
				// - In the meantime, replacing ky with node-fetch may be a good enough fix for edge cases of very large, long-running requests.
				payload = await xfetch(url, opts)
			} else {
				const response = await use.client[method](url, {
					headers,
					body:
						method == 'get'
							? undefined
							: headers['content-type'].includes('json')
							? JSON.stringify(opts.body || {})
							: opts.body
				})

				payload =
					typeof response.body == 'string'
						? response.body
						: headers.accept.includes('json')
						? JSON.stringify(response.body)
						: opts.response
			}

			// the code that calls this function should expect a parsed JSON result,
			// UNLESS the opts.headers.accept is overriden to a non-json content-type,
			// in which case the caller should be ready to process the body as needed
			body = typeof payload == 'string' && headers['accept'].includes('json') ? JSON.parse(payload) : payload

			const err = use.getErrMessage?.(body) || ''
			if (err) throw err
			else if (cacheFile && !use.noCache) {
				fs.writeFileSync(cacheFile, typeof payload == 'string' ? payload : JSON.stringify(payload), {
					encoding: 'utf8'
				})
			}
		} catch (e) {
			throw e
		}
	}

	// in case the caller needs to know the saved cached id, mostly for testing
	if (use.metaKey) body[use.metaKey] = { id, cacheFile }
	// may add back other response metadata as needed
	return { body }
}

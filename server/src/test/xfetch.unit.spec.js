import tape from 'tape'
import util from 'node:util'
import { xfetch, removeCredentials } from '../xfetch.js'
import { isRecoverableError } from '../utils.js'
import serverconfig from '../serverconfig.js'

/*
test sections:
- xfetch(): an HTTP error response
- xfetch(): a failed connection
- xfetch(): a response body that is cut off
- xfetch(): an HTTP 503 response
- xfetch(): an aborted request
- xfetch(): serverconfig.features.networkErrorMessage
- removeCredentials()
*/

const credentials = {
	Cookie: 'sessionid=cookieValue123',
	'X-Auth-Token': 'tokenValue456',
	Authorization: 'Bearer abc789'
}
const hasCredential = s => ['cookieValue123', 'tokenValue456', 'abc789'].some(v => s.includes(v))

// a fetch() stub, so that no request leaves the test
function getFetch(status) {
	return async () =>
		new Response(JSON.stringify({ message: 'not allowed' }), {
			status,
			headers: { 'content-type': 'application/json' }
		})
}

tape('\n', test => {
	test.comment('-***- xfetch specs -***-')
	test.end()
})

tape('xfetch(): an HTTP error response', async test => {
	const headers = { ...credentials }
	let error
	try {
		await xfetch('https://api.example.org/files', { headers, fetch: getFetch(403), retry: 0 })
	} catch (e) {
		error = e
	}
	test.equal(error?.response?.status, 403, 'should throw the HTTP error with its response')
	test.notOk(hasCredential(util.inspect(error, { depth: 10 })), 'should not have a credential in the thrown error')
	test.deepEqual(headers, credentials, 'should not change the headers object of the caller')
	test.end()
})

const apiUrl = 'https://api.example.com/query'

function jsonResponse(payload, status = 200) {
	return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}

// a fetch() stub that fails to connect
async function failedFetch() {
	throw new TypeError('fetch failed', { cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }) })
}

// a fetch() stub whose response body is cut off for the first `cutOffs` calls
function getCutOffFetch(cutOffs) {
	const stub = async () => {
		stub.calls++
		if (stub.calls > cutOffs) return jsonResponse({ ok: 1 })
		const body = new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode('{"ok":'))
				controller.error(new TypeError('terminated'))
			}
		})
		return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
	}
	stub.calls = 0
	return stub
}

async function getError(url, opts) {
	try {
		await xfetch(url, opts)
	} catch (e) {
		return e
	}
}

tape('xfetch(): a failed connection', async test => {
	const error = await getError(apiUrl, { method: 'POST', body: { size: 1 }, fetch: failedFetch, retry: { limit: 0 } })
	test.equal(error?.name, 'NetworkError', 'should replace the native error')
	test.ok(error?.message.startsWith('The server is busy or not responding'), 'should have a message for a user')
	test.equal(error?.cause?.message, 'fetch failed', 'should keep the native error as the cause')
	test.equal(error?.code, 'ECONNRESET', 'should keep the network error code')
	test.ok(isRecoverableError(error), 'should still be detected as a recoverable error')

	test.end()
})

tape('xfetch(): a response body that is cut off', async test => {
	const fetch = getCutOffFetch(Infinity)
	const error = await getError('https://api.example.org/files', {
		method: 'POST',
		body: { size: 1 },
		fetch,
		retry: { limit: 0 }
	})
	test.ok(error?.message.startsWith('The server is busy or not responding'), 'should have a message for a user')
	test.equal(error?.cause?.message, 'terminated', 'should keep the native error as the cause')
	test.end()
})

tape('xfetch(): an HTTP 503 response', async test => {
	const error = await getError(apiUrl, { fetch: getFetch(503), retry: { limit: 0 } })
	test.equal(error?.name, 'NetworkError', 'should replace the HTTP error')
	test.equal(error?.response?.status, 503, 'should keep the HTTP response')
	test.end()
})

tape('xfetch(): an aborted request', async test => {
	const fetch = async () => {
		throw new DOMException('This operation was aborted', 'AbortError')
	}
	const error = await getError(apiUrl, { method: 'POST', body: { size: 1 }, fetch, retry: { limit: 0 } })
	test.equal(error?.name, 'AbortError', 'should not replace an abort error')
	test.end()
})

tape('xfetch(): serverconfig.features.networkErrorMessage', async test => {
	if (!serverconfig.features) serverconfig.features = {}
	const original = serverconfig.features.networkErrorMessage
	const opts = { method: 'POST', body: { size: 1 }, fetch: failedFetch, retry: { limit: 0 } }

	serverconfig.features.networkErrorMessage = 'Data is temporarily unavailable, please retry.'
	let error = await getError(apiUrl, opts)
	test.equal(error?.message, 'Data is temporarily unavailable, please retry.', 'should use the configured message')

	serverconfig.features.networkErrorMessage = ' '
	error = await getError(apiUrl, opts)
	test.ok(error?.message.startsWith('The server is busy'), 'should use the default message for a blank value')

	if (original === undefined) delete serverconfig.features.networkErrorMessage
	else serverconfig.features.networkErrorMessage = original
	test.end()
})

tape('removeCredentials()', test => {
	const request = new Request('https://api.example.org/files', { headers: credentials })
	const e = { request, options: { headers: new Headers({ ...credentials, Accept: 'application/json' }) } }
	removeCredentials(e)
	test.notOk(hasCredential(util.inspect(e, { depth: 10 })), 'should remove the credential headers')
	test.equal(e.options.headers.get('accept'), 'application/json', 'should keep the other headers')
	test.doesNotThrow(() => removeCredentials('a string error'), 'should accept an error that is not an object')
	test.doesNotThrow(() => removeCredentials(null), 'should accept a null error')
	test.end()
})

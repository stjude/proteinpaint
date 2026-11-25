import tape from 'tape'
import util from 'node:util'
import { xfetch, abortCtrlBy, removeCredentials, getRetryDelay } from '../xfetch.js'
import { isRecoverableError } from '../utils.js'
import { setHostpathOptions, clearHostpathOptions } from '../xfetch.hostpath.ts'

/*
test sections:
- xfetch(): an HTTP error response
- xfetch(): a failed connection
- xfetch(): a response body that is cut off
- xfetch(): an HTTP 503 response
- xfetch(): an aborted request
- xfetch(): a registered networkErrorMessage
- xfetch(): a retry of a failed connection
- xfetch(): a retry of a response body that is cut off
- xfetch(): a shouldRetry() option and a response body that is cut off
- xfetch(): a shouldRetry() that aborts the request and then fails
- xfetch(): a retry delay() that throws for a response body that is cut off
- xfetch(): an abort while waiting to retry a response body that is cut off
- xfetch(): a registered retry option
- getRetryDelay()
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

tape('xfetch(): a registered networkErrorMessage', async test => {
	setHostpathOptions(
		{ 'api.example.com': { networkErrorMessage: 'Data is temporarily unavailable, please retry.' } },
		'ds1'
	)
	const opts = { method: 'POST', body: { size: 1 }, fetch: failedFetch, retry: { limit: 0 } }
	let error = await getError(apiUrl, opts)
	test.equal(error?.message, 'Data is temporarily unavailable, please retry.', 'should use the message of the hostpath')

	error = await getError('https://api.example.org/files', opts)
	test.ok(error?.message.startsWith('The server is busy'), 'should use the default message for another host')
	clearHostpathOptions()
	test.end()
})

// a retry option without a backoff delay, so that the tests do not wait
const postRetry = { limit: 1, methods: ['post'], backoffLimit: 1 }

tape('xfetch(): a retry of a failed connection', async test => {
	let calls = 0
	const fetch = async () => {
		calls++
		return failedFetch()
	}
	const error = await getError(apiUrl, { method: 'POST', body: { size: 1 }, fetch, retry: postRetry })
	test.equal(calls, 2, 'should retry a POST request when the retry option allows it')
	test.equal(error?.name, 'NetworkError', 'should replace the native error after the retry')
	test.end()
})

tape('xfetch(): a retry of a response body that is cut off', async test => {
	const fetch1 = getCutOffFetch(1)
	const payload = await xfetch(apiUrl, { method: 'POST', body: { size: 1 }, fetch: fetch1, retry: postRetry })
	test.deepEqual(payload, { ok: 1 }, 'should retry once and return the payload')
	test.equal(fetch1.calls, 2, 'should request again after the body is cut off')

	const fetch2 = getCutOffFetch(Infinity)
	await getError(apiUrl, { method: 'POST', body: { size: 1 }, fetch: fetch2, retry: { limit: 0 } })
	test.equal(fetch2.calls, 1, 'should not retry when the retry option does not allow it')

	// another host has no retry option, so the ky defaults apply: a GET is retried with ky's default limit
	const fetch3 = getCutOffFetch(1)
	const payload3 = await xfetch('https://api.example.org/files', { fetch: fetch3 })
	test.deepEqual(payload3, { ok: 1 }, 'should retry a GET request without a retry option, as ky does')
	test.equal(fetch3.calls, 2, 'should request again with the default retry limit')

	const fetch4 = getCutOffFetch(1)
	await getError('https://api.example.org/files', { method: 'POST', body: { size: 1 }, fetch: fetch4 })
	test.equal(fetch4.calls, 1, 'should not retry a POST request without a retry option, as ky does')
	test.end()
})

tape('xfetch(): a shouldRetry() option and a response body that is cut off', async test => {
	const calls = []
	const shouldRetry = state => {
		calls.push(state)
		return false
	}
	const fetch = getCutOffFetch(1)
	const error = await getError(apiUrl, { fetch, retry: { limit: 1, shouldRetry } })
	test.equal(fetch.calls, 1, 'should not request again when shouldRetry() returns false')
	test.equal(error?.name, 'NetworkError', 'should replace the cut-off body error')
	test.equal(calls[0]?.error?.message, 'terminated', 'should give shouldRetry() the cut-off body error')
	test.equal(calls[0]?.retryCount, 1, 'should give shouldRetry() the retry count')

	const fetch2 = getCutOffFetch(1)
	const payload = await xfetch(apiUrl, {
		fetch: fetch2,
		retry: { limit: 1, backoffLimit: 1, shouldRetry: () => undefined }
	})
	test.deepEqual(payload, { ok: 1 }, 'should retry when shouldRetry() returns undefined')
	test.equal(fetch2.calls, 2, 'should request again when shouldRetry() returns undefined')

	const fetch3 = getCutOffFetch(1)
	const thrown = new Error('shouldRetry failed')
	const error3 = await getError(apiUrl, {
		fetch: fetch3,
		retry: {
			limit: 1,
			shouldRetry: () => {
				throw thrown
			}
		}
	})
	test.equal(error3, thrown, 'should throw the error of shouldRetry(), as ky does')
	test.equal(fetch3.calls, 1, 'should not request again when shouldRetry() throws')

	// an abort while an async shouldRetry() is pending
	const ctrl = new AbortController()
	const fetch4 = getCutOffFetch(1)
	const start = Date.now()
	const shouldRetryAfterAbort = async () => {
		ctrl.abort()
		return true
	}
	const error4 = await getError(apiUrl, {
		fetch: fetch4,
		signal: ctrl.signal,
		retry: { limit: 1, delay: () => 5000, shouldRetry: shouldRetryAfterAbort }
	})
	test.equal(error4?.name, 'AbortError', 'should throw the abort error after an abort during shouldRetry()')
	test.ok(Date.now() - start < 1000, 'should not wait to retry after an abort during shouldRetry()')
	test.equal(fetch4.calls, 1, 'should not request again after an abort during shouldRetry()')

	// an abort while shouldRetry() never settles
	const ctrl5 = new AbortController()
	const fetch5 = getCutOffFetch(1)
	const start5 = Date.now()
	setTimeout(() => ctrl5.abort(), 50)
	const error5 = await getError(apiUrl, {
		fetch: fetch5,
		signal: ctrl5.signal,
		retry: { limit: 1, shouldRetry: () => new Promise(() => {}) }
	})
	test.equal(error5?.name, 'AbortError', 'should throw the abort error when shouldRetry() is pending')
	test.ok(Date.now() - start5 < 1000, 'should not wait for a pending shouldRetry() after an abort')
	test.equal(fetch5.calls, 1, 'should not request again after an abort while shouldRetry() is pending')
	test.end()
})

tape('xfetch(): a shouldRetry() that aborts the request and then fails', async test => {
	const unhandled = []
	const onUnhandled = reason => unhandled.push(reason)
	process.on('unhandledRejection', onUnhandled)

	for (const [label, getShouldRetry] of [
		[
			'throws',
			ctrl => () => {
				ctrl.abort()
				throw new Error('shouldRetry failed')
			}
		],
		[
			'rejects',
			ctrl => () => {
				ctrl.abort()
				return Promise.reject(new Error('shouldRetry failed'))
			}
		]
	]) {
		const ctrl = new AbortController()
		const fetch = getCutOffFetch(1)
		const error = await getError(apiUrl, {
			fetch,
			signal: ctrl.signal,
			retry: { limit: 1, shouldRetry: getShouldRetry(ctrl) }
		})
		test.equal(error?.name, 'AbortError', `should throw the abort error when shouldRetry() aborts and ${label}`)
		test.equal(fetch.calls, 1, `should not request again when shouldRetry() aborts and ${label}`)
	}
	// an unhandled rejection is reported after the microtasks of the rejected promise
	await new Promise(resolve => setTimeout(resolve, 20))
	process.off('unhandledRejection', onUnhandled)
	test.deepEqual(unhandled, [], 'should not leave an unhandled rejection from shouldRetry()')
	test.end()
})

tape('xfetch(): a retry delay() that throws for a response body that is cut off', async test => {
	// the request is one of a set that shares an abort controller, see abortCtrlBy.signal
	const ctrl = new AbortController()
	abortCtrlBy.signal.set(ctrl.signal, ctrl)
	const thrown = new Error('delay failed')
	const fetch = getCutOffFetch(1)
	const error = await getError(apiUrl, {
		fetch,
		signal: ctrl.signal,
		retry: {
			limit: 1,
			delay: () => {
				throw thrown
			}
		}
	})
	test.equal(error, thrown, 'should throw the error of delay()')
	test.equal(fetch.calls, 1, 'should not request again when delay() throws')
	test.ok(ctrl.signal.aborted, 'should abort the other requests that share the signal')
	test.end()
})

tape('xfetch(): an abort while waiting to retry a response body that is cut off', async test => {
	const ctrl = new AbortController()
	const fetch = getCutOffFetch(1)
	const retry = { limit: 1, delay: () => 5000 }
	const start = Date.now()
	setTimeout(() => ctrl.abort(), 50)
	const error = await getError(apiUrl, { fetch, retry, signal: ctrl.signal })
	test.equal(error?.name, 'AbortError', 'should throw the abort error')
	test.ok(Date.now() - start < 1000, 'should stop waiting when the request is aborted')
	test.equal(fetch.calls, 1, 'should not request again after an abort')
	test.end()
})

tape('xfetch(): a registered retry option', async test => {
	setHostpathOptions({ 'api.example.com': { retry: { limit: 1, methods: ['POST'], backoffLimit: 1 } } }, 'test-ds')
	const fetch = getCutOffFetch(1)
	const payload = await xfetch(apiUrl, { method: 'POST', body: { size: 1 }, fetch })
	test.deepEqual(payload, { ok: 1 }, 'should retry a POST request when the registered option allows it')
	test.equal(fetch.calls, 2, 'should request again with the registered option')

	const fetch2 = getCutOffFetch(1)
	await getError('https://api.example.org/files', { method: 'POST', body: { size: 1 }, fetch: fetch2 })
	test.equal(fetch2.calls, 1, 'should not use the registered option for another host')
	clearHostpathOptions()
	test.end()
})

tape('getRetryDelay()', test => {
	test.equal(getRetryDelay(undefined, 1), 300, 'should use the ky default delay without a retry option')
	test.equal(getRetryDelay(2, 2), 600, 'should use the ky default delay with a numeric retry option')
	test.equal(getRetryDelay({ backoffLimit: 1 }, 1), 1, 'should limit the delay to backoffLimit')
	test.equal(getRetryDelay({ delay: () => 50, jitter: () => -1 }, 1), 50, 'should ignore an invalid jitter result')
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

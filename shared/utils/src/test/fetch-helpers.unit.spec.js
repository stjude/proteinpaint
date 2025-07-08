import tape from 'tape'
import { ezFetch } from '../fetch-helpers.js'

/**************
 test helpers
***************/

const root =
	typeof global !== 'undefined'
		? global
		: typeof window !== 'undefined'
		? window
		: typeof self !== 'undefined'
		? self
		: this

// save to restore global fetch after using mockFetch()
const nativeFetch = root.fetch

// Mock fetch for testing
function mockFetch(response, ok = true, contentType = 'application/json') {
	return function (url, init) {
		return Promise.resolve({
			ok,
			status: ok ? 200 : 404,
			headers: {
				get: h => (h === 'content-type' ? contentType : undefined)
			},
			json: async () => response,
			text: async () => (typeof response === 'string' ? response : JSON.stringify(response)),
			blob: async () => response
		})
	}
}

function cleanup() {
	root.fetch = nativeFetch
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- #shared/fetch-helpers -***-')
	test.end()
})

tape('init.body handling', async test => {
	test.teardown(cleanup)
	root.fetch = (url, init) => {
		test.equal(url, 'http://api/test?test=abc', 'should encode init.body into URL-params')
		return mockFetch({ test: 'init.body' })(url, init)
	}
	await ezFetch('http://api/test', { body: { test: 'abc' } })

	root.fetch = (url, init) => {
		test.equal(url, 'http://api/test', 'should not change the url')
		test.equal(init.body, '{"test":"xyz"}', 'should encode init.body into JSON string')
		return mockFetch({ test: 'init.body' })(url, init)
	}
	await ezFetch('http://api/test', { method: 'POST', body: { test: 'xyz' } })
	test.end()
})

tape('json response', async test => {
	test.teardown(cleanup)
	root.fetch = mockFetch({ hello: 'world' })
	const result = await ezFetch('http://api/test')
	test.deepEqual(result, { hello: 'world' }, 'should returns parsed JSON')
	test.end()
})

tape('text response', async test => {
	test.teardown(cleanup)
	root.fetch = mockFetch('plain text response', true, 'text/plain')
	const result = await ezFetch('http://api/test')
	test.equal(result, 'plain text response', 'should return text body')
	test.end()
})

tape('error handling', async test => {
	test.teardown(cleanup)
	root.fetch = mockFetch({ error: 'Not found' }, false)
	const message = 'should throw with response body'
	try {
		await ezFetch('http://api/test')
		test.fail(message)
	} catch (e) {
		test.deepEqual(e, { error: 'Not found' }, message)
	}
	test.end()
})

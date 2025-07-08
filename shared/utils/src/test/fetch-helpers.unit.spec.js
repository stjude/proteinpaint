const tape = require('tape')
const { ezFetch } = require('../fetch-helpers')

/**************
 test helpers
***************/

// save to restore global fetch after using mockFetch()
const nativeFetch = fetch

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
	global.fetch = nativeFetch
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- #shared/fetch-helpers -***-')
	test.end()
})

tape('json response', async test => {
	test.teardown(cleanup)
	global.fetch = mockFetch({ hello: 'world' })
	const result = await ezFetch('http://api/test')
	test.deepEqual(result, { hello: 'world' }, 'should returns parsed JSON')
	test.end()
})

tape('text response', async test => {
	test.teardown(cleanup)
	global.fetch = mockFetch('plain text response', true, 'text/plain')
	const result = await ezFetch('http://api/test')
	test.equal(result, 'plain text response', 'should return text body')
	test.end()
})

tape('error handling', async test => {
	test.teardown(cleanup)
	global.fetch = mockFetch({ error: 'Not found' }, false)
	const message = 'should throw with response body'
	try {
		await ezFetch('http://api/test')
		test.fail(message)
	} catch (e) {
		test.deepEqual(e, { error: 'Not found' }, message)
	}
	test.end()
})

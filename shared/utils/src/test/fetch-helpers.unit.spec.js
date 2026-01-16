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
			blob: async () => response,
			body: {
				pipeThrough() {
					return {
						getReader() {
							const maxIndex = response.length
							let i = -1
							return {
								read: async () => {
									i++
									return i >= maxIndex ? { done: true } : { value: JSON.stringify(response[i]) + '\n', done: false }
								}
							}
						}
					}
				}
			}
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
	test.comment('-***- #shared/fetch-helpers -***-')
	test.end()
})

tape('init.body handling using opts.autoMethod', async test => {
	test.teardown(cleanup)
	root.fetch = (url, init) => {
		test.equal(url, 'http://api/test?test=abc', 'should encode init.body into URL-params')
		return mockFetch({ test: 'init.body' })(url, init)
	}
	await ezFetch('http://api/test', { body: { test: 'abc' } }, { autoMethod: true })

	root.fetch = (url, init) => {
		test.equal(url, 'http://api/test', 'should not change the url')
		test.equal(init.body, '{"test":"xyz"}', 'should encode init.body into JSON string')
		return mockFetch({ test: 'init.body' })(url, init)
	}
	await ezFetch('http://api/test', { method: 'POST', body: { test: 'xyz' } }, { autoMethod: true })
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

tape('x-ndjson-nestedkeys', async test => {
	test.teardown(cleanup)

	//
	const data = {
		samples: {
			SJ001: { data: 'abc', term1: { key: '1', value: 'test' } },
			SJ002: { data: 'abc', term2: { key: '1', value: 'test' } }
		},
		refs: {
			bySampleId: {
				SJ001: { name: 'SJ001' },
				SJ002: { name: 'SJ002' }
			},
			byTermId: {
				term1: { label: 'Term 1' },
				term2: { label: 'Term 2' }
			}
		}
	}

	const response = [
		[[], { samples: {}, refs: { bySampleId: {} } }],
		...Object.entries(data.samples).map(kv => [['samples', kv[0]], kv[1]]),
		...Object.entries(data.refs.bySampleId).map(kv => [['refs', 'bySampleId', kv[0]], kv[1]]),
		[['refs', 'byTermId'], data.refs.byTermId]
	]

	root.fetch = mockFetch(structuredClone(response), true, 'application/x-ndjson-nestedkey')
	const result = await ezFetch('http://api/test')
	test.deepEqual(result, data, 'should return parsed and fully built body')
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

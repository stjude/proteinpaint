import tape from 'tape'
import util from 'node:util'
import { xfetch, removeCredentials } from '../xfetch.js'

/*
test sections:
- xfetch(): an HTTP error response
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

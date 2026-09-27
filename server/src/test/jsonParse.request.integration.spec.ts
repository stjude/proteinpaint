/*
	Request-based regression tests for json parsing of the request body and URL query params.

	The app middlewares parse a json request body and urljson-encoded URL query params with
	secure-json-parse, which rejects a __proto__ or constructor.prototype key. Otherwise,
	Object.assign(req.query, req.body) in the app middlewares would replace the prototype of req.query.

	Run from the server dir:
	npm run test:request
*/

import tape from 'tape'
import { startTestServer, type TestServer } from '../../test/testServer.ts'

const protoError = /prototype property/
const forbiddenNameError = /forbidden request payload name/

let server: TestServer

tape('\n', test => {
	test.comment('-***- json parse requests -***-')
	test.end()
})

tape('start server', async test => {
	test.timeoutAfter(90000)
	server = await startTestServer()
	test.pass(`server is listening at ${server.url}`)
	test.end()
})

tape('a json request body is parsed', async test => {
	test.timeoutAfter(10000)
	const res = await post(server, '/genomes', JSON.stringify({ embedder: 'localhost' }))
	test.equal(res.status, 200, 'should respond with 200 for a valid json body')
	test.ok(res.body.genomes, 'should respond with the genomes')

	const empty = await post(server, '/genomes', '')
	test.equal(empty.status, 200, 'should respond with 200 for an empty body')
	test.ok(empty.body.genomes, 'should respond with the genomes for an empty body')

	const invalid = await post(server, '/genomes', '{"embedder":')
	test.equal(invalid.status, 400, 'should respond with 400 for an invalid json body')
	test.match(invalid.body.error, /invalid json body/, 'should explain that the json body is invalid')
	test.end()
})

tape('a json request body with a prototype key is rejected', async test => {
	test.timeoutAfter(10000)
	for (const [label, body] of [
		['__proto__', '{"embedder":"localhost","__proto__":{"isAdmin":true}}'],
		['nested __proto__', '{"embedder":"localhost","filter":{"lst":[{"__proto__":{"isAdmin":true}}]}}'],
		['constructor.prototype', '{"embedder":"localhost","constructor":{"prototype":{"isAdmin":true}}}']
	]) {
		const res = await post(server, '/genomes', body)
		test.equal(res.status, 400, `should respond with 400 for a ${label} key in the json body`)
		test.match(res.body.error, protoError, `should explain that the ${label} key is not allowed`)
		test.notOk(res.body.genomes, `should not respond with data for a ${label} key`)
	}
	test.end()
})

tape('a urljson query param with a prototype key is rejected', async test => {
	test.timeoutAfter(10000)
	const ok = await get(server, '/genomes', `embedder=localhost&filter=${encodeURIComponent('{"lst":[]}')}`)
	test.equal(ok.status, 200, 'should respond with 200 for a valid urljson query param')

	for (const [label, value] of [
		['__proto__', '{"__proto__":{"isAdmin":true}}'],
		['constructor.prototype', '[{"constructor":{"prototype":{"isAdmin":true}}}]']
	]) {
		const res = await get(server, '/genomes', `embedder=localhost&filter=${encodeURIComponent(value)}`)
		test.equal(res.status, 400, `should respond with 400 for a ${label} key in a urljson query param`)
		test.match(res.body.error, protoError, `should explain that the ${label} key is not allowed`)
	}
	test.end()
})

tape('a prototype-related name as a query param value is rejected', async test => {
	test.timeoutAfter(10000)
	// a dslabel/genome that names an inherited property must not select an Object.prototype member,
	// see findForbiddenName() and the Object.hasOwn lookups in app.middlewares.js
	for (const value of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
		const res = await get(server, '/termdb/config', `genome=hg38-test&dslabel=${value}&embedder=localhost`)
		test.equal(res.status, 400, `should respond with 400 for dslabel=${value}`)
		test.match(res.body.error, forbiddenNameError, `should reject dslabel=${value} as a forbidden name`)

		const g = await get(server, '/termdb/config', `genome=${value}&dslabel=TermdbTest&embedder=localhost`)
		test.equal(g.status, 400, `should respond with 400 for genome=${value}`)
	}
	test.end()
})

tape('a prototype-related name nested in a json body value is rejected', async test => {
	test.timeoutAfter(10000)
	const res = await post(server, '/termdb', '{"embedder":"localhost","filter":{"lst":["toString"]}}')
	test.equal(res.status, 400, 'should respond with 400 for a forbidden name nested in a body value')
	test.match(res.body.error, forbiddenNameError, 'should report the forbidden name path')
	test.end()
})

tape('stop server', async test => {
	test.timeoutAfter(10000)
	await server?.stop()
	test.pass('server stopped')
	test.end()
})

async function get(server: TestServer, path: string, query: string) {
	const res = await fetch(`${server.url}${path}${query ? '?' + query : ''}`)
	return { status: res.status, body: await parseBody(res) }
}

/** body is the raw text, to send json that JSON.stringify() would not produce, such as a __proto__ key */
async function post(server: TestServer, path: string, body: string) {
	const res = await fetch(`${server.url}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body
	})
	return { status: res.status, body: await parseBody(res) }
}

async function parseBody(res: Response) {
	const text = await res.text()
	try {
		return JSON.parse(text)
	} catch {
		return { text }
	}
}

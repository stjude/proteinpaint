/*
	Request-based regression tests for the termdb/matrix sample id policy.

	A logged-in session is not enough to receive sample-level matrix data: the dataset's displaySampleIds
	policy is evaluated for the session's role (see AuthApi.canDisplaySampleIds()). For a denied role,
	get_matrix() in termdb.get_matrix.ts must:
	- still end the response stream, instead of waiting on sample rows that it never sends
	- not send any sample rows
	- not send refs.bySampleId, which is filled with every sample's label before the policy is applied

	The server loads test/testdata/termdb.test.rolePolicy.ts, a TermdbTest whose displaySampleIds
	allows the 'admin' role only, like careReg.

	Run from the server dir:
	npm run test:request
*/

import tape from 'tape'
import jsonwebtoken from 'jsonwebtoken'
import { startTestServer, type TestServer } from '../../test/testServer.ts'

const secret = 'request-test-secret' // pragma: allowlist secret
const headerKey = 'x-ds-access-token'
const genome = 'hg38-test'
const dslabel = 'TermdbTest'
const embedder = 'localhost'

let server: TestServer

tape('\n', test => {
	test.comment('-***- termdb/matrix sample id policy requests -***-')
	test.end()
})

tape('start server', async test => {
	test.timeoutAfter(90000)
	server = await startTestServer({
		genomes: [
			{
				name: genome,
				species: 'human',
				file: './genome/hg38.test.js',
				datasets: [{ name: dslabel, jsfile: 'test/testdata/termdb.test.rolePolicy.ts' }]
			}
		],
		dsCredentials: { [dslabel]: { termdb: { '*': { type: 'jwt', secret, headerKey } } } }
	})
	test.pass(`server is listening at ${server.url}`)
	test.end()
})

tape('a logged-in role that is denied sample ids', async test => {
	test.timeoutAfter(15000)
	const lines = await getMatrix(test, 'user')
	if (!lines) return test.end()

	test.equal(sampleRows(lines).length, 0, 'should not send any sample rows')
	const refs = getRefs(lines)
	test.ok(refs, 'should end the stream with the refs line')
	test.deepEqual(refs?.bySampleId, {}, 'should not send refs.bySampleId')
	test.end()
})

tape('a logged-in role that is allowed sample ids', async test => {
	// a control, to prove that the denials above are due to the policy and not a broken request
	test.timeoutAfter(15000)
	const lines = await getMatrix(test, 'admin')
	if (!lines) return test.end()

	test.ok(sampleRows(lines).length, 'should send sample rows')
	const refs = getRefs(lines)
	test.ok(Object.keys(refs?.bySampleId || {}).length, 'should send refs.bySampleId')
	test.end()
})

tape('stop server', async test => {
	test.timeoutAfter(10000)
	await server?.stop()
	test.pass('server stopped')
	test.end()
})

/* logs in with the given role, then requests the matrix data of one dictionary term;
returns the parsed ndjson lines, or undefined after a failed assertion */
async function getMatrix(test, role: string) {
	const login = await post('/jwt-status', { genome, dslabel, embedder }, loginHeaders(role))
	if (!login.body.jwt) {
		test.fail(`missing session jwt for role='${role}': ${JSON.stringify(login.body)}`)
		return
	}
	const body = {
		genome,
		dslabel,
		embedder,
		terms: [{ $id: 'sex', term: { id: 'sex', type: 'categorical' }, q: { type: 'values' } }]
	}
	try {
		// a denied request used to never end its response stream, so fail fast instead of waiting on the tape timeout
		const res = await fetch(`${server.url}/termdb/matrix`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...bearer(login.body.jwt) },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(5000)
		})
		test.equal(res.status, 200, `should respond with 200 for role='${role}'`)
		const text = await res.text()
		return text
			.split('\n')
			.filter(Boolean)
			.map(line => JSON.parse(line))
	} catch (e: any) {
		test.fail(`termdb/matrix did not complete for role='${role}': ${e.message || e}`)
	}
}

// each line is [keyPath, value], see the x-ndjson-nestedkey stream in termdb.get_matrix.ts
function sampleRows(lines: any[]) {
	return lines.filter(([keys]) => keys[0] == 'samples')
}

function getRefs(lines: any[]) {
	return lines.find(([keys]) => keys.length == 1 && keys[0] == 'refs')?.[1]
}

function loginHeaders(role: string) {
	const iat = Math.floor(Date.now() / 1000)
	const payload = { iat, exp: iat + 3600, email: 'user@test.tld', ip: '127.0.0.1', clientAuthResult: { role } }
	return { [headerKey]: jsonwebtoken.sign(payload, secret) }
}

function bearer(jwt: string) {
	return { authorization: `Bearer ${Buffer.from(jwt).toString('base64')}` }
}

async function post(path: string, body: any, headers = {}) {
	const res = await fetch(`${server.url}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		body: JSON.stringify(body)
	})
	const text = await res.text()
	try {
		return { status: res.status, body: JSON.parse(text) }
	} catch {
		return { status: res.status, body: { text } }
	}
}

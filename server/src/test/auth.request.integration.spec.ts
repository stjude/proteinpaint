/*
	Request-based regression tests for auth and credential processing.

	These tests send real HTTP requests to a fully launched server (see server/test/testServer.ts),
	so that the app middlewares, the auth middleware, auth routes, and the route handlers' own
	sign-in checks are verified to work together to prevent unauthorized access to sample-level data.
	The unit specs in server/src/auth/test and server/src/test/auth.unit.spec.js test the same gates
	in isolation.

	Each credential scenario below starts its own server with a different serverconfig.dsCredentials,
	and runs the same requests against it:
	- non-string auth query params are rejected
	- protected route paths require a session, including case and trailing slash variants
	- sample-level data is withheld from a request without a session
	- invalid, expired, forged, and other-dataset tokens do not establish a session
	- a valid session does unlock the same data, to prove that the denials above are due to auth

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
const signInError = /sign in/i

type Scenario = {
	name: string
	dsCredentials: any
	/** an embedder that matches the credential */
	embedder: string
	basepath?: string
	/** true if the credential protects all routes, so that the auth middleware rejects every data request
	 * without a session, instead of the route handlers withholding sample-level data */
	allRoutes?: boolean
	/** an embedder that does not match any credential, so the dataset is open access for it */
	openEmbedder?: string
	/** an embedder with a slash, which a glob '*' alone does not match */
	slashEmbedder?: string
}

const jwtCred = { type: 'jwt', secret, headerKey }

const scenarios: Scenario[] = [
	{
		name: 'exact dslabel key, wildcard embedder',
		dsCredentials: { [dslabel]: { termdb: { '*': jwtCred } } },
		embedder: 'localhost',
		slashEmbedder: 'a/b'
	},
	{
		name: 'glob dslabel and embedder keys, with a basepath',
		dsCredentials: { 'Termdb*': { termdb: { '*.example.org': jwtCred } } },
		embedder: 'portal.example.org',
		basepath: '/pp',
		openEmbedder: 'other.org'
	},
	{
		name: 'all-routes credential with a glob embedder',
		dsCredentials: { [dslabel]: { '*': { '*.example.org': jwtCred } } },
		embedder: 'portal.example.org',
		allRoutes: true
	}
]

for (const sc of scenarios) runScenario(sc)

function runScenario(sc: Scenario) {
	let server: TestServer
	const embedder = sc.embedder
	const base = `genome=${genome}&dslabel=${dslabel}&embedder=${encodeURIComponent(embedder)}`

	tape('\n', test => {
		test.comment(`-***- auth requests: ${sc.name} -***-`)
		test.end()
	})

	tape(`${sc.name}: start server`, async test => {
		test.timeoutAfter(90000)
		server = await startTestServer({ dsCredentials: sc.dsCredentials, basepath: sc.basepath })
		test.pass(`server is listening at ${server.url}`)
		test.end()
	})

	tape(`${sc.name}: non-string auth query params are rejected`, async test => {
		test.timeoutAfter(10000)
		for (const [param, query] of [
			['dslabel', `genome=${genome}&dslabel[]=${dslabel}&embedder=${embedder}&getsamplelist=1`],
			['embedder', `genome=${genome}&dslabel=${dslabel}&embedder[]=${embedder}&getsamplelist=1`],
			['genome', `genome[]=${genome}&dslabel=${dslabel}&embedder=${embedder}&getsamplelist=1`],
			['route', `${base}&route[]=termdb&getsamplelist=1`]
		]) {
			const res = await get(server, '/termdb', query)
			test.equal(res.status, 400, `should respond with 400 for ${param}[] in the URL query`)
			test.match(res.body.error, /must be a string/, `should explain that ${param} must be a string`)
		}

		const res = await post(server, '/termdb/chat', { genome, dslabel: [dslabel], embedder, omnisearch: true })
		test.equal(res.status, 400, `should respond with 400 for an array dslabel in a JSON request body`)

		const login = await post(server, '/jwt-status', { genome, dslabel, embedder: [embedder] }, loginHeaders())
		test.equal(login.status, 400, `should respond with 400 for an array embedder when logging in`)
		test.notOk(login.body.jwt, `should not issue a session jwt for an array embedder`)
		test.end()
	})

	tape(`${sc.name}: protected route paths require a session`, async test => {
		test.timeoutAfter(10000)
		for (const path of ['/termdb/matrix', '/TERMDB/MATRIX', '/termdb/matrix/', '/Termdb/Matrix/']) {
			const res = await get(server, path, base)
			test.equal(res.status, 401, `should respond with 401 for ${path}`)
		}
		if (sc.basepath) {
			// the path is not under the basepath, so it should not be handled as a data route
			const res = await get(server, '/termdb/matrix', base, {}, server.origin)
			test.notEqual(res.status, 200, `should not serve /termdb/matrix outside of the basepath`)
		}

		// the forced-open auth routes should still be reachable without a session
		const health = await get(server, '/healthcheck', '')
		test.equal(health.status, 200, `should allow /healthcheck without a session`)
		const noToken = await post(server, '/jwt-status', { genome, dslabel, embedder })
		test.equal(noToken.status, 401, `should reach /jwt-status without a session, and reject a missing token`)
		test.match(String(noToken.body.error), new RegExp(`missing header\\['${headerKey}'\\]`), `should ask for a token`)
		test.end()
	})

	tape(`${sc.name}: sample-level data is withheld without a session`, async test => {
		test.timeoutAfter(10000)
		const reqs = sampleRequests(base)

		if (sc.allRoutes) {
			for (const [label, query] of Object.entries(reqs)) {
				const res = await get(server, '/termdb', query)
				test.equal(res.status, 401, `should respond with 401 for ${label}`)
			}
			const chat = await post(server, '/termdb/chat', omnisearchBody(embedder))
			test.equal(chat.status, 401, `should respond with 401 for omnisearch`)
			test.end()
			return
		}

		const allSamples = await get(server, '/termdb', reqs.getAllSamples)
		test.deepEqual(sampleKeys(allSamples.body), [], `should not return sample names for for=getAllSamples`)

		const forArray = await get(server, '/termdb', reqs['for[]=getAllSamples'])
		test.equal(forArray.body.error, 'invalid q.for', `should reject an array q.for`)

		const byName = await get(server, '/termdb', reqs.getSamplesByName)
		test.deepEqual(sampleKeys(byName.body), [], `should not return a sample name map for for=getSamplesByName`)

		const list = await get(server, '/termdb', reqs.getsamplelist)
		test.ok(Array.isArray(list.body) && list.body.length, `should still return the sample list for getsamplelist=1`)
		test.equal(list.body.filter?.(s => 'name' in s).length, 0, `should not include sample names in getsamplelist=1`)

		for (const label of ['getsamples', 'convertSampleId', 'singleSampleData']) {
			const res = await get(server, '/termdb', reqs[label])
			test.match(String(res.body.error), signInError, `should require sign in for ${label}`)
		}

		const chat = await post(server, '/termdb/chat', omnisearchBody(embedder))
		test.equal(chat.status, 200, `should respond to omnisearch`)
		test.deepEqual(chat.body.samples, [], `should not return matched samples from omnisearch`)

		if (sc.slashEmbedder) {
			const res = await post(server, '/termdb/chat', omnisearchBody(sc.slashEmbedder))
			test.deepEqual(res.body.samples, [], `should not return omnisearch samples for embedder='${sc.slashEmbedder}'`)
			const list = await get(server, '/termdb', sampleRequests(baseFor(sc.slashEmbedder)).getsamplelist)
			test.equal(
				list.body.filter?.(s => 'name' in s).length,
				0,
				`should not include sample names in getsamplelist=1 for embedder='${sc.slashEmbedder}'`
			)
		}

		if (sc.openEmbedder) {
			// a control for glob embedder matching: the credential is not applicable to this embedder,
			// so the dataset is open access and sample names should be displayed without a session
			const list = await get(server, '/termdb', sampleRequests(baseFor(sc.openEmbedder)).getsamplelist)
			test.ok(
				list.body.length && list.body.every(s => 'name' in s),
				`should include sample names for embedder='${sc.openEmbedder}' that does not match the glob embedder key`
			)
		}
		test.end()
	})

	tape(`${sc.name}: invalid, expired, forged, or other-dataset tokens do not establish a session`, async test => {
		test.timeoutAfter(10000)
		const iat = Math.floor(Date.now() / 1000)
		const loginTokens = {
			'a login token with an invalid signature': jsonwebtoken.sign(loginPayload(), 'wrong-secret'),
			'an expired login token': jsonwebtoken.sign(loginPayload({ iat: iat - 7200, exp: iat - 3600 }), secret),
			'a login token for a different IP address': jsonwebtoken.sign(loginPayload({ ip: '10.1.2.3' }), secret)
		}
		for (const [label, token] of Object.entries(loginTokens)) {
			const res = await post(server, '/jwt-status', { genome, dslabel, embedder }, { [headerKey]: token })
			test.equal(res.status, 401, `should respond with 401 to ${label}`)
			test.notOk(res.body.jwt, `should not issue a session jwt for ${label}`)
		}

		// session-shaped jwts, as if they were issued by /jwt-status
		const sessionPayload = { iat, exp: iat + 3600, time: Date.now(), ip: '127.0.0.1', route: 'termdb', embedder }
		const bearerTokens = {
			'a forged session jwt': jsonwebtoken.sign({ ...sessionPayload, dslabel }, 'wrong-secret'),
			'a session jwt for a different dataset': jsonwebtoken.sign(
				{ ...sessionPayload, dslabel: 'ProtectedTest' },
				secret
			)
		}
		for (const [label, token] of Object.entries(bearerTokens)) {
			const headers = bearer(token)
			const matrix = await get(server, '/termdb/matrix', base, headers)
			test.equal(matrix.status, 401, `should respond with 401 for /termdb/matrix with ${label}`)
			const samples = await get(server, '/termdb', sampleRequests(base).getAllSamples, headers)
			test.deepEqual(sampleKeys(samples.body), [], `should not return sample names with ${label}`)
		}
		test.end()
	})

	tape(`${sc.name}: a valid session unlocks sample-level data`, async test => {
		test.timeoutAfter(10000)
		// also verifies that the forced-open /jwt-status route is matched case-insensitively with a trailing slash
		const login = await post(server, '/JWT-STATUS/', { genome, dslabel, embedder }, loginHeaders())
		test.equal(login.body.status, 'ok', `should log in with a valid login token`)
		if (!login.body.jwt) {
			test.fail(`missing session jwt: ${JSON.stringify(login.body)}`)
			test.end()
			return
		}
		const headers = bearer(login.body.jwt)
		const reqs = sampleRequests(base)

		for (const path of ['/termdb/matrix', '/TERMDB/MATRIX/']) {
			const res = await get(server, path, base, headers)
			test.notEqual(res.status, 401, `should pass the auth middleware for ${path}`)
		}

		const allSamples = await get(server, '/termdb', reqs.getAllSamples, headers)
		test.ok(sampleKeys(allSamples.body).length, `should return sample names for for=getAllSamples`)

		const byName = await get(server, '/termdb', reqs.getSamplesByName, headers)
		test.ok(sampleKeys(byName.body).length, `should return a sample name map for for=getSamplesByName`)

		const list = await get(server, '/termdb', reqs.getsamplelist, headers)
		test.ok(list.body.length && list.body.every(s => 'name' in s), `should include sample names in getsamplelist=1`)

		// the TermdbTest dataset does not fully support these handlers, so only verify that the sign-in check passes
		for (const label of ['getsamples', 'convertSampleId', 'singleSampleData']) {
			const res = await get(server, '/termdb', reqs[label], headers)
			test.doesNotMatch(String(res.body.error || ''), signInError, `should not require sign in for ${label}`)
		}

		const forArray = await get(server, '/termdb', reqs['for[]=getAllSamples'], headers)
		test.equal(forArray.body.error, 'invalid q.for', `should still reject an array q.for`)

		// TODO: userCanAccessDsData() in chat/search.ts only looks for a 'termdb' dsAuth entry, so an all-routes
		// ('/**') credential denies omnisearch samples even with a valid session; this fails closed, but should
		// be fixed so that a logged-in user can search samples
		if (sc.allRoutes) {
			test.end()
			return
		}
		// omnisearch sample search also requires a non-empty clientAuthResult from the login token
		const adminLogin = await post(
			server,
			'/jwt-status',
			{ genome, dslabel, embedder },
			loginHeaders({ clientAuthResult: { role: 'admin' } })
		)
		const chat = await post(server, '/termdb/chat', omnisearchBody(embedder), bearer(adminLogin.body.jwt))
		test.ok(chat.body.samples?.length, `should return matched samples from omnisearch`)
		test.end()
	})

	tape(`${sc.name}: stop server`, async test => {
		test.timeoutAfter(10000)
		await server?.stop()
		test.pass('server stopped')
		test.end()
	})
}

// the termdb requests that return sample-level data, keyed by a label for test messages
function sampleRequests(base: string) {
	return {
		getAllSamples: `${base}&for=getAllSamples`,
		'for[]=getAllSamples': `${base}&for[]=getAllSamples`,
		getSamplesByName: `${base}&for=getSamplesByName`,
		getsamplelist: `${base}&getsamplelist=1`,
		getsamples: `${base}&getsamples=1`,
		convertSampleId: `${base}&for=convertSampleId&inputs[]=2646`,
		singleSampleData: `${base}&for=singleSampleData&sampleId=2646&term_ids[]=sex`
	}
}

function baseFor(embedder: string) {
	return `genome=${genome}&dslabel=${dslabel}&embedder=${encodeURIComponent(embedder)}`
}

function omnisearchBody(embedder: string) {
	// the prompt matches several TermdbTest sample names; it is sent as a JSON string, since a numeric-looking
	// URL query value would be parsed as a number and not be used as a search prompt
	return { genome, dslabel, embedder, omnisearch: true, prompt: '12' }
}

function loginPayload(overrides: any = {}) {
	const iat = Math.floor(Date.now() / 1000)
	return { iat, exp: iat + 3600, email: 'user@test.tld', ip: '127.0.0.1', ...overrides }
}

function loginHeaders(overrides: any = {}) {
	return { [headerKey]: jsonwebtoken.sign(loginPayload(overrides), secret) }
}

function bearer(jwt: string) {
	return { authorization: `Bearer ${Buffer.from(jwt || '').toString('base64')}` }
}

// returns the sample names or ids in a response body, which may be an array or an object keyed by sample name
function sampleKeys(body: any) {
	if (!body || body.error) return []
	return Array.isArray(body) ? body : Object.keys(body)
}

async function get(server: TestServer, path: string, query: string, headers = {}, prefix = server.url) {
	const res = await fetch(`${prefix}${path}${query ? '?' + query : ''}`, { headers })
	return { status: res.status, body: await parseBody(res) }
}

async function post(server: TestServer, path: string, body: any, headers = {}) {
	const res = await fetch(`${server.url}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		body: JSON.stringify(body)
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

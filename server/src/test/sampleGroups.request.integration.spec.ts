/*
	Request-based tests for the sample groups of the two-group analyses, on a dataset with a role-based
	sample filter.

	termdb/DE and termdb/diffMeth get the two groups as lists of sample ids, and resolve them with the
	dataset's sample filter for the session (see buildGroupValues() in utils/sampleGroups.ts). The
	preAnalysis request returns the number of samples that each group resolves to.

	The server loads test/testdata/termdb.test.sampleFilter.ts, a TermdbTest whose getAdditionalFilter()
	gives the 'admin' role no filter and any other role the samples with an id up to 50. Group 1 has the
	ids up to 50 and group 2 the ids from 51, so that for a role with the filter, group 1 resolves as
	for the 'admin' role and group 2 has no samples.

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

const ids = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ sampleId: from + i }))
const samplelst = {
	groups: [
		{ name: 'group1', in: true, values: ids(1, 50) },
		{ name: 'group2', in: true, values: ids(51, 100) }
	]
}
const routes = [
	{ path: '/termdb/DE', body: { kind: 'DE', min_count: 10, min_total_count: 15, cpm_cutoff: 0 } },
	{ path: '/termdb/diffMeth', body: { kind: 'DM', element_type: 'promoter' } }
]

let server: TestServer

tape('\n', test => {
	test.comment('-***- sample groups with a role-based sample filter requests -***-')
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
				datasets: [{ name: dslabel, jsfile: 'test/testdata/termdb.test.sampleFilter.ts' }]
			}
		],
		dsCredentials: { [dslabel]: { termdb: { '*': { type: 'jwt', secret, headerKey } } } }
	})
	test.pass(`server is listening at ${server.url}`)
	test.end()
})

for (const route of routes) {
	tape(`${route.path} group sizes by role`, async test => {
		test.timeoutAfter(30000)
		// the role without a sample filter is the control, to prove that both groups have samples with data
		const admin = await getGroupSizes(test, route, 'admin')
		const user = await getGroupSizes(test, route, 'user')
		if (!admin || !user) return test.end()

		test.ok(admin.group1 > 0 && admin.group2 > 0, `should resolve samples in both groups for role='admin'`)
		test.equal(user.group1, admin.group1, `should resolve the same group 1 for role='user'`)
		test.equal(user.group2, 0, `should resolve no samples in group 2 for role='user'`)
		test.end()
	})
}

tape('stop server', async test => {
	test.timeoutAfter(10000)
	await server?.stop()
	test.pass('server stopped')
	test.end()
})

/* logs in with the given role, then requests the group sizes of the route;
returns {group1, group2}, or undefined after a failed assertion */
async function getGroupSizes(test, route: (typeof routes)[number], role: string) {
	const login = await post('/jwt-status', { genome, dslabel, embedder }, loginHeaders(role))
	if (!login.body.jwt) {
		test.fail(`missing session jwt for role='${role}': ${JSON.stringify(login.body)}`)
		return
	}
	const body = { genome, dslabel, embedder, samplelst, preAnalysis: true, ...route.body }
	const res = await post(route.path, body, bearer(login.body.jwt))
	if (res.status != 200 || !res.body.data) {
		test.fail(`${route.path} did not return group sizes for role='${role}': ${JSON.stringify(res.body)}`)
		return
	}
	return res.body.data as { group1: number; group2: number }
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

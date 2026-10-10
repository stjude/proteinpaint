/*
	Request-based tests for the sample groups of the two-group analyses, on a dataset with a role-based
	sample filter.

	termdb/DE and termdb/diffMeth get the two groups as lists of sample ids, or as filters, and resolve
	them with the dataset's sample filter for the session (see buildGroupValues() and resolveGroups() in
	utils/sampleGroups.ts). The preAnalysis request returns the number of samples that each group
	resolves to.

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

/* A group may be defined by a filter in place of a list, see resolveGroups() in utils/sampleGroups.ts.
The two forms of a group must resolve the same for a role: the list form is made here from what the
getsamplelist query returns for the filter to the role without a sample filter. */
const sexFilter = (key: string) => ({
	type: 'tvslst',
	in: true,
	join: '',
	lst: [{ type: 'tvs', tvs: { term: { id: 'sex', type: 'categorical' }, values: [{ key }] } }]
})
const filterGroups = [
	{ name: 'group1', in: true, filter: sexFilter('1') },
	{ name: 'group2', in: true, filter: sexFilter('2') }
]
let listGroups: { name: string; in: boolean; values: { sampleId: number }[] }[]

tape('list form of the filter groups', async test => {
	test.timeoutAfter(30000)
	const jwt = await getSessionJwt(test, 'admin')
	if (!jwt) return test.end()
	listGroups = []
	for (const g of filterGroups) {
		const res = await post('/termdb', { genome, dslabel, embedder, getsamplelist: 1, filter: g.filter }, bearer(jwt))
		if (!Array.isArray(res.body) || !res.body.length) {
			test.fail(`no sample list for the filter of ${g.name}: ${JSON.stringify(res.body).slice(0, 200)}`)
			return test.end()
		}
		listGroups.push({ name: g.name, in: true, values: res.body.map(s => ({ sampleId: s.id })) })
	}
	test.pass(`the filters select ${listGroups.map(g => g.values.length).join(' and ')} samples`)
	test.end()
})

for (const route of routes) {
	tape(`${route.path} sizes of groups given as filters, by role`, async test => {
		test.timeoutAfter(30000)
		if (!listGroups?.length) {
			test.fail('the list form of the groups is missing')
			return test.end()
		}
		const sizes: any = {}
		for (const role of ['admin', 'user']) {
			const asLists = await getGroupSizes(test, route, role, { groups: listGroups })
			const asFilters = await getGroupSizes(test, route, role, { groups: filterGroups })
			if (!asLists || !asFilters) return test.end()
			test.deepEqual(asFilters, asLists, `should resolve filters as it resolves their lists for role='${role}'`)
			sizes[role] = asFilters
		}
		test.ok(sizes.admin.group1 > 0 && sizes.admin.group2 > 0, `should resolve samples in both groups for role='admin'`)
		test.ok(
			sizes.user.group1 + sizes.user.group2 < sizes.admin.group1 + sizes.admin.group2,
			`should resolve fewer samples for role='user'`
		)
		test.end()
	})
}

tape('termdb/categories of a samplelst term with groups given as filters, by role', async test => {
	test.timeoutAfter(30000)
	if (!listGroups?.length) {
		test.fail('the list form of the groups is missing')
		return test.end()
	}
	const term = (withList: boolean) => ({
		name: 'groups',
		type: 'samplelst',
		values: Object.fromEntries(
			listGroups.map(g => [g.name, { key: g.name, label: g.name, ...(withList ? { list: g.values } : {}) }])
		)
	})
	const counts: any = {}
	for (const role of ['admin', 'user']) {
		const jwt = await getSessionJwt(test, role)
		if (!jwt) return test.end()
		const get = async (tw: any) => {
			const res = await post('/termdb/categories', { genome, dslabel, embedder, tw }, bearer(jwt))
			if (!Array.isArray(res.body.lst))
				return test.fail(`no categories for role='${role}': ${JSON.stringify(res.body)}`)
			return Object.fromEntries(res.body.lst.map(c => [c.key, c.samplecount]))
		}
		const asLists = await get({ term: term(true), q: { groups: listGroups } })
		const asFilters = await get({ term: term(false), q: { groups: filterGroups } })
		if (!asLists || !asFilters) return test.end()
		test.deepEqual(asFilters, asLists, `should give the categories of the list form for role='${role}'`)
		counts[role] = asFilters
	}

	// a route may return the term wrappers of its request: the samples of a filter group are not in them
	const jwt = await getSessionJwt(test, 'admin')
	if (!jwt) return test.end()
	const tw2 = { $id: 'groups', term: term(false), q: { groups: filterGroups } }
	const tw1 = { $id: 'diaggrp', term: { id: 'diaggrp', type: 'categorical' }, q: {} }
	for (const [path, body] of [
		['/termdb/categories', { tw: tw2 }],
		['/termdb/barsql', { term1: tw1, term2: tw2, hiddenValues: { term1: [], term2: [] } }]
	] as const) {
		const res = await post(path, { genome, dslabel, embedder, ...body }, bearer(jwt))
		const text = JSON.stringify(res.body)
		test.ok(res.status == 200 && !res.body.error, `${path} should answer${res.body.error ? ': ' + res.body.error : ''}`)
		test.notOk(text.includes('"sampleId"'), `${path} should not list the samples of a group in its answer`)
	}
	test.ok(counts.admin.group1 > 0 && counts.admin.group2 > 0, `should have samples in both groups for role='admin'`)
	test.end()
})

/* A confounder is read with getData() for the request, see resolveDaContext() in utils/sampleGroups.ts,
which applies the dataset's sample filter for the session as for the groups. */
const sexTw = { $id: 'sex', term: { id: 'sex', type: 'categorical', name: 'Sex' }, q: { type: 'values' } }

for (const route of routes) {
	tape(`${route.path} group sizes with a confounder, by role`, async test => {
		test.timeoutAfter(30000)
		for (const role of ['admin', 'user']) {
			const sizes = await getGroupSizes(test, { ...route, body: { ...route.body, tw: sexTw } }, role)
			if (!sizes) return test.end()
			test.ok(sizes.group1 > 0, `should resolve samples in group 1 with a confounder for role='${role}'`)
		}
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
async function getGroupSizes(test, route: { path: string; body: any }, role: string, groups: any = samplelst) {
	const jwt = await getSessionJwt(test, role)
	if (!jwt) return
	const body = { genome, dslabel, embedder, samplelst: groups, preAnalysis: true, ...route.body }
	const res = await post(route.path, body, bearer(jwt))
	if (res.status != 200 || !res.body.data) {
		test.fail(`${route.path} did not return group sizes for role='${role}': ${JSON.stringify(res.body)}`)
		return
	}
	return res.body.data as { group1: number; group2: number }
}

// logs in with the given role; returns the session jwt, or undefined after a failed assertion
async function getSessionJwt(test, role: string): Promise<string | undefined> {
	const login = await post('/jwt-status', { genome, dslabel, embedder }, loginHeaders(role))
	if (login.body.jwt) return login.body.jwt
	test.fail(`missing session jwt for role='${role}': ${JSON.stringify(login.body)}`)
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

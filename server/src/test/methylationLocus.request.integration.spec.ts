/*
	Request-based tests for termdb/methylationLocus, which returns per-sample CpG methylation along a gene
	next to the gene's expression in the same samples.

	The server loads test/testdata/termdb.test.rolePolicy.ts, a TermdbTest whose displaySampleIds
	allows the 'admin' role only. The response names samples, so only 'admin' gets data.

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
const path = '/termdb/methylationLocus'

let server: TestServer

tape('\n', test => {
	test.comment('-***- termdb/methylationLocus requests -***-')
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
		dsCredentials: {
			[dslabel]: { termdb: { '*': { type: 'jwt', secret, headerKey } } }
		}
	})
	test.pass(`server is listening at ${server.url}`)
	test.end()
})

tape('a role that is allowed sample ids', async test => {
	test.timeoutAfter(30000)
	const res = await request(test, 'admin', { gene: 'TP53' })
	if (!res) return test.end()
	if (res.error) {
		test.fail(`unexpected error: ${res.error}`)
		return test.end()
	}
	const { samples, bins } = res
	test.ok(samples.length >= 3, `should return samples with both data types (${samples.length})`)
	test.ok(
		samples.every((s, i) => i == 0 || samples[i - 1].value <= s.value),
		'should order samples by ascending expression'
	)
	test.ok(bins.length > 0, `should return CpG bins (${bins.length})`)
	test.ok(
		bins.every(b => b.beta.length == samples.length),
		'should give every bin one value per sample'
	)
	test.ok(
		bins.every((b, i) => b.nCpg > 0 && b.start <= b.stop && (i == 0 || bins[i - 1].stop < b.start)),
		'should give non-empty, ordered, non-overlapping bins'
	)
	const tested = bins.filter(b => b.rho !== undefined)
	test.ok(tested.length > 0, 'should correlate at least one bin with expression')
	test.ok(
		tested.every(b => b.rho >= -1 && b.rho <= 1 && b.q >= 0 && b.q <= 1),
		'should give each tested bin a rho in [-1,1] and a q in [0,1]'
	)
	test.end()
})

tape('an isoform other than the default', async test => {
	test.timeoutAfter(30000)
	const res = await request(test, 'admin', { gene: 'TP53' })
	if (!res?.isoforms) return test.end(test.fail(`no isoforms: ${res?.error}`))
	const other = res.isoforms.find(i => i.start != res.gene.start || i.stop != res.gene.stop)
	if (!other) return test.end(test.fail('no isoform with another span'))
	const res2 = await request(test, 'admin', { gene: 'TP53', isoform: other.isoform })
	test.equal(res2?.gene?.isoform, other.isoform, 'should set the locus by the requested isoform')
	test.deepEqual(
		[res2?.gene?.start, res2?.gene?.stop],
		[other.start, other.stop],
		'should use the span of the requested isoform'
	)
	const res3 = await request(test, 'admin', { gene: 'TP53', isoform: 'NOT_AN_ISOFORM' })
	test.ok(String(res3?.error).includes('Unknown isoform'), 'should respond with an unknown-isoform error')
	test.end()
})

tape('groups defined by a filter on a patient-level term', async test => {
	// sex annotates patients, while the methylation and expression are on their samples
	test.timeoutAfter(30000)
	const sexFilter = (key: string) => ({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [{ type: 'tvs', tvs: { term: { id: 'sex', type: 'categorical' }, values: [{ key }] } }]
	})
	const groups = [
		{ name: 'group1', in: true, filter: sexFilter('1') },
		{ name: 'group2', in: true, filter: sexFilter('2') }
	]
	const groupTw = { term: { type: 'samplelst', name: 'sex' }, q: { groups, type: 'custom-samplelst' } }
	const res = await request(test, 'admin', { gene: 'TP53', groupTw })
	if (!res?.samples) return test.end(test.fail(`no samples: ${res?.error}`))
	const n = (g: string) => res.samples.filter(s => s.group == g).length
	test.ok(n('group1') > 0 && n('group2') > 0, `should label samples of both groups (${n('group1')}, ${n('group2')})`)
	test.deepEqual(res.groups, ['group1', 'group2'], 'should list the groups in request order')
	test.ok(
		res.bins.every(b => b.byGroup?.map(g => g.group).join() == 'group1,group2'),
		'should give every bin a rho entry per group'
	)
	const tested = res.bins.flatMap(b => b.byGroup).filter(g => g.rho !== undefined)
	test.ok(tested.length > 0, 'should correlate within the groups')
	test.ok(
		tested.every(g => g.rho >= -1 && g.rho <= 1 && g.q >= 0 && g.q <= 1),
		'should give each rho within a group a value in [-1,1] and a q in [0,1]'
	)
	test.end()
})

tape('a logged-in role that is denied sample ids', async test => {
	test.timeoutAfter(15000)
	const res = await request(test, 'user', { gene: 'TP53' })
	if (!res) return test.end()
	test.ok(res.error, 'should respond with an error')
	test.notOk(res.samples, 'should not send samples')
	test.end()
})

tape('a request without a session', async test => {
	test.timeoutAfter(15000)
	const res = await post(path, { genome, dslabel, embedder, gene: 'TP53' })
	test.notOk(res.body.samples, 'should not send samples')
	test.end()
})

tape('an unknown gene', async test => {
	test.timeoutAfter(15000)
	const res = await request(test, 'admin', { gene: 'NOT_A_GENE' })
	if (!res) return test.end()
	test.ok(String(res.error).includes('Unknown gene'), 'should respond with an unknown-gene error')
	test.end()
})

tape('stop server', async test => {
	test.timeoutAfter(10000)
	await server?.stop()
	test.pass('server stopped')
	test.end()
})

/* logs in with the given role, then requests the locus; returns the parsed body, or undefined after a failed assertion */
async function request(test, role: string, body: any) {
	const login = await post('/jwt-status', { genome, dslabel, embedder }, loginHeaders(role))
	if (!login.body.jwt) {
		test.fail(`missing session jwt for role='${role}': ${JSON.stringify(login.body)}`)
		return
	}
	const res = await post(path, { genome, dslabel, embedder, ...body }, bearer(login.body.jwt))
	return res.body
}

function loginHeaders(role: string) {
	const iat = Math.floor(Date.now() / 1000)
	const payload = {
		iat,
		exp: iat + 3600,
		email: 'user@test.tld',
		ip: '127.0.0.1',
		clientAuthResult: { role }
	}
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

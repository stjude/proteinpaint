/*
	Request-based tests for the sample limit of a differential expression run.

	The preAnalysis request reports a run over the limit as an alert, and the client hides its "Run" button. A full
	run request is checked again on the server, so that one sent without the preAnalysis step is refused too, before
	any counts are read.

	The server loads test/testdata/termdb.test.maxSamples.ts, a TermdbTest whose rnaseqGeneCount.maxSamples is below
	its 100 samples.

	Run from the server dir:
	npm run test:request
*/

import tape from 'tape'
import { startTestServer, type TestServer } from '../../test/testServer.ts'
import { maxSamples } from '../../test/testdata/termdb.test.maxSamples.ts'

const genome = 'hg38-test'
const dslabel = 'TermdbTest'

const ids = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ sampleId: from + i }))
const groupsOf = (n: number) => ({
	groups: [
		{ name: 'group1', in: true, values: ids(1, n) },
		{ name: 'group2', in: true, values: ids(51, 50 + n) }
	]
})
const body = { genome, dslabel, kind: 'DE', method: 'edgeR', min_count: 10, min_total_count: 15, cpm_cutoff: 0 }
const overLimit = new RegExp(`exceeds the limit of ${maxSamples} per run`)

let server: TestServer

tape('\n', test => {
	test.comment('-***- differential expression sample limit requests -***-')
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
				datasets: [{ name: dslabel, jsfile: 'test/testdata/termdb.test.maxSamples.ts' }]
			}
		]
	})
	test.pass(`server is listening at ${server.url}`)
	test.end()
})

tape('termdb/DE preAnalysis reports the sample limit', async test => {
	test.timeoutAfter(30000)
	const under = await post('/termdb/DE', { ...body, samplelst: groupsOf(5), preAnalysis: true })
	test.equal(under.status, 200, 'should answer the preAnalysis of a run under the limit')
	test.equal(under.body.alert, undefined, 'should not alert for a run under the limit')

	const over = await post('/termdb/DE', { ...body, samplelst: groupsOf(50), preAnalysis: true })
	const total = over.body.data?.group1 + over.body.data?.group2
	test.ok(total > maxSamples, `should resolve more than ${maxSamples} samples (${total})`)
	test.match(over.body.alert || '', overLimit, 'should alert for a run over the limit')
	test.end()
})

tape('termdb/DE refuses a full run over the sample limit', async test => {
	test.timeoutAfter(30000)
	const res = await post('/termdb/DE', { ...body, samplelst: groupsOf(50) })
	test.notEqual(res.status, 200, 'should not run')
	test.match(res.body.error || '', overLimit, 'should say that the run is over the limit')
	test.end()
})

tape('stop server', async test => {
	await server?.stop()
	test.end()
})

async function post(path: string, body: any) {
	const res = await fetch(`${server.url}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	})
	const text = await res.text()
	try {
		return { status: res.status, body: JSON.parse(text) }
	} catch {
		return { status: res.status, body: { text } }
	}
}

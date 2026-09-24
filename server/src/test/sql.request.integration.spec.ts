/*
	Request-based regression tests for sql injection in constructed sql statements.

	These tests send real HTTP requests to a fully launched server (see server/test/testServer.ts),
	with sql injection payloads in the request values that were previously interpolated into sql text,
	to verify that the values are now bound as sql parameters or rejected by validation. The unit spec
	in server/src/test/sql.unit.spec.ts tests the sql`` tag and guardDb() in isolation.

	Each payload is compared against the response to an equivalent legitimate request, so that a test
	fails if the payload changes the query results, such as by widening a filter or exfiltrating data.

	Run from the server dir:
	npm run test:request
*/

import tape from 'tape'
import { startTestServer, type TestServer } from '../../test/testServer.ts'

const base = { genome: 'hg38-test', dslabel: 'TermdbTest', embedder: 'localhost' }
const agedx = { id: 'agedx', type: 'float', name: 'Age at diagnosis' }
const efs = { id: 'efs', type: 'survival', name: 'Event-free survival' }
const sex = { id: 'sex', type: 'categorical', name: 'Sex' }
// if interpolated into sql text, this bin name would be replaced by a list of the db table names
const exfilName = `hi' || (SELECT group_concat(name, '|') FROM sqlite_master WHERE type='table') || '`

let server: TestServer

tape('\n', test => {
	test.comment('-***- sql injection requests -***-')
	test.end()
})

tape('start server', async test => {
	test.timeoutAfter(90000)
	server = await startTestServer()
	test.pass(`server is listening at ${server.url}`)
	test.end()
})

tape('numeric custom bin names are bound as sql parameters', async test => {
	test.timeoutAfter(10000)
	const legit = await post('/termdb/categories', { tw: getBinnedTw('hi') })
	test.deepEqual(legit.body.orderedLabels, ['lo', 'hi'], `should return the custom bin labels`)
	const hiCount = legit.body.lst?.find(c => c.key == 'hi')?.samplecount
	test.ok(hiCount > 0, `should count samples in the last bin`)

	for (const name of [exfilName, `O'Brien`]) {
		const res = await post('/termdb/categories', { tw: getBinnedTw(name) })
		test.deepEqual(res.body.orderedLabels, ['lo', name], `should return the bin name as-is: ${name}`)
		test.equal(
			res.body.lst?.find(c => c.key == name)?.samplecount,
			hiCount,
			`should count the same samples as a legitimate bin name: ${name}`
		)
		test.doesNotMatch(JSON.stringify(res.body), /sampleidmap/, `should not include db table names: ${name}`)
	}
	test.end()
})

tape('non-numeric bin boundaries and uncomputable value keys are rejected', async test => {
	test.timeoutAfter(10000)
	const start = await post('/termdb/categories', { tw: getBinnedTw('hi', '5 AS start --') })
	test.match(String(start.body.error), /must be numeric|invalid bin boundary/, `should reject a non-numeric bin.start`)
	test.notOk(start.body.lst, `should not return categories for a non-numeric bin.start`)

	const term = { ...agedx, values: { '-999) OR (1=1': { label: 'x', uncomputable: true } } }
	const key = await post('/termdb/categories', { tw: getBinnedTw('hi', 5, term) })
	test.match(String(key.body.error), /non-numeric uncomputable value key/, `should reject a non-numeric value key`)
	test.notOk(key.body.lst, `should not return categories for a non-numeric value key`)
	test.end()
})

tape('a survival filter cutoff is bound as a sql parameter', async test => {
	test.timeoutAfter(10000)
	const getFilter = q => ({
		type: 'tvslst',
		join: '',
		in: true,
		lst: [{ type: 'tvs', tvs: { term: efs, q, values: [{ key: 1 }] } }]
	})
	const legit = getCount(await post('/termdb', { getsamplecount: 1, filter: getFilter({ cutoff: 0 }) }))
	test.ok(legit > 0, `should count samples for a numeric cutoff`)

	// if interpolated, `AND tte >= 0 OR 1=1 AND exit_code IN (?)` would match every survival term's events
	const injected = getCount(await post('/termdb', { getsamplecount: 1, filter: getFilter({ cutoff: '0 OR 1=1' }) }))
	test.ok(
		injected <= legit,
		`should not count more samples than a numeric cutoff (legit=${legit}, injected=${injected})`
	)
	test.end()
})

tape('filter sample types do not widen the sample list', async test => {
	test.timeoutAfter(10000)
	const filter = {
		type: 'tvslst',
		join: '',
		in: true,
		lst: [{ type: 'tvs', tvs: { term: sex, values: [{ key: '1' }] } }]
	}
	const legit = await post('/termdb', { getsamplelist: 1, filter, mapParent2Children: true, sampleTypes: ['2'] })
	test.ok(Array.isArray(legit.body) && legit.body.length, `should return a filtered sample list`)

	for (const sampleTypes of [['2', '2) OR (1=1'], ['2) OR (1=1']]) {
		const res = await post('/termdb', { getsamplelist: 1, filter, mapParent2Children: true, sampleTypes })
		const n = Array.isArray(res.body) ? res.body.length : 0
		test.ok(
			n <= legit.body.length,
			`should not return more samples for sampleTypes=${JSON.stringify(sampleTypes)} (legit=${
				legit.body.length
			}, n=${n})`
		)
	}
	test.end()
})

tape('stop server', async test => {
	test.timeoutAfter(10000)
	await server?.stop()
	test.pass('server stopped')
	test.end()
})

function getBinnedTw(name: string, start: any = 5, term: any = agedx) {
	return {
		$id: 'tw1',
		term,
		q: {
			mode: 'discrete',
			type: 'custom-bin',
			lst: [
				{ startunbounded: true, stop: 5, stopinclusive: false, label: 'lo', name: 'lo' },
				{ start, stopunbounded: true, startinclusive: true, label: name, name }
			]
		}
	}
}

// parses a response like { count: '78 samples' }
function getCount(res) {
	const n = parseInt(res.body.count)
	if (!Number.isInteger(n)) throw `unexpected sample count response: ${JSON.stringify(res.body)}`
	return n
}

async function post(path: string, body: any) {
	const res = await fetch(`${server.url}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ ...base, ...body })
	})
	const text = await res.text()
	try {
		return { status: res.status, body: JSON.parse(text) }
	} catch {
		return { status: res.status, body: { text } }
	}
}

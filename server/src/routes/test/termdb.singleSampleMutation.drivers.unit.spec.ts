import tape from 'tape'
import { dtsnvindel, dtfusionrna } from '#shared'
import { genomes } from '#src/initGenomesDs.js'
import * as singleSampleMutation from '../termdb.singleSampleMutation.ts'
import { getKb } from '#src/driverRank/test/fixture.ts'

/*
Tests:
	the route ranks the events of a ds with a driver kb, with the driver events first
	drivers:'only' responds with the driver events only
	drivers:'only' fails for a ds without a driver kb, and a ds without one gets its events as is
	a ranking error leaves the events as is, and fails a drivers:'only' request
	the request checker accepts drivers:'only' and rejects other values
*/

const kb = getKb()

function getEvents() {
	return [
		{ dt: dtsnvindel, gene: 'KRAS', mname: 'G12C', class: 'M' },
		{ dt: dtsnvindel, gene: 'ABC', mname: 'R1H', class: 'M' },
		{ dt: dtfusionrna, geneA: 'BCR', geneB: 'ABL1' }
	]
}

function getDs(label: string, more = {}) {
	return { label, queries: { singleSampleMutation: { get: async () => ({ mlst: getEvents() }) } }, ...more }
}

/** the response of the route to a query, with the given datasets of genome hg38 */
async function request(query: any, datasets: any): Promise<any> {
	for (const n in genomes) delete genomes[n]
	genomes.hg38 = { datasets, __driverKb: kb }
	try {
		const handler = (singleSampleMutation.payload.init as any)({ genomes })
		let sent: any
		await handler({ query: { genome: 'hg38', sample: 's1', ...query } }, { send: (r: any) => (sent = r) })
		return sent
	} finally {
		for (const n in genomes) delete genomes[n]
	}
}

tape('\n', test => {
	test.comment('-***- routes/termdb.singleSampleMutation driver specs -***-')
	test.end()
})

tape('ranks the events of a ds with a driver kb', async test => {
	const r = await request({ dslabel: 'A' }, { A: getDs('A') })
	test.deepEqual(
		r.mlst.map((m: any) => m.mname || m.geneA),
		['BCR', 'G12C', 'R1H'],
		'should put the tier 1 fusion first, then the tier 2 KRAS G12C, then the non-driver'
	)
	test.equal(r.mlst[0].driver?.tier, 1, 'should tag the fusion')
	test.equal(r.mlst[2].driver, undefined, 'should not tag a non-driver')
	test.equal(r.driverRank?.kbVersion, 'test', 'should give the kb version')
	test.deepEqual(
		r.driverRank?.sources.map((s: any) => s.id),
		['civic'],
		'should list the sources of the matched rules'
	)
	test.end()
})

tape('drivers:only', async test => {
	const r = await request({ dslabel: 'A', drivers: 'only' }, { A: getDs('A') })
	test.equal(r.mlst.length, 2, 'should respond with the 2 driver events only')
	const off = await request({ dslabel: 'B', drivers: 'only' }, { B: getDs('B', { __driverKb: null }) })
	test.equal(off.error, 'driver ranking is not available for this dataset', 'should fail for a ds without a kb')
	const asIs = await request({ dslabel: 'B' }, { B: getDs('B', { __driverKb: null }) })
	test.equal(asIs.driverRank, undefined, 'a ds without a kb should get no driverRank')
	test.deepEqual(asIs.mlst, getEvents(), 'a ds without a kb should get its events as is')
	test.end()
})

tape('a ranking error', async test => {
	const broken = { ...kb, match: undefined }
	const consoleError = console.error
	console.error = () => {}
	try {
		const r = await request({ dslabel: 'C' }, { C: getDs('C', { __driverKb: broken }) })
		test.deepEqual(r.mlst, getEvents(), 'should leave the events as is')
		test.equal(r.driverRank, undefined, 'should give no driverRank')
		const only = await request({ dslabel: 'C', drivers: 'only' }, { C: getDs('C', { __driverKb: broken }) })
		test.equal(only.error, 'driver ranking failed', 'should fail a drivers:only request')
	} finally {
		console.error = consoleError
	}
	test.end()
})

tape('request checker', test => {
	const checker = singleSampleMutation.payload.request.checker as any
	const q = { genome: 'hg38', dslabel: 'A', sample: 's1' }
	for (const n in genomes) delete genomes[n]
	genomes.hg38 = { datasets: { A: getDs('A') } }
	try {
		test.equal(checker({ ...q, drivers: 'only' }).drivers, 'only', 'should accept drivers:only')
		test.equal('drivers' in checker(q), false, 'should leave drivers out when not given')
		test.throws(() => checker({ ...q, drivers: 'all' }), /drivers must be "only"/, 'should reject another value')
		test.throws(() => checker({ ...q, drivers: ['only'] }), /drivers must be "only"/, 'should reject an array')
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	test.end()
})

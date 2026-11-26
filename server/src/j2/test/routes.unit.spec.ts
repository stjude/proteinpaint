import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as junctions from '../junctions.ts'
import * as AbyB from '../AbyB.ts'
import * as onesampletk from '../onesampletk.ts'
import { validate_query_junction, maxJunctionRegion } from '../validate.ts'

/*
Tests:
	junction routes are not set up when no mds3 ds has a junction query
	junction routes are set up when a mds3 ds has a junction query
	onesampletk route is always set up
	junctions route checks the size of groupRegion before reading
	AbyB route reads the span of the junctions of at most maxJunctionRegion
	AbyB route takes at most maxJunctionAposlst A junctions

the junction routes check the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from j2/ routes for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [junctions, AbyB, onesampletk], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

const onesampletkRoute = ['get /termdb/junction/onesampletk']

tape('\n', function (test) {
	test.comment('-***- j2/routes specs -***-')
	test.end()
})

tape('junction routes are not set up when no mds3 ds has a junction query', test => {
	test.deepEqual(getMounted({}), onesampletkRoute, 'should not set up junction routes when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: { isMds3: true, queries: {} } } } }),
		onesampletkRoute,
		'should not set up junction routes when no ds has a junction query'
	)
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: { isMds: true, queries: { junction: {} } } } } }),
		onesampletkRoute,
		'should not set up junction routes when only a legacy mds ds has a junction query'
	)
	test.end()
})

tape('junction routes are set up when a mds3 ds has a junction query', test => {
	const mounted = getMounted({
		hg19: {},
		hg38: { datasets: { A: { isMds3: true }, B: { isMds3: true, queries: { junction: {} } } } }
	})
	test.deepEqual(
		mounted.sort(),
		[
			'get /termdb/junction/onesampletk',
			'get /termdb/junctions',
			'get /termdb/junctions/AbyB',
			'post /termdb/junctions',
			'post /termdb/junctions/AbyB'
		],
		'should set up the GET and POST junction routes when at least one mds3 ds has a junction query'
	)
	test.end()
})

tape('junctions route checks the size of groupRegion before reading', async test => {
	const ds = {
		queries: {
			junction: {
				samples: [],
				listJunctions: async () => {
					throw new Error('should not read junctions')
				}
			}
		}
	}
	const groupTw = { q: { groups: [{ name: 'a' }, { name: 'b' }] } }
	const data = await callRoute(junctions, ds, {
		groupTw,
		groupRegion: { chr: 'chr17', start: 0, stop: maxJunctionRegion + 1 }
	})
	test.equal(data.error, `groupRegion must be at most ${maxJunctionRegion / 1e6} Mb`, 'rejects a groupRegion too wide')
	test.end()
})

tape('AbyB route reads the span of the junctions of at most maxJunctionRegion', async test => {
	const ds = await getTestJunctionDs()
	const junctionB = { chr: 'chr17', start: 1000, stop: 2000, strand: '+' }
	{
		// junction A has read counts 8, 6 and 9 in samples S1, S2 and S4, all of which have junction B
		const data = await callRoute(AbyB, ds, { junctionB, junctionAposlst: [[3000, 4000, '+']] })
		test.deepEqual(
			data.lst?.map(j => [j.start, j.v]),
			[[3000, 8]],
			'gives the median read count of a junction A over the samples of junction B'
		)
	}
	{
		const data = await callRoute(AbyB, ds, { junctionB, junctionAposlst: [[3000, maxJunctionRegion + 1001, '+']] })
		test.equal(
			data.error,
			`Zoom in to under ${maxJunctionRegion / 1e6} Mb to show junctions`,
			'rejects junctions spanning over maxJunctionRegion'
		)
	}
	test.end()
})

tape('AbyB route takes at most maxJunctionAposlst A junctions', async test => {
	const ds = await getTestJunctionDs()
	const junctionB = { chr: 'chr17', start: 1000, stop: 2000, strand: '+' }
	const jAs = (n: number) => Array.from({ length: n }, () => [3000, 4000, '+'])
	{
		const data = await callRoute(AbyB, ds, { junctionB, junctionAposlst: jAs(AbyB.maxJunctionAposlst) })
		test.equal(
			data.lst?.length,
			AbyB.maxJunctionAposlst,
			'gives a read count of each of maxJunctionAposlst A junctions'
		)
	}
	{
		const data = await callRoute(AbyB, ds, { junctionB, junctionAposlst: jAs(AbyB.maxJunctionAposlst + 1) })
		test.equal(
			data.error,
			`q.junctionAposlst has more than ${AbyB.maxJunctionAposlst} junctions`,
			'rejects more than maxJunctionAposlst A junctions'
		)
	}
	test.end()
})

// a ds of test/tp/files/hg38/junction/test.junction.gz, see validate.unit.spec.ts
async function getTestJunctionDs() {
	const ds: any = { label: 'test', queries: { junction: { file: 'files/hg38/junction/test.junction.gz' } } }
	await validate_query_junction(ds, { chrlookup: { CHR17: { name: 'chr17', len: 83257441 } } })
	return ds
}

// the response of a route of a ds of genome hg38, for request parameters
async function callRoute(route, ds, query) {
	const handler = route.init({ genomes: { hg38: { datasets: { T: ds } } } })
	let data
	await handler({ query: { genome: 'hg38', dslabel: 'T', ...query } }, { send: d => (data = d) })
	return data
}

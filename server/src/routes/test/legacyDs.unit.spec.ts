import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as legacyDs from '../legacyDs.ts'

/*
Tests:
	legacyDs route is not set up when no legacy ds is loaded
	legacyDs route is set up when a legacy ds is loaded
	init() does not serve a mds3 ds

the route checks the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from the legacyDs route for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [legacyDs], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted.sort()
}

tape('\n', function (test) {
	test.comment('-***- routes/legacyDs specs -***-')
	test.end()
})

tape('legacyDs route is not set up when no legacy ds is loaded', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(getMounted({ hg19: {} }), [], 'should not set up the route when a genome has no datasets')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: { isMds3: true }, B: { isMds3: true } } } }),
		[],
		'should not set up the route when all ds are mds3'
	)
	test.end()
})

tape('legacyDs route is set up when a legacy ds is loaded', test => {
	const expected = ['get /legacyDs', 'post /legacyDs']
	test.deepEqual(
		getMounted({ hg19: { datasets: { A: { isMds3: true }, B: { isMds: true } } } }),
		expected,
		'should set up the GET and POST routes when a legacy mds ds is loaded'
	)
	test.deepEqual(
		getMounted({ hg19: { datasets: {} }, hg38: { datasets: { C: { queries: [] } } } }),
		expected,
		'should set up the GET and POST routes when an older non-mds ds is loaded'
	)
	test.end()
})

tape('init() does not serve a mds3 ds', test => {
	const handler = legacyDs.init({ genomes: { hg38: { datasets: { A: { isMds3: true } } } } })
	let sent
	handler({ query: { genome: 'hg38', dsname: 'a' } }, { send: d => (sent = d) })
	test.deepEqual(sent, { error: 'not a legacy dataset' }, 'should return an error for a mds3 ds')
	test.end()
})

import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as singleSampleMutation from '../termdb.singleSampleMutation.ts'

/*
Tests:
	singleSampleMutation route is not set up when no ds has ds.queries.singleSampleMutation
	singleSampleMutation route is set up when a ds has ds.queries.singleSampleMutation

the singleSampleMutation route checks the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/termdb.singleSampleMutation.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [singleSampleMutation], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/termdb.singleSampleMutation mount specs -***-')
	test.end()
})

tape('singleSampleMutation route is not set up when no ds has ds.queries.singleSampleMutation', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { queries: {} } } } }),
		[],
		'should not set up the route when no ds has ds.queries.singleSampleMutation'
	)
	test.end()
})

tape('singleSampleMutation route is set up when a ds has ds.queries.singleSampleMutation', test => {
	test.deepEqual(
		getMounted({ hg19: {}, hg38: { datasets: { A: {}, B: { queries: { singleSampleMutation: {} } } } } }),
		['get /termdb/singleSampleMutation'],
		'should set up the GET route (the only method) when at least one ds has ds.queries.singleSampleMutation'
	)
	test.end()
})

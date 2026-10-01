import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as burden from '../burden.ts'

/*
Tests:
	burden route is not set up when no ds has ds.cohort.cumburden
	burden route is set up when a ds has ds.cohort.cumburden

the burden route checks the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/burden.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [burden], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/burden specs -***-')
	test.end()
})

tape('burden route is not set up when no ds has ds.cohort.cumburden', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { cohort: {} } } } }),
		[],
		'should not set up the route when no ds has ds.cohort.cumburden'
	)
	test.end()
})

tape('burden route is set up when a ds has ds.cohort.cumburden', test => {
	const mounted = getMounted({ hg19: {}, hg38: { datasets: { A: {}, B: { cohort: { cumburden: {} } } } } })
	test.deepEqual(
		mounted,
		['get /burden', 'post /burden'],
		'should set up the GET and POST routes when at least one ds has ds.cohort.cumburden'
	)
	test.end()
})

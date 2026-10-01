import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as wsiBySample from '../termdb.wsiBySample.ts'

/*
Tests:
	wsiBySample route is not set up when no ds has ds.queries.w2
	wsiBySample route is set up when a ds has ds.queries.w2

the wsiBySample route checks the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/termdb.wsiBySample.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [wsiBySample], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/termdb.wsiBySample mount specs -***-')
	test.end()
})

tape('wsiBySample route is not set up when no ds has ds.queries.w2', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { queries: { snvindel: {} } } } } }),
		[],
		'should not set up the route when no ds has ds.queries.w2'
	)
	test.end()
})

tape('wsiBySample route is set up when a ds has ds.queries.w2', test => {
	const mounted = getMounted({ hg19: {}, hg38: { datasets: { A: {}, B: { queries: { w2: { wsiFolder: 'wsi' } } } } } })
	test.deepEqual(
		mounted,
		['get /termdb/wsiBySample', 'post /termdb/wsiBySample'],
		'should set up the GET and POST routes when at least one ds has ds.queries.w2'
	)
	test.end()
})

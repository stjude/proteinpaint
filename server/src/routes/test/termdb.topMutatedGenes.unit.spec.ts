import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as topMutatedGenes from '../termdb.topMutatedGenes.ts'

/*
Tests:
	topMutatedGenes route is not set up when no ds has ds.queries.topMutatedGenes
	topMutatedGenes route is set up when a ds has ds.queries.topMutatedGenes

the topMutatedGenes route checks the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/termdb.topMutatedGenes.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [topMutatedGenes], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/termdb.topMutatedGenes specs -***-')
	test.end()
})

tape('topMutatedGenes route is not set up when no ds has ds.queries.topMutatedGenes', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { queries: { snvindel: {} } } } } }),
		[],
		'should not set up the route when no ds has ds.queries.topMutatedGenes'
	)
	test.end()
})

tape('topMutatedGenes route is set up when a ds has ds.queries.topMutatedGenes', test => {
	const mounted = getMounted({ hg19: {}, hg38: { datasets: { A: {}, B: { queries: { topMutatedGenes: {} } } } } })
	test.deepEqual(
		mounted,
		['get /termdb/topMutatedGenes', 'post /termdb/topMutatedGenes'],
		'should set up the GET and POST routes when at least one ds has ds.queries.topMutatedGenes'
	)
	test.end()
})

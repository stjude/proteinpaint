import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as topVE from '../termdb.topVariablyExpressedGenes.ts'

/*
Tests:
	topVariablyExpressedGenes route is not set up when no ds has ds.queries.topVariablyExpressedGenes
	topVariablyExpressedGenes route is set up when a ds has ds.queries.topVariablyExpressedGenes

the topVariablyExpressedGenes route checks the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/termdb.topVariablyExpressedGenes.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [topVE], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/termdb.topVariablyExpressedGenes mount specs -***-')
	test.end()
})

tape('topVariablyExpressedGenes route is not set up when no ds has ds.queries.topVariablyExpressedGenes', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { queries: {} } } } }),
		[],
		'should not set up the route when no ds has ds.queries.topVariablyExpressedGenes'
	)
	test.end()
})

tape('topVariablyExpressedGenes route is set up when a ds has ds.queries.topVariablyExpressedGenes', test => {
	test.deepEqual(
		getMounted({ hg19: {}, hg38: { datasets: { A: {}, B: { queries: { topVariablyExpressedGenes: {} } } } } }),
		['get /termdb/topVariablyExpressedGenes', 'post /termdb/topVariablyExpressedGenes'],
		'should set up the GET and POST routes when at least one ds has ds.queries.topVariablyExpressedGenes'
	)
	test.end()
})

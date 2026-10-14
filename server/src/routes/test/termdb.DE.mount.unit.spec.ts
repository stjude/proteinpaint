import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as DE from '../termdb.DE.ts'

/*
Tests:
	DE route is not set up when no ds has rnaseqGeneCount or pseudobulk
	DE route is set up when a ds has ds.queries.rnaseqGeneCount
	DE route is set up when a ds has ds.queries.singleCell.pseudobulk

the DE route checks the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/termdb.DE.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [DE], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/termdb.DE mount specs -***-')
	test.end()
})

tape('DE route is not set up when no ds has rnaseqGeneCount or pseudobulk', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { queries: {} }, C: { queries: { singleCell: {} } } } } }),
		[],
		'should not set up the route when no ds has rnaseqGeneCount or pseudobulk'
	)
	test.end()
})

tape('DE route is set up when a ds has ds.queries.rnaseqGeneCount', test => {
	test.deepEqual(
		getMounted({ hg19: {}, hg38: { datasets: { A: {}, B: { queries: { rnaseqGeneCount: {} } } } } }),
		['get /termdb/DE', 'post /termdb/DE'],
		'should set up the GET and POST routes when at least one ds has rnaseqGeneCount'
	)
	test.end()
})

tape('DE route is set up when a ds has ds.queries.singleCell.pseudobulk', test => {
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: { queries: { singleCell: { pseudobulk: {} } } } } } }),
		['get /termdb/DE', 'post /termdb/DE'],
		'should set up the GET and POST routes when at least one ds has pseudobulk'
	)
	test.end()
})

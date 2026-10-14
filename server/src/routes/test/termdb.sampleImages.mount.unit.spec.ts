import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as sampleImages from '../termdb.sampleImages.ts'

/*
Tests:
	sampleImages route is not set up when no ds has ds.queries.images
	sampleImages route is set up when a ds has ds.queries.images

the sampleImages route checks the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/termdb.sampleImages.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [sampleImages], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/termdb.sampleImages mount specs -***-')
	test.end()
})

tape('sampleImages route is not set up when no ds has ds.queries.images', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { queries: {} } } } }),
		[],
		'should not set up the route when no ds has ds.queries.images'
	)
	test.end()
})

tape('sampleImages route is set up when a ds has ds.queries.images', test => {
	test.deepEqual(
		getMounted({ hg19: {}, hg38: { datasets: { A: {}, B: { queries: { images: {} } } } } }),
		['get /termdb/getSampleImages', 'post /termdb/getSampleImages'],
		'should set up the GET and POST routes when at least one ds has ds.queries.images'
	)
	test.end()
})

import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as brainImaging from '../termdb.brainImaging.ts'
import * as brainImagingSamples from '../termdb.brainImagingSamples.ts'

/*
Tests:
	brainImaging routes are not set up when no ds has ds.queries.NIdata
	brainImaging routes are set up when a ds has ds.queries.NIdata

the brainImaging routes check the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/termdb.brainImaging*.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [brainImaging, brainImagingSamples], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/termdb.brainImaging* mount specs -***-')
	test.end()
})

tape('brainImaging routes are not set up when no ds has ds.queries.NIdata', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the routes when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { queries: { proteome: {} } } } } }),
		[],
		'should not set up the routes when no ds has ds.queries.NIdata'
	)
	test.end()
})

tape('brainImaging routes are set up when a ds has ds.queries.NIdata', test => {
	const mounted = getMounted({ hg19: {}, hg38: { datasets: { A: {}, B: { queries: { NIdata: {} } } } } })
	test.deepEqual(
		mounted,
		[
			'get /termdb/brainImaging',
			'post /termdb/brainImaging',
			'get /termdb/brainImagingSamples',
			'post /termdb/brainImagingSamples'
		],
		'should set up the GET and POST routes when at least one ds has ds.queries.NIdata'
	)
	test.end()
})

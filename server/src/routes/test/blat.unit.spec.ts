import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as blat from '../blat.ts'

/*
Tests:
	blat route is not set up when no genome has blat
	blat route is set up when a genome has blat

the blat route checks the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/blat.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [blat], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/blat specs -***-')
	test.end()
})

tape('blat route is not set up when no genome has blat', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(getMounted({ hg19: {}, hg38: {} }), [], 'should not set up the route when no genome has blat')
	test.end()
})

tape('blat route is set up when a genome has blat', test => {
	const mounted = getMounted({ hg19: {}, hg38: { blat: { host: 'localhost', port: 1234 } } })
	test.deepEqual(
		mounted,
		['get /blat', 'post /blat'],
		'should set up the GET and POST routes when at least one genome has blat'
	)
	test.end()
})

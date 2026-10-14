import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as dsdata from '../dsdata.ts'

/*
Tests:
	dsdata route is not set up when no legacy ds is loaded
	dsdata route is set up when a legacy ds is loaded

the dsdata route checks the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/dsdata.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [dsdata], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/dsdata specs -***-')
	test.end()
})

tape('dsdata route is not set up when no legacy ds is loaded', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(
		getMounted({
			hg38: {
				datasets: {
					A: { isMds3: true, queries: { snvindel: {} } },
					B: { isMds: true, queries: { junction: {} } }
				}
			}
		}),
		[],
		'should not set up the route when only mds and mds3 ds are loaded'
	)
	test.end()
})

tape('dsdata route is set up when a legacy ds is loaded', test => {
	test.deepEqual(
		getMounted({
			hg19: {},
			hg38: { datasets: { A: { isMds3: true, queries: {} }, B: { dbfile: 'legacy.db', queries: [] } } }
		}),
		['get /dsdata', 'post /dsdata'],
		'should set up the GET and POST routes for a legacy ds with ds.dbfile'
	)
	test.deepEqual(
		getMounted({ hg19: { datasets: { B: { queries: [{ vcffile: 'legacy.vcf.gz' }] } } } }),
		['get /dsdata', 'post /dsdata'],
		'should set up the GET and POST routes for a vcf-only legacy ds without ds.dbfile'
	)
	test.end()
})

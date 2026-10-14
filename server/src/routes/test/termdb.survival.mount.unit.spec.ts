import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as survival from '../termdb.survival.ts'

/*
Tests:
	survival route is not set up when no ds has survival terms
	survival route is set up when a ds has survival terms

the survival route checks the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/termdb.survival.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [survival], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/termdb.survival mount specs -***-')
	test.end()
})

tape('survival route is not set up when no ds has survival terms', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(
		getMounted({
			hg38: {
				datasets: {
					A: {},
					B: { cohort: { termdb: {} } },
					C: { cohort: { termdb: { termtypeByCohort: { '': { categorical: 2, survival: 0, numeric: 0 } } } } }
				}
			}
		}),
		[],
		'should not set up the route when no ds has a nonzero survival term count'
	)
	test.end()
})

tape('survival route is set up when a ds has survival terms', test => {
	const mounted = getMounted({
		hg19: {},
		hg38: {
			datasets: {
				A: {},
				B: { cohort: { termdb: { termtypeByCohort: { ABC: { categorical: 1 }, XYZ: { survival: 3 } } } } }
			}
		}
	})
	test.deepEqual(
		mounted,
		['get /termdb/survival', 'post /termdb/survival'],
		'should set up the GET and POST routes when at least one ds has survival terms'
	)
	test.end()
})

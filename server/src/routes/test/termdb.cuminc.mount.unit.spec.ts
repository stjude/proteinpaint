import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as cuminc from '../termdb.cuminc.ts'

/*
Tests:
	cuminc route is not set up when no ds has condition terms
	cuminc route is set up when a ds has condition terms

the cuminc route checks the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/termdb.cuminc.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [cuminc], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/termdb.cuminc mount specs -***-')
	test.end()
})

tape('cuminc route is not set up when no ds has condition terms', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(
		getMounted({
			hg38: {
				datasets: {
					A: {},
					B: { cohort: { termdb: {} } },
					C: { cohort: { termdb: { termtypeByCohort: { '': { categorical: 2, condition: 0, numeric: 0 } } } } }
				}
			}
		}),
		[],
		'should not set up the route when no ds has a nonzero condition term count'
	)
	test.end()
})

tape('cuminc route is set up when a ds has condition terms', test => {
	const mounted = getMounted({
		hg19: {},
		hg38: {
			datasets: {
				A: {},
				B: { cohort: { termdb: { termtypeByCohort: { ABC: { categorical: 1 }, XYZ: { condition: 3 } } } } }
			}
		}
	})
	test.deepEqual(
		mounted,
		['get /termdb/cuminc', 'post /termdb/cuminc'],
		'should set up the GET and POST routes when at least one ds has condition terms'
	)
	test.end()
})

import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as runChart from '../termdb.runChart.ts'

/*
Tests:
	runChart route is not set up when no ds has isSupportedChartOverride.runChart2
	runChart route is set up when a ds has isSupportedChartOverride.runChart2

the runChart route checks the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/termdb.runChart.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [runChart], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

const expected = ['get /termdb/runChart', 'post /termdb/runChart']

tape('\n', function (test) {
	test.comment('-***- routes/termdb.runChart mount specs -***-')
	test.end()
})

tape('runChart route is not set up when no ds has isSupportedChartOverride.runChart2', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(
		getMounted({
			hg38: {
				datasets: {
					A: {},
					B: { isSupportedChartOverride: { sampleView: () => false } },
					C: { isSupportedChartOverride: { runChart2: false, frequencyChart: () => true } }
				}
			}
		}),
		[],
		'should not set up the route when isSupportedChartOverride.runChart2 is absent or false'
	)
	test.end()
})

tape('runChart route is set up when a ds has isSupportedChartOverride.runChart2', test => {
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { isSupportedChartOverride: { runChart2: () => false } } } } }),
		expected,
		'should set up the routes when ds.isSupportedChartOverride.runChart2 is a callback'
	)
	test.end()
})

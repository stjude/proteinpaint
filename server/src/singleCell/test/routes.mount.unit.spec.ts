import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as dataRoute from '../dataRoute.ts'
import * as DEgenesRoute from '../DEgenesRoute.ts'
import * as plotsRoute from '../plotsRoute.ts'
import * as samplesRoute from '../samplesRoute.ts'

/*
Tests:
	single cell routes are not set up when no ds has ds.queries.singleCell
	single cell routes are set up when a ds has ds.queries.singleCell

the single cell routes check the loaded genomes when augen sets up the routes, so each case
sets the genomes before calling setRoutes()
*/

const routes = [dataRoute, DEgenesRoute, plotsRoute, samplesRoute]

// returns the route methods that augen sets up from the single cell routes for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, routes, { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- singleCell route mount specs -***-')
	test.end()
})

tape('single cell routes are not set up when no ds has ds.queries.singleCell', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the routes when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { queries: { rnaseqGeneCount: {} } } } } }),
		[],
		'should not set up the routes when no ds has ds.queries.singleCell'
	)
	test.end()
})

tape('single cell routes are set up when a ds has ds.queries.singleCell', test => {
	const mounted = getMounted({ hg19: {}, hg38: { datasets: { A: {}, B: { queries: { singleCell: {} } } } } })
	const expected: string[] = []
	for (const e of ['singlecellData', 'singlecellDEgenes', 'singleCellPlots', 'singlecellSamples']) {
		expected.push('get /termdb/' + e, 'post /termdb/' + e)
	}
	test.deepEqual(
		mounted,
		expected,
		'should set up the GET and POST routes when at least one ds has ds.queries.singleCell'
	)
	test.end()
})

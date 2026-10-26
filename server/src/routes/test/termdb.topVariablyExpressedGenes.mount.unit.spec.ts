import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import serverconfig from '#src/serverconfig.js'
import * as topVE from '../termdb.topVariablyExpressedGenes.ts'

/*
Tests:
	topVariablyExpressedGenes route is not set up when no ds has ds.queries.topVariablyExpressedGenes
	topVariablyExpressedGenes route is set up when a ds has ds.queries.topVariablyExpressedGenes
	topVariablyExpressedGenes route is not set up when serverconfig.features.disableFeature_topVariablyExpressedGenes is true
	validate_query_TopVariablyExpressedGenes() removes ds.queries.topVariablyExpressedGenes when disabled

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

// sets serverconfig.features.disableFeature_topVariablyExpressedGenes while running fn(), then restores it
function withDisabledFeature(fn) {
	const key = 'disableFeature_topVariablyExpressedGenes'
	const original = serverconfig.features[key]
	serverconfig.features[key] = true
	try {
		return fn()
	} finally {
		if (original === undefined) delete serverconfig.features[key]
		else serverconfig.features[key] = original
	}
}

tape(
	'topVariablyExpressedGenes route is not set up when serverconfig.features.disableFeature_topVariablyExpressedGenes is true',
	test => {
		const mounted = withDisabledFeature(() =>
			getMounted({ hg38: { datasets: { A: { queries: { topVariablyExpressedGenes: {} } } } } })
		)
		test.deepEqual(mounted, [], 'should not set up the route even when a ds has ds.queries.topVariablyExpressedGenes')
		test.end()
	}
)

tape('validate_query_TopVariablyExpressedGenes() removes ds.queries.topVariablyExpressedGenes when disabled', test => {
	const getGenes = async () => []
	const ds: any = { queries: { topVariablyExpressedGenes: { getGenes } } }
	withDisabledFeature(() => topVE.validate_query_TopVariablyExpressedGenes(ds))
	test.equal(ds.queries.topVariablyExpressedGenes, undefined, 'should delete ds.queries.topVariablyExpressedGenes')

	const ds2: any = { queries: { topVariablyExpressedGenes: { getGenes } } }
	topVE.validate_query_TopVariablyExpressedGenes(ds2)
	test.equal(ds2.queries.topVariablyExpressedGenes?.getGenes, getGenes, 'should keep the ds query when not disabled')
	test.end()
})

import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as diffMeth from '../termdb.diffMeth.ts'
import * as dmr from '../termdb.dmr.ts'
import * as dmrBatch from '../termdb.dmrBatch.ts'
import * as dmrGeneDE from '../termdb.dmrGeneDE.ts'
import * as dmrGeneLink from '../termdb.dmrGeneLink.ts'
import * as dmrLiterature from '../termdb.dmrLiterature.ts'
import * as geneBodyMeth from '../termdb.geneBodyMeth.ts'

/*
Tests:
	methylation routes are not set up when no ds has ds.queries.dnaMethylation
	methylation routes are set up when a ds has ds.queries.dnaMethylation

the methylation routes check the loaded genomes when augen sets up the routes, so each case
sets the genomes before calling setRoutes()
*/

const routes = [diffMeth, dmr, dmrBatch, dmrGeneDE, dmrGeneLink, dmrLiterature, geneBodyMeth]

// returns the route methods that augen sets up from the methylation routes for the given genomes
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
	test.comment('-***- methylation route mount specs -***-')
	test.end()
})

tape('methylation routes are not set up when no ds has ds.queries.dnaMethylation', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the routes when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { queries: { rnaseqGeneCount: {} } } } } }),
		[],
		'should not set up the routes when no ds has ds.queries.dnaMethylation'
	)
	test.end()
})

tape('methylation routes are set up when a ds has ds.queries.dnaMethylation', test => {
	const mounted = getMounted({ hg19: {}, hg38: { datasets: { A: {}, B: { queries: { dnaMethylation: {} } } } } })
	const expected: string[] = []
	for (const e of ['diffMeth', 'dmr', 'dmrBatch', 'dmrGeneDE', 'dmrGeneLink', 'dmrLiterature', 'geneBodyMeth']) {
		expected.push('get /termdb/' + e, 'post /termdb/' + e)
	}
	test.deepEqual(
		mounted,
		expected,
		'should set up the GET and POST routes when at least one ds has ds.queries.dnaMethylation'
	)
	test.end()
})

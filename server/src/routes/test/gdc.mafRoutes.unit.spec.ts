import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as gdcMaf from '../gdc.maf.ts'
import * as gdcMafBuild from '../gdc.mafBuild.ts'

/*
Tests:
	gdc maf routes are not set up when the GDC ds is not loaded
	gdc maf routes are set up when the GDC ds is loaded

the gdc maf routes check the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/gdc.maf.ts and gdc.mafBuild.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [gdcMaf, gdcMafBuild], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/gdc.maf and gdc.mafBuild mount specs -***-')
	test.end()
})

tape('gdc maf routes are not set up when the GDC ds is not loaded', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the routes when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { MMRF: { label: 'MMRF' } } } }),
		[],
		'should not set up the routes when no ds is labeled GDC'
	)
	test.end()
})

tape('gdc maf routes are set up when the GDC ds is loaded', test => {
	const mounted = getMounted({ hg19: {}, hg38: { datasets: { MMRF: { label: 'MMRF' }, GDC: { label: 'GDC' } } } })
	test.deepEqual(
		mounted,
		['get /gdc/maf', 'post /gdc/maf', 'get /gdc/mafBuild', 'post /gdc/mafBuild'],
		'should set up the GET and POST routes when the GDC ds is loaded'
	)
	test.end()
})

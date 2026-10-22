import tape from 'tape'
import { setMovedRoutes } from './movedRoutes.js'

/*
Specs of the routes that were moved from app.unorg.js to route files.

The legacy mds routes were only set up by app.unorg.js when a loaded genome has a legacy mds dataset, which their init
getter now checks. The other moved routes are always set up.

test sections:
- set up routes by the loaded datasets
*/

/** returns the "method endpoint" of the moved routes that are set up for the genomes */
function getMounted(genomes) {
	const mounted = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete', 'all'])
		app[method] = endpoint => mounted.push(`${method} ${endpoint}`)
	setMovedRoutes(app, genomes)
	return mounted.sort()
}

tape('\n', test => {
	test.comment('-***- moved routes specs -***-')
	test.end()
})

tape('set up routes by the loaded datasets', test => {
	const always = ['get /cardsjson', 'get /isoformbycoord']
	const mds = ['post /mdsexpressionrank', 'post /mdssvcnv', 'post /samplematrix']
	test.deepEqual(getMounted({}), always, 'should not set up the legacy mds routes with no genome')
	test.deepEqual(
		getMounted({ hg38: { datasets: { Mds3Ds: { isMds3: true } } } }),
		always,
		'should not set up the legacy mds routes with no legacy mds dataset'
	)
	test.deepEqual(
		getMounted({ hg19: {}, hg38: { datasets: { MdsDs: { isMds: true } } } }),
		[...always, ...mds].sort(),
		'should set up the legacy mds routes when a genome has a legacy mds dataset'
	)
	test.end()
})

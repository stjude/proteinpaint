import tape from 'tape'
import { getTestRoutes } from './testRoutes.js'
import { protectedRoutes } from '../auth/protectedRoutes.ts'

/*
Specs of the test route table in testRoutes.js.

test sections:
- set up the legacy mds routes by the loaded datasets
- the route table has the handler of a route with middlewares
*/

// the routes of a legacy mds dataset, which are only set up when a loaded genome has a legacy mds dataset
const mdsPaths = [
	'/mdsexpressionrank',
	'/mdsgeneboxplot',
	'/mdsgenecount',
	'/mdsjunction',
	'/mdssamplescatterplot',
	'/mdssamplesignature',
	'/mdssurvivalplot',
	'/mdssvcnv',
	'/samplematrix'
]

function getMdsPaths(genomes) {
	return Object.keys(getTestRoutes(genomes))
		.filter(p => mdsPaths.includes(p))
		.sort()
}

tape('\n', test => {
	test.comment('-***- test route table specs -***-')
	test.end()
})

tape('set up the legacy mds routes by the loaded datasets', test => {
	test.deepEqual(getMdsPaths({}), [], 'should not set up the legacy mds routes with no genome')
	test.deepEqual(
		getMdsPaths({ hg38: { datasets: { Mds3Ds: { isMds3: true } } } }),
		[],
		'should not set up the legacy mds routes with no legacy mds dataset'
	)
	test.deepEqual(
		getMdsPaths({ hg19: {}, hg38: { datasets: { MdsDs: { isMds: true } } } }),
		mdsPaths,
		'should set up the legacy mds routes when a genome has a legacy mds dataset'
	)
	test.end()
})

tape('the route table has the handler of a route with middlewares', test => {
	const routes = getTestRoutes({})
	for (const path of ['/termdb', '/termdb/barsql', '/termdb/matrix']) {
		test.equal(typeof routes[path], 'function', `should have a handler for ${path}`)
		test.notOk(
			Object.values(protectedRoutes).includes(routes[path]),
			`should not have a route-level middleware as the handler of ${path}`
		)
	}
	test.end()
})

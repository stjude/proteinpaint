import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import { handle_request_closure } from '#src/termdb.js'
import * as variantData from '../termdb.mds3.variantData.ts'

const { validTermdbMds3VariantDataRequest } = variantData

function withGenomes(_genomes, callback) {
	for (const name in genomes) delete genomes[name]
	Object.assign(genomes, _genomes)
	try {
		return callback()
	} finally {
		for (const name in genomes) delete genomes[name]
	}
}

function getMounted(_genomes) {
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	withGenomes(_genomes, () => setRoutes(app, [variantData], { genomes }))
	return mounted
}

tape('\n', test => {
	test.comment('-***- routes/termdb.mds3.variantData specs -***-')
	test.end()
})

tape('legacy termdb for=mds3variantData is no longer supported', async test => {
	const handler = handle_request_closure({
		hg38: {
			datasets: {
				test: { cohort: { termdb: {} } }
			}
		}
	})
	let response
	await handler(
		{ query: { genome: 'hg38', dslabel: 'test', for: 'mds3variantData' } },
		{ send: value => (response = value) }
	)
	test.deepEqual(
		response,
		{ error: "termdb: doesn't know what to do" },
		'legacy dispatcher does not handle variant data'
	)
	test.end()
})

tape('variant data route is only mounted when supported', test => {
	test.deepEqual(getMounted({}), [], 'does not mount when no genome has variant details')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { queries: { snvindel: { details: {} } } } } } }),
		['get /termdb/mds3/variantData', 'post /termdb/mds3/variantData'],
		'mounts for datasets that support snvindel details'
	)
	test.deepEqual(
		getMounted({ hg38: { termdbs: { A: { queries: { snvindel: { details: {} } } } } } }),
		['get /termdb/mds3/variantData', 'post /termdb/mds3/variantData'],
		'mounts for termdbs that support snvindel details'
	)
	test.end()
})

tape('variant data request validates shared IDs and chromosome', test => {
	const request = {
		genome: 'hg38',
		dslabel: 'test-dataset',
		chr: 'chr1',
		start: 10,
		stop: 20,
		details: { groups: [{ type: 'info', infoKey: 'DP' }] }
	}
	test.deepEqual(validTermdbMds3VariantDataRequest(request), request, 'preserves request fields and validated IDs')
	for (const chr of ['', undefined, 1]) {
		test.throws(
			() => validTermdbMds3VariantDataRequest({ ...request, chr }),
			/q\.chr missing/,
			`rejects invalid chromosome ${String(chr)}`
		)
	}
	test.end()
})

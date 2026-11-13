import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import { handle_request_closure } from '#src/termdb.js'
import * as ldRoute from '../termdb.mds3.ld.ts'

const { validTermdbMds3LDRequest } = ldRoute

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
	withGenomes(_genomes, () => setRoutes(app, [ldRoute], { genomes }))
	return mounted
}

tape('\n', test => {
	test.comment('-***- routes/termdb.mds3.ld specs -***-')
	test.end()
})

tape('LD route is mounted only when a dataset has LD tracks', test => {
	test.deepEqual(getMounted({}), [], 'does not mount when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { queries: { ld: { tracks: [{ name: 'ld' }] } } } } } }),
		['get /termdb/mds3/getLDdata', 'post /termdb/mds3/getLDdata'],
		'mounts for datasets with LD tracks'
	)
	test.deepEqual(
		getMounted({ hg38: { termdbs: { A: { queries: { ld: { tracks: [{ name: 'ld' }] } } } } } }),
		[],
		'does not inspect genome-level termdbs'
	)
	test.end()
})

tape('LD request validates shared IDs and request fields', test => {
	const request = {
		genome: 'hg38',
		dslabel: 'test-dataset',
		ldtkname: 'ld',
		m: { chr: 'chr1', pos: 10, ref: 'A', alt: 'T' }
	}
	test.deepEqual(validTermdbMds3LDRequest(request), request, 'preserves valid request')
	test.throws(() => validTermdbMds3LDRequest({ ...request, ldtkname: '' }), /\.ldtkname missing/)
	test.throws(() => validTermdbMds3LDRequest({ ...request, m: undefined }), /q\.m\{\} not object/)
	test.throws(() => validTermdbMds3LDRequest({ ...request, m: { ...request.m, pos: '10' } }), /invalid q\.m\.chr\/pos/)
	test.throws(() => validTermdbMds3LDRequest({ ...request, m: { ...request.m, alt: '' } }), /q\.m\{\} invalid alleles/)
	test.end()
})

tape('legacy termdb getLDdata dispatch is no longer supported', async test => {
	const handler = handle_request_closure({ hg38: { datasets: { testds: { cohort: { termdb: {} } } } } })
	let result
	await handler({ query: { genome: 'hg38', dslabel: 'testds', getLDdata: 1 } }, { send: value => (result = value) })
	test.equal(result?.error, "termdb: doesn't know what to do", 'legacy getLDdata query is rejected')
	test.end()
})

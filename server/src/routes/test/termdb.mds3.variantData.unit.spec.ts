import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import { handle_request_closure } from '#src/termdb.js'
import * as variantData from '../termdb.mds3.variantData.ts'

const { validTermdbMds3VariantDataRequest, get_mds3variantData } = variantData

const chrlen = 248956422
const regionGenome = { chrlookup: { CHR1: { name: 'chr1', len: chrlen } } }
const details = { groups: [{ type: 'population', key: 'gnomAD' }] }

// a byrange.get() that records whether a data query was made, so a rejected request can be told apart
function getDs(withDetails = true) {
	const ds: any = {
		queried: false,
		queries: {
			snvindel: {
				byrange: {
					get: async () => {
						ds.queried = true
						return []
					}
				}
			}
		}
	}
	if (withDetails) ds.queries.snvindel.details = details
	return ds
}

async function getError(q, ds) {
	try {
		await get_mds3variantData(q, ds, regionGenome)
	} catch (e) {
		return String(e)
	}
	return ''
}

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

tape('get_mds3variantData: dataset without snvindel.details', async test => {
	const ds = getDs(false)
	const error = await getError({ chr: 'chr1', start: 0, stop: 10, details }, ds)
	test.ok(error.includes('snvindel.details not supported'), 'should reject a dataset without snvindel.details')
	test.notOk(ds.queried, 'should not query the data')
	test.end()
})

tape('get_mds3variantData: region', async test => {
	for (const [region, message, label] of [
		[{ chr: 'chr1', start: 0, stop: chrlen + 1 }, 'stop out of bound', 'a region past the chromosome end'],
		[{ chr: 'chrZ', start: 0, stop: 10 }, 'invalid chr name', 'a region on an unknown chromosome'],
		[{ chr: 'chr1', start: 10, stop: 10 }, 'stop < start', 'a region with stop not after start']
	] as [object, string, string][]) {
		const ds = getDs()
		const error = await getError({ ...region, details }, ds)
		test.ok(error.includes(message), `should reject ${label}`)
		test.notOk(ds.queried, `should not query the data for ${label}`)
	}
	test.end()
})

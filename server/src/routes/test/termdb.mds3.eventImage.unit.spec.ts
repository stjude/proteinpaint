import tape from 'tape'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as eventImage from '../termdb.mds3.eventImage.ts'
import { addNonDictionaryQueries } from '../termdb.config.ts'

/*
Tests:
	route is not set up when no ds has ds.queries.svfusion.eventImages
	route is set up when a ds has ds.queries.svfusion.eventImages
	event reports: by event image value
	event reports: client capability
	event reports: dataset validation
	event reports: not supported without svfusion.eventImages

the route checks the loaded genomes when augen sets up the route, so each case sets the genomes before
reading payload.init or calling setRoutes()
*/

const { payload, validate_query_svfusionEventImages } = eventImage
const prefix1 = 'GENE1_exon1_100-__GENE2_exon2_200+'
const prefix2 = 'GENE1_exon1_100-__GENE2_exon3_300+'
const png = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
	'base64'
)

// runs callback() with the loaded genomes set to _genomes
function withGenomes(_genomes, callback) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	try {
		return callback()
	} finally {
		for (const n in genomes) delete genomes[n]
	}
}

// returns the route methods that augen sets up from routes/termdb.mds3.eventImage.ts for the given genomes
function getMounted(_genomes) {
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	withGenomes(_genomes, () => setRoutes(app, [eventImage], { genomes }))
	return mounted
}

/* validates ds like mds3.init.js, and returns run(query) that sends a request through the checker and
handler of the route, as augen does, and returns the response or the error of the checker or handler */
function getRunner(ds, request) {
	validate_query_svfusionEventImages(ds)
	const _genomes = { test: { datasets: { test: ds } } }
	const init = withGenomes(_genomes, () => payload.init)
	const handler = init({ genomes: _genomes })
	return async function run(extra = {}): Promise<{ images?: any[]; error?: string }> {
		const query = { ...request, ...extra }
		try {
			Object.assign(query, payload.request.checker!(query))
		} catch (e: any) {
			return { error: e.message || e }
		}
		let result
		await handler({ query }, { send: value => (result = value) })
		return result
	}
}

tape('\n', function (test) {
	test.comment('-***- routes/termdb.mds3.eventImage specs -***-')
	test.end()
})

tape('route is not set up when no ds has ds.queries.svfusion.eventImages', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { queries: { svfusion: {} } } } } }),
		[],
		'should not set up the route when no ds has ds.queries.svfusion.eventImages'
	)
	test.end()
})

tape('route is set up when a ds has ds.queries.svfusion.eventImages', test => {
	test.deepEqual(
		getMounted({ hg19: {}, hg38: { datasets: { A: {}, B: { queries: { svfusion: { eventImages: {} } } } } } }),
		['get /termdb/mds3/eventImage', 'post /termdb/mds3/eventImage'],
		'should set up the GET and POST routes when at least one ds has ds.queries.svfusion.eventImages'
	)
	test.end()
})

tape('event reports: by event image value', async t => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pp-event-reports-'))
	const file = prefix1 + '_reportA_10-02-26.png'
	const files = [
		file,
		prefix1 + '_reportB_10-02-26.png',
		prefix1 + '_reportA_10-03-26.png',
		prefix2 + '_reportA_10-02-26.png',
		prefix2 + '_reportB_10-02-26.png',
		prefix1 + 'extra_report.png',
		prefix1 + '_report.jpg'
	]
	try {
		await Promise.all(files.map(file => fs.writeFile(path.join(dir, file), png)))
		await fs.mkdir(path.join(dir, prefix1 + '_directory.png'))
		await fs.symlink(path.join(dir, file), path.join(dir, prefix1 + '_linked.png'))
		const ds = { queries: { svfusion: { eventImages: { folder: dir, label: 'Event reports' } } } }
		const run = getRunner(ds, { genome: 'test', dslabel: 'test', eventImage: prefix1 })

		const src = `data:image/png;base64,${png.toString('base64')}`
		const listed = await run()
		t.notOk(listed.error, 'returns reports')
		t.deepEqual(
			listed.images?.map(i => i.label),
			['reportA 10-02-26', 'reportA 10-03-26', 'reportB 10-02-26'],
			'keeps all dated versions and report types, and only png files named by the value and "_", labeled by the rest of the file name'
		)
		t.ok(
			listed.images?.every(i => i.src == src),
			'returns exact PNG bytes of each report'
		)
		t.equal((await run({ eventImage: prefix2 })).images?.length, 2, 'another value has its own reports')
		for (const eventImage of [undefined, '', '../' + prefix1, 'dir/' + prefix1, 'dir\\' + prefix1, 'a\0b', 1]) {
			t.ok((await run({ eventImage })).error, `rejects invalid value ${JSON.stringify(eventImage)}`)
		}
		t.ok((await run({ dslabel: 'other' })).error, 'rejects an unknown dataset')
		t.deepEqual((await run({ eventImage: 'missing' })).images, [], 'no matching files is a normal empty result')
		await fs.writeFile(path.join(dir, file), 'not an image')
		t.ok((await run()).error, 'reports invalid image data')
		ds.queries.svfusion.eventImages.folder = path.join(dir, 'missing')
		t.ok((await run()).error, 'reports directory errors rather than hiding them')
	} finally {
		await fs.rm(dir, { recursive: true, force: true })
	}
	t.end()
})

tape('event reports: client capability', t => {
	const ds = {
		label: 'test',
		queries: { svfusion: { eventImages: { folder: '/data/private', label: 'Event reports' } } }
	}
	const c: any = {}
	addNonDictionaryQueries(c, ds as any, {})
	t.deepEqual(c.queries.svfusion.eventImages, { label: 'Event reports' }, 'only exposes the label')
	t.end()
})

tape('event reports: dataset validation', t => {
	const valid = () => ({ label: 'Event reports', folder: 'files/images' })
	const validate = (svfusion: any) => () => validate_query_svfusionEventImages({ queries: { svfusion } })
	const ds: any = { queries: { svfusion: { eventImages: valid() } } }
	validate_query_svfusionEventImages(ds)
	t.equal(typeof ds.queries.svfusion.eventImages.get, 'function', 'adds the native getter')
	for (const key of ['label', 'folder']) {
		t.throws(validate({ eventImages: { ...valid(), [key]: ' ' } }), new RegExp(key), `requires ${key}`)
	}
	const get = async () => ({ images: [] })
	const supplied: any = { queries: { svfusion: { eventImages: { label: 'Event reports', get } } } }
	validate_query_svfusionEventImages(supplied)
	t.equal(supplied.queries.svfusion.eventImages.get, get, 'keeps a ds-supplied getter')
	t.end()
})

tape('event reports: not supported without svfusion.eventImages', async t => {
	// another ds has eventImages, so that the route is set up
	const _genomes = {
		test: {
			datasets: {
				test: { queries: { svfusion: {} } },
				other: { queries: { svfusion: { eventImages: { label: 'Event reports' } } } }
			}
		}
	}
	const handler = withGenomes(_genomes, () => payload.init)({ genomes: _genomes })
	let result
	await handler(
		{ query: { genome: 'test', dslabel: 'test', eventImage: prefix1 } },
		{ send: value => (result = value) }
	)
	t.equal(result.error, 'eventImages not supported on this dataset', 'reports unsupported dataset')
	t.end()
})

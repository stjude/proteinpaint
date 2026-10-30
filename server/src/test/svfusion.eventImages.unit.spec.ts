import tape from 'tape'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { validate_query_svfusionEventImages } from '../svfusion.eventImages.ts'
import { mds3_request_closure } from '../mds3.load.js'
import { addNonDictionaryQueries } from '../routes/termdb.config.ts'

const prefix1 = 'GENE1_exon1_100-__GENE2_exon2_200+'
const prefix2 = 'GENE1_exon1_100-__GENE2_exon3_300+'
const png = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
	'base64'
)

/* validates ds like mds3.init.js, and returns run(query) that sends a termdb/mds3 request with
q.eventImage to the route handler, and returns .eventImages{} of the response or its error */
function getRunner(genome, ds, request) {
	validate_query_svfusionEventImages(ds)
	const handler = mds3_request_closure({ test: { ...genome, datasets: { test: ds } } })
	return async function run(extra = {}): Promise<{ images?: any[]; error?: string }> {
		const query = { ...request, ...extra }
		let result
		await handler({ query, get: () => 'test-token' }, { send: value => (result = value) })
		return result.error ? { error: result.error } : result.eventImages
	}
}

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
		let queried = false
		const ds = {
			queries: {
				svfusion: {
					eventImages: { folder: dir, label: 'Event reports' },
					byrange: {
						get: async () => {
							queried = true
							return []
						}
					}
				}
			}
		}
		const request = { genome: 'test', dslabel: 'test', eventImage: prefix1 }
		const run = getRunner({ chrlookup: { CHR1: { len: 1000 } } }, ds, request)

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
		t.notOk(queried, 'does not query the event')
		for (const eventImage of ['', '../' + prefix1, 'dir/' + prefix1, 'dir\\' + prefix1, 'a\0b', 1]) {
			t.ok((await run({ eventImage })).error, `rejects invalid value ${JSON.stringify(eventImage)}`)
		}
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
	const get = async () => ({ groups: [] })
	const supplied: any = { queries: { svfusion: { eventImages: { label: 'Event reports', get } } } }
	validate_query_svfusionEventImages(supplied)
	t.equal(supplied.queries.svfusion.eventImages.get, get, 'keeps a ds-supplied getter')
	t.end()
})

tape('event reports: not supported without svfusion.eventImages', async t => {
	const handler = mds3_request_closure({ test: { datasets: { test: { queries: { svfusion: {} } } } } })
	let result
	const query = { genome: 'test', dslabel: 'test', eventImage: prefix1 }
	await handler({ query, get: () => undefined }, { send: value => (result = value) })
	t.equal(result.error, 'eventImages not supported on this dataset', 'reports unsupported dataset')
	t.end()
})

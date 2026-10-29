import tape from 'tape'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { validate_query_svfusionEventImages } from '../svfusion.eventImages.ts'
import { mds3_request_closure } from '../mds3.load.js'
import { client_copy } from '../mds3.init.js'
import { dtfusionrna, dtsv } from '#shared/common.js'

const prefix1 = 'GENE1_exon1_100-__GENE2_exon2_200+'
const prefix2 = 'GENE1_exon1_100-__GENE2_exon3_300+'
const png = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
	'base64'
)

// request properties that identify the event, sent in q.eventImages{} of a termdb/mds3 request
const eventKeys = ['ssm_id', 'chr', 'pos', 'range', 'pair', 'file']

/* validates ds like mds3.init.js, and returns run(query) that sends a termdb/mds3 request with
q.eventImages{} to the route handler, and returns .eventImages{} of the response or its error */
function getRunner(genome, ds, request) {
	validate_query_svfusionEventImages(ds, genome)
	const handler = mds3_request_closure({ test: { ...genome, datasets: { test: ds } } })
	return async function run(extra = {}): Promise<{ groups?: any[]; src?: string; error?: string }> {
		const query: any = { eventImages: {} }
		for (const [k, v] of Object.entries({ ...request, ...extra })) {
			if (eventKeys.includes(k)) query.eventImages[k] = v
			else query[k] = v
		}
		let result
		await handler({ query, get: () => 'test-token' }, { send: value => (result = value) })
		return result.error ? { error: result.error } : result.eventImages
	}
}

function sample(prefix, pos) {
	return {
		formatK2v: { imagePrefix: prefix },
		_pairlst: [
			{
				a: { chr: 'chr1', pos: 99, name: 'GENE1', strand: '-' },
				b: { chr: 'chr2', pos, name: 'GENE2', strand: '+' }
			}
		]
	}
}

tape('event reports: matching, ranges, and loading', async t => {
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
		let samples = [sample(prefix1, 199), sample(prefix1, 199), sample(prefix2, 299)]
		let pairlstIdx = 0
		let received
		const ds = {
			queries: {
				snvindel: { format: { status: {} } },
				svfusion: {
					eventImages: { folder: dir, attrKey: 'imagePrefix', label: 'Event reports' },
					byrange: {
						get: async q => {
							received = q
							return [{ ssm_id: 'event1', pairlstIdx, samples }]
						}
					}
				}
			}
		}
		const filter = { type: 'tvslst', lst: [], join: 'and' }
		const request = {
			genome: 'test',
			dslabel: 'test',
			ssm_id: 'event1',
			chr: 'chr1',
			pos: 99,
			filter,
			__protected__: { clientAuthResult: { role: 'user' } }
		}
		const run = getRunner({ chrlookup: { CHR1: { len: 1000 } } }, ds, request)

		const all = await run()
		t.notOk(all.error, 'lists reports')
		t.equal(all.groups?.length, 2, 'groups by breakpoint pair')
		t.equal(all.groups?.[0].images.length, 3, 'keeps all dated versions and deduplicates samples')
		t.equal(all.groups?.[1].images.length, 2, 'keeps both report types')
		t.ok(all.groups?.[0].label.includes('chr2:200+'), 'uses one-based coordinates in group labels')
		t.deepEqual(received.rglst, [{ chr: 'chr1', start: 99, stop: 100 }], 'queries the clicked breakend')
		t.equal(received.filter, filter, 'preserves the auth-adjusted filter')
		t.equal(received.__protected__, request.__protected__, 'preserves protected context')
		t.equal(received.token, 'test-token', 'forwards dataset token')
		t.equal(received.addFormatValues, true, 'requests per-event attributes')

		const filtered = await run({
			filterObj: filter,
			formatFilter: { status: ['hidden'] },
			skewerRim: { type: 'format', formatKey: 'status', hiddenvaluelst: ['rim'] }
		})
		t.notOk(filtered.error, 'accepts the same filters as the track query')
		t.equal(received.filterObj, filter, 'preserves the sample filter')
		t.deepEqual(received.formatFilter, { status: new Set(['hidden']) }, 'prepares FORMAT filters for the getter')
		t.deepEqual(received.skewerRim.hiddenvalues, new Set(['rim']), 'prepares rim filters for the getter')
		for (const invalid of [
			{ formatFilter: 'hidden' },
			{ formatFilter: { unknown: [] } },
			{ formatFilter: { status: 'hidden' } },
			{ skewerRim: { type: 'other', formatKey: 'status' } },
			{ skewerRim: { type: 'format', formatKey: 'unknown' } },
			{ skewerRim: { type: 'format', formatKey: 'status', hiddenvaluelst: 'hidden' } }
		]) {
			t.ok((await run(invalid)).error, 'rejects invalid track filters')
		}

		const selected = await run({ range: { chr: 'chr2', start: 199, stop: 199 } })
		t.equal(selected.groups?.length, 1, 'single-position range is inclusive')
		t.equal(selected.groups?.[0].images.length, 3, 'only lists images of selected pair')
		const empty = await run({ range: { chr: 'chr2', start: 200, stop: 298 } })
		t.deepEqual(empty.groups, [], 'empty selection has no reports')
		t.deepEqual((await run({ range: { chr: 'chr3', start: 199, stop: 299 } })).groups, [], 'checks chromosome')
		t.equal((await run({ range: null })).groups?.length, 2, 'clearing the range restores all pairs')
		pairlstIdx = 1
		t.equal(
			(await run({ range: { chr: 'chr1', start: 99, stop: 99 } })).groups?.length,
			2,
			'queries from the other gene use the a-side partner breakpoint'
		)
		pairlstIdx = 0

		const image = await run({ file })
		t.equal(image.src, `data:image/png;base64,${png.toString('base64')}`, 'returns exact PNG bytes')
		t.ok((await run({ file, range: { chr: 'chr2', start: 299, stop: 299 } })).error, 'load honors selection')
		t.ok((await run({ file: '../other.png' })).error, 'requires a listed image identifier')
		t.ok((await run({ pos: -1 })).error, 'validates event position')
		t.ok((await run({ range: { chr: 'chr2', start: 300, stop: 200 } })).error, 'validates range')
		t.deepEqual((await run({ ssm_id: 'other' })).groups, [], 'another event has no reports')
		samples = [sample(undefined, 199)]
		t.deepEqual((await run()).groups, [], 'existing events without image attributes remain supported')
		t.ok((await run({ file })).error, 'cannot load an image without its event association')
		samples = [sample('missing', 199)]
		t.deepEqual((await run()).groups, [], 'no matching files is a normal empty result')
		samples = [sample(prefix1, 199)]
		await fs.writeFile(path.join(dir, file), 'not an image')
		t.ok((await run({ file })).error, 'reports invalid image data')
		await fs.unlink(path.join(dir, file))
		t.ok((await run({ file })).error, 'reports a removed image')
		ds.queries.svfusion.eventImages.folder = path.join(dir, 'missing')
		t.ok((await run()).error, 'reports directory errors rather than hiding them')
	} finally {
		await fs.rm(dir, { recursive: true, force: true })
	}
	t.end()
})

tape('event reports: lookup by sample and breakpoint pair', async t => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pp-event-reports-'))
	const file = prefix1 + '_reportA_10-02-26.png'
	try {
		await fs.writeFile(path.join(dir, file), png)
		await fs.writeFile(path.join(dir, prefix2 + '_reportA_10-02-26.png'), png)
		const s1 = { ...sample(prefix1, 199), sample_id: 1 }
		const other = { ...sample(prefix2, 199), sample_id: 2 }
		const nearby = { ...sample(prefix2, 235), sample_id: 1 }
		const oppositeA = { ...sample(prefix2, 199), sample_id: 1 }
		oppositeA._pairlst[0].a.strand = '+'
		const oppositeB = { ...sample(prefix2, 199), sample_id: 1 }
		oppositeB._pairlst[0].b.strand = '-'
		const rglsts: any[] = []
		let received
		const ds = {
			cohort: { termdb: { q: { sampleName2id: name => ({ S1: 1, S2: 2 }[name]) } } },
			queries: {
				svfusion: {
					eventImages: { folder: dir, attrKey: 'imagePrefix', label: 'Event reports' },
					byrange: {
						get: async q => {
							received = q
							rglsts.push(q.rglst)
							return [
								{
									dt: dtfusionrna,
									ssm_id: 'event1',
									pairlstIdx: 0,
									samples: [s1, other, nearby, oppositeA, oppositeB]
								},
								{ dt: dtsv, samples: [{ ...sample(prefix2, 199), sample_id: 1 }] }
							]
						}
					}
				}
			}
		}
		const request = {
			genome: 'test',
			dslabel: 'test',
			pair: {
				sample: 'S1',
				dt: dtfusionrna,
				chrA: 'chr1',
				posA: 99,
				strandA: '-',
				chrB: 'chr2',
				posB: 199,
				strandB: '+'
			},
			__protected__: { clientAuthResult: { role: 'user' } }
		}
		const run = getRunner({ chrlookup: { CHR1: { len: 1000 }, CHR2: { len: 1000 } } }, ds, request)
		const listed = await run()
		t.notOk(listed.error, 'lists reports for a breakpoint pair')
		t.deepEqual(
			listed.groups?.map(g => g.images.map(i => i.file)),
			[[file]],
			'only the matching sample and exact pair contribute'
		)
		t.deepEqual(
			rglsts,
			[[{ chr: 'chr1', start: 99, stop: 100 }], [{ chr: 'chr2', start: 199, stop: 200 }]],
			'queries both breakends'
		)
		t.equal(received.__protected__, request.__protected__, 'preserves protected context')
		t.equal(received.token, 'test-token', 'forwards dataset token')
		const image = await run({ file })
		t.equal(image.src, `data:image/png;base64,${png.toString('base64')}`, 'loads a listed PNG')
		t.ok((await run({ file: prefix2 + '_reportA_10-02-26.png' })).error, 'cannot load another sample image')
		t.deepEqual(
			(await run({ pair: { ...request.pair, sample: 'S2' } })).groups?.map(g => g.images.length),
			[1],
			'another sample gets its own reports'
		)
		t.deepEqual((await run({ pair: { ...request.pair, posB: 200 } })).groups, [], 'requires exact positions')
		for (const identity of [{ strandA: '+' }, { strandB: '-' }, { dt: dtsv }]) {
			t.deepEqual(
				(await run({ pair: { ...request.pair, ...identity } })).groups?.flatMap(g => g.images.map(i => i.file)),
				[prefix2 + '_reportA_10-02-26.png'],
				'selects reports using the complete event identity'
			)
		}
		t.ok((await run({ pair: { ...request.pair, dt: 1 } })).error, 'validates event type')
		t.ok((await run({ pair: { ...request.pair, strandA: '?' } })).error, 'validates first strand')
		t.ok((await run({ pair: { ...request.pair, strandB: '?' } })).error, 'validates second strand')
		t.deepEqual((await run({ pair: { ...request.pair, sample: 'unknown' } })).groups, [], 'unknown sample is empty')
		t.deepEqual(
			(await run({ pair: { ...request.pair, sample: '1' } })).groups,
			[],
			'unknown numeric sample name does not match a sample id'
		)
		t.ok((await run({ pair: { ...request.pair, posA: -1 } })).error, 'validates positions')
		t.ok((await run({ pair: { ...request.pair, sample: '' } })).error, 'validates sample')
	} finally {
		await fs.rm(dir, { recursive: true, force: true })
	}
	t.end()
})

tape('event reports: client capability', t => {
	const ds = {
		label: 'test',
		queries: { svfusion: { eventImages: { folder: '/data/private', attrKey: 'imagePrefix', label: 'Event reports' } } }
	}
	const copy = client_copy(ds)
	t.deepEqual(copy.queries.svfusion, { eventImages: { label: 'Event reports' } }, 'only exposes the label')
	t.end()
})

tape('event reports: dataset validation', t => {
	const byrange = { get: async () => [] }
	const valid = () => ({ label: 'Event reports', folder: 'files/images', attrKey: 'imagePrefix' })
	const validate = (svfusion: any) => () => validate_query_svfusionEventImages({ queries: { svfusion } }, {})
	const ds: any = { queries: { svfusion: { byrange, eventImages: valid() } } }
	validate_query_svfusionEventImages(ds, {})
	t.equal(typeof ds.queries.svfusion.eventImages.get, 'function', 'adds the native getter')
	t.throws(validate({ eventImages: valid() }), /requires svfusion.byrange/, 'requires byrange for the native getter')
	for (const key of ['label', 'folder', 'attrKey']) {
		t.throws(validate({ byrange, eventImages: { ...valid(), [key]: ' ' } }), new RegExp(key), `requires ${key}`)
	}
	const get = async () => ({ groups: [] })
	const supplied: any = { queries: { svfusion: { eventImages: { label: 'Event reports', get } } } }
	validate_query_svfusionEventImages(supplied, {})
	t.equal(supplied.queries.svfusion.eventImages.get, get, 'keeps a ds-supplied getter')
	t.end()
})

tape('event reports: not supported without svfusion.eventImages', async t => {
	const handler = mds3_request_closure({ test: { datasets: { test: { queries: { svfusion: {} } } } } })
	let result
	const query = { genome: 'test', dslabel: 'test', eventImages: { ssm_id: 'event1', chr: 'chr1', pos: 99 } }
	await handler({ query, get: () => undefined }, { send: value => (result = value) })
	t.equal(result.error, 'eventImages not supported on this dataset', 'reports unsupported dataset')
	t.end()
})

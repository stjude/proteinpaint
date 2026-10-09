import tape from 'tape'
import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import {
	resolveDaContext,
	buildGroupValues,
	canonicalizeSamplelst,
	withholdSampleNames,
	sampleFilterScope,
	sampleFilterId,
	resolveGroups,
	resolveGroupPair,
	withResolvedGroups,
	maxFilterGroups
} from '#src/utils/sampleGroups.ts'
import { getData } from '#src/termdb.matrix.js'
import { init as initTestDs } from '#src/test/load.testds.js'
import { server_init_db_queries } from '#src/termdb.server.init.ts'
import { getAuthApi, authApi } from '#src/auth.js'

/*
test sections:

canonicalizeSamplelst returns input unchanged when s is falsy
canonicalizeSamplelst returns input unchanged when s.groups is not an array
canonicalizeSamplelst sorts values by sampleId and is order-stable
canonicalizeSamplelst comparator treats equal sampleIds as equal (A === B branch)
canonicalizeSamplelst leaves a group.values that is not an array unchanged
canonicalizeSamplelst keeps the filter of a group that lists no samples
buildGroupValues happy path: includes samples whose id is integer and name is in allSampleSet
buildGroupValues skips non-integer sampleId
buildGroupValues skips when id2sampleName returns falsy
buildGroupValues skips when name is not in allSampleSet
buildGroupValues resolves the samples of a ds with a sample filter once per request
sampleFilterId is empty only for no sample filter
sampleFilterScope is empty for a dataset without a sample filter
buildGroupValues skips when tw is configured but term_results has no row for that sample
buildGroupValues skips when tw2 is configured but term_results2 has no row for that sample
buildGroupValues reads .value for continuous mode and .key otherwise
withholdSampleNames removes matching names and reports the count
withholdSampleNames reports 0 when the pattern matches nothing
withholdSampleNames is a no-op without a pattern
buildGroupValues populates conf2 from tw2 with the same continuous/discrete split
resolveDaContext throws when the request genome is not in the genomes map
resolveDaContext returns ds with empty term_results when neither tw nor tw2 is set
resolveDaContext invokes getData via the tw branch and rethrows on term_results.error
resolveDaContext invokes getData via the tw2 branch and rethrows on term_results2.error
resolveGroups returns groups that list their samples as they are
resolveGroups lists the samples that the filter of a group selects
resolveGroups resolves the filter groups of a call one at a time
resolveGroups refuses more filter groups than its limit
resolveGroups gives a filter with a non-dictionary term to the method of the dataset
getData holds the samplelst terms of a request to the limit of filter groups together
withResolvedGroups gives a request the samples of its groups, for a cache key by samples
resolveGroupPair takes each group as a list or as a filter
*/

/** Unit tests for src/utils/sampleGroups.ts. canonicalizeSamplelst and
 * buildGroupValues are pure functions exercised with hand-rolled fakes.
 * resolveDaContext is covered for its no-tw/no-tw2 paths via a minimal
 * fake `genomes` object that satisfies get_ds_tdb's shape requirements;
 * the tw-bearing branches call getData() against a real termdb (via
 * load.testds.js, mirroring termdb.filter.unit.spec.js). */

tape('\n', t => {
	t.comment('-***- src/utils/sampleGroups -***-')
	t.end()
})

// =============================================================================
// canonicalizeSamplelst
// =============================================================================

tape('canonicalizeSamplelst returns input unchanged when s is falsy', t => {
	t.equal(canonicalizeSamplelst(null), null, 'null passes through')
	t.equal(canonicalizeSamplelst(undefined), undefined, 'undefined passes through')
	t.end()
})

tape('canonicalizeSamplelst returns input unchanged when s.groups is not an array', t => {
	const s = { groups: { not: 'an-array' } }
	t.equal(canonicalizeSamplelst(s), s, 'non-array groups passes through (early return)')
	t.end()
})

tape('canonicalizeSamplelst sorts values by sampleId and is order-stable', t => {
	const a = canonicalizeSamplelst({
		groups: [{ name: 'g', in: true, values: [{ sampleId: 3 }, { sampleId: 1 }, { sampleId: 2 }] }]
	})
	const b = canonicalizeSamplelst({
		groups: [{ name: 'g', in: true, values: [{ sampleId: 1 }, { sampleId: 2 }, { sampleId: 3 }] }]
	})
	t.deepEqual(a, b, 'two orderings of the same samples canonicalize identically')
	t.deepEqual(
		a.groups[0].values.map((v: any) => v.sampleId),
		[1, 2, 3],
		'values sorted ascending by sampleId'
	)
	t.end()
})

tape('canonicalizeSamplelst comparator treats equal sampleIds as equal (A === B branch)', t => {
	// Two entries with the same sampleId — comparator must return 0 and the
	// pair must remain together in the output (any order is acceptable).
	const out = canonicalizeSamplelst({
		groups: [{ name: 'g', in: true, values: [{ sampleId: 5, tag: 'a' }, { sampleId: 5, tag: 'b' }, { sampleId: 1 }] }]
	})
	const ids = out.groups[0].values.map((v: any) => v.sampleId)
	t.deepEqual(ids, [1, 5, 5], 'equal sampleIds stay adjacent at the sorted position')
	t.end()
})

tape('canonicalizeSamplelst leaves a group.values that is not an array unchanged', t => {
	const out = canonicalizeSamplelst({
		groups: [{ name: 'g', in: true, values: 'opaque-non-array' as any }]
	})
	t.equal(out.groups[0].values, 'opaque-non-array', 'non-array values is passed through (else branch of ternary)')
	t.end()
})

tape('canonicalizeSamplelst keeps the filter of a group that lists no samples', t => {
	const filter = (key: string) => ({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [{ type: 'tvs', tvs: { values: [{ key }] } }]
	})
	const a = canonicalizeSamplelst({ groups: [{ name: 'g', in: true, filter: filter('a'), sampleCount: 5 }] })
	const b = canonicalizeSamplelst({ groups: [{ name: 'g', in: true, filter: filter('b'), sampleCount: 5 }] })
	t.notDeepEqual(a, b, 'two groups that differ by their filter are not the same')
	t.deepEqual(a.groups[0].filter, filter('a'), 'the filter is kept')
	t.notOk('sampleCount' in a.groups[0], 'a property that does not define the group is left out')
	t.deepEqual(
		canonicalizeSamplelst({
			groups: [{ name: 'g', in: true, values: [{ sampleId: 2 }, { sampleId: 1 }], filter: filter('a') }]
		}),
		{ groups: [{ name: 'g', in: true, values: [{ sampleId: 1 }, { sampleId: 2 }] }] },
		'a group that lists its samples is the same as before'
	)
	t.end()
})

// =============================================================================
// buildGroupValues
// =============================================================================

/** Build a tiny ds with an id-to-name lookup table that buildGroupValues
 * reads via ds.cohort.termdb.q.id2sampleName(). */
function makeDs(idToName: Record<number, string>) {
	return {
		cohort: {
			termdb: {
				q: {
					id2sampleName: (id: number) => idToName[id]
				}
			}
		}
	}
}

tape('buildGroupValues happy path: includes samples whose id is integer and name is in allSampleSet', async t => {
	const ds = makeDs({ 1: 'sampleA', 2: 'sampleB' })
	const allSampleSet = new Set<string>(['sampleA', 'sampleB'])
	const out = await buildGroupValues([{ sampleId: 1 }, { sampleId: 2 }], allSampleSet, ds, null, null, [], [])
	t.deepEqual(out.names, ['sampleA', 'sampleB'], 'both samples included')
	t.deepEqual(out.conf1, [], 'no tw → empty conf1')
	t.deepEqual(out.conf2, [], 'no tw2 → empty conf2')
	t.end()
})

tape('buildGroupValues skips non-integer sampleId', async t => {
	const ds = makeDs({ 1: 'sampleA' })
	const allSampleSet = new Set<string>(['sampleA'])
	const out = await buildGroupValues(
		[{ sampleId: 1 }, { sampleId: 1.5 as any }, { sampleId: 'x' as any }],
		allSampleSet,
		ds,
		null,
		null,
		[],
		[]
	)
	// 1.5 is not a termdb row id; 'x' is a name, but not one this ds has data for
	t.deepEqual(out.names, ['sampleA'], 'only the integer sampleId entry was kept')
	t.end()
})

tape('buildGroupValues takes a string sampleId as the sample name itself', async t => {
	// api-backed datasets without a sqlite termdb (gdc) key samples by case uuid, and have no
	// id2sampleName to resolve through
	const ds = { cohort: { termdb: {} } }
	const caseUuid = 'ec82a00f-3909-4781-8ae2-e54cbc1ac7ac'
	const allSampleSet = new Set<string>([caseUuid])
	const out = await buildGroupValues(
		[{ sampleId: caseUuid }, { sampleId: 'not-in-the-cohort' }],
		allSampleSet,
		ds,
		null,
		null,
		[],
		[]
	)
	t.deepEqual(out.names, [caseUuid], 'the known case uuid was kept, the unknown one dropped')
	t.end()
})

tape('buildGroupValues skips when id2sampleName returns falsy', async t => {
	const ds = makeDs({ 1: 'sampleA' }) // sampleId 2 maps to undefined
	const allSampleSet = new Set<string>(['sampleA'])
	const out = await buildGroupValues([{ sampleId: 1 }, { sampleId: 2 }], allSampleSet, ds, null, null, [], [])
	t.deepEqual(out.names, ['sampleA'], 'sample with no name resolution was skipped')
	t.end()
})

tape('buildGroupValues skips when name is not in allSampleSet', async t => {
	const ds = makeDs({ 1: 'sampleA', 2: 'sampleB' })
	const allSampleSet = new Set<string>(['sampleA']) // sampleB missing
	const out = await buildGroupValues([{ sampleId: 1 }, { sampleId: 2 }], allSampleSet, ds, null, null, [], [])
	t.deepEqual(out.names, ['sampleA'], 'sample not in allSampleSet was skipped')
	t.end()
})

/* For a ds with a sample filter, the samples are resolved from the ds db. Here the db is a stub that
returns sampleA only, and the shared authApi of a unit test run is the open-access one, which does
not call getAdditionalFilter(): this covers which names are kept and how often the db is queried.
The filter of a session's role is covered by sampleGroups.request.integration.spec.ts. */
tape('buildGroupValues resolves the samples of a ds with a sample filter once per request', async t => {
	// assign the shared open-access api once, the same idempotent way termdb.matrix.unit.spec.js does
	if (!authApi) {
		const app = { doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }
		await getAuthApi(app, {}, {}, true)
	}
	const ds: any = makeDs({ 1: 'sampleA', 2: 'sampleB' })
	ds.cohort.termdb.getAdditionalFilter = () => undefined
	ds.cohort.termdb.q.sampleName2id = (name: string) => (name == 'sampleA' ? 1 : 2)
	let queries = 0
	ds.cohort.db = { connection: { prepare: () => ({ all: () => (queries++, [{ id: 1 }]) }) } }
	const allSampleSet = new Set<string>(['sampleA', 'sampleB'])
	const request = {} // the q.__protected__ of one request
	const g1 = await buildGroupValues([{ sampleId: 1 }, { sampleId: 2 }], allSampleSet, ds, null, null, [], [], request)
	const g2 = await buildGroupValues([{ sampleId: 2 }], allSampleSet, ds, null, null, [], [], request)
	t.deepEqual(g1.names, ['sampleA'], 'only the sample that the ds db returns is included')
	t.deepEqual(g2.names, [], 'a group of the other sample is empty')
	t.equal(queries, 1, 'the two groups of a request share one db query')
	await buildGroupValues([{ sampleId: 1 }], allSampleSet, ds, null, null, [], [], {})
	t.equal(queries, 2, 'another request queries the db again')
	t.end()
})

tape('sampleFilterId is empty only for no sample filter', t => {
	t.equal(sampleFilterId(undefined), '', 'no filter')
	t.equal(
		sampleFilterId({ type: 'tvslst', join: '', lst: [] }),
		'',
		'the empty filter that is left for a request without a sample filter'
	)
	const tvs = { type: 'tvs', tvs: { term: { id: 'a' }, values: [{ key: '1' }] } }
	const ids = [
		sampleFilterId({ type: 'tvslst', join: '', lst: [tvs], tag: 'x' }),
		sampleFilterId({ type: 'tvslst', join: '', lst: [], tag: 'x' }),
		sampleFilterId({ ...tvs, tag: 'x' }),
		sampleFilterId(tvs)
	]
	t.ok(
		ids.every(id => id),
		'a sample filter of any shape has an id'
	)
	t.equal(new Set(ids).size, ids.length, 'and different filters have different ids')
	t.end()
})

tape('sampleFilterScope is empty for a dataset without a sample filter', t => {
	t.equal(sampleFilterScope({}, makeDs({})), '', 'same as no cacheScope, so the cacheId does not change')
	t.end()
})

tape('buildGroupValues skips when tw is configured but term_results has no row for that sample', async t => {
	const ds = makeDs({ 1: 'sampleA', 2: 'sampleB' })
	const allSampleSet = new Set<string>(['sampleA', 'sampleB'])
	const tw = { $id: 'tw1', q: { mode: 'discrete' } }
	const term_results = { samples: { 1: { tw1: { key: 'M', value: 'M' } } } } // sample 2 missing
	const out = await buildGroupValues([{ sampleId: 1 }, { sampleId: 2 }], allSampleSet, ds, tw, null, term_results, [])
	t.deepEqual(out.names, ['sampleA'], 'sample missing tw data was skipped')
	t.deepEqual(out.conf1, ['M'], 'conf1 picked up the discrete key for the kept sample')
	t.end()
})

tape('buildGroupValues skips when tw2 is configured but term_results2 has no row for that sample', async t => {
	const ds = makeDs({ 1: 'sampleA', 2: 'sampleB' })
	const allSampleSet = new Set<string>(['sampleA', 'sampleB'])
	const tw2 = { $id: 'tw2', q: { mode: 'discrete' } }
	const term_results2 = { samples: { 1: { tw2: { key: 'X', value: 'X' } } } } // sample 2 missing
	const out = await buildGroupValues([{ sampleId: 1 }, { sampleId: 2 }], allSampleSet, ds, null, tw2, [], term_results2)
	t.deepEqual(out.names, ['sampleA'], 'sample missing tw2 data was skipped')
	t.deepEqual(out.conf2, ['X'], 'conf2 picked up the discrete key for the kept sample')
	t.end()
})

tape('buildGroupValues reads .value for continuous mode and .key otherwise', async t => {
	const ds = makeDs({ 1: 'sampleA', 2: 'sampleB' })
	const allSampleSet = new Set<string>(['sampleA', 'sampleB'])

	// Continuous: conf1 collects v.value
	const twCont = { $id: 'twC', q: { mode: 'continuous' } }
	const term_results_cont = {
		samples: {
			1: { twC: { key: 'unused', value: 1.5 } },
			2: { twC: { key: 'unused', value: 2.5 } }
		}
	}
	const outCont = await buildGroupValues(
		[{ sampleId: 1 }, { sampleId: 2 }],
		allSampleSet,
		ds,
		twCont,
		null,
		term_results_cont,
		[]
	)
	t.deepEqual(outCont.conf1, [1.5, 2.5], 'continuous mode used v.value')

	// Discrete: conf1 collects v.key
	const twDisc = { $id: 'twD', q: { mode: 'discrete' } }
	const term_results_disc = {
		samples: {
			1: { twD: { key: 'M', value: 'unused' } },
			2: { twD: { key: 'F', value: 'unused' } }
		}
	}
	const outDisc = await buildGroupValues(
		[{ sampleId: 1 }, { sampleId: 2 }],
		allSampleSet,
		ds,
		twDisc,
		null,
		term_results_disc,
		[]
	)
	t.deepEqual(outDisc.conf1, ['M', 'F'], 'non-continuous mode used v.key')
	t.end()
})

tape('withholdSampleNames removes matching names and reports the count', t => {
	const set = new Set(['MMRF_1_1_BM_CD138pos', 'MMRF_2_1_PB_CD138pos', 'MMRF_3_1_BM_CD138pos'])
	const withheld = withholdSampleNames(set, '_PB_')
	t.equal(withheld, 1, 'returns how many were withheld')
	t.deepEqual(
		[...set].sort(),
		['MMRF_1_1_BM_CD138pos', 'MMRF_3_1_BM_CD138pos'],
		'only the matching name left the set, and it was mutated in place'
	)
	t.end()
})

/* A pattern that matches nothing is the failure mode this guards: the exclusion looks like it
worked from every downstream angle. The count is what lets the caller warn instead of proceeding
quietly, so pin that it comes back 0 rather than throwing or silently succeeding. */
tape('withholdSampleNames reports 0 when the pattern matches nothing', t => {
	const set = new Set(['MMRF_1_1_BM_CD138pos', 'MMRF_3_1_BM_CD138pos'])
	t.equal(withholdSampleNames(set, '_PB_'), 0, 'nothing matched, so nothing was withheld')
	t.equal(set.size, 2, 'set untouched')
	t.end()
})

tape('withholdSampleNames is a no-op without a pattern', t => {
	const set = new Set(['a', 'b'])
	t.equal(withholdSampleNames(set, undefined), 0, 'no pattern means no filtering')
	t.equal(withholdSampleNames(set, ''), 0, 'an empty pattern must not match every name')
	t.equal(set.size, 2, 'set untouched')
	t.end()
})

tape('buildGroupValues populates conf2 from tw2 with the same continuous/discrete split', async t => {
	const ds = makeDs({ 1: 'sampleA' })
	const allSampleSet = new Set<string>(['sampleA'])
	const tw2Cont = { $id: 'twC2', q: { mode: 'continuous' } }
	const term_results2 = { samples: { 1: { twC2: { key: 'unused', value: 9.9 } } } }
	const out = await buildGroupValues([{ sampleId: 1 }], allSampleSet, ds, null, tw2Cont, [], term_results2)
	t.deepEqual(out.conf2, [9.9], 'conf2 continuous reads v.value')
	t.end()
})

// =============================================================================
// resolveDaContext
// =============================================================================

tape('resolveDaContext throws when the request genome is not in the genomes map', async t => {
	try {
		await resolveDaContext({ genome: 'nope', dslabel: 'whatever' } as any, {})
		t.fail('expected throw on invalid genome')
	} catch (e: any) {
		t.match(e.message, /invalid genome/, 'error identifies the invalid genome')
	}
	t.end()
})

tape('resolveDaContext returns ds with empty term_results when neither tw nor tw2 is set', async t => {
	// Minimal fake genome that satisfies get_ds_tdb: needs datasets[dslabel]
	// with .cohort.termdb. Returning [ds, ds.cohort.termdb] from get_ds_tdb
	// is all resolveDaContext destructures, so no further shape is required.
	const ds = { cohort: { termdb: {} }, _marker: 'fake-ds' }
	const genomes = { hg38: { datasets: { TestDs: ds } } }
	const req = { genome: 'hg38', dslabel: 'TestDs' } as any

	const out = await resolveDaContext(req, genomes)
	t.equal(out.ds, ds, 'returned ds is the one looked up via get_ds_tdb')
	t.deepEqual(out.term_results, [], 'no tw → term_results is the [] initializer')
	t.deepEqual(out.term_results2, [], 'no tw2 → term_results2 is the [] initializer')
	t.end()
})

// --- tw / tw2 branches (integration-shaped via load.testds.js) --------------
//
// resolveDaContext calls getData() when req.tw / req.tw2 is set, and then
// rethrows when the returned value has an .error field. Covering those four
// branches with hand-rolled fakes is impractical because getData() expects a
// real cohort db. We use the existing load.testds pattern (already used by
// termdb.filter.unit.spec.js and others) to boot the real TermdbTest db.
//
// We then deliberately pass an UNRECOGNIZED term id. getData() swallows the
// internal error, returns { error: 'unknown term id' } (see
// termdb.matrix.js — getData wraps everything in try/catch and converts
// throws to { error }). resolveDaContext's `if (term_results.error)` then
// fires, covering both the call and the rethrow lines for tw and tw2.

let sharedTdb: any
async function ensureSharedTdb() {
	if (sharedTdb) return sharedTdb
	sharedTdb = await initTestDs('termdb.test.ts')
	server_init_db_queries(sharedTdb.ds)
	return sharedTdb
}

tape('resolveDaContext invokes getData via the tw branch and rethrows on term_results.error', async t => {
	const tdb = await ensureSharedTdb()
	const genomes = { hg38: { datasets: { TermdbTest: tdb.ds } } }
	const req = {
		genome: 'hg38',
		dslabel: 'TermdbTest',
		tw: { term: { id: '__no_such_term__' } }
	} as any
	try {
		await resolveDaContext(req, genomes)
		t.fail('expected throw because getData returned {error}')
	} catch (e: any) {
		t.ok(e instanceof Error, 'rethrown as a real Error')
		t.ok(e.message && e.message.length, 'rethrown error carries a non-empty message')
	}
	t.end()
})

tape('resolveDaContext invokes getData via the tw2 branch and rethrows on term_results2.error', async t => {
	const tdb = await ensureSharedTdb()
	const genomes = { hg38: { datasets: { TermdbTest: tdb.ds } } }
	const req = {
		genome: 'hg38',
		dslabel: 'TermdbTest',
		tw2: { term: { id: '__no_such_term_2__' } }
	} as any
	try {
		await resolveDaContext(req, genomes)
		t.fail('expected throw because getData returned {error} on the tw2 call')
	} catch (e: any) {
		t.ok(e instanceof Error, 'rethrown as a real Error')
		t.ok(e.message && e.message.length, 'rethrown error carries a non-empty message')
	}
	t.end()
})

// =============================================================================
// resolveGroups, resolveGroupPair
// =============================================================================

// the cache subdir that CacheManager creates when a server launches
fs.mkdirSync(path.join(serverconfig.cachedir, 'samplelst'), { recursive: true })

const allFilter = () => ({
	type: 'tvslst',
	in: true,
	join: '',
	lst: [
		{
			type: 'tvs',
			tvs: { term: { id: 'diaggrp', type: 'categorical' }, values: [{ key: 'Acute lymphoblastic leukemia' }] }
		}
	]
})

/** Runs fn() with the db of the ds replaced by one that throws when it is queried. */
async function withoutDb(ds: any, fn: () => Promise<any>) {
	const db = ds.cohort.db
	ds.cohort.db = {
		connection: {
			prepare() {
				throw new Error('the db was queried')
			}
		}
	}
	try {
		return await fn()
	} finally {
		ds.cohort.db = db
	}
}

tape('resolveGroups returns groups that list their samples as they are', async t => {
	const tdb = await ensureSharedTdb()
	const groups = [
		{ name: 'a', in: true, values: [{ sampleId: 1 }] },
		{ name: 'b', in: false, values: [{ sampleId: 1 }] }
	]
	t.equal(
		await withoutDb(tdb.ds, () => resolveGroups(groups, {}, tdb.ds)),
		groups,
		'the same groups, without a db query'
	)
	try {
		await resolveGroups({ a: 1 }, {}, tdb.ds)
		t.fail('expected a throw for groups that are not an array')
	} catch (e: any) {
		t.match(e.message, /not an array/, 'groups that are not an array are refused')
	}
	const neither = [{ name: 'a' }, { name: 'b', values: [] }]
	t.deepEqual(await resolveGroups(neither, {}, tdb.ds), neither, 'a group with neither is left to its reader')
	t.end()
})

tape('resolveGroups lists the samples that the filter of a group selects', async t => {
	const tdb = await ensureSharedTdb()
	const ds = tdb.ds
	// a filter of its own, so that an earlier run of this spec has not cached its list
	const filter: any = allFilter()
	filter.tag = `spec-${Date.now()}-${Math.random()}`
	const expected = [
		...new Set(
			ds.cohort.db.connection
				.prepare('select sample from anno_categorical where term_id=? and value=?')
				.all('diaggrp', 'Acute lymphoblastic leukemia')
				.map((r: any) => r.sample)
		)
	].sort((a: any, b: any) => a - b)
	t.ok(expected.length > 0, 'the test db has samples for the filter')

	const groups = [
		{ name: 'ALL', filter, sampleCount: 3, color: 'red' },
		{ name: 'picked', in: true, values: [{ sampleId: 1 }] }
	]
	const before = structuredClone(groups)
	const out = await resolveGroups(groups, {}, ds)
	t.deepEqual(groups, before, 'the groups of the request are not modified')
	t.deepEqual(
		out[0].values.map((v: any) => v.sampleId).sort((a: any, b: any) => a - b),
		expected,
		'the group of a filter lists the samples that the filter selects'
	)
	t.notOk('filter' in out[0], 'and no longer has the filter')
	t.equal(out[0].in, true, 'it is a group of the listed samples')
	t.equal(out[0].color, 'red', 'its other properties are kept')
	t.equal(out[1], groups[1], 'a group that lists its samples is returned as it is')

	t.deepEqual(
		await withoutDb(ds, () => resolveGroups(groups, {}, ds)),
		out,
		'resolving the same groups again gives the same lists from the cache, without a db query'
	)
	t.end()
})

/** A dataset without a db, whose own method resolves a filter and counts the calls made and in flight. */
function countingDs() {
	const calls = { total: 0, inFlight: 0, mostInFlight: 0 }
	const ds = {
		genomename: 'hg38-test',
		label: `spec-${Date.now()}-${Math.random()}`,
		cohort: {
			termdb: {
				async filterSamples() {
					calls.total++
					calls.mostInFlight = Math.max(calls.mostInFlight, ++calls.inFlight)
					await new Promise(resolve => setTimeout(resolve, 5))
					calls.inFlight--
					return [1, 2]
				}
			}
		}
	}
	return { ds, calls }
}

// n groups, each with a filter of its own
const filterGroups = (n: number) =>
	Array.from({ length: n }, (_, i) => ({ name: `g${i}`, filter: { ...allFilter(), tag: `g${i}` } }))

tape('resolveGroups resolves the filter groups of a call one at a time', async t => {
	const { ds, calls } = countingDs()
	const out = await resolveGroups(filterGroups(5), {}, ds)
	t.equal(calls.total, 5, 'each filter is resolved')
	t.equal(calls.mostInFlight, 1, 'one at a time')
	t.deepEqual(
		out.map((g: any) => [g.name, g.values]),
		filterGroups(5).map(g => [g.name, [{ sampleId: 1 }, { sampleId: 2 }]]),
		'the groups come back in their order, each with its list'
	)
	t.end()
})

tape('resolveGroups refuses more filter groups than its limit', async t => {
	const { ds, calls } = countingDs()
	try {
		await resolveGroups(filterGroups(maxFilterGroups + 1), {}, ds)
		t.fail('expected a throw for more filter groups than the limit')
	} catch (e: any) {
		t.match(e.message, /too many sample groups/, 'more filter groups than the limit are refused')
	}
	t.equal(calls.total, 0, 'before any of them is resolved')
	t.equal((await resolveGroups(filterGroups(maxFilterGroups), {}, ds)).length, maxFilterGroups, 'the limit is allowed')
	const listed = Array.from({ length: maxFilterGroups + 1 }, (_, i) => ({ name: `g${i}`, values: [{ sampleId: i }] }))
	t.equal(await resolveGroups(listed, {}, ds), listed, 'groups that list their samples are not counted')
	t.end()
})

tape('resolveGroups gives a filter with a non-dictionary term to the method of the dataset', async t => {
	const group = [
		{
			name: 'a',
			filter: {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [{ type: 'tvs', tvs: { term: { type: 'geneExpression', gene: 'TP53' }, ranges: [{ start: 1 }] } }]
			}
		}
	]
	const { ds, calls } = countingDs()
	t.equal((await resolveGroups(group, {}, ds))[0].values.length, 2, 'the group gets the samples that the method gives')
	t.equal(calls.total, 1, 'from one call of the method')
	t.end()
})

tape('getData holds the samplelst terms of a request to the limit of filter groups together', async t => {
	const tdb = await ensureSharedTdb()
	const half = Math.ceil((maxFilterGroups + 1) / 2)
	const tw = (name: string) => ({
		$id: name,
		term: { name, type: 'samplelst', values: {} },
		q: { groups: filterGroups(half) }
	})
	const result = await withoutDb(tdb.ds, () => getData({ terms: [tw('a'), tw('b')] }, tdb.ds))
	t.match(String(result.error), /too many sample groups/, 'refused, before any group is resolved')
	t.end()
})

tape('withResolvedGroups gives a request the samples of its groups, for a cache key by samples', async t => {
	const { ds } = countingDs()
	const req = { genome: 'hg38-test', samplelst: { groups: filterGroups(2) } }
	const before = structuredClone(req)
	const resolved = await withResolvedGroups(req, ds)
	t.deepEqual(req, before, 'the request is not modified')
	const listed = {
		groups: filterGroups(2).map(g => ({ name: g.name, in: true, values: [{ sampleId: 2 }, { sampleId: 1 }] }))
	}
	t.deepEqual(
		canonicalizeSamplelst(resolved.samplelst),
		canonicalizeSamplelst(listed),
		'its groups are, for a cache key, the same as the groups that list those samples'
	)
	t.equal(resolved.genome, 'hg38-test', 'the rest of the request is kept')
	const lists = { samplelst: listed }
	t.equal(await withResolvedGroups(lists, ds), lists, 'a request whose groups list their samples is returned as it is')
	const none = {}
	t.equal(await withResolvedGroups(none, ds), none, 'and so is a request without groups')
	t.end()
})

tape('resolveGroupPair takes each group as a list or as a filter', async t => {
	const tdb = await ensureSharedTdb()
	const ids = [{ sampleId: 1 }, { sampleId: 2 }]
	const [g1, g2] = await resolveGroupPair({ group1: ids, group2: { filter: allFilter() } }, tdb.ds)
	t.equal(g1, ids, 'a list is returned as it is')
	t.ok(Array.isArray(g2) && g2.length > 0 && 'sampleId' in g2[0], 'a filter is returned as its list')
	const [n1, n2] = await resolveGroupPair({}, tdb.ds)
	t.ok(n1 === undefined && n2 === undefined, 'a missing group stays missing, for the check of the route')
	t.end()
})

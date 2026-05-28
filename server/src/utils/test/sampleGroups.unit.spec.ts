import tape from 'tape'
import { resolveDaContext, buildGroupValues, canonicalizeSamplelst } from '#src/utils/sampleGroups.ts'
import { init as initTestDs } from '#src/test/load.testds.js'
import { server_init_db_queries } from '#src/termdb.server.init.ts'

/*
test sections:

canonicalizeSamplelst returns input unchanged when s is falsy
canonicalizeSamplelst returns input unchanged when s.groups is not an array
canonicalizeSamplelst sorts values by sampleId and is order-stable
canonicalizeSamplelst comparator treats equal sampleIds as equal (A === B branch)
canonicalizeSamplelst leaves a group.values that is not an array unchanged
buildGroupValues happy path: includes samples whose id is integer and name is in allSampleSet
buildGroupValues skips non-integer sampleId
buildGroupValues skips when id2sampleName returns falsy
buildGroupValues skips when name is not in allSampleSet
buildGroupValues skips when tw is configured but term_results has no row for that sample
buildGroupValues skips when tw2 is configured but term_results2 has no row for that sample
buildGroupValues reads .value for continuous mode and .key otherwise
buildGroupValues populates conf2 from tw2 with the same continuous/discrete split
resolveDaContext throws when the request genome is not in the genomes map
resolveDaContext returns ds with empty term_results when neither tw nor tw2 is set
resolveDaContext invokes getData via the tw branch and rethrows on term_results.error
resolveDaContext invokes getData via the tw2 branch and rethrows on term_results2.error
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

tape('buildGroupValues happy path: includes samples whose id is integer and name is in allSampleSet', t => {
	const ds = makeDs({ 1: 'sampleA', 2: 'sampleB' })
	const q = { allSampleSet: new Set(['sampleA', 'sampleB']) }
	const out = buildGroupValues([{ sampleId: 1 }, { sampleId: 2 }], q, ds, null, null, [], [])
	t.deepEqual(out.names, ['sampleA', 'sampleB'], 'both samples included')
	t.deepEqual(out.conf1, [], 'no tw → empty conf1')
	t.deepEqual(out.conf2, [], 'no tw2 → empty conf2')
	t.end()
})

tape('buildGroupValues skips non-integer sampleId', t => {
	const ds = makeDs({ 1: 'sampleA' })
	const q = { allSampleSet: new Set(['sampleA']) }
	const out = buildGroupValues(
		[{ sampleId: 1 }, { sampleId: 1.5 as any }, { sampleId: 'x' as any }],
		q,
		ds,
		null,
		null,
		[],
		[]
	)
	t.deepEqual(out.names, ['sampleA'], 'only the integer sampleId entry was kept')
	t.end()
})

tape('buildGroupValues skips when id2sampleName returns falsy', t => {
	const ds = makeDs({ 1: 'sampleA' }) // sampleId 2 maps to undefined
	const q = { allSampleSet: new Set(['sampleA']) }
	const out = buildGroupValues([{ sampleId: 1 }, { sampleId: 2 }], q, ds, null, null, [], [])
	t.deepEqual(out.names, ['sampleA'], 'sample with no name resolution was skipped')
	t.end()
})

tape('buildGroupValues skips when name is not in allSampleSet', t => {
	const ds = makeDs({ 1: 'sampleA', 2: 'sampleB' })
	const q = { allSampleSet: new Set(['sampleA']) } // sampleB missing
	const out = buildGroupValues([{ sampleId: 1 }, { sampleId: 2 }], q, ds, null, null, [], [])
	t.deepEqual(out.names, ['sampleA'], 'sample not in allSampleSet was skipped')
	t.end()
})

tape('buildGroupValues skips when tw is configured but term_results has no row for that sample', t => {
	const ds = makeDs({ 1: 'sampleA', 2: 'sampleB' })
	const q = { allSampleSet: new Set(['sampleA', 'sampleB']) }
	const tw = { $id: 'tw1', q: { mode: 'discrete' } }
	const term_results = { samples: { 1: { tw1: { key: 'M', value: 'M' } } } } // sample 2 missing
	const out = buildGroupValues([{ sampleId: 1 }, { sampleId: 2 }], q, ds, tw, null, term_results, [])
	t.deepEqual(out.names, ['sampleA'], 'sample missing tw data was skipped')
	t.deepEqual(out.conf1, ['M'], 'conf1 picked up the discrete key for the kept sample')
	t.end()
})

tape('buildGroupValues skips when tw2 is configured but term_results2 has no row for that sample', t => {
	const ds = makeDs({ 1: 'sampleA', 2: 'sampleB' })
	const q = { allSampleSet: new Set(['sampleA', 'sampleB']) }
	const tw2 = { $id: 'tw2', q: { mode: 'discrete' } }
	const term_results2 = { samples: { 1: { tw2: { key: 'X', value: 'X' } } } } // sample 2 missing
	const out = buildGroupValues([{ sampleId: 1 }, { sampleId: 2 }], q, ds, null, tw2, [], term_results2)
	t.deepEqual(out.names, ['sampleA'], 'sample missing tw2 data was skipped')
	t.deepEqual(out.conf2, ['X'], 'conf2 picked up the discrete key for the kept sample')
	t.end()
})

tape('buildGroupValues reads .value for continuous mode and .key otherwise', t => {
	const ds = makeDs({ 1: 'sampleA', 2: 'sampleB' })
	const q = { allSampleSet: new Set(['sampleA', 'sampleB']) }

	// Continuous: conf1 collects v.value
	const twCont = { $id: 'twC', q: { mode: 'continuous' } }
	const term_results_cont = {
		samples: {
			1: { twC: { key: 'unused', value: 1.5 } },
			2: { twC: { key: 'unused', value: 2.5 } }
		}
	}
	const outCont = buildGroupValues([{ sampleId: 1 }, { sampleId: 2 }], q, ds, twCont, null, term_results_cont, [])
	t.deepEqual(outCont.conf1, [1.5, 2.5], 'continuous mode used v.value')

	// Discrete: conf1 collects v.key
	const twDisc = { $id: 'twD', q: { mode: 'discrete' } }
	const term_results_disc = {
		samples: {
			1: { twD: { key: 'M', value: 'unused' } },
			2: { twD: { key: 'F', value: 'unused' } }
		}
	}
	const outDisc = buildGroupValues([{ sampleId: 1 }, { sampleId: 2 }], q, ds, twDisc, null, term_results_disc, [])
	t.deepEqual(outDisc.conf1, ['M', 'F'], 'non-continuous mode used v.key')
	t.end()
})

tape('buildGroupValues populates conf2 from tw2 with the same continuous/discrete split', t => {
	const ds = makeDs({ 1: 'sampleA' })
	const q = { allSampleSet: new Set(['sampleA']) }
	const tw2Cont = { $id: 'twC2', q: { mode: 'continuous' } }
	const term_results2 = { samples: { 1: { twC2: { key: 'unused', value: 9.9 } } } }
	const out = buildGroupValues([{ sampleId: 1 }], q, ds, null, tw2Cont, [], term_results2)
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

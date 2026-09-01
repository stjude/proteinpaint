/********************************************
Unit tests for the sample-id exposure guard in the /termdb/sampleScatter route
(server/src/routes/termdb.sampleScatter.ts).

Sample coordinates are retrieved from one of two sources, and BOTH must hide the sample
name/id when the request is not authorized to display sample ids
(authApi.canDisplaySampleIds):
  1. getSampleCoordinatesByTerms() — coordinates derived from two numeric terms
  2. getSamples()                  — a prebuilt plot, read from the plot's in-memory samples

Rather than load the full genome/ds (CI has no tp/ data dir or R/htslib binaries), the two
helper functions are called directly with hardcoded, minimal inputs. Under open access
authApi.canDisplaySampleIds keys off ds.cohort.termdb.displaySampleIds, which is exactly the
allowed-vs-not-allowed toggle these tests exercise (see omnisearch.unit.spec.ts for the same
approach).

Run with (must use tsx + the sjpp/dev condition):
  cd proteinpaint/server && npx tsx --conditions=sjpp/dev src/routes/test/sampleScatter.unit.spec.ts
or run the whole unit suite (as CI does):
  cd proteinpaint/server && npm run test:unit
*********************************************/
import tape from 'tape'
import { getSampleCoordinatesByTerms, getSamples } from '../termdb.sampleScatter.ts'
import { getAuthApi, authApi } from '../../auth.js'

// assign the shared open-access authApi once (idempotent — the live-binding is process-global)
async function ensureOpenAuth() {
	if (authApi) return
	// minimal express-app stand-in; getAuthApi only stores it in a WeakMap for open access
	const app: any = { doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }
	await getAuthApi(app, {}, {}, true)
}

// displaySampleIds is the dataset's per-role sample-ID visibility policy — the same value
// /termdb/config computes; under open access canDisplaySampleIds returns it (plus isUserLoggedIn).
function makeDs(displaySampleIds: boolean): any {
	return { cohort: { termdb: { displaySampleIds } } }
}

const req: any = { query: {} }

// a request carrying a clientAuthResult role, for exercising a function-based displaySampleIds policy
function reqWithRole(role: string): any {
	return { query: { __protected__: { clientAuthResult: { role } } } }
}

// a per-request policy: only the admin role may see sample ids. A truthy-but-denying function like this
// is exactly what must NOT leak names — canDisplaySampleIds evaluates it rather than treating it as a
// blanket allow (see AuthApi/AuthApiOpen.canDisplaySampleIds).
function makeDsPolicy(): any {
	return { cohort: { termdb: { displaySampleIds: (car: any) => car?.role == 'admin' } } }
}

/*** coordinate branch: getSampleCoordinatesByTerms() ***/

// data as returned by getData(): samples keyed by id, coord values under each term's $id, plus
// refs.bySampleId providing the human-readable label.
function makeCoordData(): any {
	return {
		samples: {
			'1': { x_id: { value: 10 }, y_id: { value: 20 } },
			'2': { x_id: { value: 30 }, y_id: { value: 40 } }
		},
		refs: { bySampleId: { '1': { label: 'SampleA' }, '2': { label: 'SampleB' } } }
	}
}

const coordQ: any = {
	coordTWs: [
		{ $id: 'x_id', term: {} },
		{ $id: 'y_id', term: {} }
	]
}

tape('getSampleCoordinatesByTerms: exposes sample name when displaying sample ids is allowed', async t => {
	await ensureOpenAuth()
	const [samples] = await getSampleCoordinatesByTerms(req, coordQ, makeDs(true), makeCoordData())
	t.equal(samples.length, 2, 'should return both samples')
	t.equal((samples[0] as any).sample, 'SampleA', 'first sample should carry its label')
	t.equal((samples[1] as any).sample, 'SampleB', 'second sample should carry its label')
	t.end()
})

tape('getSampleCoordinatesByTerms: hides sample name when displaying sample ids is not allowed', async t => {
	await ensureOpenAuth()
	const [samples] = await getSampleCoordinatesByTerms(req, coordQ, makeDs(false), makeCoordData())
	t.equal(samples.length, 2, 'should still return both samples (coordinates are shown)')
	t.notOk('sample' in (samples[0] as any), 'first sample should not carry a sample name/id')
	t.notOk('sample' in (samples[1] as any), 'second sample should not carry a sample name/id')
	t.end()
})

tape('getSampleCoordinatesByTerms: hides sample name for a non-admin under a function policy', async t => {
	await ensureOpenAuth()
	const [denied] = await getSampleCoordinatesByTerms(reqWithRole('public'), coordQ, makeDsPolicy(), makeCoordData())
	t.notOk('sample' in (denied[0] as any), 'a role the policy denies should not receive sample names')
	const [allowed] = await getSampleCoordinatesByTerms(reqWithRole('admin'), coordQ, makeDsPolicy(), makeCoordData())
	t.equal((allowed[0] as any).sample, 'SampleA', 'a role the policy allows should receive sample names')
	t.end()
})

/*** prebuilt-plot branch: getSamples() ***/

// a plot already loaded in memory (filterableSamples set => loadFile is skipped). Each sample
// object carries a .sample name that must be dropped when display is not allowed.
function makePlot(): any {
	return {
		referenceSamples: [{ sample: 'Ref1', x: 1, y: 2 }],
		filterableSamples: [
			{ sample: 'Cohort1', x: 3, y: 4 },
			{ sample: 'Cohort2', x: 5, y: 6 }
		]
	}
}

tape('getSamples: exposes sample names when displaying sample ids is allowed', async t => {
	await ensureOpenAuth()
	const [refSamples, cohortSamples] = await getSamples(req, makeDs(true), makePlot())
	t.equal((refSamples[0] as any).sample, 'Ref1', 'reference sample should carry its name')
	t.deepEqual(
		cohortSamples.map((s: any) => s.sample),
		['Cohort1', 'Cohort2'],
		'cohort samples should carry their names'
	)
	t.end()
})

tape('getSamples: hides sample names when displaying sample ids is not allowed', async t => {
	await ensureOpenAuth()
	const [refSamples, cohortSamples] = await getSamples(req, makeDs(false), makePlot())
	t.notOk('sample' in (refSamples[0] as any), 'reference sample should not carry a name')
	t.equal(cohortSamples.length, 2, 'should still return both cohort samples (coordinates are shown)')
	t.notOk(
		cohortSamples.some((s: any) => 'sample' in s),
		'no cohort sample should carry a name/id'
	)
	t.end()
})

tape('getSamples: hides sample names for a non-admin under a function policy', async t => {
	await ensureOpenAuth()
	const [, deniedCohort] = await getSamples(reqWithRole('public'), makeDsPolicy(), makePlot())
	t.notOk(
		deniedCohort.some((s: any) => 'sample' in s),
		'a role the policy denies should not receive sample names'
	)
	const [, allowedCohort] = await getSamples(reqWithRole('admin'), makeDsPolicy(), makePlot())
	t.deepEqual(
		allowedCohort.map((s: any) => s.sample),
		['Cohort1', 'Cohort2'],
		'a role the policy allows should receive sample names'
	)
	t.end()
})

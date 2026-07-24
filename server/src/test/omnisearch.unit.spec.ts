/********************************************
Unit tests for runOmnisearch() (server/src/chat/search.ts)

Hardcodes the minimal parts of the hg38-test genome and TermdbTest dataset that runOmnisearch() actually
reads, then calls it directly with plain request objects. The real datasets are NOT loaded: CI has no
access to the full tp/ data dir or the R/htslib binaries, and initGenomesDs would fail there. Everything
below is the exact shape runOmnisearch/getGeneDataTypes/searchGeneNames/getGeneCoord/string2pos touch —
values copied from the real hg38-test genedb (TP53 gene model, chr17 length) and TermdbTest termdb (Sex).

Separate tests cover dictionary variables, each gene data type (SNV/indel, CNV, SV/fusion, DNA methylation,
genome browser) reported for a gene, and coordinate search for the genome browser.

Run with (must use tsx + the sjpp/dev condition — plain `node` cannot resolve the codebase's .js-that-are-.ts
imports, e.g. termdb.server.init.ts -> ./auth.js):
  cd proteinpaint/server && npx tsx --conditions=sjpp/dev src/test/omnisearch.unit.spec.ts
or run the whole unit suite (as CI does):
  cd proteinpaint/server && npm run test:unit
*********************************************/
import tape from 'tape'
import { runOmnisearch, userCanAccessDsData, computeUnionAuthFilter } from '../chat/search.ts'
import { getAuthApi, authApi } from '../auth.js'

// minimal request; filterTerms() only reads req.query.__protected__, and our hardcoded ds has no isTermVisible()
const req: any = { query: {} }
const cohortStr = 'ABC'
const gene = 'TP53'
const coordPrompt = 'chr17:7666657-7688274'

// TP53 gene model as stored in the real hg38-test genedb (anno/genes.hg38.test.db). getGeneCoord() parses
// this, applies its stop-- adjustment, and merges isoform loci; only chr/start/stop/isoform are read.
const TP53_GENEMODEL = '{"isoform":"NM_000546","chr":"chr17","start":7668420,"stop":7675244}'
// hg38 chr17 length, from the hg38-test genome's chromosome table
const CHR17_LEN = 83257441

// The "Sex" dictionary term, as it exists in the real TermdbTest termdb (id/name/type + its one ancestor).
const sexTerm = { id: 'sex', name: 'Sex', type: 'categorical', parent_id: 'Demographic Variables' }

// hg38-test genome — only the fields runOmnisearch's gene/coordinate path reads
const genome: any = {
	genomicNameRegexp: /[^a-zA-Z0-9.:_-]/, // default from initGenomesDs.js
	chrlookup: { CHR17: { name: 'chr17', len: CHR17_LEN } }, // used by string2pos/invalidcoord
	genedb: {
		// LIKE 'TP53%' -> [{name:'TP53'}]; anything else -> no match
		getnameslike: {
			all: (like: string) => ('TP53'.startsWith(like.replace('%', '').toUpperCase()) ? [{ name: 'TP53' }] : [])
		},
		getNameByAlias: { all: () => [] },
		getnamebynameorisoform: { get: () => undefined },
		getjsonbyname: { all: (name: string) => (name == 'TP53' ? [{ genemodel: TP53_GENEMODEL }] : []) }
	}
}

// TermdbTest dataset — only the fields getDsAllowedTermTypes/getGeneDataTypes/dictionary search read.
// dnaMethylation query => DNA_METHYLATION term type; snvindel/cnv/svfusion queries => those gene data types.
const ds: any = {
	cohort: {
		termdb: {
			termtypeByCohort: [],
			q: {
				findTermByName: async (str: string) => (/SEX/i.test(str) ? [sexTerm] : []),
				getAncestorIDs: () => ['Demographic Variables'],
				getAncestorNames: () => ['Demographic Variables']
			}
		}
	},
	queries: { snvindel: {}, cnv: {}, svfusion: {}, dnaMethylation: {} }
}

/**************
 test sections
***************/
tape('\n', t => {
	t.comment('-***- chat/omnisearch runOmnisearch (hardcoded hg38-test / TermdbTest) -***-')
	t.end()
})

tape('dictionary variables: "sex" returns matching dictionary terms', async t => {
	const data = await runOmnisearch(
		{ prompt: 'sex', cohortStr, usecase: { target: 'dictionary', detail: 'term' } },
		req,
		ds,
		genome
	)
	t.ok(Array.isArray(data.dictionaryTerms), 'dictionaryTerms should be an array')
	t.ok(
		data.dictionaryTerms.some((term: any) => /sex/i.test(term?.name || '')),
		'dictionaryTerms should include a term whose name matches "sex" (e.g. "Sex")'
	)
	t.end()
})

/* Gene data types — a gene match carries a `dataTypes` object; each test asserts one data type is
   reported as available for TP53 in TermdbTest. */

tape('gene data type — SNV/indel: TP53 reports snvindel', async t => {
	const data = await runOmnisearch({ prompt: gene }, req, ds, genome)
	const tp53 = data.genes.find(g => g.gene == gene)
	t.ok(tp53, 'genes should include TP53')
	t.equal(tp53?.dataTypes?.snvindel, true, 'TP53 dataTypes.snvindel should be true')
	t.end()
})

tape('gene data type — CNV: TP53 reports cnv', async t => {
	const data = await runOmnisearch({ prompt: gene }, req, ds, genome)
	const tp53 = data.genes.find(g => g.gene == gene)
	t.ok(tp53, 'genes should include TP53')
	t.equal(tp53?.dataTypes?.cnv, true, 'TP53 dataTypes.cnv should be true')
	t.end()
})

tape('gene data type — SV/fusion: TP53 reports svfusion', async t => {
	const data = await runOmnisearch({ prompt: gene }, req, ds, genome)
	const tp53 = data.genes.find(g => g.gene == gene)
	t.ok(tp53, 'genes should include TP53')
	t.equal(tp53?.dataTypes?.svfusion, true, 'TP53 dataTypes.svfusion should be true')
	t.end()
})

tape('gene data type — DNA methylation: TP53 reports dnaMethylation', async t => {
	const data = await runOmnisearch({ prompt: gene }, req, ds, genome)
	const tp53 = data.genes.find(g => g.gene == gene)
	t.ok(tp53, 'genes should include TP53')
	t.equal(tp53?.dataTypes?.dnaMethylation, true, 'TP53 dataTypes.dnaMethylation should be true')
	// methylation genes carry a server-resolved coordinate used to seed the region picker
	t.ok(tp53?.coord?.chr, 'TP53 should carry a resolved coordinate for the methylation region picker')
	t.end()
})

tape('gene data type — genome browser: TP53 reports genomeBrowser', async t => {
	const data = await runOmnisearch({ prompt: gene }, req, ds, genome)
	const tp53 = data.genes.find(g => g.gene == gene)
	t.ok(tp53, 'genes should include TP53')
	t.equal(tp53?.dataTypes?.genomeBrowser, true, 'TP53 dataTypes.genomeBrowser should be true')
	t.end()
})

/* Sample search — runOmnisearch matches the prompt against sample names and returns the matches ONLY when
   the dataset allows displaying sample ids (authApi.canDisplaySampleIds). At server startup app.ts assigns
   the shared authApi live-binding; unit tests run without that, so ensureOpenAuth() assigns the default
   open-access AuthApi once. Under open access canDisplaySampleIds keys off ds.cohort.termdb.displaySampleIds,
   which is exactly the allowed-vs-not-allowed toggle these two tests exercise. */

// assign the shared open-access authApi once (idempotent — the live-binding is process-global)
async function ensureOpenAuth() {
	if (authApi) return
	// minimal express-app stand-in; getAuthApi only stores it in a WeakMap for open access
	const app: any = { doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }
	await getAuthApi(app, {}, {}, true)
}

// a TermdbTest-like ds carrying two sample names. displaySampleIds is the dataset's per-role sample-ID
// visibility policy (boolean, or a function of the request's clientAuthResult) — the same value the
// /termdb/config route computes; dsAllowsSampleSearch gates on it. Reuses no-op dictionary/gene stubs so
// runOmnisearch's dictionary + gene search find nothing and only samples matter.
function makeSampleDs(displaySampleIds: boolean | ((clientAuthResult: any) => boolean)): any {
	return {
		cohort: {
			termdb: {
				termtypeByCohort: [],
				displaySampleIds,
				q: { findTermByName: async () => [], getAncestorIDs: () => [], getAncestorNames: () => [] }
			}
		},
		queries: {},
		// get_AllSamplesByName's no-filter branch reads this Map (name -> id)
		sampleName2Id: new Map([
			['2646', 41],
			['3416', 96]
		])
	}
}

function addSingleCellSamples(ds: any, samples: any[]) {
	ds.queries.singleCell = { samples: { get: async () => ({ samples }) } }
	return ds
}

tape('sample search: returns the matching sample when the dataset allows displaying sample ids', async t => {
	await ensureOpenAuth()
	const ds = addSingleCellSamples(makeSampleDs(true), [{ sample: '2646', experiments: [{ experimentID: 'exp-1' }] }])
	const data = await runOmnisearch({ prompt: '2646' }, req, ds, genome)
	t.ok(Array.isArray(data.samples), 'samples should be an array')
	t.deepEqual(
		data.samples,
		[{ id: 41, name: '2646', singleCell: { sID: '2646', eID: 'exp-1' } }],
		'should include single-cell data when available'
	)
	t.end()
})

tape('sample search: omits single-cell action for samples without single-cell data', async t => {
	await ensureOpenAuth()
	const ds = addSingleCellSamples(makeSampleDs(true), [{ sample: '3416' }])
	const data = await runOmnisearch({ prompt: '2646' }, req, ds, genome)
	t.deepEqual(data.samples, [{ id: 41, name: '2646' }], 'should not include single-cell data for another sample')
	t.end()
})

tape('sample search: returns no samples when the dataset does not allow displaying sample ids', async t => {
	await ensureOpenAuth()
	const data = await runOmnisearch({ prompt: '2646' }, req, makeSampleDs(false), genome)
	t.deepEqual(data.samples, [], 'should return no samples even though "2646" matches a sample name')
	t.end()
})

tape('sample search: returns samples when displaySampleIds is a function that permits this request', async t => {
	// the role policy is evaluated (function form); returning true enables sample search
	await ensureOpenAuth()
	const data = await runOmnisearch(
		{ prompt: '2646' },
		req,
		makeSampleDs(() => true),
		genome
	)
	t.deepEqual(data.samples, [{ id: 41, name: '2646' }], 'displaySampleIds()==true should enable sample search')
	t.end()
})

tape('sample search: returns no samples when displaySampleIds forbids this role (e.g. profile non-admin)', async t => {
	// a role-gated policy that this request does not satisfy (no admin role in the auth payload) -> denied,
	// even though the sample name matches. This is the profile user/public case.
	await ensureOpenAuth()
	const data = await runOmnisearch(
		{ prompt: '2646' },
		req,
		makeSampleDs(car => car?.role === 'admin'),
		genome
	)
	t.deepEqual(data.samples, [], 'displaySampleIds()==false for the role should disable sample search')
	t.end()
})

/* Sign-in gate — userCanAccessDsData() decides whether sample search may run based on whether the dataset
   requires a sign-in the user has not satisfied. "Data download" is shown even for sign-in-protected
   datasets, so a supported chart alone is not enough. A mock auth object stands in for the shared authApi
   (injected via the function's second argument) to exercise each branch. */

// mock authApi: reqCred = getRequiredCredForDsEmbedder; dsAuth = getDsAuth; clientAuthResult = the
// authorization payload getNonsensitiveInfo reports (empty {} = a bare demo/preview session).
function makeAuth({ reqCred, dsAuth, clientAuthResult }: { reqCred?: any[]; dsAuth?: any[]; clientAuthResult?: any }) {
	return {
		getRequiredCredForDsEmbedder: () => reqCred,
		getDsAuth: () => dsAuth || [],
		getNonsensitiveInfo: () => ({ clientAuthResult: clientAuthResult || {} })
	}
}
const reqFor = (dslabel: string): any => ({ query: { dslabel, embedder: 'localhost' } })

tape('sign-in gate: open dataset (no required credential) allows sample data access', t => {
	// AuthApiOpen / an unprotected ds -> getRequiredCredForDsEmbedder returns undefined
	t.equal(userCanAccessDsData(reqFor('OpenDs'), makeAuth({ reqCred: undefined })), true, 'no credential -> allowed')
	t.end()
})

tape('sign-in gate: sign-in required and user has a valid session with real authorization allows access', t => {
	const auth = makeAuth({
		reqCred: [{ route: 'termdb', type: 'jwt' }],
		dsAuth: [{ dslabel: 'ProtDs', route: 'termdb', type: 'jwt', insession: true }],
		clientAuthResult: { role: 'admin' } // real authorization payload
	})
	t.equal(userCanAccessDsData(reqFor('ProtDs'), auth), true, 'valid session + real auth -> allowed')
	t.end()
})

tape('sign-in gate: in-session but no real auth and not from a demo referer denies access', t => {
	// e.g. a SJLife demo session dragged into bare massnative: in-session, empty clientAuthResult, and the
	// request's referer is not one the ds demoToken authorizes (no demoTokenRoles on the auth entry)
	const auth = makeAuth({
		reqCred: [{ route: 'termdb', type: 'jwt' }],
		dsAuth: [{ dslabel: 'ProtDs', route: 'termdb', type: 'jwt', insession: true }],
		clientAuthResult: {} // empty -> no real access
	})
	t.equal(userCanAccessDsData(reqFor('ProtDs'), auth), false, 'in-session, no real auth, no demo referer -> denied')
	t.end()
})

tape('sign-in gate: in-session from an authorized demo referer allows access', t => {
	// e.g. SJLife role=user via /demo-login.html: valid demo session, empty clientAuthResult, but the request
	// comes from a referer the demoToken authorizes (getDsAuth sets demoTokenRoles on the entry)
	const auth = makeAuth({
		reqCred: [{ route: 'termdb', type: 'jwt' }],
		dsAuth: [{ dslabel: 'ProtDs', route: 'termdb', type: 'jwt', insession: true, demoTokenRoles: ['user'] }],
		clientAuthResult: {}
	})
	t.equal(userCanAccessDsData(reqFor('ProtDs'), auth), true, 'in-session from authorized demo referer -> allowed')
	t.end()
})

tape('sign-in gate: sign-in required and user is NOT in-session denies access', t => {
	const auth = makeAuth({
		reqCred: [{ route: 'termdb', type: 'jwt' }],
		dsAuth: [{ dslabel: 'ProtDs', route: 'termdb', type: 'jwt', insession: false }]
	})
	t.equal(
		userCanAccessDsData(reqFor('ProtDs'), auth),
		false,
		'no valid session -> denied (Data download requires sign-in)'
	)
	t.end()
})

tape('sign-in gate: sign-in required but no matching auth entry denies access (fail closed)', t => {
	const auth = makeAuth({ reqCred: [{ route: 'termdb', type: 'jwt' }], dsAuth: [] })
	t.equal(userCanAccessDsData(reqFor('ProtDs'), auth), false, 'missing session entry -> denied')
	t.end()
})

/* Per-role sample restriction — for a dataset that restricts sample access by role (defines
   getAdditionalFilter, e.g. profile), computeUnionAuthFilter unions the per-cohort authorized-Sites filters
   so a non-admin user's sample search is limited to their authorized samples. Mirrors profile's
   getAdditionalFilter: admin -> no filter; user -> Sites filter; public -> empty (matches nothing). */

// mock of profile.getAdditionalFilter: builds an AUNIT/FUNIT Site filter from clientAuthResult[cohort].sites
function profileGetAdditionalFilter({ clientAuthResult, activeCohort }: any) {
	const car = clientAuthResult[activeCohort]
	const role = car?.role
	if (role == 'admin') return undefined // admin: unrestricted
	const values = role == 'user' ? car.sites.map((key: string) => ({ key })) : [] // else (public): empty
	return {
		type: 'tvslst',
		in: true,
		join: 'or',
		lst: [
			{ type: 'tvs', tvs: { term: { id: 'AUNIT' }, values } },
			{ type: 'tvs', tvs: { term: { id: 'FUNIT' }, values } }
		]
	}
}

tape('sample restriction: user gets a union filter of their per-cohort authorized Sites', t => {
	const clientAuthResult = {
		full: { role: 'user', sites: ['PRO_00009'] },
		abbrev: { role: 'user', sites: ['AF007', 'AF008', 'AF009'] }
	}
	const filter = computeUnionAuthFilter(profileGetAdditionalFilter, clientAuthResult)
	t.ok(filter, 'a restriction filter is produced for a user with authorized sites')
	t.equal(filter.join, 'or', 'the two cohort filters are OR-ed')
	t.equal(filter.lst.length, 2, 'one sub-filter per cohort (full + abbrev)')
	t.end()
})

tape('sample restriction: public (no authorized sites) yields no filter -> denied', t => {
	const clientAuthResult = { full: { role: 'public' }, abbrev: { role: 'public' } }
	const filter = computeUnionAuthFilter(profileGetAdditionalFilter, clientAuthResult)
	t.equal(filter, undefined, 'empty-value cohort filters are dropped -> undefined (authorized for nothing)')
	t.end()
})

tape('coordinate search for genome browser: a typed coordinate resolves only when candidates are sent', async t => {
	// with coordCandidates (the client regex passed) the server resolves the coordinate via string2pos
	const withCandidates = await runOmnisearch(
		{ prompt: coordPrompt, coordCandidates: [coordPrompt, '17:7666657-7688274'] },
		req,
		ds,
		genome
	)
	t.ok(withCandidates.coord, 'coord should be resolved when coordCandidates are sent')
	t.equal(withCandidates.coord?.chr, 'chr17', 'resolved chr should be chr17')
	t.equal(withCandidates.coord?.start, 7666657, 'resolved start should match')
	t.equal(withCandidates.coord?.stop, 7688274, 'resolved stop should match')

	// without coordCandidates the server does not resolve a coordinate (gated on the client regex)
	const noCandidates = await runOmnisearch({ prompt: coordPrompt }, req, ds, genome)
	t.notOk(noCandidates.coord, 'coord should NOT be resolved when no coordCandidates are sent')
	t.end()
})

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
import { runOmnisearch } from '../chat/search.ts'
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

// a TermdbTest-like ds carrying two sample names, with sample-id display allowed or not. Reuses no-op
// dictionary/gene stubs so runOmnisearch's dictionary + gene search find nothing and only samples matter.
// sampleChartTypes lets the test control the "Data download / Sample View" gate: sample search only runs
// when getSupportedChartTypes() reports one of those chart types (mirrors dsAllowsSampleSearch in search.ts).
function makeSampleDs(displaySampleIds: boolean, sampleChartTypes: string[] = ['sampleView']): any {
	return {
		cohort: {
			termdb: {
				termtypeByCohort: [],
				displaySampleIds,
				q: {
					findTermByName: async () => [],
					getAncestorIDs: () => [],
					getAncestorNames: () => [],
					getSupportedChartTypes: () => ({ '': sampleChartTypes })
				}
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

tape('sample search: returns the matching sample when the dataset allows displaying sample ids', async t => {
	await ensureOpenAuth()
	const data = await runOmnisearch({ prompt: '2646' }, req, makeSampleDs(true), genome)
	t.ok(Array.isArray(data.samples), 'samples should be an array')
	t.deepEqual(data.samples, [{ id: 41, name: '2646' }], 'should return the matching sample with its id')
	t.end()
})

tape('sample search: returns no samples when the dataset does not allow displaying sample ids', async t => {
	await ensureOpenAuth()
	const data = await runOmnisearch({ prompt: '2646' }, req, makeSampleDs(false), genome)
	t.deepEqual(data.samples, [], 'should return no samples even though "2646" matches a sample name')
	t.end()
})

tape('sample search: returns samples when the ds supports the "Data download" chart', async t => {
	await ensureOpenAuth()
	const data = await runOmnisearch({ prompt: '2646' }, req, makeSampleDs(true, ['dataDownload']), genome)
	t.deepEqual(data.samples, [{ id: 41, name: '2646' }], 'dataDownload support should enable sample search')
	t.end()
})

tape('sample search: returns no samples when the ds supports neither "Data download" nor "Sample View"', async t => {
	// e.g. profile public: displaySampleIds may pass, but without a sample-level chart sample search is off
	await ensureOpenAuth()
	const data = await runOmnisearch({ prompt: '2646' }, req, makeSampleDs(true, ['summary', 'matrix']), genome)
	t.deepEqual(data.samples, [], 'no dataDownload/sampleView chart should disable sample search')
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

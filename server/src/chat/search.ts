import type { GeneMatch, GeneDataTypeAvailability, OmnisearchResult, SampleMatch } from '#types'
import { filterTerms } from '#src/termdb.server.init.ts'
import { copy_term, get_AllSamplesByName } from '#src/termdb.js'
import { authApi } from '#src/auth.js'
import { getDsAllowedTermTypes } from '../routes/termdb.config.ts'
import { GENE_EXPRESSION, DNA_METHYLATION } from '#shared/terms.js'
import { string2pos } from '#shared/common.js'
/** Determine which gene data types a dataset supports. Deliberately independent of the AI chat
 * pipeline (run_chat_pipeline): a synchronous, read-only capability probe for the mass omnisearch.
 * Gene expression and DNA methylation are read from getDsAllowedTermTypes() (the shared source of
 * truth); the gene variant sub-types (snvindel/cnv/svfusion) are read directly from ds.queries,
 * since getDsAllowedTermTypes() does not report them. */
export function getGeneDataTypes(ds: any): GeneDataTypeAvailability {
	const allowedTermTypes = getDsAllowedTermTypes(ds) as string[]
	const snvindel = Boolean(ds.queries?.snvindel)
	const cnv = Boolean(ds.queries?.cnv)
	const svfusion = Boolean(ds.queries?.svfusion)
	return {
		geneExpression: allowedTermTypes.includes(GENE_EXPRESSION),
		dnaMethylation: allowedTermTypes.includes(DNA_METHYLATION),
		snvindel,
		cnv,
		svfusion,
		// genome browser is offered whenever any genomic-alteration data type is available
		genomeBrowser: snvindel || cnv || svfusion
	}
}

/** Handle a single mass omnisearch request: search dictionary variables and genes together, without
 * invoking the AI chat pipeline. Dictionary search reuses the dataset's term-search query (the same
 * path as the termdb findterm route); gene search uses searchGeneNames() below. */
export async function runOmnisearch(q: any, req: any, ds: any, genome: any): Promise<OmnisearchResult> {
	const prompt = typeof q.prompt == 'string' ? q.prompt.trim() : ''
	// The client gates dictionary + sample search to a longer minimum prompt length than gene search
	// (client/mass/search.ts) and sends this flag; skip those searches when it is explicitly false so a
	// short (gene-only) prompt never runs the dictionary lookup or the all-samples scan. Defaults to true
	// for direct callers (unit tests) that don't set it.
	const includeDictAndSampleSearch = q.includeDictAndSampleSearch !== false

	// Dictionary variables — mirror trigger_findterm()'s DICTIONARY_VARIABLES path in server/src/termdb.js
	let terms: any[] = []
	let dictionaryTotal = 0
	if (includeDictAndSampleSearch) {
		const str = prompt.toUpperCase()
		const found = (await ds.cohort.termdb.q.findTermByName(str, q.cohortStr || '', q.usecase, q.treeFilter)) || []
		const allTerms = filterTerms(req, ds, found.map(copy_term))
		dictionaryTotal = allTerms.length
		terms = allTerms.slice(0, MAX_DICT_MATCHES) // cap displayed terms; dictionaryTotal reports the full count
		for (const term of terms) {
			term.__ancestors = ds.cohort.termdb.q.getAncestorIDs(term.id)
			term.__ancestorNames = ds.cohort.termdb.q.getAncestorNames(term.id)
		}
	}

	// Genes — only search when the dataset has at least one gene data type to act on. The dataset-level
	// availability is the basis for the per-gene data types resolved below.
	const datasetDataTypes = getGeneDataTypes(ds)
	const hasGeneData =
		datasetDataTypes.geneExpression ||
		datasetDataTypes.dnaMethylation ||
		datasetDataTypes.snvindel ||
		datasetDataTypes.cnv ||
		datasetDataTypes.svfusion
	const allGeneNames = prompt && hasGeneData ? searchGeneNames(genome, prompt) : []
	const genesTotal = allGeneNames.length
	const geneNames = allGeneNames.slice(0, MAX_GENE_MATCHES) // cap displayed genes; genesTotal reports the full count
	// Resolve data types per gene (one gene may have e.g. SNV/indel data while another does not), and
	// resolve a default genomic coordinate for genes that can seed a genome browser (DNA methylation
	// region picker or the genome browser genomic view) so the client can seed the browser without a
	// separate genelookup request.
	const genes: GeneMatch[] = geneNames.map(gene => {
		const dataTypes = getGeneDataTypesForEachGene(ds, gene, datasetDataTypes)
		// resolve a default genomic coordinate for genes that can seed a genome browser: the DNA
		// methylation region picker and the genome browser's genomic view both need chr/start/stop
		const coord =
			(dataTypes.dnaMethylation || dataTypes.genomeBrowser) && ds.queries?.gbRestrictMode !== 'protein' // Restrict genome browser to protein view only (no genomic view) when gbRestrictMode is set to 'protein'
				? getGeneCoord(genome, gene)
				: null
		return { gene, dataTypes, coord }
	})

	// Genomic coordinate typed as the prompt (e.g. "chr7:100000-200000") — resolved here (not on the
	// client) so string2pos and the genome object stay server-side. Only resolved when the client sent
	// candidate spellings (q.coordCandidates), i.e. its coordinate regex passed, AND the dataset has a
	// genome browser genomic view (snvindel/cnv/svfusion and gbRestrictMode !== 'protein').
	const coord =
		datasetDataTypes.genomeBrowser && ds.queries?.gbRestrictMode !== 'protein'
			? resolveCoordFromCandidates(q.coordCandidates, genome)
			: null

	// Samples — returns [] when the dataset does not allow displaying sample ids, or when the client gated
	// out sample search for a short (gene-only) prompt. sampleTotal is the full match count (before the cap).
	const { matches: samples, total: sampleTotal } =
		includeDictAndSampleSearch && prompt ? await searchSamples(req, ds, prompt) : { matches: [], total: 0 }

	// Per-type total match counts (before each type's display cap) so the client can show a
	// "Displaying N out of M" note when a type's results were truncated.
	const totals = { dictionaryTerms: dictionaryTotal, genes: genesTotal, samples: sampleTotal }

	// Will later add support for other NonDict terms such as genesets etc.
	return { dictionaryTerms: terms, genes: genes, coord, samples, totals }
}

/** Sample search is only offered when the dataset lets the user act on sample-level data — i.e. it
 * supports the "Data download" or "Sample View" chart for this request. getSupportedChartTypes(req) already
 * evaluates those with role/embedder context (e.g. profile admin gets them, profile public does not), so
 * this gates sample search the same way charts are gated. Returns false when the ds exposes no such API. */
function dsAllowsSampleSearch(ds: any, req: any): boolean {
	const supported = ds?.cohort?.termdb?.q?.getSupportedChartTypes?.(req)
	if (!supported) return false
	for (const chartTypes of Object.values(supported) as string[][]) {
		if (chartTypes.includes('dataDownload') || chartTypes.includes('sampleView')) return true
	}
	return false
}

/** Match the prompt against sample names. get_AllSamplesByName() is the single source of truth for both
 * the name->id map and the "can this dataset display sample ids" check: it sends {} when
 * authApi.canDisplaySampleIds() is false, so a disallowed dataset yields no samples here. It is a
 * response-sending route handler, hence the capturing res stub. Returns [] on error / no match. */
async function searchSamples(req: any, ds: any, prompt: string): Promise<{ matches: SampleMatch[]; total: number }> {
	// authApi is only assigned once app.ts calls getAuthApi(); when it is not set (e.g. a unit test calling
	// runOmnisearch directly, no server app), skip sample search rather than let get_AllSamplesByName crash
	// on authApi.canDisplaySampleIds. Fail closed: no auth layer -> no sample ids.
	if (!authApi) return { matches: [], total: 0 }

	// only offer sample search when the ds supports a sample-level chart (Data download / Sample View)
	if (!dsAllowsSampleSearch(ds, req)) return { matches: [], total: 0 }

	// Sample search is a name lookup over every sample the dataset permits displaying — access is already
	// gated above (canDisplaySampleIds + the Data download / Sample View chart check). Deliberately do NOT
	// forward q.filter: the auth middleware injects a term-level auth filter (e.g. profile's Site filter)
	// that, in this request context, resolves the active cohort's role as non-admin and excludes every
	// sample even for admins. Searching the unfiltered name map matches the getAllSamples route behavior.
	let sampleName2Id: any = {}
	await get_AllSamplesByName({}, req, { send: (data: any) => (sampleName2Id = data) }, ds)
	if (!sampleName2Id || sampleName2Id.error) return { matches: [], total: 0 }

	const str = prompt.toLowerCase()
	const matches: SampleMatch[] = []
	let total = 0
	// ponytail: O(all samples) substring scan per keystroke; count every match for `total` (no early break)
	// but only collect up to the cap. Index the names if counting all matches gets slow on a large ds.
	for (const [name, v] of Object.entries(sampleName2Id as { [k: string]: any })) {
		if (!name?.toLowerCase().includes(str)) continue
		total++
		if (matches.length < MAX_SAMPLE_MATCHES) matches.push({ id: v.id, name })
	}
	return { matches, total }
}
const MAX_SAMPLE_MATCHES = 10
const MAX_GENE_MATCHES = 50
const MAX_DICT_MATCHES = 10

/** Resolve a typed genomic coordinate to { chr, start, stop } from the client-provided candidate spellings
 * (e.g. ["7:100000-200000", "chr7:100000-200000"]). The client (mass/search.ts) runs the shape regex and
 * the "chr" prefix toggling and only sends candidates when its regex passed; here we just run string2pos
 * against the genome, which validates the chromosome name and position range (returns null on invalid
 * input). Returns the first candidate that resolves, or null (including when no candidates were sent). */
function resolveCoordFromCandidates(candidates: any, genome: any): { chr: string; start: number; stop: number } | null {
	if (!genome || !Array.isArray(candidates)) return null
	for (const c of candidates) {
		if (typeof c != 'string') continue
		try {
			const coord = string2pos(c, genome, true)
			if (coord) return { chr: coord.chr, start: coord.start, stop: coord.stop }
		} catch {
			// try the next candidate spelling
		}
	}
	return null
}

/** Determine the gene data types available for a SPECIFIC gene in a dataset. This is the harness for
 * per-gene data-type filtering: e.g. one gene may have SNV/indel data while another does not.
 *
 * NOTE: the per-gene determination strategy is not yet implemented — every gene currently reports the
 * dataset-level availability (datasetDataTypes) as a placeholder. Add the per-gene filtering criteria
 * inside this function (e.g. consult assay availability such as gene panels or query results for `gene` and set each data
 * type to false when that gene lacks it). A fresh object is returned per gene so callers can safely
 * mutate/narrow it. */
function getGeneDataTypesForEachGene(
	_ds: any,
	_gene: string,
	datasetDataTypes: GeneDataTypeAvailability
): GeneDataTypeAvailability {
	// TODO: replace this dataset-level fallback with per-gene filtering using `ds` and `gene`. This could happen in case of gene panels, or if the dataset has only a subset of genes with SNV/indel data, etc.
	const dt = { ...datasetDataTypes }
	// keep genomeBrowser consistent with the (possibly narrowed) genomic-alteration flags for this gene
	dt.genomeBrowser = dt.snvindel || dt.cnv || dt.svfusion
	return dt
}

/** Match a search string to gene symbols via the genome's gene db. Copied from the shallow branch of
 * getResult() in server/src/gene.js so the omnisearch can resolve genes within this route instead of
 * the client making a separate genelookup request. Tries direct name, then alias, then isoform.
 * Returns gene-name strings, or [] for no match / invalid input (never throws). */
function searchGeneNames(genome: any, input: string): string[] {
	try {
		if (genome.genomicNameRegexp.test(input)) return [] // invalid character in gene name → no gene match
		const upper = input.toUpperCase()
		const byName = genome.genedb.getnameslike.all(upper + '%')
		if (byName.length) {
			byName.sort()
			return byName.map((i: any) => i.name)
		}
		// no direct name match, try alias
		if (genome.genedb.getNameByAlias) {
			const byAlias = genome.genedb.getNameByAlias.all(upper)
			if (byAlias.length) return byAlias.map((i: any) => i.name)
		}
		// no hit by alias; see if input is an isoform that maps to a symbol
		const byIsoform = genome.genedb.getnamebynameorisoform.get(input, input)
		if (byIsoform) return [byIsoform.name]
		return []
	} catch {
		return []
	}
}

/** Resolve a gene symbol to its default genomic coordinate { chr, start, stop } from the genome's gene
 * db. Copied from the deep branch of getResult() in server/src/gene.js (including its stop-- gene-model
 * adjustment), then merges the gene's isoform models into loci with gmlst2loci() and returns the first
 * locus — mirroring the client's previous behavior (gene2loci → loci[0]) so a gene whose isoforms span
 * discontinuous loci opens the genome browser at the same region as before. Lets the omnisearch seed a
 * genome browser track without a separate genelookup request. `gene` is already a resolved symbol (from
 * searchGeneNames). Returns null if it cannot be resolved. */
export function getGeneCoord(genome: any, gene: string): { chr: string; start: number; stop: number } | null {
	try {
		const rows = genome.genedb.getjsonbyname.all(gene)
		if (!rows?.length) return null
		// build the gmlst as getResult()'s deep branch does (parse each gene model, adjust stop)
		const gmlst = rows.map((r: any) => {
			const m = JSON.parse(r.genemodel)
			m.stop-- // match getResult()'s stop-- (gene models are stored with a not-included stop)
			return m
		})
		const locus = gmlst2loci(gmlst)[0]
		if (!locus?.chr || !Number.isInteger(locus.start) || !Number.isInteger(locus.stop)) return null
		return { chr: locus.chr, start: locus.start, stop: locus.stop }
	} catch {
		return null
	}
}

/** Merge a gene's isoform models into non-overlapping loci. Copied verbatim from gmlst2loci() in
 * client/src/client.js (which is client-only and cannot be imported server-side) so the omnisearch's
 * coordinate resolution matches the client's previous behavior: isoforms overlapping on the same chr
 * are merged, and isoforms on discontinuous loci yield more than one entry (first locus is used). */
function gmlst2loci(gmlst: any[]): { name: string; chr: string; start: number; stop: number }[] {
	const locs: { name: string; chr: string; start: number; stop: number }[] = []
	for (const f of gmlst) {
		let nooverlap = true
		for (const r of locs) {
			if (f.chr == r.chr && Math.max(f.start, r.start) < Math.min(f.stop, r.stop)) {
				r.start = Math.min(r.start, f.start)
				r.stop = Math.max(r.stop, f.stop)
				nooverlap = false
			}
		}
		if (nooverlap) {
			locs.push({ name: f.isoform, chr: f.chr, start: f.start, stop: f.stop })
		}
	}
	return locs
}

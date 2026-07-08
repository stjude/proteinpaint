import type { GeneMatch, GeneDataTypeAvailability, OmnisearchResult } from '#types'
import { filterTerms } from '#src/termdb.server.init.ts'
import { copy_term } from '#src/termdb.js'
import { getDsAllowedTermTypes } from '../routes/termdb.config.ts'
import { GENE_EXPRESSION, DNA_METHYLATION } from '#shared/terms.js'
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

	// Dictionary variables — mirror trigger_findterm()'s DICTIONARY_VARIABLES path in server/src/termdb.js
	let terms: any[] = []
	const str = prompt.toUpperCase()
	const found = (await ds.cohort.termdb.q.findTermByName(str, q.cohortStr || '', q.usecase, q.treeFilter)) || []
	terms = filterTerms(req, ds, found.map(copy_term))
	for (const term of terms) {
		term.__ancestors = ds.cohort.termdb.q.getAncestorIDs(term.id)
		term.__ancestorNames = ds.cohort.termdb.q.getAncestorNames(term.id)
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
	const MAX_GENE_MATCHES = 50
	const geneNames = prompt && hasGeneData ? searchGeneNames(genome, prompt).slice(0, MAX_GENE_MATCHES) : []
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
	// Will later add support for other NonDict terms such as genesets etc.
	return { dictionaryTerms: terms, genes: genes }
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

import type { DERequest, GenesetEnrichmentRequest, GenesetEnrichmentResponse, RouteApi } from '#types'
import { genesetEnrichmentPayload } from '#types/checkers'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { run_python } from '@sjcrh/proteinpaint-python'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { readCacheFileOrRecompute, stableStringify } from '#src/diffAnalysis.ts'

export const api: RouteApi = {
	endpoint: 'genesetEnrichment',
	methods: {
		get: {
			...genesetEnrichmentPayload,
			init
		},
		post: {
			...genesetEnrichmentPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: GenesetEnrichmentRequest = req.query
			// TODO: should separate the processing based on if q.geneset_name exists,
			// so that each of the separate function can have definite signature types
			// instead of trying to generalize the same function to do different things
			const results = await run_genesetEnrichment_analysis(q, genomes)
			if (!q.geneset_name) {
				// req.query.geneset_name contains the geneset name which is defined only
				// when a request for plotting the details of a particular geneset_name is made.
				// During the initial computation this is not defined as this will be selected
				// by the user from the client side. When this is not defined, it will send the
				// table output. The python code saves the table in cachedir_gsea in a pickle file
				// (gsea_<hash>.pkl) which will later be retrieved by a subsequent
				// server request asking to plot the details of that geneset.
				if (typeof results != 'object') throw new Error('gsea result is not object')
				res.send(results satisfies GenesetEnrichmentResponse)
				return
			}
			// req.query.geneset_name is present, this will cause the geneset image to be generated.
			// The python code will retrieve gsea_<hash>.pkl from cachedir_gsea to
			// generate the image (gsea_plot_{random_num}.png). This prevents having to rerun the
			// entire gsea computation again.
			if (typeof results != 'string') throw new Error('gsea result is not string')
			res.sendFile(results, (err: any) => {
				fs.unlink(results, () => {})
				if (err) {
					res.status(404).send('Image not found')
				}
			})
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function run_genesetEnrichment_analysis(
	q: GenesetEnrichmentRequest,
	genomes: any
): Promise<GenesetEnrichmentResponse | string> {
	if (!genomes[q.genome].termdbs) throw new Error('termdb database is not available for ' + q.genome)

	if (q.fetchDE) {
		// Client requested the ranked DE list only (used by the cerno detail plot).
		const { genes, fold_change } = await resolveGseaGenesAndFoldChange({ q, genomes })
		return { data: { genes, fold_change } } as unknown as GenesetEnrichmentResponse
	}

	if (q.method == 'blitzgsea') {
		// computeGSEA owns the whole blitzgsea path: genes/fold_change
		// resolution, deterministic pickle filename, in-flight dedup, and
		// the run_python invocation.
		return await computeGSEA({ q, genomes })
	}

	if (q.method == 'cerno') {
		const { genes, fold_change } = await resolveGseaGenesAndFoldChange({ q, genomes })
		const genesetenrichment_input: any = {
			genes,
			fold_change,
			db: genomes[q.genome].termdbs.msigdb.cohort.db.connection.name,
			geneset_group: q.geneSetGroup,
			genedb: path.join(serverconfig.tpmasterdir, genomes[q.genome].genedb.dbfile),
			filter_non_coding_genes: q.filter_non_coding_genes
		}
		const time1 = new Date().valueOf()
		const gsea_output = JSON.parse(await run_rust('cerno', JSON.stringify(genesetenrichment_input)))
		mayLog('Time taken to run CERNO:', formatElapsedTime(Date.now() - time1))
		return gsea_output as GenesetEnrichmentResponse
	}

	throw new Error('Unknown method:' + q.method)
}

/** Resolve the `genes` + `fold_change` inputs that every GSEA path needs.
 * Shared between `computeGSEA` (blitzgsea), the cerno branch, and the
 * `fetchDE` short-circuit — a single source of truth for "where do the
 * arrays come from" so the cacheId/daRequest contract is enforced in one
 * place. */
async function resolveGseaGenesAndFoldChange({
	q,
	genomes
}: {
	q: GenesetEnrichmentRequest
	genomes: any
}): Promise<{ genes: string[]; fold_change: number[] }> {
	if (q.cacheId) {
		// A cacheId without daRequest is malformed — without the DE
		// snapshot there's no way to verify the id or recompute on a cache
		// miss. The 'daCacheMissing' literal matches the client's sayerror
		// regex so stale sessions still get the reopen-the-volcano
		// message.
		if (!q.daRequest) throw new Error('daCacheMissing')
		const result = await readCacheFileOrRecompute({ daRequest: q.daRequest as DERequest, genomes })
		if (result.cacheId !== q.cacheId) throw new Error('cacheId does not match daRequest')
		return {
			genes: result.geneData.map(g => g.gene_name),
			fold_change: result.geneData.map(g => g.fold_change)
		}
	}
	// Inline path (legacy single-cell). Reject early so we don't pass
	// undefined down to Python/Rust.
	if (!q.genes || !q.fold_change) throw new Error('requires genes and fold_change when cacheId is absent')
	return { genes: q.genes, fold_change: q.fold_change }
}

/** Compute the deterministic pickle filename for a blitzgsea run. Hash
 * includes everything that affects the blitzgsea result: the signature
 * arrays (genes + fold_change), the gene-set library selector, the
 * permutation count, and the coding-genes filter flag. Method is always
 * 'blitzgsea' for this helper; included in the hash for future-proofing. */
function computeGseaPickleId({
	genes,
	fold_change,
	geneSetGroup,
	num_permutations,
	filter_non_coding_genes
}: {
	genes: string[]
	fold_change: number[]
	geneSetGroup: string
	num_permutations: number | undefined
	filter_non_coding_genes: boolean
}): string {
	const keyInputs = {
		genes,
		fold_change,
		geneSetGroup,
		num_permutations: num_permutations ?? null,
		filter_non_coding_genes,
		method: 'blitzgsea'
	}
	const key = stableStringify(keyInputs)
	const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 32)
	return `gsea_${hash}.pkl`
}

/** In-flight blitzgsea work keyed by pickle filename. Dedupes concurrent
 * callers with identical inputs so only one Python invocation runs per
 * (pickleId, work-kind). Initial computes (no geneset_name) occupy the
 * `.gsea` slot; detail-plot image requests occupy the `.img` slot. Both
 * slots can be in flight concurrently on the same pickle. */
type PendingGseaEntry = {
	gsea?: Promise<GenesetEnrichmentResponse | string>
	img?: Promise<GenesetEnrichmentResponse | string>
}
const pendingGseaCompute = new Map<string, PendingGseaEntry>()

/** Single entry point for GSEA (blitzgsea) — resolves genes+fold_change,
 * computes a deterministic pickle filename, calls Python which either
 * loads the pickle or computes and writes it, and returns the result.
 *
 * For cacheId-bearing requests, genes+fold_change are pulled from the DA
 * cache via `readCacheFileOrRecompute`. For the legacy single-cell path,
 * they come inline on the request. */
async function computeGSEA({
	q,
	genomes
}: {
	q: GenesetEnrichmentRequest
	genomes: any
}): Promise<GenesetEnrichmentResponse | string> {
	const { genes, fold_change } = await resolveGseaGenesAndFoldChange({ q, genomes })

	// Inputs that determine the pickle filename. geneset_name is deliberately
	// excluded so detail-plot requests resolve to the same pickle the initial
	// enrichment wrote.
	const gseaComputeArg = {
		genes,
		fold_change,
		geneSetGroup: q.geneSetGroup,
		num_permutations: q.num_permutations,
		filter_non_coding_genes: q.filter_non_coding_genes
	}
	const pickle_file = computeGseaPickleId(gseaComputeArg)

	const slot: 'gsea' | 'img' = q.geneset_name ? 'img' : 'gsea'
	const entry = pendingGseaCompute.get(pickle_file)
	const inFlight = entry?.[slot]
	if (inFlight) return inFlight

	const work = runGseaPython({ q, genomes, gseaComputeArg, pickle_file })
	pendingGseaCompute.set(pickle_file, { ...entry, [slot]: work })

	return work.finally(() => {
		const cur = pendingGseaCompute.get(pickle_file)
		if (!cur || cur[slot] !== work) return
		const next: PendingGseaEntry = { ...cur }
		delete next[slot]
		if (next.gsea || next.img) pendingGseaCompute.set(pickle_file, next)
		else pendingGseaCompute.delete(pickle_file)
	})
}

async function runGseaPython({
	q,
	genomes,
	gseaComputeArg,
	pickle_file
}: {
	q: GenesetEnrichmentRequest
	genomes: any
	gseaComputeArg: {
		genes: string[]
		fold_change: number[]
		geneSetGroup: string
		num_permutations: number | undefined
		filter_non_coding_genes: boolean
	}
	pickle_file: string
}): Promise<GenesetEnrichmentResponse | string> {
	const cachedir_gsea = path.join(serverconfig.cachedir, 'gsea')
	const genesetenrichment_input: any = {
		genes: gseaComputeArg.genes,
		fold_change: gseaComputeArg.fold_change,
		db: genomes[q.genome].termdbs.msigdb.cohort.db.connection.name,
		geneset_group: gseaComputeArg.geneSetGroup,
		genedb: path.join(serverconfig.tpmasterdir, genomes[q.genome].genedb.dbfile),
		filter_non_coding_genes: gseaComputeArg.filter_non_coding_genes,
		cachedir: cachedir_gsea,
		pickle_file,
		geneset_name: q.geneset_name,
		num_permutations: gseaComputeArg.num_permutations
	}

	const time1 = new Date().valueOf()
	const gsea_output: string = await run_python('gsea.py', '/' + JSON.stringify(genesetenrichment_input))
	mayLog('Time taken to run blitzgsea:', formatElapsedTime(Date.now() - time1))

	let result: any
	let data_found = false
	let image_found = false
	for (const line of gsea_output.split('\n')) {
		if (line.startsWith('result: ')) {
			result = JSON.parse(line.replace('result: ', ''))
			data_found = true
		} else if (line.startsWith('image: ')) {
			result = JSON.parse(line.replace('image: ', ''))
			image_found = true
		} else {
			mayLog(line)
		}
	}

	if (data_found) return result as GenesetEnrichmentResponse
	if (image_found) return path.join(cachedir_gsea, result.image_file)
	throw new Error('data or image not found in gsea output; this should not happen')
}

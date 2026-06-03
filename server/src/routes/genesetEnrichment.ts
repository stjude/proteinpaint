import type { RoutePayload, RouteApi } from '#types'

const payload: RoutePayload = {
	init,
	request: { typeId: 'GenesetEnrichmentRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GenesetEnrichmentResponse' }
}

export const api: RouteApi = {
	endpoint: 'genesetEnrichment',
	methods: {
		get: payload,
		post: payload
	}
}

import type { DERequest, DiffMethRequest, GenesetEnrichmentRequest, GenesetEnrichmentResponse } from '#types'
import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { run_python } from '@sjcrh/proteinpaint-python'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { getDeCacheResult } from './termdb.DE.ts'
import { getDmCacheResult } from '../../routes/termdb.diffMeth.ts'
import { cacheOrRecompute } from '#src/utils/cacheOrRecompute.ts'
import { get_ds_tdb } from '#src/termdb.js'
import type { GseaCacheResult } from '../../routes/types.ts'

/*
 * Cache flow (uniform across the four cacheOrRecompute consumers):
 *   init  →  xKeyInputs  →  getXCacheResult  →  cacheOrRecompute  →  runXFresh

 *   GSEA:  init → run_genesetEnrichment_analysis →               
 *          { computeGseaInitial | computeGseaImage } → getGseaCacheResult →
 *          runGseaPythonForTable
 *
 * Within this file the function order mirrors that flow:
 *   init → run_genesetEnrichment_analysis → gseaKeyInputs →
 *   getGseaCacheResult → computeGseaInitial → computeGseaImage →
 *   runGseaPythonForTable → runGseaPythonForImage → helpers
 */

export function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: GenesetEnrichmentRequest = req.query
			// TODO: should separate the processing based on if q.geneset_name exists,
			// so that each of the separate function can have definite signature types
			// instead of trying to generalize the same function to do different things
			const results = await run_genesetEnrichment_analysis(q, genomes)
			if (!q.geneset_name) {
				// Initial table request: computeGseaInitial returns the table
				// either fresh or from the JSON cache (no Python on hit). The
				// pickle rides inside the cache result and gets handed back
				// to Python on subsequent detail-image requests.
				if (typeof results != 'object') throw new Error('gsea result is not object')
				res.send(results as GenesetEnrichmentResponse)
				return
			}
			// req.query.geneset_name is present, this will cause the geneset image to be generated.
			// Python receives the cached pickle inline (pickle_b64) and renders
			// the per-geneset plot (gsea_plot_{random_num}.png) without rerunning
			// the gsea computation.
			//
			// gsea.py emits `{error}` (a structured object) when blitzgsea fails
			// on degenerate input — forward that to the client instead of
			// throwing the unhelpful "gsea result is not string".
			if (typeof results === 'object' && (results as any).error) {
				res.send({ status: 'error', error: (results as any).error })
				return
			}
			if (typeof results != 'string') throw new Error('gsea result is not string')
			res.sendFile(results, (err: any) => {
				fs.unlink(results, () => {})
				if (err) {
					res.status(404).send('Image not found')
				}
			})
		} catch (e: any) {
			res.status(e.status || 500).send({ status: 'error', error: e.message || e, code: e.code })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function run_genesetEnrichment_analysis(
	q: GenesetEnrichmentRequest,
	genomes: any
): Promise<GenesetEnrichmentResponse | string | { error: string }> {
	if (!genomes[q.genome].termdbs) throw new Error('termdb database is not available for ' + q.genome)

	if (q.fetchDE) {
		// Client requested the ranked DE list only (used by the cerno detail plot).
		const { genes, fold_change } = await resolveGseaGenesAndFoldChange({ q, genomes })
		return { data: { genes, fold_change } } as unknown as GenesetEnrichmentResponse
	}

	if (q.method == 'blitzgsea') {
		// Initial table requests cache the result as JSON so cache hits skip
		// Python startup entirely. Detail-image requests (geneset_name set)
		// always invoke Python — image generation is per-geneset and not
		// cached on disk.
		if (q.geneset_name) return await computeGseaImage({ q, genomes })
		return await computeGseaInitial({ q, genomes })
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

/** Inputs that uniquely determine the GSEA enrichment table + pickle.
 * Passed to cacheOrRecompute as the computeArgument. `geneset_name` is
 * deliberately excluded — it picks which row to render as a detail
 * plot, not the underlying enrichment, so initial-table and
 * detail-image requests share one cached result and one pickle. */
function gseaKeyInputs(q: GenesetEnrichmentRequest, genes: string[], fold_change: number[]) {
	return {
		genes,
		fold_change,
		geneSetGroup: q.geneSetGroup,
		num_permutations: q.num_permutations,
		filter_non_coding_genes: q.filter_non_coding_genes
	}
}

/** Single read-or-recompute entry point for the GSEA cache. Both the
 * initial-table path and the detail-image path go through here so they
 * share one cache result (and the pickle inside it). */
async function getGseaCacheResult({
	q,
	genomes
}: {
	q: GenesetEnrichmentRequest
	genomes: any
}): Promise<{ result: GseaCacheResult; cacheId: string }> {
	const { genes, fold_change } = await resolveGseaGenesAndFoldChange({ q, genomes })
	const cacheArg = gseaKeyInputs(q, genes, fold_change)

	// ─── cache lookup or recompute ─── //
	const { result, cacheId } = await cacheOrRecompute<typeof cacheArg, GseaCacheResult>({
		computeArgument: cacheArg,
		cacheSubdir: 'gsea',
		computeFresh: async () => {
			const { table, pickleB64 } = await runGseaPythonForTable({ q, genomes, cacheArg })
			const cacheResult: GseaCacheResult = { table, pickleB64 }
			return cacheResult
		}
	})
	return { result, cacheId }
}

/** Initial GSEA request (no `geneset_name`): returns the cached or
 * freshly-computed enrichment table. */
async function computeGseaInitial({
	q,
	genomes
}: {
	q: GenesetEnrichmentRequest
	genomes: any
}): Promise<GenesetEnrichmentResponse> {
	const { result } = await getGseaCacheResult({ q, genomes })
	return result.table
}

/** In-flight detail-image requests keyed by cacheId + geneset_name. The
 * image itself is per-geneset and ephemeral (sent + deleted), so it
 * isn't cached on disk — but concurrent callers asking for the same
 * detail plot on the same cache result should still dedup to one Python run. */
const pendingImageRequests = new Map<string, Promise<string>>()

/** Detail-image GSEA request (`geneset_name` set): pulls the pickled
 * gsea result out of the cache result and hands it to Python to render
 * the per-geneset running-sum plot. Returns the image file path on success
 * or an `{ error }` object when gsea.py emits a structured failure. */
async function computeGseaImage({
	q,
	genomes
}: {
	q: GenesetEnrichmentRequest
	genomes: any
}): Promise<string | { error: string }> {
	const { result, cacheId } = await getGseaCacheResult({ q, genomes })

	const dedupKey = `${cacheId}:${q.geneset_name}`
	const inFlight = pendingImageRequests.get(dedupKey)
	if (inFlight) return inFlight

	const work: Promise<string | { error: string }> = runGseaPythonForImage({
		q,
		genomes,
		pickleB64: result.pickleB64
	}).finally(() => pendingImageRequests.delete(dedupKey))
	// Coerce: pendingImageRequests stores Promise<string> for happy-path dedup.
	// Errors propagate via the same promise; the caller-facing return type
	// widens to include the `{ error }` object that runGseaPythonForImage
	// may surface.
	pendingImageRequests.set(dedupKey, work as Promise<string>)
	return work
}

async function runGseaPythonForTable({
	q,
	genomes,
	cacheArg
}: {
	q: GenesetEnrichmentRequest
	genomes: any
	cacheArg: ReturnType<typeof gseaKeyInputs>
}): Promise<{ table: GenesetEnrichmentResponse; pickleB64: string }> {
	const pyInput = buildPyInput({ ...q, geneset_name: undefined } as GenesetEnrichmentRequest, genomes, cacheArg)
	const time1 = new Date().valueOf()
	const gsea_output: string = await run_python('gsea.py', '/' + JSON.stringify(pyInput))
	mayLog('Time taken to run blitzgsea:', formatElapsedTime(Date.now() - time1))

	for (const line of gsea_output.split('\n')) {
		if (line.startsWith('result: ')) {
			const parsed = JSON.parse(line.replace('result: ', ''))
			// gsea.py reports failures (e.g., degenerate input) on the same
			// `result:` channel as success. Throw rather than return so
			// cacheOrRecompute won't write the error into the cache and
			// serve it as a fake "cache hit" on every subsequent request.
			if (parsed?.error) throw new Error(parsed.error)
			const { pickle_b64, ...table } = parsed
			if (!pickle_b64) throw new Error('gsea.py result missing pickle_b64')
			return { table: table as GenesetEnrichmentResponse, pickleB64: pickle_b64 }
		}
		mayLog(line)
	}
	throw new Error('gsea.py did not emit a result line on the initial path')
}

async function runGseaPythonForImage({
	q,
	genomes,
	pickleB64
}: {
	q: GenesetEnrichmentRequest
	genomes: any
	pickleB64: string
}): Promise<string | { error: string }> {
	// The image path doesn't recompute gsea — only blitz.plot.running_sum
	// needs the signature/library/filter inputs. Resolve genes+fold_change
	// here (the cache result doesn't store them) and reuse buildPyInput.
	const { genes, fold_change } = await resolveGseaGenesAndFoldChange({ q, genomes })
	const cacheArg = gseaKeyInputs(q, genes, fold_change)
	const pyInput = buildPyInput(q, genomes, cacheArg, pickleB64)
	const time1 = new Date().valueOf()
	const gsea_output: string = await run_python('gsea.py', '/' + JSON.stringify(pyInput))
	mayLog('Time taken to render gsea image:', formatElapsedTime(Date.now() - time1))

	for (const line of gsea_output.split('\n')) {
		if (line.startsWith('image: ')) {
			const parsed = JSON.parse(line.replace('image: ', ''))
			return path.join(serverconfig.cachedir, 'gsea', parsed.image_file)
		}
		// gsea.py emits failures on the `result:` channel even from the
		// detail-image path — forward those structurally so the route can
		// surface a clean error response (matches the prior behavior).
		if (line.startsWith('result: ')) {
			const parsed = JSON.parse(line.replace('result: ', ''))
			if (parsed?.error) return { error: parsed.error }
		}
		mayLog(line)
	}
	throw new Error('gsea.py did not emit an image line on the detail path')
}

// ─── helpers ─── //

/** Build the input object for gsea.py. The pickle (when relevant) rides
 * inline via `pickle_b64`; gsea.py owns no on-disk artifact anymore. */
function buildPyInput(
	q: GenesetEnrichmentRequest,
	genomes: any,
	cacheArg: ReturnType<typeof gseaKeyInputs>,
	pickleB64?: string
) {
	return {
		genes: cacheArg.genes,
		fold_change: cacheArg.fold_change,
		db: genomes[q.genome].termdbs.msigdb.cohort.db.connection.name,
		geneset_group: cacheArg.geneSetGroup,
		genedb: path.join(serverconfig.tpmasterdir, genomes[q.genome].genedb.dbfile),
		filter_non_coding_genes: cacheArg.filter_non_coding_genes,
		cachedir: path.join(serverconfig.cachedir, 'gsea'),
		geneset_name: q.geneset_name,
		num_permutations: cacheArg.num_permutations,
		...(pickleB64 ? { pickle_b64: pickleB64 } : {})
	}
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
		// A cacheId without daRequest is malformed — without the DA/DM
		// snapshot there's no way to verify the id or recompute on a cache
		// miss. The 'daCacheMissing' literal matches the client's sayerror
		// regex so stale sessions still get the reopen-the-volcano message.
		if (!q.daRequest) throw new Error('daCacheMissing')
		// Discriminate on the explicit `kind` tag carried by the request
		// types. `daRequest` is typed Partial<DERequest>|Partial<DiffMethRequest>,
		// so `kind` may be absent (legacy snapshots, malformed external
		// callers); validate up-front rather than silently falling through to
		// one branch and producing a confusing cacheId-mismatch error.
		// For DM, multiple promoters can map to the same gene_name —
		// blitzgsea/CERNO may warn or down-rank duplicates; we pass them
		// through without dedup for now.
		const kind = q.daRequest.kind
		if (kind !== 'DE' && kind !== 'DM') throw new Error('daRequest.kind must be "DE" or "DM"')
		if (kind === 'DE') {
			const { result, cacheId } = await getDeCacheResult(q.daRequest as DERequest, genomes)
			if (cacheId !== q.cacheId) throw new Error('cacheId does not match daRequest')
			return {
				genes: result.geneRows.map(g => g.gene_name),
				fold_change: result.geneRows.map(g => g.fold_change)
			}
		}
		const { result, cacheId } = await getDmCacheResult(q.daRequest as DiffMethRequest, genomes)
		if (cacheId !== q.cacheId) throw new Error('cacheId does not match daRequest')
		return {
			genes: result.promoterRows.map(p => p.gene_name),
			fold_change: result.promoterRows.map(p => p.fold_change)
		}
	}
	// Inline path (legacy single-cell). Reject early so we don't pass
	// undefined down to Python/Rust.
	if (q.dapParams) {
		const genome = genomes[q.genome]
		if (!genome) throw new Error('invalid genome')
		const [ds] = get_ds_tdb(genome, q)
		const { organism, assay, cohort } = q.dapParams
		const cohortConfig = ds.queries?.proteome?.organisms?.[organism]?.assays?.[assay]?.cohorts?.[cohort]
		if (!cohortConfig?.DAPfile) throw new Error('DAP file not configured for this cohort')
		const filePath = path.join(serverconfig.tpmasterdir, cohortConfig.DAPfile)
		const content = await fs.promises.readFile(filePath, 'utf8')
		const lines = content.trim().split('\n')
		const genes: string[] = []
		const fold_change: number[] = []
		for (let i = 1; i < lines.length; i++) {
			const parts = lines[i].split('\t')
			if (parts.length < 4) continue
			const fc = Number(parts[2])
			if (!Number.isFinite(fc)) continue
			genes.push(parts[1])
			fold_change.push(fc)
		}
		return { genes, fold_change }
	}
	if (!q.genes || !q.fold_change) throw new Error('requires genes and fold_change when cacheId is absent')
	return { genes: q.genes, fold_change: q.fold_change }
}

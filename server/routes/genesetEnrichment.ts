import type { DERequest, DiffMethRequest, GenesetEnrichmentRequest, GenesetEnrichmentResponse, RouteApi } from '#types'
import { genesetEnrichmentPayload } from '#types/checkers'
import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { run_python } from '@sjcrh/proteinpaint-python'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { getDeEnvelope } from '#routes/termdb.DE.ts'
import { getDmEnvelope } from '#routes/termdb.diffMeth.ts'
import { cacheFilePath, cacheOrRecompute, generateHash, writeJsonCache } from '#src/utils/cacheOrRecompute.ts'
import { get_ds_tdb } from '#src/termdb.js'
import { file_not_exist } from '#src/utils.js'
import type { GseaEnvelope } from './types.ts'

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
				// Initial table request: computeGseaInitial returns the table
				// either fresh or from the JSON envelope cache (no Python on
				// hit). The pickle is still written as a sibling so subsequent
				// detail-image requests can find it.
				if (typeof results != 'object') throw new Error('gsea result is not object')
				res.send(results as GenesetEnrichmentResponse)
				return
			}
			// req.query.geneset_name is present, this will cause the geneset image to be generated.
			// The python code will retrieve gsea_<hash>.pkl from cachedir_gsea to
			// generate the image (gsea_plot_{random_num}.png). This prevents having to rerun the
			// entire gsea computation again.
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
			res.send({ status: 'error', error: e.message || e })
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
		// Structural type guard: `min_count` is required on DERequest and
		// absent on DiffMethRequest, so its presence reliably picks the
		// right per-route helper without needing an explicit kind tag on
		// the wire. For DM, multiple promoters can map to the same
		// gene_name — blitzgsea/CERNO may warn or down-rank duplicates;
		// we pass them through without dedup for now.
		const isDe = 'min_count' in q.daRequest
		if (isDe) {
			const { envelope, cacheId } = await getDeEnvelope(q.daRequest as DERequest, genomes)
			if (cacheId !== q.cacheId) throw new Error('cacheId does not match daRequest')
			return {
				genes: envelope.geneRows.map(g => g.gene_name),
				fold_change: envelope.geneRows.map(g => g.fold_change)
			}
		}
		const { envelope, cacheId } = await getDmEnvelope(q.daRequest as DiffMethRequest, genomes)
		if (cacheId !== q.cacheId) throw new Error('cacheId does not match daRequest')
		return {
			genes: envelope.promoterRows.map(p => p.gene_name),
			fold_change: envelope.promoterRows.map(p => p.fold_change)
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

/** Inputs that uniquely determine the GSEA enrichment pickle. `geneset_name`
 * is deliberately excluded — it picks which row to render as a detail plot,
 * not the underlying enrichment. The same cacheArg is used by both the
 * initial-table and detail-image paths so they share one pickle. */
function gseaCacheArg(q: GenesetEnrichmentRequest, genes: string[], fold_change: number[]) {
	return {
		genes,
		fold_change,
		geneSetGroup: q.geneSetGroup,
		num_permutations: q.num_permutations,
		filter_non_coding_genes: q.filter_non_coding_genes
	}
}

/** Initial GSEA request (no `geneset_name`): wraps the Python computation
 * in cacheOrRecompute so a cache hit returns the table without starting a
 * Python process. Python startup + blitzgsea/scipy import time was the
 * dominant cost on hits in the previous implementation. */
async function computeGseaInitial({
	q,
	genomes
}: {
	q: GenesetEnrichmentRequest
	genomes: any
}): Promise<GenesetEnrichmentResponse> {
	const { genes, fold_change } = await resolveGseaGenesAndFoldChange({ q, genomes })
	const cacheArg = gseaCacheArg(q, genes, fold_change)

	// Pre-check: if the envelope is on disk but the sibling pickle is gone
	// (manual cleanup, partial eviction), unlink the envelope so the next
	// cacheOrRecompute call misses cleanly and Python regenerates both.
	const cacheId = generateHash(cacheArg)
	const envelopePath = cacheFilePath('gsea', cacheId)
	const pickleFile = path.join(serverconfig.cachedir, 'gsea', `${cacheId}.pkl`)
	await evictGseaIfPickleMissing(envelopePath, pickleFile)

	const { result: env } = await cacheOrRecompute<typeof cacheArg, GseaEnvelope>({
		computeArgument: cacheArg,
		cacheSubdir: 'gsea',
		computeFresh: async (_args, _cacheId, envelopeFile) => {
			const table = await runGseaPythonForTable({ q, genomes, cacheArg, pickleFile })
			const envelope: GseaEnvelope = { kind: 'GSEA', table, pickleFile }
			await writeJsonCache(envelopeFile, envelope)
			return envelope
		}
	})
	return env.table
}

/** If the JSON envelope at `envelopePath` exists but the sibling pickle
 * does not, unlink the envelope so the next cacheOrRecompute call misses
 * and Python regenerates both files together. */
async function evictGseaIfPickleMissing(envelopePath: string, pickleFile: string): Promise<void> {
	if (await file_not_exist(envelopePath)) return // envelope already absent — nothing to evict
	if (await file_not_exist(pickleFile)) {
		await fs.promises.unlink(envelopePath).catch(() => {})
	}
}

/** In-flight detail-image requests keyed by pickleFile + geneset_name.
 * The image itself is per-geneset and ephemeral (sent + deleted), so it
 * isn't cached on disk — but concurrent callers asking for the same
 * detail plot on the same pickle should still dedup to one Python run. */
const pendingImageRequests = new Map<string, Promise<string>>()

/** Detail-image GSEA request (`geneset_name` set): always invokes Python
 * to render the per-geneset plot from the pickle. If the pickle has been
 * evicted, falls back to running the initial path first to regenerate it.
 * Returns either an image file path (success) or an `{ error }` object
 * (gsea.py emits errors on the `result:` channel from any path). */
async function computeGseaImage({
	q,
	genomes
}: {
	q: GenesetEnrichmentRequest
	genomes: any
}): Promise<string | { error: string }> {
	const { genes, fold_change } = await resolveGseaGenesAndFoldChange({ q, genomes })
	const cacheArg = gseaCacheArg(q, genes, fold_change)
	const cacheId = generateHash(cacheArg)
	const pickleFile = path.join(serverconfig.cachedir, 'gsea', `${cacheId}.pkl`)

	// If the pickle is missing, regenerate it via the initial path. That
	// also rewrites the JSON envelope so subsequent table requests stay
	// fast. We deliberately ignore its return value here — only the side
	// effect of writing the pickle matters for the image step.
	if (await file_not_exist(pickleFile)) {
		await computeGseaInitial({ q: { ...q, geneset_name: undefined } as GenesetEnrichmentRequest, genomes })
	}

	const dedupKey = `${cacheId}:${q.geneset_name}`
	const inFlight = pendingImageRequests.get(dedupKey)
	if (inFlight) return inFlight

	const work: Promise<string | { error: string }> = runGseaPythonForImage({
		q,
		genomes,
		cacheArg,
		pickleFile
	}).finally(() => pendingImageRequests.delete(dedupKey))
	// Coerce: pendingImageRequests stores Promise<string> for happy-path dedup.
	// Errors propagate via the same promise; the caller-facing return type
	// widens to include the `{ error }` object that runGseaPythonForImage
	// may surface.
	pendingImageRequests.set(dedupKey, work as Promise<string>)
	return work
}

/** Build the input object for gsea.py and parse one of its emitted result
 * lines. Shared between the initial-table and detail-image runners — only
 * the result-line prefix and post-processing differ. */
function buildPyInput(
	q: GenesetEnrichmentRequest,
	genomes: any,
	cacheArg: ReturnType<typeof gseaCacheArg>,
	pickleFile: string
) {
	return {
		genes: cacheArg.genes,
		fold_change: cacheArg.fold_change,
		db: genomes[q.genome].termdbs.msigdb.cohort.db.connection.name,
		geneset_group: cacheArg.geneSetGroup,
		genedb: path.join(serverconfig.tpmasterdir, genomes[q.genome].genedb.dbfile),
		filter_non_coding_genes: cacheArg.filter_non_coding_genes,
		cachedir: path.join(serverconfig.cachedir, 'gsea'),
		// gsea.py expects just the basename; it joins with cachedir internally.
		pickle_file: path.basename(pickleFile),
		geneset_name: q.geneset_name,
		num_permutations: cacheArg.num_permutations
	}
}

async function runGseaPythonForTable({
	q,
	genomes,
	cacheArg,
	pickleFile
}: {
	q: GenesetEnrichmentRequest
	genomes: any
	cacheArg: ReturnType<typeof gseaCacheArg>
	pickleFile: string
}): Promise<GenesetEnrichmentResponse> {
	const pyInput = buildPyInput(
		{ ...q, geneset_name: undefined } as GenesetEnrichmentRequest,
		genomes,
		cacheArg,
		pickleFile
	)
	const time1 = new Date().valueOf()
	const gsea_output: string = await run_python('gsea.py', '/' + JSON.stringify(pyInput))
	mayLog('Time taken to run blitzgsea:', formatElapsedTime(Date.now() - time1))

	for (const line of gsea_output.split('\n')) {
		if (line.startsWith('result: ')) {
			const parsed = JSON.parse(line.replace('result: ', ''))
			// gsea.py reports failures (e.g., degenerate input) on the same
			// `result:` channel as success. Throw rather than return so
			// cacheOrRecompute won't write the error into the JSON envelope
			// and serve it as a fake "cache hit" on every subsequent request.
			if (parsed?.error) throw new Error(parsed.error)
			return parsed as GenesetEnrichmentResponse
		}
		mayLog(line)
	}
	throw new Error('gsea.py did not emit a result line on the initial path')
}

async function runGseaPythonForImage({
	q,
	genomes,
	cacheArg,
	pickleFile
}: {
	q: GenesetEnrichmentRequest
	genomes: any
	cacheArg: ReturnType<typeof gseaCacheArg>
	pickleFile: string
}): Promise<string | { error: string }> {
	const pyInput = buildPyInput(q, genomes, cacheArg, pickleFile)
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

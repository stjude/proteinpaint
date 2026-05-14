import fs from 'fs'
import path from 'path'
import type { DEFullResponse, DEImage, DERequest, ExpressionInput, GeneDEEntry, RouteApi } from '#types'
import { diffExpPayload } from '#types/checkers'
import { mayLog } from '#src/helpers.ts'
import serverconfig from '../src/serverconfig.js'
import { run_R } from '@sjcrh/proteinpaint-r'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { formatElapsedTime } from '#shared'
import { renderVolcano } from '../src/renderVolcano.ts'
import { cacheFilePath, cacheOrRecompute, canonicalizeSamplelst, writeJsonCache } from '#src/utils/cacheOrRecompute.ts'
import { buildGroupValues, resolveDaContext, type SampleGroups } from '#src/utils/sampleGroups.ts'
import { file_not_exist } from '#src/utils.js'
import type { DeCacheEnvelope } from './types.ts'

export const api: RouteApi = {
	endpoint: 'termdb/DE',
	methods: {
		get: {
			...diffExpPayload,
			init
		},
		post: {
			...diffExpPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query as DERequest

			// preAnalysis short-circuit: just sample counts, no cache touch.
			if ((q as any).preAnalysis) {
				const { ds, term_results, term_results2 } = await resolveDaContext(q, genomes)
				const groups = resolveSampleGroups(q, ds, term_results, term_results2)
				const group1Name = q.samplelst.groups[0].name
				const group2Name = q.samplelst.groups[1].name
				res.send({
					data: {
						[group1Name]: groups.group1names.length,
						[group2Name]: groups.group2names.length,
						...(groups.alerts.length ? { alert: groups.alerts.join(' | ') } : {})
					}
				})
				return
			}

			const { envelope, cacheId, images } = await loadDeForResponse(q, genomes)

			const rendered = await renderVolcano<GeneDEEntry>(envelope.geneRows, q.volcanoRender)
			rendered.cacheId = cacheId

			const output: DEFullResponse = {
				data: rendered,
				sample_size1: envelope.sample_size1,
				sample_size2: envelope.sample_size2,
				method: envelope.method
			}
			if (images.length) output.images = images
			if (envelope.bcv != null) output.bcv = envelope.bcv
			res.send(output)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

/** The subset of a DERequest that determines the cache identity. Passed
 * to cacheOrRecompute as the computeArgument. storage_type is excluded:
 * it is dataset-pinned (derived from ds.queries.rnaseqGeneCount at
 * request time, not sent by the client) and `dslabel` already identifies
 * the dataset that determines it. Rendering parameters are excluded
 * because changing them does not change the DE result. */
function deKeyInputs(req: DERequest) {
	return {
		genome: req.genome,
		dslabel: req.dslabel,
		samplelst: canonicalizeSamplelst(req.samplelst),
		min_count: req.min_count,
		min_total_count: req.min_total_count,
		cpm_cutoff: req.cpm_cutoff,
		method: req.method ?? null,
		tw: req.tw ?? null,
		tw2: req.tw2 ?? null,
		filter: (req as any).filter ?? null,
		filter0: (req as any).filter0 ?? null
	}
}

/** Wrap getDeEnvelope with the route-handler-only steps: verify the
 * sibling PNGs are still on disk for cached envelopes (evict + recompute
 * on partial-eviction or pre-migration envelopes that lack siblings),
 * then materialize the PNGs as base64 data URLs for the response.
 *
 * gsea bypasses this layer — it calls `getDeEnvelope` directly because
 * it only needs gene_name + fold_change and would waste work loading
 * PNGs it doesn't use. */
async function loadDeForResponse(
	req: DERequest,
	genomes: any
): Promise<{ envelope: DeCacheEnvelope; cacheId: string; images: DEImage[] }> {
	let { envelope, cacheId, fromCache } = await getDeEnvelope(req, genomes)
	const expectsQl = envelope.method === 'edgeR' // 'edgeR' covers limma too — runDeFresh sets method='edgeR' in both branches
	let png = dePngPaths(cacheId)

	// Cache-hit sibling check: a missing QL on an edgeR envelope means the
	// PNG was evicted (manual cleanup, partial CacheManager eviction) or
	// the envelope is from before the sibling-files migration. Either way,
	// evict the envelope and let cacheOrRecompute regenerate everything.
	// Bounded: a fresh run always writes the PNG, so the retry can only
	// fail by throwing.
	if (fromCache && expectsQl && (await file_not_exist(png.ql))) {
		await fs.promises.unlink(cacheFilePath('de', cacheId)).catch(() => {})
		;({ envelope, cacheId, fromCache } = await getDeEnvelope(req, genomes))
		png = dePngPaths(cacheId)
	}

	const images: DEImage[] = []
	if (expectsQl) {
		images.push(await readPngAsDEImage(png.ql, 'ql_image'))
		// MDS is only generated when the read-counts matrix fits under R's
		// `mds_cutoff` — its absence is normal, not an eviction signal.
		if (!(await file_not_exist(png.mds))) images.push(await readPngAsDEImage(png.mds, 'mds_image'))
	}

	return { envelope, cacheId, images }
}

/** Single read-or-recompute entry point for the DE cache. Used both by
 * `loadDeForResponse` above and by genesetEnrichment.ts when it needs
 * to project gene_name + fold_change off a cached DE envelope. The
 * cacheOrRecompute pending map dedupes concurrent identical calls so
 * doubling up here is free on hits and produces one shared compute on
 * misses. */
export async function getDeEnvelope(
	req: DERequest,
	genomes: any
): Promise<{ envelope: DeCacheEnvelope; cacheId: string; fromCache: boolean }> {
	const { result, cacheId, fromCache } = await cacheOrRecompute<ReturnType<typeof deKeyInputs>, DeCacheEnvelope>({
		computeArgument: deKeyInputs(req),
		cacheSubdir: 'de',
		computeFresh: async (_args, id, file) => {
			const { ds, term_results, term_results2 } = await resolveDaContext(req, genomes)
			return runDeFresh(req, ds, term_results, term_results2, id, file)
		}
	})
	return { envelope: result, cacheId, fromCache }
}

/** Resolve the two sample groups + any confounder value arrays for DE.
 * Wraps the shared `buildGroupValues` with DE-specific dataset query
 * lookup and engineer-facing alert messages. */
export function resolveSampleGroups(param: DERequest, ds: any, term_results: any, term_results2: any): SampleGroups {
	if (param.samplelst?.groups?.length != 2) throw new Error('.samplelst.groups.length!=2')
	if (param.samplelst.groups[0].values?.length < 1) throw new Error('samplelst.groups[0].values.length<1')
	if (param.samplelst.groups[1].values?.length < 1) throw new Error('samplelst.groups[1].values.length<1')

	const q = ds.queries.rnaseqGeneCount
	if (!q) throw new Error('rnaseqGeneCount query missing on ds')
	if (!q.file) throw new Error('unknown data type for rnaseqGeneCount')
	if (!q.storage_type) throw new Error('storage_type is not defined')
	// Do NOT mutate `param.storage_type` here. `param` is the request object
	// used for cacheId hashing; mutating it would cause hash drift between
	// call sites that hash before this runs and those that hash after.
	// Readers should pull from ds.queries.rnaseqGeneCount.storage_type.

	const g1 = buildGroupValues(param.samplelst.groups[0].values, q, ds, param.tw, param.tw2, term_results, term_results2)
	const g2 = buildGroupValues(param.samplelst.groups[1].values, q, ds, param.tw, param.tw2, term_results, term_results2)

	const alerts: string[] = []
	if (g1.names.length < 1) alerts.push('sample size of group1 < 1')
	if (g2.names.length < 1) alerts.push('sample size of group2 < 1')
	const commonnames = g1.names.filter(x => g2.names.includes(x))
	if (commonnames.length) alerts.push(`Common elements found between both groups: ${commonnames.join(', ')}`)

	return {
		group1names: g1.names,
		group2names: g2.names,
		conf1_group1: g1.conf1,
		conf1_group2: g2.conf1,
		conf2_group1: g1.conf2,
		conf2_group2: g2.conf2,
		alerts
	}
}

/** Read a sibling PNG (the QL or MDS plot R wrote to disk for this
 * cacheId) and return it as a base64 data URL the client can render
 * directly. Used by the route handler on every response — fresh runs
 * just wrote the PNG, cache hits find it as a sibling of the JSON
 * envelope. */
async function readPngAsDEImage(file: string, key: string): Promise<DEImage> {
	const plot = await fs.promises.readFile(file)
	return {
		src: `data:image/png;base64,${Buffer.from(plot).toString('base64')}`,
		size: plot.length,
		key
	}
}

/** Deterministic sibling paths for the diagnostic PNGs that R writes for
 * a given cacheId. Layout matches what runDeFresh hands to R. */
function dePngPaths(cacheId: string): { ql: string; mds: string } {
	const dir = path.join(serverconfig.cachedir, 'de')
	return { ql: path.join(dir, `${cacheId}.ql.png`), mds: path.join(dir, `${cacheId}.mds.png`) }
}

/** Run DE fresh and write the JSON cache envelope to `cacheFile`.
 * Mutates param.method to the canonical label ('edgeR' or 'wilcoxon')
 * to match the pipeline that actually ran. For edgeR/limma, R writes
 * the QL plot (and optional MDS plot) to deterministic sibling paths
 * derived from `cacheId`; the route handler reads them off disk on
 * every response. */
async function runDeFresh(
	param: DERequest,
	ds: any,
	term_results: any,
	term_results2: any,
	cacheId: string,
	cacheFile: string
): Promise<DeCacheEnvelope> {
	const groups = resolveSampleGroups(param, ds, term_results, term_results2)
	if (groups.alerts.length) throw new Error(groups.alerts.join(' | '))

	const q = ds.queries.rnaseqGeneCount
	const png = dePngPaths(cacheId)

	const expression_input = {
		case: groups.group2names.join(','),
		control: groups.group1names.join(','),
		data_type: 'do_DE',
		input_file: q.file,
		cachedir: serverconfig.cachedir,
		// Read storage_type from the dataset directly, not from the mutable
		// request object — see note in resolveSampleGroups.
		storage_type: q.storage_type,
		DE_method: param.method,
		mds_cutoff: 10000,
		min_count: param.min_count,
		min_total_count: param.min_total_count,
		cpm_cutoff: param.cpm_cutoff,
		// R writes the diagnostic PNGs directly to these deterministic
		// sibling paths so they survive as cache artifacts. Only used by
		// the edgeR / limma branches; the wilcoxon (Rust) branch ignores
		// them and produces no images.
		ql_image_path: png.ql,
		mds_image_path: png.mds
	} as ExpressionInput

	if (param.tw) {
		expression_input.conf1 = [...groups.conf1_group2, ...groups.conf1_group1]
		expression_input.conf1_mode = param.tw.q.mode
		if (new Set(expression_input.conf1).size === 1) throw new Error('Confounding variable 1 has only one value')
	}

	if (param.tw2) {
		expression_input.conf2 = [...groups.conf2_group2, ...groups.conf2_group1]
		expression_input.conf2_mode = param.tw2.q.mode
		if (new Set(expression_input.conf2).size === 1) throw new Error('Confounding variable 2 has only one value')
	}

	// Pick the engine. Below 8 samples per group, edgeR (parametric) is
	// used even when wilcoxon was requested — small groups don't have
	// enough degrees of freedom for the non-parametric test.
	const small = groups.group1names.length <= 8 && groups.group2names.length <= 8
	const engine: 'edgeR' | 'wilcoxon' =
		small || param.method === 'edgeR' || param.method === 'limma' ? 'edgeR' : 'wilcoxon'
	if (engine === 'edgeR') {
		const time1 = new Date().valueOf()
		const result = JSON.parse(await run_R('edge_newh5.R', JSON.stringify(expression_input)))
		mayLog('Time taken to run edgeR:', formatElapsedTime(Date.now() - time1))
		param.method = 'edgeR'

		const envelope: DeCacheEnvelope = {
			geneRows: result.gene_data,
			sample_size1: result.num_controls[0],
			sample_size2: result.num_cases[0],
			method: param.method,
			bcv: result.bcv && result.bcv[0] != null ? result.bcv[0] : undefined
		}
		await writeJsonCache(cacheFile, envelope)
		return envelope
	}

	const time1 = new Date().valueOf()
	const result: GeneDEEntry[] = JSON.parse(await run_rust('DEanalysis', JSON.stringify(expression_input)))
	mayLog('Time taken to run rust DE pipeline:', formatElapsedTime(Date.now() - time1))
	param.method = 'wilcoxon'

	const envelope: DeCacheEnvelope = {
		geneRows: result,
		sample_size1: groups.group1names.length,
		sample_size2: groups.group2names.length,
		method: param.method
	}
	await writeJsonCache(cacheFile, envelope)
	return envelope
}

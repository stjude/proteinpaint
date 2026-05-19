import type { DEFullResponse, DEImage, DERequest, ExpressionInput, GeneDEEntry, RouteApi } from '#types'
import { diffExpPayload } from '#types/checkers'
import { mayLog } from '#src/helpers.ts'
import serverconfig from '../src/serverconfig.js'
import { run_R } from '@sjcrh/proteinpaint-r'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { formatElapsedTime } from '#shared'
import { renderVolcano } from '../src/renderVolcano.ts'
import { cacheOrRecompute } from '#src/utils/cacheOrRecompute.ts'
import {
	buildGroupValues,
	canonicalizeSamplelst,
	resolveDaContext,
	type SampleGroups
} from '#src/utils/sampleGroups.ts'
import type { DeCacheResult } from './types.ts'

/*
 * Cache flow (uniform across the four cacheOrRecompute consumers):
 *   init  →  xKeyInputs  →  getXCacheResult  →  cacheOrRecompute  →  runXFresh
 *
 *   DE:    init → loadDeForResponse → getDeCacheResult → runDeFresh
 *
 * Within this file the function order mirrors that flow:
 *   init → deKeyInputs → loadDeForResponse → getDeCacheResult → runDeFresh → helpers
 */

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

			const { result, cacheId, images } = await loadDeForResponse(q, genomes)

			const rendered = await renderVolcano<GeneDEEntry>(result.geneRows, q.volcanoRender)
			rendered.cacheId = cacheId

			const output: DEFullResponse = {
				data: rendered,
				sample_size1: result.sample_size1,
				sample_size2: result.sample_size2,
				method: result.method
			}
			if (images.length) output.images = images
			if (result.bcv != null) output.bcv = result.bcv
			res.send(output)
		} catch (e: any) {
			res.status(e.status || 500).send({ status: 'error', error: e.message || e, code: e.code })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

/** The subset of a DERequest that determines the cache identity. Passed
 * to cacheOrRecompute as the computeArgument. */
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

/** Wrap getDeCacheResult with the route-handler-only step of pulling the
 * embedded diagnostic PNGs out of the cache result for the response.
 *
 * gsea bypasses this layer — it calls `getDeCacheResult` directly because
 * it only needs gene_name + fold_change and would waste work shuttling
 * around image payloads it doesn't use. */
async function loadDeForResponse(
	req: DERequest,
	genomes: any
): Promise<{ result: DeCacheResult; cacheId: string; images: DEImage[] }> {
	const { result, cacheId } = await getDeCacheResult(req, genomes)
	const images: DEImage[] = []
	if (result.qlImage) images.push(result.qlImage)
	if (result.mdsImage) images.push(result.mdsImage)
	return { result, cacheId, images }
}

/** Single read-or-recompute entry point for the DE cache. Used both by
 * `loadDeForResponse` above and by genesetEnrichment.ts when it needs
 * to project gene_name + fold_change off a cached DE result. The
 * cacheOrRecompute pending map dedupes concurrent identical calls so
 * doubling up here is free on hits and produces one shared compute on
 * misses. */
export async function getDeCacheResult(
	req: DERequest,
	genomes: any
): Promise<{ result: DeCacheResult; cacheId: string }> {
	// ─── cache lookup or recompute ─── //
	const { result, cacheId } = await cacheOrRecompute<ReturnType<typeof deKeyInputs>, DeCacheResult>({
		computeArgument: deKeyInputs(req),
		cacheSubdir: 'de',
		computeFresh: async () => {
			const { ds, term_results, term_results2 } = await resolveDaContext(req, genomes)
			return runDeFresh(req, ds, term_results, term_results2)
		}
	})
	return { result, cacheId }
}

/** Run DE fresh and return the cache result; `cacheOrRecompute` persists
 * it. Mutates param.method to the canonical label ('edgeR' or 'wilcoxon')
 * to match the pipeline that actually ran. For edgeR/limma, R hands the
 * diagnostic PNGs back inline (base64) in its stdout JSON, so no
 * intermediate files touch disk. */
async function runDeFresh(param: DERequest, ds: any, term_results: any, term_results2: any): Promise<DeCacheResult> {
	const groups = resolveSampleGroups(param, ds, term_results, term_results2)
	if (groups.alerts.length) throw new Error(groups.alerts.join(' | '))

	const q = ds.queries.rnaseqGeneCount

	const expression_input = {
		case: groups.group2names.join(','),
		control: groups.group1names.join(','),
		data_type: 'do_DE',
		input_file: q.file,
		cachedir: serverconfig.cachedir,
		storage_type: q.storage_type,
		DE_method: param.method,
		mds_cutoff: 10000,
		min_count: param.min_count,
		min_total_count: param.min_total_count,
		cpm_cutoff: param.cpm_cutoff
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

		const qlImage = deImageFromB64(result.ql_image_b64, 'ql_image')
		const mdsImage = deImageFromB64(result.mds_image_b64, 'mds_image')

		const cacheResult: DeCacheResult = {
			geneRows: result.gene_data,
			sample_size1: result.num_controls[0],
			sample_size2: result.num_cases[0],
			method: param.method,
			bcv: result.bcv && result.bcv[0] != null ? result.bcv[0] : undefined,
			...(qlImage ? { qlImage } : {}),
			...(mdsImage ? { mdsImage } : {})
		}
		return cacheResult
	}

	const time1 = new Date().valueOf()
	const result: GeneDEEntry[] = JSON.parse(await run_rust('DEanalysis', JSON.stringify(expression_input)))
	mayLog('Time taken to run rust DE pipeline:', formatElapsedTime(Date.now() - time1))
	param.method = 'wilcoxon'

	const cacheResult: DeCacheResult = {
		geneRows: result,
		sample_size1: groups.group1names.length,
		sample_size2: groups.group2names.length,
		method: param.method
	}
	return cacheResult
}

// ─── helpers ─── //

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

/** Wrap a base64 PNG string from R into the `DEImage` shape the client
 * consumes. Returns null if R didn't emit the field (e.g. MDS was
 * skipped because the read counts matrix exceeded `mds_cutoff`). */
function deImageFromB64(b64: string | undefined, key: string): DEImage | null {
	if (!b64) return null
	const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
	const size = Math.floor((b64.length * 3) / 4) - padding
	return { src: `data:image/png;base64,${b64}`, size, key }
}

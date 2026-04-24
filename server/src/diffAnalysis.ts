import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { DERequest, DEImage, ExpressionInput, GeneDEEntry } from '#types'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { run_R } from '@sjcrh/proteinpaint-r'
import { getData } from './termdb.matrix.js'
import { get_ds_tdb } from './termdb.js'
import { mayLog } from '#src/helpers.ts'
import serverconfig from './serverconfig.js'
import { imageSize } from 'image-size'
import { formatElapsedTime } from '#shared'

// Any drift in this function between the volcano path and the GSEA path will
// cause cache-miss storms. Keep it minimal and purely structural.
function stableStringify(v: any): string {
	if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
	if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
	const keys = Object.keys(v).sort()
	return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}'
}

function canonicalizeSamplelst(s: any): any {
	if (!s || !Array.isArray(s.groups)) return s
	return {
		groups: s.groups.map((g: any) => ({
			name: g.name,
			in: g.in,
			values: Array.isArray(g.values)
				? [...g.values].sort((a, b) => {
						const A = a?.sampleId
						const B = b?.sampleId
						if (A === B) return 0
						return A < B ? -1 : 1
				  })
				: g.values
		}))
	}
}

export function computeDaCacheId(req: DERequest): string {
	// storage_type is intentionally excluded: it is dataset-pinned (derived
	// from ds.queries.rnaseqGeneCount at request time, not sent by the client)
	// and `dslabel` already identifies the dataset that determines it. Including
	// it caused hash drift because some call sites saw it mutated onto `req`
	// and others did not.
	// Our keyInputs are all the parameters that determine the DE result,
	// except for storage_type as noted above. Changing rendering parameters
	// will not change the DA result, so they are not included in the inputs that determine the cacheId.
	const keyInputs = {
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
	const key = stableStringify(keyInputs)
	const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 32)
	const cacheId = `da_${hash}`
	return cacheId
}

const CACHE_ID_RE = /^da_[0-9a-f]{32}$/

function cacheFilePath(cacheId: string): string {
	if (!CACHE_ID_RE.test(cacheId)) throw new Error('invalid cacheId')
	return path.join(serverconfig.cachedir, 'daAnalysis', `${cacheId}.tsv`)
}

export async function writeDaCache(cacheId: string, geneData: GeneDEEntry[]): Promise<void> {
	const file = cacheFilePath(cacheId)
	console.log(77, file)
	// Full 5-field row: renderVolcano (and its underlying Rust renderer) needs
	// adjusted_p_value + original_p_value for significance gating on the PNG;
	// GSEA only uses gene_name + fold_change. Storing everything lets cache
	// hits serve both paths without re-running DE.
	const lines = ['gene_id\tgene_name\tfold_change\toriginal_p_value\tadjusted_p_value']
	for (const g of geneData) {
		lines.push(`${g.gene_id ?? ''}\t${g.gene_name}\t${g.fold_change}\t${g.original_p_value}\t${g.adjusted_p_value}`)
	}
	await fs.promises.writeFile(file, lines.join('\n'))
}

/** Returns null on cache miss (ENOENT) so callers can branch on hit vs. miss. */
export async function readDaCache(cacheId: string): Promise<GeneDEEntry[] | null> {
	const file = cacheFilePath(cacheId)
	let text: string
	try {
		text = await fs.promises.readFile(file, 'utf8')
	} catch (e: any) {
		if (e && e.code === 'ENOENT') return null
		throw e
	}
	const rows = text.split('\n')
	if (rows.length < 1) return []
	// Detect legacy 2-column caches (gene_name, fold_change) written before
	// this format change. Those files can't drive the volcano Rust renderer
	// (no p-values), so return null and let the caller fall back to
	// runDeFresh, which rewrites the file with the full schema.
	const header = rows[0].split('\t')
	if (header.length < 5) return null
	const data: GeneDEEntry[] = []
	for (const r of rows.slice(1).filter(Boolean)) {
		const cols = r.split('\t')
		data.push({
			gene_id: cols[0],
			gene_name: cols[1],
			fold_change: Number(cols[2]),
			original_p_value: Number(cols[3]),
			adjusted_p_value: Number(cols[4])
		})
	}
	return data
}

/** Resolve the dataset + confounder term data. Both the volcano route and
 * the GSEA recompute path call this before running DE or computing sample
 * sizes on a cache hit. */
export async function resolveDeContext(
	req: DERequest,
	genomes: any
): Promise<{ ds: any; term_results: any; term_results2: any }> {
	const genome = genomes[req.genome]
	if (!genome) throw new Error('invalid genome')
	const [ds] = get_ds_tdb(genome, req as any)

	let term_results: any = []
	if (req.tw) {
		term_results = await getData(
			{
				filter: (req as any).filter,
				filter0: (req as any).filter0,
				terms: [req.tw]
			},
			ds
		)
		if (term_results.error) throw new Error(term_results.error)
	}

	let term_results2: any = []
	if (req.tw2) {
		term_results2 = await getData(
			{
				filter: (req as any).filter,
				filter0: (req as any).filter0,
				terms: [req.tw2]
			},
			ds
		)
		if (term_results2.error) throw new Error(term_results2.error)
	}

	return { ds, term_results, term_results2 }
}

/** Below this per-group size, DE runs edgeR (parametric) even if the client
 * requested wilcoxon — small groups don't have enough degrees of freedom for
 * the non-parametric test. Keeping this threshold in one place so runDeFresh
 * and the cache-hit label-derivation can't drift. */
const SAMPLE_SIZE_LIMIT = 8

/** Return the canonical engine label ('edgeR' or 'wilcoxon') for a given
 * request + group sizes. Mirrors the branch at the top of runDeFresh; used
 * there to pick the engine and used in readCacheFileOrRecompute on a cache
 * hit to report the same label the fresh run would have reported (the cache
 * file does not record which engine produced it). */
function deriveEngineLabel(req: DERequest, group1size: number, group2size: number): 'edgeR' | 'wilcoxon' {
	const small = group1size <= SAMPLE_SIZE_LIMIT && group2size <= SAMPLE_SIZE_LIMIT
	if (small || req.method === 'edgeR' || req.method === 'limma') return 'edgeR'
	return 'wilcoxon'
}

type SampleGroups = {
	group1names: string[]
	group2names: string[]
	conf1_group1: (string | number)[]
	conf1_group2: (string | number)[]
	conf2_group1: (string | number)[]
	conf2_group2: (string | number)[]
	alerts: string[]
}

/** Resolve the two sample groups + any confounder value arrays. Extracted
 * from the original run_DE so cache hits can compute sample sizes without
 * re-running R/Rust. */
export function resolveSampleGroups(param: DERequest, ds: any, term_results: any, term_results2: any): SampleGroups {
	if (param.samplelst?.groups?.length != 2) throw new Error('.samplelst.groups.length!=2')
	if (param.samplelst.groups[0].values?.length < 1) throw new Error('samplelst.groups[0].values.length<1')
	if (param.samplelst.groups[1].values?.length < 1) throw new Error('samplelst.groups[1].values.length<1')

	const q = ds.queries.rnaseqGeneCount
	if (!q) throw new Error('rnaseqGeneCount query missing on ds')
	if (!q.file) throw new Error('unknown data type for rnaseqGeneCount')
	if (!q.storage_type) throw new Error('storage_type is not defined')
	// Do NOT mutate `param.storage_type` here. `param` is the request object
	// used for cacheId hashing elsewhere; mutating it causes hash drift between
	// call sites that hash before this runs (volcano route, GSEA route) and
	// those that hash after (runDeFresh). Readers of storage_type should pull
	// from ds.queries.rnaseqGeneCount.storage_type directly.

	const group1names: string[] = []
	const conf1_group1: (string | number)[] = []
	const conf2_group1: (string | number)[] = []
	for (const s of param.samplelst.groups[0].values) {
		if (!Number.isInteger(s.sampleId)) continue
		const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
		if (!n) continue
		if (!q.allSampleSet.has(n)) continue
		if (param.tw && !param.tw2) {
			if (term_results.samples[s.sampleId]) {
				conf1_group1.push(
					param.tw.q.mode == 'continuous'
						? term_results.samples[s.sampleId][param.tw.$id]['value']
						: term_results.samples[s.sampleId][param.tw.$id]['key']
				)
				group1names.push(n)
			}
		} else if (!param.tw && param.tw2) {
			if (term_results2.samples[s.sampleId]) {
				conf2_group1.push(
					param.tw2.q.mode == 'continuous'
						? term_results2.samples[s.sampleId][param.tw2.$id]['value']
						: term_results2.samples[s.sampleId][param.tw2.$id]['key']
				)
				group1names.push(n)
			}
		} else if (param.tw && param.tw2) {
			if (term_results.samples[s.sampleId] && term_results2.samples[s.sampleId]) {
				conf1_group1.push(
					param.tw.q.mode == 'continuous'
						? term_results.samples[s.sampleId][param.tw.$id]['value']
						: term_results.samples[s.sampleId][param.tw.$id]['key']
				)
				conf2_group1.push(
					param.tw2.q.mode == 'continuous'
						? term_results2.samples[s.sampleId][param.tw2.$id]['value']
						: term_results2.samples[s.sampleId][param.tw2.$id]['key']
				)
				group1names.push(n)
			}
		} else {
			group1names.push(n)
		}
	}

	const group2names: string[] = []
	const conf1_group2: (string | number)[] = []
	const conf2_group2: (string | number)[] = []
	for (const s of param.samplelst.groups[1].values) {
		if (!Number.isInteger(s.sampleId)) continue
		const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
		if (!n) continue
		if (!q.allSampleSet.has(n)) continue
		if (param.tw && !param.tw2) {
			if (term_results.samples[s.sampleId]) {
				conf1_group2.push(
					param.tw.q.mode == 'continuous'
						? term_results.samples[s.sampleId][param.tw.$id]['value']
						: term_results.samples[s.sampleId][param.tw.$id]['key']
				)
				group2names.push(n)
			}
		} else if (!param.tw && param.tw2) {
			if (term_results2.samples[s.sampleId]) {
				conf2_group2.push(
					param.tw2.q.mode == 'continuous'
						? term_results2.samples[s.sampleId][param.tw2.$id]['value']
						: term_results2.samples[s.sampleId][param.tw2.$id]['key']
				)
				group2names.push(n)
			}
		} else if (param.tw && param.tw2) {
			if (term_results.samples[s.sampleId] && term_results2.samples[s.sampleId]) {
				conf1_group2.push(
					param.tw.q.mode == 'continuous'
						? term_results.samples[s.sampleId][param.tw.$id]['value']
						: term_results.samples[s.sampleId][param.tw.$id]['key']
				)
				conf2_group2.push(
					param.tw2.q.mode == 'continuous'
						? term_results2.samples[s.sampleId][param.tw2.$id]['value']
						: term_results2.samples[s.sampleId][param.tw2.$id]['key']
				)
				group2names.push(n)
			}
		} else {
			group2names.push(n)
		}
	}

	const alerts = validateGroups(group1names.length, group2names.length, group1names, group2names)
	return { group1names, group2names, conf1_group1, conf1_group2, conf2_group1, conf2_group2, alerts }
}

function validateGroups(
	sample_size1: number,
	sample_size2: number,
	group1names: string[],
	group2names: string[]
): string[] {
	const alerts: string[] = []
	if (sample_size1 < 1) alerts.push('sample size of group1 < 1')
	if (sample_size2 < 1) alerts.push('sample size of group2 < 1')
	const commonnames = group1names.filter(x => group2names.includes(x))
	if (commonnames.length) alerts.push(`Common elements found between both groups: ${commonnames.join(', ')}`)
	return alerts
}

async function readFileAndDelete(file: string, key: string, response: any) {
	const plot = await fs.promises.readFile(file)
	const plotBuffer = Buffer.from(plot).toString('base64')
	const { width, height } = imageSize(file)
	response[key] = {
		src: `data:image/png;base64,${plotBuffer}`,
		size: `${width}x${height}`,
		key
	}
	await fs.promises.unlink(file)
}

export type RunDeFreshResult = {
	geneData: GeneDEEntry[]
	sample_size1: number
	sample_size2: number
	method: string
	images?: DEImage[]
	bcv?: number
	cacheId: string
}

/** Run DE fresh and write the cache. The caller should check the cache
 * before calling this — this function does not do the read-vs-compute
 * branch itself. Mutates param.method to the canonical label ('edgeR'
 * or 'wilcoxon') to match the pipeline that actually ran. */
export async function runDeFresh(
	param: DERequest,
	ds: any,
	term_results: any,
	term_results2: any
): Promise<RunDeFreshResult> {
	const groups = resolveSampleGroups(param, ds, term_results, term_results2)
	if (groups.alerts.length) throw new Error(groups.alerts.join(' | '))

	const q = ds.queries.rnaseqGeneCount

	const expression_input = {
		case: groups.group2names.join(','),
		control: groups.group1names.join(','),
		data_type: 'do_DE',
		input_file: q.file,
		cachedir: serverconfig.cachedir,
		min_count: param.min_count,
		min_total_count: param.min_total_count,
		cpm_cutoff: param.cpm_cutoff,
		// Read storage_type from the dataset directly, not from the mutable
		// request object — see note in resolveSampleGroups.
		storage_type: q.storage_type,
		DE_method: param.method,
		mds_cutoff: 10000
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

	// cacheId is computed from the unmutated request; runners below may mutate
	// param.method, so capture the id first.
	const cacheId = computeDaCacheId(param)

	const engine = deriveEngineLabel(param, groups.group1names.length, groups.group2names.length)
	if (engine === 'edgeR') {
		const time1 = new Date().valueOf()
		const result = JSON.parse(await run_R('edge_newh5.R', JSON.stringify(expression_input)))
		mayLog('Time taken to run edgeR:', formatElapsedTime(Date.now() - time1))
		param.method = 'edgeR'

		const ql_imagePath = path.join(serverconfig.cachedir, result.edgeR_ql_image_name[0])
		await readFileAndDelete(ql_imagePath, 'ql_image', result)

		if (result.edgeR_mds_image_name) {
			const mds_imagePath = path.join(serverconfig.cachedir, result.edgeR_mds_image_name[0])
			await readFileAndDelete(mds_imagePath, 'mds_image', result)
		}

		const images: DEImage[] = [result.ql_image]
		if (result.mds_image) images.push(result.mds_image)

		await writeDaCache(cacheId, result.gene_data)

		return {
			geneData: result.gene_data,
			sample_size1: result.num_controls[0],
			sample_size2: result.num_cases[0],
			method: param.method,
			images,
			bcv: result.bcv && result.bcv[0] != null ? result.bcv[0] : undefined,
			cacheId
		}
	}

	const time1 = new Date().valueOf()
	const result: GeneDEEntry[] = JSON.parse(await run_rust('DEanalysis', JSON.stringify(expression_input)))
	mayLog('Time taken to run rust DE pipeline:', formatElapsedTime(Date.now() - time1))
	param.method = 'wilcoxon'

	await writeDaCache(cacheId, result)

	return {
		geneData: result,
		sample_size1: groups.group1names.length,
		sample_size2: groups.group2names.length,
		method: param.method,
		cacheId
	}
}

export type CacheOrRecomputeResult = {
	cacheId: string
	geneData: GeneDEEntry[]
	/** true = served from cache; false = freshly computed and written. */
	fromCache: boolean
	sample_size1: number
	sample_size2: number
	method: string
	/** Only populated on fresh edgeR/limma runs. Cache hits do not carry
	 * diagnostic PNGs — those are produced only during a fresh R invocation. */
	images?: DEImage[]
	bcv?: number
}

/** In-flight read-or-recompute promises keyed by cacheId. Deduplicates
 * concurrent requests for the same inputs so only one R/Rust run (and one
 * file write) actually happens per unique cacheId, even if N callers
 * arrive simultaneously. Matters in two scenarios:
 *
 *   - Automated tests / demos where many clients hit the same URL at once.
 *   - A fresh volcano render racing a GSEA click that immediately follows.
 *
 * Second and subsequent callers attach to the first caller's promise and
 * resolve to the same result — `fromCache` reports whatever the winning
 * caller did (typically `false` on first miss, `true` afterwards). The
 * entry is cleared once the promise settles so later, genuinely new
 * requests start fresh. */
const pendingReadOrRecompute = new Map<string, Promise<CacheOrRecomputeResult>>()

/** Single entry point for "give me the DE result for this request" —
 * hides the cache-hit-vs-recompute branch from callers and deduplicates
 * concurrent requests for the same inputs via `pendingReadOrRecompute`.
 *
 * On hit: reads the cached gene data, resolves sample groups from the
 * dataset to produce `sample_size{1,2}` (cheap — no R/Rust).
 *
 * On miss: runs the full DE pipeline via `runDeFresh`, which writes the
 * cache as a side effect.
 *
 * The deterministic cacheId ensures every node/process produces the same
 * filename for the same inputs; both routes (`termdb/DE` and
 * `genesetEnrichment`'s recompute branch) go through this helper. */
export async function readCacheFileOrRecompute({
	daRequest,
	genomes
}: {
	daRequest: DERequest
	genomes: any
}): Promise<CacheOrRecomputeResult> {
	const cacheId = computeDaCacheId(daRequest)

	// Synchronous get/set — JS single-threaded event loop guarantees no
	// interleaving between this get and the set below, so two concurrent
	// callers cannot both miss the map and both start a fresh compute.
	const inFlight = pendingReadOrRecompute.get(cacheId)
	if (inFlight) {
		console.log(485, 'reused inflight')
		return inFlight
	}

	const work = doReadOrRecompute(cacheId, daRequest, genomes)
	pendingReadOrRecompute.set(cacheId, work)
	return work.finally(() => {
		pendingReadOrRecompute.delete(cacheId)
	})
}

async function doReadOrRecompute(cacheId: string, daRequest: DERequest, genomes: any): Promise<CacheOrRecomputeResult> {
	const cached = await readDaCache(cacheId)
	const { ds, term_results, term_results2 } = await resolveDeContext(daRequest, genomes)

	if (cached) {
		const groups = resolveSampleGroups(daRequest, ds, term_results, term_results2)
		if (groups.alerts.length) throw new Error(groups.alerts.join(' | '))
		return {
			cacheId,
			geneData: cached,
			fromCache: true,
			sample_size1: groups.group1names.length,
			sample_size2: groups.group2names.length,
			// The cache file doesn't record which engine produced it, and
			// daRequest.method is optional on the wire. Derive the label the
			// same way runDeFresh does (shared helper) so cache-hit responses
			// match fresh-run responses for the same request.
			method: deriveEngineLabel(daRequest, groups.group1names.length, groups.group2names.length)
		}
	}

	const fresh = await runDeFresh(daRequest, ds, term_results, term_results2)
	return {
		cacheId: fresh.cacheId,
		geneData: fresh.geneData,
		fromCache: false,
		sample_size1: fresh.sample_size1,
		sample_size2: fresh.sample_size2,
		method: fresh.method,
		images: fresh.images,
		bcv: fresh.bcv
	}
}

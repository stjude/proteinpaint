import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { DERequest, DEImage, DiffMethEntry, DiffMethRequest, ExpressionInput, GeneDEEntry } from '#types'
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
export function stableStringify(v: any): string {
	if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
	if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
	const keys = Object.keys(v).sort()
	return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}'
}

export function canonicalizeSamplelst(s: any): any {
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

export function computeDeCacheId(req: DERequest): string {
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
	return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32)
}

const CACHE_ID_RE = /^[0-9a-f]{32}$/

function cacheFilePath(cacheId: string): string {
	if (!CACHE_ID_RE.test(cacheId)) throw new Error('invalid cacheId')
	return path.join(serverconfig.cachedir, 'daAnalysis', `${cacheId}.tsv`)
}

// Header lines double as the file-format discriminator: readDaCacheFile
// inspects line 0 to decide DE vs DM, so writers and the reader must agree
// on these exact strings.
const DE_CACHE_HEADER = 'gene_id\tgene_name\tfold_change\toriginal_p_value\tadjusted_p_value'
const DE_CACHE_COL_COUNT = 5

export async function writeDeCache(cacheId: string, geneData: GeneDEEntry[]): Promise<void> {
	const file = cacheFilePath(cacheId)
	// Full 5-field row: renderVolcano (and its underlying Rust renderer) needs
	// adjusted_p_value + original_p_value for significance gating on the PNG;
	// GSEA only uses gene_name + fold_change. Storing everything lets cache
	// hits serve both paths without re-running DE.
	const lines = [DE_CACHE_HEADER]
	for (const g of geneData) {
		lines.push(`${g.gene_id ?? ''}\t${g.gene_name}\t${g.fold_change}\t${g.original_p_value}\t${g.adjusted_p_value}`)
	}
	await fs.promises.writeFile(file, lines.join('\n'))
}

/** Returns null on cache miss (ENOENT), an unrecognized header, or any
 * malformed data row so callers can branch on hit vs. miss. A truncated
 * line (interrupted write, hand-edit, partial copy) would otherwise
 * yield NaNs from `Number(undefined)` and silently propagate into the
 * volcano renderer + GSEA — safer to discard the file and recompute.
 *
 * The header line is the file-format discriminator: matches
 * `DE_CACHE_HEADER` → `kind: 'DE'` with rows under `geneRows`; matches
 * `DM_CACHE_HEADER` → `kind: 'DM'` with rows under `promoterRows`.
 * Anything else (legacy 2-col cache, schema drift across a deploy,
 * unrelated file) is treated as a miss so the caller recomputes and
 * rewrites with the current schema. The `kind` literal lets callers
 * narrow with `cached.kind === 'DE'` — same convention as
 * CacheOrRecomputeResult. */
export async function readDaCacheFile(
	cacheId: string
): Promise<{ kind: 'DE'; geneRows: GeneDEEntry[] } | { kind: 'DM'; promoterRows: DiffMethEntry[] } | null> {
	const file = cacheFilePath(cacheId)
	let text: string
	try {
		text = await fs.promises.readFile(file, 'utf8')
	} catch (e: any) {
		if (e && e.code === 'ENOENT') return null
		throw e
	}
	const lines = text.split('\n')
	if (lines.length < 1) return null
	const header = lines[0]

	if (header === DE_CACHE_HEADER) {
		const geneRows: GeneDEEntry[] = []
		for (const r of lines.slice(1).filter(Boolean)) {
			const cols = r.split('\t')
			if (cols.length < DE_CACHE_COL_COUNT) return null
			geneRows.push({
				gene_id: cols[0],
				gene_name: cols[1],
				fold_change: Number(cols[2]),
				original_p_value: Number(cols[3]),
				adjusted_p_value: Number(cols[4])
			})
		}
		return { geneRows }
	}

	if (header === DM_CACHE_HEADER) {
		const promoterRows: DiffMethEntry[] = []
		for (const r of lines.slice(1).filter(Boolean)) {
			const cols = r.split('\t')
			if (cols.length < DM_CACHE_COL_COUNT) return null
			promoterRows.push({
				promoter_id: cols[0],
				gene_name: cols[1],
				fold_change: Number(cols[2]),
				original_p_value: Number(cols[3]),
				adjusted_p_value: Number(cols[4]),
				chr: cols[5],
				start: Number(cols[6]),
				stop: Number(cols[7])
			})
		}
		return { promoterRows }
	}

	// Unknown header — could be a legacy short-header file or schema drift
	// across a deploy. Treat as a cache miss so the caller recomputes and
	// rewrites with the current schema; auto-recovery beats failing every
	// user's first post-deploy request until someone hand-cleans the dir.
	return null
}

/** Resolve the dataset + confounder term data. Both the volcano route and
 * the GSEA recompute path call this before running DA (DE or DM) or
 * computing sample sizes on a cache hit. Generic over request type — the
 * lookups (genome, tw, tw2, filter, filter0) live on both DERequest and
 * DiffMethRequest with identical semantics. */
export async function resolveDaContext(
	req: DERequest | DiffMethRequest,
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
	const cacheId = computeDeCacheId(param)

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

		await writeDeCache(cacheId, result.gene_data)

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

	await writeDeCache(cacheId, result)

	return {
		geneData: result,
		sample_size1: groups.group1names.length,
		sample_size2: groups.group2names.length,
		method: param.method,
		cacheId
	}
}

/** Discriminated-union result of the unified read-or-recompute helper.
 * The `kind` literal tells callers which payload field to read at a
 * glance — more readable than structurally narrowing on the field name
 * itself, even though TypeScript would handle either correctly. */
export type CacheOrRecomputeResult =
	| {
			kind: 'DE'
			cacheId: string
			geneData: GeneDEEntry[]
			fromCache: boolean
			sample_size1: number
			sample_size2: number
			method: string
			/** Only populated on fresh edgeR/limma runs. Cache hits do not carry
			 * diagnostic PNGs — those are produced only during a fresh R invocation. */
			images?: DEImage[]
			bcv?: number
	  }
	| {
			kind: 'DM'
			cacheId: string
			promoterData: DiffMethEntry[]
			fromCache: boolean
			sample_size1: number
			sample_size2: number
	  }

/** True if the request is a gene-expression DE request. `min_count` is
 * required on `DERequest` and absent on `DiffMethRequest`, so this is a
 * reliable structural type guard without needing a wire-protocol marker. */
function isDeRequest(req: DERequest | DiffMethRequest): req is DERequest {
	return 'min_count' in req
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
 * requests start fresh. One map covers both DE and DM since cacheIds are
 * unique across kinds — the keyInputs differ structurally (DE has
 * min_count/cpm_cutoff/method, DM has min_samples_per_group), so
 * stableStringify produces disjoint hash inputs. */
const pendingReadOrRecompute = new Map<string, Promise<CacheOrRecomputeResult>>()

/** Single entry point for "give me the DA result for this request" —
 * handles both gene-expression DE (`DERequest`) and DNA-methylation DM
 * (`DiffMethRequest`). Hides the cache-hit-vs-recompute branch from
 * callers, dispatches to the right runner on miss, and deduplicates
 * concurrent requests for the same inputs via `pendingReadOrRecompute`.
 *
 * On hit: reads the cached rows via the unified `readDaCacheFile` (which
 * inspects the file's header line to decide DE vs DM), then resolves
 * sample groups from the dataset to produce `sample_size{1,2}` (cheap —
 * no R/Rust). On miss: dispatches to `runDeFresh` / `runDmFresh`, which
 * write the cache as a side effect.
 *
 * The deterministic cacheId ensures every node/process produces the same
 * filename for the same inputs; the volcano routes (`termdb/DE`,
 * `termdb/diffMeth`) and `genesetEnrichment`'s recompute branch all go
 * through this helper. */
export async function readCacheFileOrRecompute({
	daRequest,
	genomes
}: {
	daRequest: DERequest | DiffMethRequest
	genomes: any
}): Promise<CacheOrRecomputeResult> {
	const cacheId = isDeRequest(daRequest) ? computeDeCacheId(daRequest) : computeDmCacheId(daRequest)

	// Synchronous get/set — JS single-threaded event loop guarantees no
	// interleaving between this get and the set below, so two concurrent
	// callers cannot both miss the map and both start a fresh compute.
	const inFlight = pendingReadOrRecompute.get(cacheId)
	if (inFlight) {
		return inFlight
	}

	const work = doReadOrRecompute(cacheId, daRequest, genomes)
	pendingReadOrRecompute.set(cacheId, work)
	return work.finally(() => {
		pendingReadOrRecompute.delete(cacheId)
	})
}

async function doReadOrRecompute(
	cacheId: string,
	daRequest: DERequest | DiffMethRequest,
	genomes: any
): Promise<CacheOrRecomputeResult> {
	const cached = await readDaCacheFile(cacheId)
	const { ds, term_results, term_results2 } = await resolveDaContext(daRequest, genomes)

	if (isDeRequest(daRequest)) {
		// Cache-hit defense: a shape-mismatched file (DM rows under a DE
		// cacheId) would only happen via header drift or hand-edits. Treat
		// as a miss so we recompute and rewrite cleanly.
		if (cached && 'geneRows' in cached) {
			const groups = resolveSampleGroups(daRequest, ds, term_results, term_results2)
			if (groups.alerts.length) throw new Error(groups.alerts.join(' | '))
			return {
				kind: 'DE',
				cacheId,
				geneData: cached.geneRows,
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
			kind: 'DE',
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

	// DM branch
	if (cached && 'promoterRows' in cached) {
		const groups = resolveDmSampleGroups(daRequest, ds, term_results, term_results2)
		if (groups.alerts.length) throw new Error(groups.alerts.join(' | '))
		return {
			kind: 'DM',
			cacheId,
			promoterData: cached.promoterRows,
			fromCache: true,
			sample_size1: groups.group1names.length,
			sample_size2: groups.group2names.length
		}
	}
	const fresh = await runDmFresh(daRequest, ds, term_results, term_results2)
	return {
		kind: 'DM',
		cacheId: fresh.cacheId,
		promoterData: fresh.promoterData,
		fromCache: false,
		sample_size1: fresh.sample_size1,
		sample_size2: fresh.sample_size2
	}
}

// ---- DM (DNA methylation promoter) ----
//
// DE and DM share the cacheId namespace, the cacheFilePath, and the
// readCacheFileOrRecompute orchestrator. What stays parallel below is
// only the genuinely-different pieces: keyInputs, write/header, sample-
// group resolver (different ds.queries path + user-facing copy), and
// runner (diffMeth.R vs edgeR/Rust).

export function computeDmCacheId(req: DiffMethRequest): string {
	const keyInputs = {
		genome: req.genome,
		dslabel: req.dslabel,
		samplelst: canonicalizeSamplelst(req.samplelst),
		min_samples_per_group: req.min_samples_per_group ?? null,
		tw: req.tw ?? null,
		tw2: req.tw2 ?? null,
		filter: (req as any).filter ?? null,
		filter0: (req as any).filter0 ?? null
	}
	const key = stableStringify(keyInputs)
	return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32)
}

const DM_CACHE_HEADER = 'promoter_id\tgene_name\tfold_change\toriginal_p_value\tadjusted_p_value\tchr\tstart\tstop'
const DM_CACHE_COL_COUNT = 8

export async function writeDmCache(cacheId: string, promoterData: DiffMethEntry[]): Promise<void> {
	const file = cacheFilePath(cacheId)
	const lines = [DM_CACHE_HEADER]
	for (const p of promoterData) {
		lines.push(
			`${p.promoter_id}\t${p.gene_name}\t${p.fold_change}\t${p.original_p_value}\t${p.adjusted_p_value}\t${p.chr}\t${p.start}\t${p.stop}`
		)
	}
	await fs.promises.writeFile(file, lines.join('\n'))
}

type DmSampleGroups = {
	group1names: string[]
	group2names: string[]
	conf1_group1: (string | number)[]
	conf1_group2: (string | number)[]
	conf2_group1: (string | number)[]
	conf2_group2: (string | number)[]
	alerts: string[]
}

export function resolveDmSampleGroups(
	param: DiffMethRequest,
	ds: any,
	term_results: any,
	term_results2: any
): DmSampleGroups {
	if (param.samplelst?.groups?.length != 2)
		throw new Error('Exactly 2 sample groups are required for differential methylation analysis.')
	if (param.samplelst.groups[0].values?.length < 1)
		throw new Error('Group 1 has no samples. Please select at least one sample.')
	if (param.samplelst.groups[1].values?.length < 1)
		throw new Error('Group 2 has no samples. Please select at least one sample.')

	const q = ds.queries.dnaMethylation?.promoter
	if (!q) throw new Error('This dataset does not have promoter-level methylation data configured.')
	if (!q.file) throw new Error('Promoter methylation data file is not configured for this dataset.')

	const group1names: string[] = []
	const conf1_group1: (string | number)[] = []
	const conf2_group1: (string | number)[] = []
	for (const s of param.samplelst.groups[0].values) {
		if (!Number.isInteger(s.sampleId)) continue
		const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
		if (!n) continue
		if (!q.allSampleSet.has(n)) continue

		if (param.tw && param.tw2) {
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
		} else if (param.tw && !param.tw2) {
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

		if (param.tw && param.tw2) {
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
		} else if (param.tw && !param.tw2) {
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
		} else {
			group2names.push(n)
		}
	}

	const alerts = validateDmGroups(group1names.length, group2names.length, group1names, group2names)
	return { group1names, group2names, conf1_group1, conf1_group2, conf2_group1, conf2_group2, alerts }
}

// User-facing copy (vs the engineer-facing strings in DE's validateGroups);
// rendered directly in the volcano UI.
function validateDmGroups(
	sample_size1: number,
	sample_size2: number,
	group1names: string[],
	group2names: string[]
): string[] {
	const alerts: string[] = []
	if (sample_size1 < 1) alerts.push('No samples in group 1 have methylation data available.')
	if (sample_size2 < 1) alerts.push('No samples in group 2 have methylation data available.')
	const commonnames = group1names.filter(x => group2names.includes(x))
	if (commonnames.length)
		alerts.push(
			`${commonnames.length} sample(s) appear in both groups: ${commonnames.join(', ')}. Please remove duplicates.`
		)
	return alerts
}

type DiffMethInput = {
	case: string
	control: string
	input_file: string
	min_samples_per_group?: number
	conf1?: any[]
	conf1_mode?: 'continuous' | 'discrete'
	conf2?: any[]
	conf2_mode?: 'continuous' | 'discrete'
}

export type RunDmFreshResult = {
	promoterData: DiffMethEntry[]
	sample_size1: number
	sample_size2: number
	cacheId: string
}

export async function runDmFresh(
	param: DiffMethRequest,
	ds: any,
	term_results: any,
	term_results2: any
): Promise<RunDmFreshResult> {
	const groups = resolveDmSampleGroups(param, ds, term_results, term_results2)
	if (groups.alerts.length) throw new Error(groups.alerts.join(' | '))

	const q = ds.queries.dnaMethylation.promoter

	const diffMethInput: DiffMethInput = {
		// Group 1 is control, group 2 is case (same convention as DE).
		case: groups.group2names.join(','),
		control: groups.group1names.join(','),
		input_file: q.file,
		min_samples_per_group: param.min_samples_per_group
	}

	if (param.tw) {
		diffMethInput.conf1 = [...groups.conf1_group2, ...groups.conf1_group1]
		diffMethInput.conf1_mode = param.tw.q.mode
		if (new Set(diffMethInput.conf1).size === 1) throw new Error('Confounding variable 1 has only one value')
	}

	if (param.tw2) {
		diffMethInput.conf2 = [...groups.conf2_group2, ...groups.conf2_group1]
		diffMethInput.conf2_mode = param.tw2.q.mode
		if (new Set(diffMethInput.conf2).size === 1) throw new Error('Confounding variable 2 has only one value')
	}

	const cacheId = computeDmCacheId(param)

	const time1 = Date.now()
	const result = JSON.parse(await run_R('diffMeth.R', JSON.stringify(diffMethInput)))
	mayLog('Time taken to run diffMeth:', formatElapsedTime(Date.now() - time1))

	const promoterData: DiffMethEntry[] = result.promoter_data
	await writeDmCache(cacheId, promoterData)

	return {
		promoterData,
		sample_size1: groups.group1names.length,
		sample_size2: groups.group2names.length,
		cacheId
	}
}

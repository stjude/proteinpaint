import type { DiffSpliceEntry, DiffSpliceFullResponse, DiffSpliceMethod, DiffSpliceRequest } from '#types'
import { mayLog } from '#src/helpers.ts'
import { run_python } from '@sjcrh/proteinpaint-python'
import { formatElapsedTime } from '#shared'
import { renderVolcano } from '../src/renderVolcano.ts'
import { cacheOrRecompute } from '#src/utils/cacheOrRecompute.ts'
import {
	buildGroupValues,
	canonicalizeSamplelst,
	resolveDaContext,
	type SampleGroups
} from '#src/utils/sampleGroups.ts'
import type { DsCacheResult } from './types.ts'

/*
 * Differential splicing on intron clusters.
 *
 * Cache flow (uniform across the cacheOrRecompute consumers):
 *   init  →  xKeyInputs  →  getXCacheResult  →  cacheOrRecompute  →  runXFresh
 *   DS:    init → dsKeyInputs → getDsCacheResult → runDsFresh
 *
 * Within this file the function order mirrors that flow:
 *   init → dsKeyInputs → getDsCacheResult → resolveDs → runDsFresh → helpers
 *
 * Two engines are planned: edgeR's diffSpliceDGE (the fast genome-wide screen) and the
 * leafcutter Dirichlet-multinomial test (exact, slower). Only edgeR is wired; `pickDsEngine`
 * is the single place the second one lands. Both are required to return CLUSTER rows of the
 * same shape — see DsCacheResult — so nothing downstream branches on which one ran.
 */

/** Max samples ONE GROUP may contribute to a run, counted AFTER filtering to samples that
 * actually have splicing data. A dataset may lower (or raise) it via
 * queries.junction.cluster.maxSamplesPerGroup.
 *
 * Per-group rather than a total, because that is what the cost and the statistics both track:
 * the per-group fit dominates runtime, and past a few hundred per group the p-values stop
 * discriminating — at ~1000/group most "significant" clusters move under a percentage point of
 * PSI. A 250v250 run and a 400v100 run have very different costs and the same total. */
export const MAX_SAMPLES_PER_GROUP = 250

export function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query as DiffSpliceRequest

			// preAnalysis short-circuit: just sample counts, no cache touch.
			if (q.preAnalysis) {
				const { ds, term_results, term_results2 } = await resolveDaContext(q, genomes)
				const { allSampleSet } = resolveDs(ds)
				const groups = await resolveDsSampleGroups(q, allSampleSet, ds, term_results, term_results2)
				const group1Name = q.samplelst.groups[0].name
				const group2Name = q.samplelst.groups[1].name
				const alerts = [...groups.alerts]
				/* Reported here, not just enforced at run time: the client hides the "Run" button
				whenever an alert is present, so the user learns the group is too big before
				submitting rather than after waiting on a request that was always going to fail.
				Counted on the post-filter size, which is what would actually be tested. */
				const cap = resolveMaxPerGroup(ds)
				const noun = ds.cohort?.termdb?.uiLabels?.samples || 'samples'
				for (const [name, n] of [
					[group1Name, groups.group1names.length],
					[group2Name, groups.group2names.length]
				] as [string, number][]) {
					if (n > cap)
						alerts.push(
							`Group "${name}" has ${n} ${noun} with splicing data, which exceeds the limit of ${cap} per group. Please narrow the group.`
						)
				}
				// the alert is a sibling of data{}, not a key in it: data{} is keyed by group name, and a
				// group named 'alert' would otherwise be indistinguishable from this message
				res.send({
					data: {
						[group1Name]: groups.group1names.length,
						[group2Name]: groups.group2names.length
					},
					...(alerts.length ? { alert: alerts.join(' | ') } : {})
				})
				return
			}

			const { result, cacheId } = await getDsCacheResult(q, genomes)

			const rendered = await renderVolcano<DiffSpliceEntry>(result.clusterRows, q.volcanoRender)
			rendered.cacheId = cacheId

			/* No rows at all means nothing was TESTED, which is a filtering problem, not a
			thresholding one — and it looks identical to "nothing was significant" on an empty
			plot. The skip counts are the only thing that tells the two apart, so they are named
			in the error rather than left in the response the client is about to discard. */
			if (rendered.totalRows === 0) {
const skipped = Object.entries(result.skipped ?? {})
				const why = skipped.length
					? ` Clusters dropped before testing: ${skipped.map(([reason, n]) => `${reason}=${n}`).join(', ')}.`
					: ''
				throw new Error(
					`No intron clusters passed filtering. Try lowering the minimum counts per cluster or selecting more samples.${why}`
				)
			}

			const output: DiffSpliceFullResponse = {
				data: rendered,
				sample_size1: result.sample_size1,
				sample_size2: result.sample_size2,
				method: result.method
			}
			if (result.skipped) output.skipped = result.skipped
			res.send(output)
		} catch (e: any) {
			res.status(e.status || 500).send({ status: 'error', error: e.message || e, code: e.code })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

/** The subset of a DiffSpliceRequest that determines the cache identity.
 * Passed to cacheOrRecompute as the computeArgument.
 *
 * `method` MUST be here. The two engines test the same clusters and return the same row
 * shape, so their results are indistinguishable structurally — without the method in the key,
 * switching engines would silently serve the other one's cached table. */
function dsKeyInputs(req: DiffSpliceRequest) {
	return {
		genome: req.genome,
		dslabel: req.dslabel,
		samplelst: canonicalizeSamplelst(req.samplelst),
		method: req.method ?? null,
		minSamplesPerIntron: req.minSamplesPerIntron,
		minSamplesPerGroup: req.minSamplesPerGroup,
		minCountsPerCluster: req.minCountsPerCluster,
		tw: req.tw ?? null,
		tw2: req.tw2 ?? null,
		filter: (req as any).filter ?? null,
		filter0: (req as any).filter0 ?? null
	}
}

/** Single read-or-recompute entry point for the DS cache. Exported for the
 * same reason getDeCacheResult is: a future drill-down route (run --gene on
 * one cluster) needs the screen's rows without re-running the screen, and
 * the cacheOrRecompute pending map dedupes concurrent identical calls so
 * asking twice is free on hits and produces one shared compute on misses. */
export async function getDsCacheResult(
	req: DiffSpliceRequest,
	genomes: any
): Promise<{ result: DsCacheResult; cacheId: string }> {
	validateDsFilters(req)
	const { result, cacheId } = await cacheOrRecompute<ReturnType<typeof dsKeyInputs>, DsCacheResult>({
		computeArgument: dsKeyInputs(req),
		cacheSubdir: 'ds',
		computeFresh: async () => {
			const { ds, term_results, term_results2 } = await resolveDaContext(req, genomes)
			const { countsFile, allSampleSet } = resolveDs(ds)
			return runDsFresh(req, countsFile, allSampleSet, ds, term_results, term_results2)
		}
	})
	return { result, cacheId }
}

function resolveDs(ds: any): { countsFile: string; allSampleSet: Set<string> } {
	const q = ds.queries?.junction?.cluster
	if (!q) throw new Error('no junction.cluster query for differential splicing')
	if (!q.file) throw new Error('junction.cluster query has no .file')
	if (!q.allSampleSet)
		throw new Error('junction.cluster query has no .allSampleSet; did validate_junction_cluster run?')
	return { countsFile: q.file, allSampleSet: q.allSampleSet }
}

/** Run the screen fresh and return the cache result; `cacheOrRecompute` persists it.
 *
 * The engine is resolved BEFORE the python input is built, because that object is serialized
 * at the run_python call — a method assigned afterwards would never reach the script. */
async function runDsFresh(
	req: DiffSpliceRequest,
	countsFile: string,
	allSampleSet: Set<string>,
	ds: any,
	term_results: any,
	term_results2: any
): Promise<DsCacheResult> {
	const groups = await resolveDsSampleGroups(req, allSampleSet, ds, term_results, term_results2)
	if (groups.alerts.length) throw new Error(groups.alerts.join(' | '))

	/* Re-checked here and not only in preAnalysis: preAnalysis is advisory (it shapes what the UI
	offers), while this is the gate a direct API call also passes through. */
	const cap = resolveMaxPerGroup(ds)
	if (groups.group1names.length > cap || groups.group2names.length > cap)
		throw new Error(
			`Group sizes ${groups.group1names.length} and ${groups.group2names.length} exceed the limit of ${cap} samples per group for differential splicing.`
		)

	// the label is what the response reports; diffSpliceScreen.py is edgeR-only and takes no method
	const { label } = pickDsEngine(req.method)

	/* Key names are diffSpliceScreen.py's, not this route's -- that script is generated from the
	leafcutter-ds tree ("do not edit here"), so the contract is its docstring and the mapping
	happens on this side. group1 is the CONTROL group, group2 the CASE group; sample names go as
	arrays, not the comma-joined strings the DE route hands to R. */
	const pyInput: any = {
		h5: countsFile,
		group1: groups.group1names,
		group2: groups.group2names,
		/* leafcutter's own cluster filters. The client sends them already scaled to cohort size --
		see validateDSSettings -- because as absolute counts they silently loosen as N grows, which
		the script's own docstring warns about. */
		min_samples_per_intron: req.minSamplesPerIntron,
		min_samples_per_group: req.minSamplesPerGroup,
		min_coverage: req.minCountsPerCluster
	}

	/* The script takes covariates as {sampleName: {name: value}}. conf1/conf2 arrive index-aligned
	with [group2names..., group1names...] -- case first, matching how the DE route builds them. */
	if (req.tw || req.tw2) {
		const order = [...groups.group2names, ...groups.group1names]
		const conf1 = req.tw ? [...groups.conf1_group2, ...groups.conf1_group1] : null
		const conf2 = req.tw2 ? [...groups.conf2_group2, ...groups.conf2_group1] : null
		if (conf1 && new Set(conf1).size === 1) throw new Error('Confounding variable 1 has only one value')
		if (conf2 && new Set(conf2).size === 1) throw new Error('Confounding variable 2 has only one value')
		const covariates: { [sample: string]: { [k: string]: any } } = {}
		order.forEach((name, i) => {
			const o: { [k: string]: any } = {}
			if (conf1) o[req.tw.term?.name || 'conf1'] = conf1[i]
			if (conf2) o[req.tw2.term?.name || 'conf2'] = conf2[i]
			covariates[name] = o
		})
		pyInput.covariates = covariates
	}

	const t0 = Date.now()
	const result = JSON.parse(await run_python('diffSpliceScreen.py', JSON.stringify(pyInput)))
	/* The script always exits 0 and reports failure in the body, because run_python discards the
	response on a non-zero exit. Without this check a failed run reads as a successful one that
	tested nothing, and the user is told "no clusters passed filtering" instead of the real error. */
	if (result.ok === false) {
		const detail = result.stderr ? `\n${result.stderr}` : ''
		throw new Error(`diffSpliceScreen.py failed: ${result.error || 'unknown error'}${detail}`)
	}
	/* Nothing surviving the filters is an outcome of the user's groups and thresholds, not a
	failure, so the script reports it as status "no_clusters" on a successful body with no rows.
	It needs no branch here: the empty clusterRows reach init(), which answers totalRows === 0
	with its filtering guidance. The status is logged below so the two empty cases stay apart. */
	mayLog(`Time taken to run ${label} diffSplice:`, formatElapsedTime(Date.now() - t0))
	/* Logged unconditionally (not mayLog) because the point is diagnosing slow runs on deployed
	servers, where debugmode is off. One line per run, and runs are rare. Absent from the log
	means the result came from the ds/ cache and the script never ran. */
	console.log(
		`[DS] ${groups.group1names.length}v${groups.group2names.length} samples, engine: ${label},`,
		`clusters tested: ${result.cluster_data?.length ?? 0},`,
		...(result.status ? [`status: ${result.status},`] : []),
		'skipped:',
		JSON.stringify(result.skipped ?? {})
	)

	return {
		clusterRows: result.cluster_data,
		/* Sizes as the script actually used them, not as the groups nominally contained: the
		filters drop samples, and the volcano reports these as the run's n. */
		sample_size1: result.num_controls ?? groups.group1names.length,
		sample_size2: result.num_cases ?? groups.group2names.length,
		method: label,
		...(result.skipped ? { skipped: result.skipped } : {})
	}
}

// ─── helpers ─── //

/** The three leafcutter filters are absolute counts, and diffSpliceScreen.py casts them with
 * int(): a fraction such as 0.02 would become 0, which disables the filter without any error.
 * Rejected here instead, before the value can reach the cache key or the script. An absent value
 * is allowed and leaves the script's own default in force. */
export function validateDsFilters(req: Partial<DiffSpliceRequest>) {
	const filters: [string, any, string][] = [
		['minSamplesPerIntron', req.minSamplesPerIntron, 'sample count'],
		['minSamplesPerGroup', req.minSamplesPerGroup, 'sample count'],
		['minCountsPerCluster', req.minCountsPerCluster, 'read count']
	]
	for (const [key, v, unit] of filters) {
		if (v === undefined || v === null) continue
		if (!Number.isInteger(v) || v < 0) throw new Error(`${key} must be a non-negative integer ${unit}, got ${v}`)
	}
}

/** The per-group sample cap in force for this dataset. A ds may override the default; a
 * non-positive or non-integer override is ignored rather than honoured, so a typo in a dataset
 * file cannot silently disable the cap. */
function resolveMaxPerGroup(ds: any): number {
	const v = ds.queries?.junction?.cluster?.maxSamplesPerGroup
	return Number.isInteger(v) && v > 0 ? v : MAX_SAMPLES_PER_GROUP
}

/** Decide which engine runs, and the label the response reports.
 *
 * Returned as a pair, and resolved before the python input is built, for the same reason
 * pickDeEngine is: the label must describe what ACTUALLY ran, since a future rule here may
 * override what the client asked for. The client displays `response.method`, not its own
 * setting, so an override stays visible rather than silently mislabelling the run.
 *
 * leafcutter throws rather than falling back to edgeR: the two compute different quantities
 * (a Simes-adjusted exon-level p vs a Dirichlet-multinomial likelihood-ratio test), so
 * quietly substituting one would answer a different question than the one asked. */
export function pickDsEngine(method?: DiffSpliceMethod): { engine: 'edgeR'; label: DiffSpliceMethod } {
	if (method === 'leafcutter') throw new Error('the leafcutter engine is not yet available')
	if (method && method !== 'edgeR') throw new Error(`unknown differential splicing method '${method}'`)
	return { engine: 'edgeR', label: 'edgeR' }
}

/** Resolve the two sample groups + any confounder value arrays for differential splicing.
 * Wraps the shared `buildGroupValues` with DS-specific eligibility (samples present in the
 * cohort h5) and engineer-facing alert messages. */
export async function resolveDsSampleGroups(
	req: DiffSpliceRequest,
	allSampleSet: Set<string>,
	ds: any,
	term_results: any,
	term_results2: any
): Promise<SampleGroups> {
	if (req.samplelst?.groups?.length != 2) throw new Error('.samplelst.groups.length!=2')
	if (req.samplelst.groups[0].values?.length < 1) throw new Error('samplelst.groups[0].values.length<1')
	if (req.samplelst.groups[1].values?.length < 1) throw new Error('samplelst.groups[1].values.length<1')

	const g1 = await buildGroupValues(
		req.samplelst.groups[0].values,
		allSampleSet,
		ds,
		req.tw,
		req.tw2,
		term_results,
		term_results2
	)
	const g2 = await buildGroupValues(
		req.samplelst.groups[1].values,
		allSampleSet,
		ds,
		req.tw,
		req.tw2,
		term_results,
		term_results2
	)

	const alerts: string[] = []
	if (g1.names.length < 1) alerts.push('sample size of group1 < 1')
	if (g2.names.length < 1) alerts.push('sample size of group2 < 1')
	const commonnames = g1.names.filter(x => g2.names.includes(x))
	if (commonnames.length) alerts.push(`Common samples found between both groups: ${commonnames.join(', ')}`)

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

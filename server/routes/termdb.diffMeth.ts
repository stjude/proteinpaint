import type { DiffMethEntry, DiffMethFullResponse, DiffMethRequest } from '#types'
import { mayLog } from '#src/helpers.ts'
import { run_R } from '@sjcrh/proteinpaint-r'
import { formatElapsedTime } from '#shared'
import { renderVolcano } from '../src/renderVolcano.ts'
import { cacheOrRecompute } from '#src/utils/cacheOrRecompute.ts'
import {
	buildGroupValues,
	canonicalizeSamplelst,
	resolveDaContext,
	type SampleGroups
} from '#src/utils/sampleGroups.ts'
import type { DmCacheResult } from './types.ts'

/*
 * Cache flow (uniform across the four cacheOrRecompute consumers):
 *   init  →  xKeyInputs  →  getXCacheResult  →  cacheOrRecompute  →  runXFresh
 *   DM:    init → getDmCacheResult → runDmFresh
 *
 * Within this file the function order mirrors that flow:
 *   init → dmKeyInputs → getDmCacheResult → runDmFresh → helpers
 */

export function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query as DiffMethRequest

			if ((q as any).preAnalysis) {
				const { ds, term_results, term_results2 } = await resolveDaContext(q, genomes)
				const groups = await resolveDmSampleGroups(q, ds, term_results, term_results2)
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

			const { result, cacheId } = await getDmCacheResult(q, genomes)

			const rendered = await renderVolcano<DiffMethEntry>(result.promoterRows, q.volcanoRender)
			rendered.cacheId = cacheId

			// Empty dots is valid (strict thresholds) and the PNG should still
			// return; only abort if no rows reached the renderer at all.
			if (rendered.totalRows === 0)
				throw new Error('No promoters passed filtering. Try relaxing group criteria or selecting more samples.')

			const output: DiffMethFullResponse = {
				data: rendered,
				sample_size1: result.sample_size1,
				sample_size2: result.sample_size2
			}
			res.send(output)
		} catch (e: any) {
			res.status(e.status || 500).send({ status: 'error', error: e.message || e, code: e.code })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

/** Resolve which element matrix a request refers to.
 *
 * Single point of truth for the promoter/elements config shapes, used by the cache key,
 * the fresh run, and the sample-group resolver. They MUST agree: if the key and the run
 * disagree about which matrix was used, the cache silently serves the wrong element type's
 * results, which no error surfaces.
 *
 * Absent element_type means 'promoter'. A dataset with only the legacy `promoter` key
 * behaves exactly as before, and its cache entries stay valid because 'promoter' is also
 * what the key defaults to.
 */
export function resolveElementQuery(ds: any, elementType: string | undefined): { key: string; q: any } {
	const key = elementType ?? 'promoter'
	const dm = ds?.queries?.dnaMethylation
	if (!dm) throw new Error('This dataset does not have methylation data configured.')

	const q = dm.elements?.[key] ?? (key === 'promoter' ? dm.promoter : undefined)
	if (!q) {
		const available = [
			...Object.keys(dm.elements ?? {}),
			...(dm.promoter && !dm.elements?.promoter ? ['promoter'] : [])
		]
		throw new Error(
			available.length
				? `Unknown element type '${key}'. This dataset offers: ${available.join(', ')}.`
				: 'This dataset does not have element-level methylation data configured.'
		)
	}
	if (!q.file) throw new Error(`Methylation matrix file is not configured for element type '${key}'.`)
	return { key, q }
}

/** The element types this dataset can serve, with display labels, for a client picker. */
export function listElementTypes(ds: any): { key: string; label: string }[] {
	const dm = ds?.queries?.dnaMethylation
	if (!dm) return []
	const out: { key: string; label: string }[] = []
	for (const [key, e] of Object.entries<any>(dm.elements ?? {})) {
		if (e?.file) out.push({ key, label: e.label || key })
	}
	if (dm.promoter?.file && !dm.elements?.promoter) {
		out.unshift({ key: 'promoter', label: dm.promoter.label || 'Promoters' })
	}
	return out
}

/** The subset of a DiffMethRequest that determines the cache identity.
 * Passed to cacheOrRecompute as the computeArgument.
 * preAnalysis is also excluded because it short-circuits before any cache lookup happens. */
function dmKeyInputs(req: DiffMethRequest, imputeMissing: boolean) {
	return {
		genome: req.genome,
		dslabel: req.dslabel,
		/* Which element matrix was tested. Without this field a block request with the
		same sample groups as an earlier promoter request hashes to the same key and is
		served the promoter result — wrong rows, wrong coordinates, no error. Defaulting
		to 'promoter' rather than null keeps pre-existing cache entries valid on deploy. */
		element_type: req.element_type ?? 'promoter',
		/* Derived from ds config rather than sent by the client, but it still belongs in the
		key: flipping a dataset's platform changes every p-value, and without it the on-disk
		cache would keep serving results computed under the old missingness model. */
		impute_missing: imputeMissing,
		samplelst: canonicalizeSamplelst(req.samplelst),
		min_samples_per_group: req.min_samples_per_group ?? null,
		exclude_sex_chr: req.exclude_sex_chr ?? null,
		ebayes_trend: req.ebayes_trend ?? null,
		ebayes_robust: req.ebayes_robust ?? null,
		array_weights: req.array_weights ?? null,
		tw: req.tw ?? null,
		tw2: req.tw2 ?? null,
		/* Changes the design matrix and therefore every p-value, so it must be part of the
		cache identity. Defaulting to false keeps pre-existing entries valid on deploy. */
		pair_by_parent: req.pair_by_parent ?? false,
		filter: (req as any).filter ?? null,
		filter0: (req as any).filter0 ?? null
	}
}

/** Single read-or-recompute entry point for the DM cache. Used by the
 * route handler above and by genesetEnrichment.ts when projecting
 * gene_name + fold_change off a cached DM result. cacheOrRecompute's
 * pending map dedupes concurrent identical calls. */
export async function getDmCacheResult(
	req: DiffMethRequest,
	genomes: any
): Promise<{ result: DmCacheResult; cacheId: string }> {
	/* Cheap map lookup so the platform can reach the cache key without paying for
	resolveDaContext on a cache hit. Absent platform means 'array', keeping every existing
	dataset on the imputing path it was validated under. */
	const imputeMissing = genomes?.[req.genome]?.datasets?.[req.dslabel]?.queries?.dnaMethylation?.platform != 'wgbs'

	// ─── cache lookup or recompute ─── //
	const { result, cacheId } = await cacheOrRecompute<ReturnType<typeof dmKeyInputs>, DmCacheResult>({
		computeArgument: dmKeyInputs(req, imputeMissing),
		cacheSubdir: 'dm',
		computeFresh: async () => {
			const { ds, term_results, term_results2 } = await resolveDaContext(req, genomes)
			return runDmFresh(req, ds, term_results, term_results2, imputeMissing)
		}
	})
	return { result, cacheId }
}

type DiffMethInput = {
	case: string
	control: string
	input_file: string
	/* Restrict a mixed-class matrix to one element class, so several element types can be
	served from ONE h5 rather than one file each. That is what makes cCRE promoter-like (PLS)
	free to offer: its rows already sit in the all-cCRE matrix as element_class='promoter'.
	Comes from the ds config entry, never from the client — the client picks an element_type
	and the server decides which file and which class that means. diffMeth.R errors rather
	than returning an empty result when the value matches no rows. */
	element_class?: string
	min_samples_per_group?: number
	exclude_sex_chr?: boolean
	impute_missing?: boolean
	ebayes_trend?: boolean
	ebayes_robust?: boolean
	array_weights?: boolean
	conf1?: any[]
	conf1_mode?: 'continuous' | 'discrete'
	conf2?: any[]
	conf2_mode?: 'continuous' | 'discrete'
	/* One block label per sample, CASES FIRST then controls -- the order diffMeth.R
	requires, and the same order conf1/conf2 are assembled in below. */
	pair_id?: string[]
}

async function runDmFresh(
	param: DiffMethRequest,
	ds: any,
	term_results: any,
	term_results2: any,
	imputeMissing: boolean
): Promise<DmCacheResult> {
	const groups = await resolveDmSampleGroups(param, ds, term_results, term_results2)
	if (groups.alerts.length) throw new Error(groups.alerts.join(' | '))

	const { q } = resolveElementQuery(ds, param.element_type)

	const diffMethInput: DiffMethInput = {
		// Group 1 is control, group 2 is case (same convention as DE).
		case: groups.group2names.join(','),
		control: groups.group1names.join(','),
		input_file: q.file,
		// Omitted entirely when the entry does not set it, so an unfiltered request stays
		// byte-identical to what it was before this field existed.
		...(q.element_class ? { element_class: q.element_class } : {}),
		min_samples_per_group: param.min_samples_per_group,
		exclude_sex_chr: param.exclude_sex_chr,
		// ds-derived, not a user setting: see the platform field on queries.dnaMethylation
		impute_missing: imputeMissing,
		ebayes_trend: param.ebayes_trend,
		ebayes_robust: param.ebayes_robust,
		array_weights: param.array_weights
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

	if (param.pair_by_parent) {
		/* Block labels are a pure function of sample NAME, so they are derived here from the
		resolved group names rather than threaded through buildGroupValues alongside the
		confounders. Same case-then-control order as conf1/conf2 above, which is the order
		diffMeth.R documents for pair_id. */
		const toBlock = ds.sampleName2blockLabel
		if (typeof toBlock != 'function') {
			throw new Error('This dataset does not support paired analysis: no parent entity is defined for its samples.')
		}
		const names = [...groups.group2names, ...groups.group1names]
		const pair_id = names.map(n => toBlock(n))
		/* An unresolvable name would otherwise become "undefined", quietly forming one giant
		block that pools unrelated samples -- worse than refusing, and invisible in the output. */
		const unresolved = names.filter((_, i) => !pair_id[i])
		if (unresolved.length) {
			throw new Error(
				`Paired analysis: no parent entity found for ${unresolved.length} sample(s), e.g. ${unresolved
					.slice(0, 3)
					.join(', ')}.`
			)
		}
		/* diffMeth.R drops single-arm blocks, but if NO block spans both arms it stops with an
		error after the H5 read. Catching it here costs one Set and keeps the failure cheap and
		specific: the usual cause is two groups that hold different patients entirely. */
		const g2 = new Set(pair_id.slice(0, groups.group2names.length))
		if (!pair_id.slice(groups.group2names.length).some(b => g2.has(b))) {
			throw new Error(
				'Paired analysis: no parent entity has a sample in both groups, so there is nothing to compare within blocks.'
			)
		}
		diffMethInput.pair_id = pair_id
	}

	const time1 = Date.now()
	const result = JSON.parse(await run_R('diffMeth.R', JSON.stringify(diffMethInput)))
	mayLog('Time taken to run diffMeth:', formatElapsedTime(Date.now() - time1))

	/* Surface the arrayWeights result. The point of the option is to reveal whether one
	sample is dominating a group, which the weights answer and the promoter rows do not.
	Report PER GROUP: a whole-run min/max cannot answer that question, because a high weight
	is only alarming when it lands in the small arm. With few samples the residuals are taken
	around a mean estimated from those same few points, so that group's variance is
	underestimated, arrayWeights over-weights it, and significance inflates. Only present when
	the option ran. */
	if (Array.isArray(result.sample_weights) && result.sample_weights.length) {
		const ws = result.sample_weights as { sample: string; weight: number }[]
		const byName = new Map(ws.map(w => [w.sample, w.weight]))
		const summarize = (label: string, names: string[]) => {
			const vals = names.map(n => byName.get(n)).filter((v): v is number => Number.isFinite(v as number))
			if (!vals.length) return `${label}: no weights`
			const sorted = [...vals].sort((a, b) => a - b)
			const median = sorted[Math.floor(sorted.length / 2)]
			const head = `${label} (n=${sorted.length}): min=${sorted[0].toFixed(3)} median=${median.toFixed(3)} max=${sorted[
				sorted.length - 1
			].toFixed(3)}`
			/* Small groups get every weight printed. That is the whole diagnostic when a group
			is small enough for one sample to carry it, and it is a handful of numbers. */
			if (sorted.length <= 10) {
				return `${head} | all: ${names
					.filter(n => byName.has(n))
					.map(n => `${n}=${(byName.get(n) as number).toFixed(3)}`)
					.join(', ')}`
			}
			const low = names.filter(n => (byName.get(n) as number) < 0.5)
			return head + (low.length ? ` | ${low.length} under 0.5` : ' | none under 0.5')
		}
		/* Say when the estimate was subsampled. The weights are reported per sample either way,
		so without this a 10k-row estimate is indistinguishable from a full-matrix one. */
		if (result.array_weights_rows && result.array_weights_rows < result.array_weights_total) {
			mayLog(
				`diffMeth arrayWeights estimated on ${result.array_weights_rows.toLocaleString()} of ${result.array_weights_total.toLocaleString()} promoters (evenly spaced); the fit uses all of them`
			)
		}
		mayLog('diffMeth arrayWeights ' + summarize('group1/control', groups.group1names))
		mayLog('diffMeth arrayWeights ' + summarize('group2/case', groups.group2names))
	}

	const cacheResult: DmCacheResult = {
		promoterRows: result.promoter_data,
		sample_size1: groups.group1names.length,
		sample_size2: groups.group2names.length
	}
	return cacheResult
}

// ─── helpers ─── //

/** Resolve the two sample groups + any confounder value arrays for DM.
 * Wraps the shared `buildGroupValues` with DM-specific dataset query
 * lookup and user-facing alert messages (rendered directly in the
 * volcano UI, vs DE's engineer-facing strings). */
export async function resolveDmSampleGroups(
	param: DiffMethRequest,
	ds: any,
	term_results: any,
	term_results2: any
): Promise<SampleGroups> {
	if (param.samplelst?.groups?.length != 2)
		throw new Error('Exactly 2 sample groups are required for differential methylation analysis.')
	if (param.samplelst.groups[0].values?.length < 1)
		throw new Error('Group 1 has no samples. Please select at least one sample.')
	if (param.samplelst.groups[1].values?.length < 1)
		throw new Error('Group 2 has no samples. Please select at least one sample.')

	/* Same resolver the cache key and the fresh run use, so the sample set a group is
	built against always comes from the matrix that will actually be tested. Each element
	entry carries its own allSampleSet (built at startup in mds3.init.js), because the
	matrices need not hold identical sample sets. */
	const { q } = resolveElementQuery(ds, param.element_type)

	const g1 = await buildGroupValues(
		param.samplelst.groups[0].values,
		q.allSampleSet,
		ds,
		param.tw,
		param.tw2,
		term_results,
		term_results2
	)
	const g2 = await buildGroupValues(
		param.samplelst.groups[1].values,
		q.allSampleSet,
		ds,
		param.tw,
		param.tw2,
		term_results,
		term_results2
	)

	const alerts: string[] = []
	if (g1.names.length < 1) alerts.push('No samples in group 1 have methylation data available.')
	if (g2.names.length < 1) alerts.push('No samples in group 2 have methylation data available.')
	const commonnames = g1.names.filter(x => g2.names.includes(x))
	if (commonnames.length)
		alerts.push(
			`${commonnames.length} sample(s) appear in both groups: ${commonnames.join(', ')}. Please remove duplicates.`
		)

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

import type { DiffMethEntry, DiffMethFullResponse, DiffMethRequest, DmrScanSummary } from '#types'
import { DMR_SCAN_ELEMENT_TYPE } from '#types'
import { runDmrBatch } from '#src/routes/termdb.dmrBatch.ts'
import { dmrScanToRows, summarizeProfile, coarsenProfile } from '#src/utils/dmrScanRows.ts'
import { resolveGroupNames, matchedSamplelst, eligibleMethylationSamples } from '#src/utils/methylationMatrix.ts'
import { mayLog } from '#src/helpers.ts'
import { run_R } from '@sjcrh/proteinpaint-r'
import { formatElapsedTime } from '#shared'
import { renderVolcano } from '../src/renderVolcano.ts'
import { renderManhattanPoints } from '../src/renderManhattan.ts'
import { HYPER_COLOR, HYPO_COLOR } from '#shared/dmrColors.js'
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
				// the alert is a sibling of data{}, not a key in it: data{} is keyed by group name, and a
				// group named 'alert' would otherwise be indistinguishable from this message
				res.send({
					data: {
						[group1Name]: groups.group1names.length,
						[group2Name]: groups.group2names.length
					},
					...(groups.alerts.length ? { alert: groups.alerts.join(' | ') } : {})
				})
				return
			}

			const { result, cacheId } = await getDmCacheResult(q, genomes)

			const rendered = await renderVolcano<DiffMethEntry>(result.promoterRows, q.volcanoRender)
			rendered.cacheId = cacheId

			// Empty dots is valid (strict thresholds) and the PNG should still
			// return; only abort if no rows reached the renderer at all.
			if (rendered.totalRows === 0)
				throw new Error(
					result.scan
						? 'The scan called no DMRs that met the CpG floor.'
						: 'No promoters passed filtering. Try relaxing group criteria or selecting more samples.'
				)

			const output: DiffMethFullResponse = {
				data: rendered,
				sample_size1: result.sample_size1,
				sample_size2: result.sample_size2
			}
			if (result.scan) {
				output.scan = result.scan
				if (result.scan.binMethylation) {
					output.scan.profileSummary = summarizeProfile(result.scan.binMethylation)
					output.scan.profile = await renderMethylationProfile(
						result.scan,
						genomes[q.genome],
						q.volcanoRender?.devicePixelRatio,
						// display width only; the summary rows above stay on the native 100 kb bin
						q.scan?.profileBinBp
					)
					/* The bins themselves are not sent: ~30,000 rows the client would only re-derive
					the picture and the summary from, both of which are already in the response. */
					delete output.scan.binMethylation
				}
				output.scan.manhattan = await renderScanManhattan(
					result.promoterRows,
					genomes[q.genome],
					q.volcanoRender?.devicePixelRatio
				)
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
		tw: req.tw ?? null,
		tw2: req.tw2 ?? null,
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
	// a de novo scan is not a matrix of elements: it has its own cache (dmr/) and its own rows
	if (req.element_type === DMR_SCAN_ELEMENT_TYPE) return getDmrScanAsDm(req, genomes)
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

/* Which chromosomes a scan covers, from the request. Exported because anything ranking genes off
the same scan has to agree with it: GSEA ranked every gene in the genome while the volcano showed
one chromosome, and said the two matched.

chrM is left out -- 16.5 kb of circular DNA that is not CpG-island methylated cannot carry a domain
-- and chrY stays, because on a mixed-sex cohort an empty chrY is a result rather than an omission,
unless the sex chromosomes were excluded. */
export function scanChromosomes(req: DiffMethRequest, genome: any): string[] {
	let chromosomes: string[] = req.scan?.chromosome
		? [req.scan.chromosome]
		: (genome.majorchrorder as string[]).filter(c => c != 'chrM' && c != 'chrMT')
	if (req.exclude_sex_chr) chromosomes = chromosomes.filter(c => !/^chr[XY]$/i.test(c))
	if (!chromosomes.length) throw new Error('No chromosomes left to scan.')
	return chromosomes
}

/* A genome-wide DMR scan presented as differential methylation.

The scan (termdb/dmrBatch) already does the expensive part and caches it; this maps its DMRs onto
the rows the volcano renders -- delta-beta on x, DMRcate's smoothed FDR (or, corrected, the
empirical p against matched intergenic background) on y -- so the PNG, the p-value table, hover,
highlight, download and the region drill-down are the ones every other element class uses, and the
scan needs no UI of its own. Group sizes come from the same resolver the scan uses internally, so
the volcano's caption and the scan agree on who was compared. */
async function getDmrScanAsDm(req: DiffMethRequest, genomes: any): Promise<{ result: DmCacheResult; cacheId: string }> {
	if (req.tw || req.tw2) throw new Error('Confounding factors are not supported by the DMR scan.')
	const genome = genomes[req.genome]
	if (!genome) throw new Error('unknown genome')
	const ds = genome.datasets?.[req.dslabel]
	if (!ds) throw new Error('unknown dataset')
	const groups = req.samplelst?.groups
	if (groups?.length != 2)
		throw new Error('Exactly 2 sample groups are required for differential methylation analysis.')

	/* Every major chromosome except the mitochondrion: 16.5 kb of circular DNA that is not CpG-island
	methylated cannot carry a domain, and on a map scaled to chr1 its track is 0.06 px wide. chrY
	stays -- on a mixed-sex cohort an empty chrY track is a result rather than an omission -- unless
	the sex chromosomes were excluded, which applies here as it does to an element class. */
	const chromosomes = scanChromosomes(req, genome)

	const { payload, cacheId } = await runDmrBatch(
		{
			genome: req.genome,
			dslabel: req.dslabel,
			group1: groups[0].values,
			group2: groups[1].values,
			scanChromosomes: chromosomes,
			backgroundCorrection: !!req.scan?.backgroundCorrection,
			// the genome-wide profile: the metric the methylome literature compares cohorts with
			binMethylation: true
		},
		genomes
	)
	// the analysis-wide eligible set, not whichever one chromosomes[0] happened to resolve
	const eligible = eligibleMethylationSamples(ds, undefined)
	const { group1, group2 } = await resolveGroupNames(groups[0].values, groups[1].values, eligible, ds)
	const { rows, scan } = dmrScanToRows(payload, {
		chromosomes,
		minCpgs: req.scan?.minCpgs,
		backgroundCorrection: !!req.scan?.backgroundCorrection
	})
	scan.matchedSamplelst = await matchedSamplelst(req.samplelst, eligible, ds)
	scan.cacheId = cacheId
	return {
		result: { promoterRows: rows, sample_size1: group1.length, sample_size2: group2.length, scan },
		cacheId
	}
}

/** How many dots the client can hover and click in EACH direction, on both genome-wide figures:
 * DMRs ranked by evidence, profile bins by |Δβ|. Per direction rather than overall because hyper
 * carries the larger evidence on MMRF and would otherwise take every slot. Everything is in the
 * PNG; only these carry pixel coordinates. */
const SCAN_INTERACTIVE_PER_SIDE = 1000

/* Where the DMRs are, along the whole genome: hyper above the line, hypo below, height = evidence,
-log10 of the q the volcano plots (DMRcate's smoothed FDR, or corrected the empirical p against
matched background), capped as GRIN2 caps it so a few extreme regions do not flatten the rest.
Drawn from EVERY kept row rather than the volcano's capped dots, which would draw the wrong picture
of 120,000 regions. Fixed size rather than the volcano's, because this figure is read as a strip
under the volcano at whatever width the volcano has. */
async function renderScanManhattan(
	rows: DiffMethEntry[],
	genome: any,
	devicePixelRatio?: number
): Promise<NonNullable<DmrScanSummary['manhattan']>> {
	const chrSizes: Record<string, number> = {}
	for (const c of genome.majorchrorder as string[]) if (c != 'chrM' && c != 'chrMT') chrSizes[c] = genome.majorchr[c]
	const points = rows.map(r => {
		const p = r.original_p_value
		// a q of 0 is the most significant thing there is and is parked at the cap
		const mag = p > 0 ? -Math.log10(p) : Infinity
		return {
			chrom: r.chr,
			pos: r.start,
			y: r.delta_beta < 0 ? -mag : mag,
			color: r.delta_beta < 0 ? HYPO_COLOR : HYPER_COLOR,
			start: r.start,
			stop: r.stop,
			delta_beta: r.delta_beta,
			fold_change: r.fold_change,
			p,
			no_cpgs: r.no_cpgs,
			gene_name: r.gene_name,
			...(r.excess != null ? { excess: r.excess } : {})
		}
	})
	const plotWidth = 1000
	const plotHeight = 300
	const { png, plot_data } = await renderManhattanPoints({
		points,
		chrSizes,
		plotWidth,
		plotHeight,
		devicePixelRatio: devicePixelRatio || 1,
		pngDotRadius: 2,
		// the GRIN2 defaults: raise the cap only when more than 5 dots would sit on it
		maxCappedPoints: 5,
		hardCap: 200,
		binSize: 10,
		interactive: SCAN_INTERACTIVE_PER_SIDE,
		signed: true,
		// open circles, as the volcano above draws the same DMRs
		hollow: true
	})
	return { png, plotData: plot_data, interactive: SCAN_INTERACTIVE_PER_SIDE, plotWidth, plotHeight }
}

/* The genome-wide methylation profile: mean beta per group in 100 kb bins, drawn as the per-bin
difference along the genome. This is the metric the methylome literature uses for a genome-wide
comparison of two groups, and it answers the question a DMR list cannot: how much of the methylome
moved, and where, INCLUDING the parts where nothing was called. A DMR plot shows only the regions
that passed a threshold, so a genome that shifted everywhere by a little and a genome that shifted
nowhere both look like sparse dots; this shows the difference between them.

Every bin with a probe is a dot and the axis is uncapped, because a beta difference is bounded.
The largest per direction are interactive: a band of 29,000 dots says nothing on its own, and a
reader points at what stands out to ask what it is. */
function renderMethylationProfile(
	scan: DmrScanSummary,
	genome: any,
	devicePixelRatio?: number,
	profileBinBp?: number
): Promise<NonNullable<DmrScanSummary['profile']>> | undefined {
	if (!scan.binMethylation?.bins.length) return undefined
	// the reader's chosen display width, or the native one; see coarsenProfile
	const bm = coarsenProfile(scan.binMethylation, profileBinBp)
	const chrSizes: Record<string, number> = {}
	for (const c of genome.majorchrorder as string[]) if (c != 'chrM' && c != 'chrMT') chrSizes[c] = genome.majorchr[c]
	/* Only what the tooltip cannot derive: the bin's span is binBp from its pos, and with capping
	off the plotted y IS the difference. 2,000 interactive bins carry these, so a field that can be
	recomputed on the client is payload for nothing. */
	const points = bm.bins.map(b => {
		const d = b.case - b.control
		return {
			chrom: b.chr,
			pos: b.start,
			y: d,
			color: d < 0 ? HYPO_COLOR : HYPER_COLOR,
			control: b.control,
			case: b.case,
			n_probes: b.n_probes
		}
	})
	const plotWidth = 1000
	const plotHeight = 160
	// 1 px: at 100 kb there are ~30,000 bins, and a 2 px dot makes the genome one solid band
	const dotRadius = 1
	return renderManhattanPoints({
		points,
		chrSizes,
		plotWidth,
		plotHeight,
		devicePixelRatio: devicePixelRatio || 1,
		pngDotRadius: dotRadius,
		maxCappedPoints: 5,
		hardCap: 200,
		binSize: 10,
		/* The bins that moved most, each way. Ranking is |y| = |Δβ| here rather than evidence: on
		this figure the effect size IS the result, and the bins a reader wants to identify are the
		excursions away from the zero line. */
		interactive: SCAN_INTERACTIVE_PER_SIDE,
		signed: true,
		capping: false
	}).then(({ png, plot_data }) => ({
		png,
		plotData: plot_data,
		binBp: bm.binBp,
		plotWidth,
		plotHeight,
		dotRadius,
		bins: bm.bins.length,
		// what the top-N-per-side rule actually left live, which at a coarse width is every bin
		interactive: plot_data.points.length
	}))
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
	conf1?: any[]
	conf1_mode?: 'continuous' | 'discrete'
	conf2?: any[]
	conf2_mode?: 'continuous' | 'discrete'
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
		impute_missing: imputeMissing
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

	const time1 = Date.now()
	const result = JSON.parse(await run_R('diffMeth.R', JSON.stringify(diffMethInput)))
	mayLog('Time taken to run diffMeth:', formatElapsedTime(Date.now() - time1))

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
	/* Not resolveElementQuery: the pre-analysis call carries no element_type, and on a CpG-only
	dataset that resolved 'promoter' and threw -- so a dataset whose only offer IS the scan could
	never get past the sample counts the group picker shows. */
	const allSampleSet = eligibleMethylationSamples(ds, param.element_type)

	const g1 = await buildGroupValues(
		param.samplelst.groups[0].values,
		allSampleSet,
		ds,
		param.tw,
		param.tw2,
		term_results,
		term_results2
	)
	const g2 = await buildGroupValues(
		param.samplelst.groups[1].values,
		allSampleSet,
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

import type { DiffMethRequest } from '#types'
import { DEFAULT_MIN_CPGS, DMR_SCAN_ELEMENT_TYPE } from '#types'
import type { DmrScanYAxis } from '#types'
import type { ActionMenuItem } from '#dom'
import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'
import { elementNoun, formatPromoterLabel } from '../promoterLabel'
import { roundValueAuto } from '#shared/roundValue.js'
import type { TooltipRow, VolcanoHandler } from './types'
import { methylationLocusAction } from './shared'

/** DMRcate's own defaults (Peters 2015/2021), which the dmrcate binary also falls back to. The model
 * sends a knob only when it differs from these, so an untouched scan keeps its cache entry. */
export const DMRCATE_DEFAULTS = { lambda: 1000, C: 2, fdrCutoff: 0.05 }
/** Tooltip of the scan's background correction, shown by the volcano's control and by the
 * pre-analysis panel (mass/groups.js). */
export const BACKGROUND_CORRECTION_TITLE =
	'Score each DMR against intergenic regions of similar width and CpG density instead of against zero. The y axis then asks "did this region move more than comparable background did" rather than "did it move". The two questions agree unless methylation shifts across the whole genome between the groups; when it does, they can disagree, even on whether a region is hyper- or hypomethylated. DMRs with too little matched background to score are counted in Statistics but not plotted. The scan takes longer with this on.'

/** The scan's y-axis choices: DMRcate's region statistics, in the order the menu lists them, with what
 * each measures in plain words for the option's tooltip. Checked against DMRcate 3.6.0's dmrcate(): it
 * calls DMRs from the smoothed FDR and orders them by its minimum; Stouffer, HMFDR and Fisher are
 * computed from the region's raw per-CpG p-values, BH-adjusted across regions, and only reported. */
export const SCAN_Y_AXIS_OPTIONS: { value: DmrScanYAxis; label: string; title: string }[] = [
	{
		value: 'min_smoothed_fdr',
		label: 'Min smoothed FDR',
		title:
			"What DMRcate uses: it calls DMRs from the smoothed FDR and ranks them by this minimum. The strongest evidence at any point in the region, after each CpG's test is pooled with its neighbors'. Pooling makes it extremely small for strong regions, so many dots crowd the top of the plot."
	},
	{
		value: 'HMFDR',
		label: 'HMFDR',
		title:
			"Reported by DMRcate for every DMR, but not used to call or rank them. The harmonic mean of the separate tests of the region's CpGs, corrected for the number of regions: driven by the clearest CpGs, it does not grow just because a region is long, and stays valid when neighboring CpGs move together."
	},
	{
		value: 'Stouffer',
		label: 'Stouffer',
		title:
			"Reported by DMRcate for every DMR, but not used to call or rank them. Averages the evidence across all the region's CpGs, whichever direction each moved, corrected for the number of regions: it rewards regions where most CpGs differ rather than a few, and grows with the number of CpGs."
	},
	{
		value: 'Fisher',
		label: 'Fisher',
		title:
			'Reported by DMRcate for every DMR, but not used to call or rank them. Adds up the evidence of every CpG in the region, weighted toward the strongest, corrected for the number of regions: a few very clear CpGs can carry it, and since it treats neighboring CpGs as independent it reads strongest of the four.'
	}
]

/** Whether the volcano's x is Δβ, with deltaBetaCutoff as its cutoff: the methylation default, and always for a DMR
 * scan, whose counts, Manhattan and track use mean Δβ and its Min Δβ floor, whatever xAxis a saved config carries. */
export function onDeltaBetaAxis(termType: string, s: { xAxis?: string; elementType?: string }): boolean {
	return termType == tt.DNA_METHYLATION && (s.xAxis == 'delta_beta' || s.elementType == DMR_SCAN_ELEMENT_TYPE)
}

/** Whether the plot's current element class is the de novo DMR scan. Read from the live plot
 * config the controls are re-rendered with, not the config captured at construction, so the scan
 * knobs appear and disappear as the class picker changes. */
export const isScanPlot = (plot: any) => plot?.settings?.volcano?.elementType == DMR_SCAN_ELEMENT_TYPE

/** Differential methylation of the elements of one class, or a de novo DMR scan */
export const dnaMethylationHandler: VolcanoHandler = {
	termType: tt.DNA_METHYLATION,
	route: 'termdb/diffMeth',
	comparesGroups: true,

	getRequestBody(ctx) {
		const { app, config, settings } = ctx
		ctx.setOthersGroup(config.samplelst)
		const state = app.getState()
		const body = {
			kind: 'DM',
			genome: app.vocabApi.vocab.genome,
			dslabel: app.vocabApi.vocab.dslabel,
			samplelst: config.samplelst,
			filter: state.termfilter.filter,
			filter0: state.termfilter.filter0,
			min_samples_per_group: settings.minSamplesPerGroup,
			exclude_sex_chr: settings.excludeSexChr,
			/* Omitted rather than sent as 'promoter' when it is the default, so a request
			from a promoter-only dataset is byte-identical to what this client sent before
			the element picker existed. The server resolves an absent element_type to
			'promoter'. This does NOT preserve cache keys -- the key object gained the
			field server-side, so every pre-existing dm/ entry is orphaned on deploy
			regardless of what the client sends. */
			...(settings.elementType && settings.elementType != 'promoter' ? { element_type: settings.elementType } : {}),
			// the scan's own knobs; the server ignores them for any other element type
			...(settings.elementType == DMR_SCAN_ELEMENT_TYPE
				? {
						scan: {
							...(settings.scanChromosome ? { chromosome: settings.scanChromosome } : {}),
							backgroundCorrection: !!settings.backgroundCorrection,
							// display only: the rows are rebuilt from the cached scan on every request
							yAxis: settings.scanYAxis,
							minCpgs: settings.minCpgs,
							// display only, like yAxis: what the scan counts, not what it runs
							minDeltaBeta: settings.deltaBetaCutoff,
							profileBinBp: settings.profileBinBp,
							// only when changed: an explicit default would orphan every cached scan
							...(settings.lambda != DMRCATE_DEFAULTS.lambda ? { lambda: settings.lambda } : {}),
							...(settings.C != DMRCATE_DEFAULTS.C ? { C: settings.C } : {}),
							...(settings.fdrCutoff != DMRCATE_DEFAULTS.fdrCutoff ? { fdrCutoff: settings.fdrCutoff } : {})
						}
				  }
				: {}),
			volcanoRender: ctx.getVolcanoRender()
		} as Partial<DiffMethRequest>

		/* The scan fits no covariates and the server rejects a scan request carrying them. Confounders
		chosen under an element class stay in the config when the class switches to the scan, so they
		are left off here rather than failing every scan until the user finds and clears them. */
		if (settings.elementType != DMR_SCAN_ELEMENT_TYPE) ctx.addConfounderTw(body)

		return body
	},

	/* The delta-beta axis, when chosen or on a scan: fold_change here is a difference of M-values, a
	logit, so its magnitude does not say how much methylation changed. The cutoff sent must be in the
	units of the field sent -- otherwise the server draws threshold lines that do not correspond to
	what it classified. */
	getEffectAxis(settings) {
		if (!onDeltaBetaAxis(tt.DNA_METHYLATION, settings)) return { cutoff: settings.foldChangeCutoff }
		return {
			xField: 'delta_beta',
			cutoff: settings.deltaBetaCutoff,
			/* Not on a scan, whose control is hidden but whose setting survives a switch from an element
			class: the scan counts, Manhattan and track use raw Δβ, and a centered volcano would disagree. */
			centerX: !!settings.centerDeltaBeta && settings.elementType != DMR_SCAN_ELEMENT_TYPE
		}
	},

	/* Methylation rows are only promoters when the promoter class was tested. With an element class
	selected they are eQTM blocks or cCREs, and calling them promoters misreports what was analysed
	in the stats panel, the row count, and the p-value table header. Taken from the selected class
	rather than the server response so no extra field has to be plumbed through. */
	getRowNoun: settings => elementNoun(settings?.elementType).many,
	// a DMR is differentially methylated by definition, so "DM DMRs" would say it twice
	getSignificantNoun(settings, scan) {
		const noun = elementNoun(settings?.elementType).many
		return scan ? noun : `DM ${noun}`
	},
	directions: { up: 'hyper', down: 'hypo' },
	actions: ['confounders', 'highlight', 'statistics', 'pValueTable', 'geneBodyLoss', 'dmrGeneLink', 'starburst'],
	// the scan resolves its own two groups and fits no covariates
	getHiddenActions: ({ scan }) => (scan ? ['confounders'] : []),
	gsea: true,

	/* An element is known by its element id (promoter_id, named before the plot became
	element-generic), or a scan DMR by its region. Not by the displayed label, which
	formatPromoterLabel() shortens to the promoter index and the coordinate. */
	getRowKey: d => d.promoter_id || d.gene_name,
	/* This column header is what lands in the downloaded p-value table, so a block run exported a
	column titled "Promoter" holding block coordinates. */
	getIdColumns: settings => [
		{ label: elementNoun(settings?.elementType).one, value: d => formatPromoterLabel(d) },
		{ label: 'Gene(s)', value: d => d.gene_name || '' }
	],
	// a scan's effect size is delta-beta; the fold change is a difference of logits
	getTableEffectColumn: ({ scan }) => (scan ? { label: 'Δβ', value: d => roundValueAuto(d.delta_beta) } : undefined),
	getExtraColumns({ scan }) {
		/* A DMR is a called region, so what a row needs is its extent and its evidence -- the peak
		CpG's delta-beta, how many CpGs, how wide -- plus, corrected, how far it moved beyond its
		matched background. There are no two group means to show. */
		if (scan)
			return [
				// fold_change carries the peak per-CpG delta-beta on a scan row
				{ label: 'Peak Δβ', value: d => roundValueAuto(d.fold_change) },
				{ label: 'CpGs', value: d => d.no_cpgs },
				{ label: 'Width (bp)', value: d => d.stop - d.start },
				...(scan.backgroundCorrection
					? [{ label: 'Excess Δβ', value: d => (d.excess == null ? '' : roundValueAuto(d.excess)) }]
					: [])
			]
		/* Δβ sits next to log₂(fold-change) so the two effect sizes read as a pair: the fold-change is
		a logit difference and does not say how much methylation moved, Δβ does. The group means
		follow because a Δβ of 0.2 means something different at 0.1→0.3 than at 0.7→0.9. */
		return [
			{ label: 'Δβ', value: d => roundValueAuto(d.delta_beta) },
			{ label: 'Mean β (group 1)', value: d => roundValueAuto(d.mean_beta_control) },
			{ label: 'Mean β (group 2)', value: d => roundValueAuto(d.mean_beta_case) }
		]
	},
	getTooltipRows(d, run, shared) {
		const rows: TooltipRow[] = []
		if ('promoter_id' in d) rows.push([elementNoun(run.settings?.elementType).one, formatPromoterLabel(d)])
		if (d.gene_name) rows.push(['Gene(s)', d.gene_name])
		rows.push(shared.effect, ...shared.pValues)
		// a scan DMR's call statistic, beside the one it is plotted by when that is another
		const sfdr = d.min_smoothed_fdr
		if (sfdr != null && (run.scan?.yAxis ?? 'min_smoothed_fdr') != 'min_smoothed_fdr')
			rows.push(['Min smoothed FDR', roundValueAuto(sfdr)])
		return rows
	},

	addDefaultSettings(defaults, opts) {
		defaults.minSamplesPerGroup = 3
		// Off by default so existing analyses are unchanged and chrX remains usable as a
		// positive control. Recommended on for mixed-sex cohorts -- see the checkbox title.
		defaults.excludeSexChr = false
		/* Off by default: the raw count is the one that answers "how many elements gained
	methylation", and centring silently would subtract a global shift that may well BE the
	biology. It is a second reading to switch to, not a better default. */
		defaults.centerDeltaBeta = false
		/* Starting element class comes from the dataset when it names one, otherwise 'promoter'.
	The server resolves an absent or 'promoter' element_type to the legacy single-matrix config,
	so the fallback reproduces existing behaviour exactly for datasets declaring no elements map.
	A dataset offering several classes can lead with the one it prefers -- MMRF starts on the
	ENCODE cCRE promoter-like elements rather than the wider TSS windows. */
		defaults.elementType = opts?.app?.vocabApi?.termdbConfig?.queries?.dnaMethylation?.defaultElementType || 'promoter'
		/* Differential methylation always plots delta-beta. log2 fold change is a difference of
	M-values -- correct to test on, but a logit, so its magnitude says nothing about how much
	methylation changed, which is the only thing a reader wants from a methylation result. The
	axis is fixed rather than offered as a choice, and the log2 cutoff control is hidden for this
	term type, so a DM run cannot be thresholded in units it does not display. */
		defaults.xAxis = 'delta_beta'
		/* 0.1 = a 10-percentage-point change in methylation, the conventional biological-significance
	floor for a DMR, and roughly where this cohort's hits start being interpretable. Deliberately
	not 0.3: that is the log2FC default and would be a 30-point shift here, which almost nothing
	clears. */
		defaults.deltaBetaCutoff = 0.1
		/* DMR scan. Whole genome by default: a scan of one chromosome answers "what happened here", the
	whole genome "where did anything happen", which is the question the mode exists for, and the run
	DMRcate's genome-wide prior and corrections are made for. Correction off because it changes what the numbers
	MEAN (a region that moved vs one that moved more than its matched background drifts) -- under a
	genome-wide shift the direction can invert -- so it is a second reading to switch to. The CpG floor is
	DEFAULT_MIN_CPGS, shared with the server fallback so both mean the same untouched scan. */
		defaults.scanChromosome = ''
		defaults.backgroundCorrection = false
		// what the scan plotted before the choice existed
		defaults.scanYAxis = 'min_smoothed_fdr'
		defaults.minCpgs = DEFAULT_MIN_CPGS
		defaults.lambda = DMRCATE_DEFAULTS.lambda
		defaults.C = DMRCATE_DEFAULTS.C
		defaults.fdrCutoff = DMRCATE_DEFAULTS.fdrCutoff
		/* The native width, so the figure opens as the metric is defined (Zhou 2018, 100 kb bins) and a
	coarser view is something the reader asks for. */
		defaults.profileBinBp = 100_000
	},
	validateSettings(settings) {
		const min = settings.minSamplesPerGroup
		if (!Number.isFinite(min) || !Number.isInteger(min) || min < 3) {
			settings.minSamplesPerGroup = 3
		}
		/* A saved session or hand-edited URL can carry an elementType the current dataset no
	longer offers -- a class renamed, or a matrix retired. Falling back to 'promoter'
	means the plot loads with the default class rather than erroring out of the route,
	and the picker then shows what is actually available. */
		if (typeof settings.elementType != 'string' || !settings.elementType) {
			settings.elementType = 'promoter'
		}
	},
	getControlInputs({ elementTypes, chromosomes }) {
		const scanOnly = (plot: any) => (isScanPlot(plot) ? '' : 'none')
		const notScan = (plot: any) => (isScanPlot(plot) ? 'none' : '')
		const dmInputs: any[] = [
			/* Element class comes FIRST because it is categorically different from the
		controls below it: those tune how the test is run, this one changes what is
		being tested. Promoters, eQTM blocks, and cCRE classes are different genomic
		features with different coordinates and different test counts, so switching
		produces a different analysis rather than a refined one.

		Hidden unless the dataset offers a genuine choice -- a single class means
		there is nothing to pick, and a dataset using the legacy promoter-only config
		gets no new UI at all. */
			...(elementTypes.length > 1
				? [
						{
							label: 'Element class',
							type: 'dropdown',
							chartType: 'volcano',
							settingsKey: 'elementType',
							options: elementTypes.map(e => ({ value: e.key, label: e.label })),
							title:
								'Which regulatory elements to test. This changes the features being analysed, not just the thresholds: promoters are TSS windows (-1500/+500 bp, the 450K array definition), cCRE promoters are the ~349 bp ENCODE promoter-like elements (the CpG-island core, no shores), eQTM blocks are runs of CpGs whose methylation correlates with a gene, and the other cCRE classes are ENCODE enhancer and CTCF annotations. Hit counts are not comparable across classes because the number of tests and the genes covered both differ. Narrow elements recover focal signal that a wide window averages away; wide windows do better on broad marks.'
						}
				  ]
				: []),
			/* The scan's own knobs, shown only while the scan is the selected class. The chromosome
		picker is a plain dropdown rather than the region search box: string2pos() turns a bare
		"chr20" into a 20kb window at the chromosome midpoint, which would silently scan 0.005% of
		the target. chrM is left out -- 16.5 kb of circular DNA that cannot carry a domain. */
			{
				label: 'Scan',
				type: 'dropdown',
				chartType: 'volcano',
				settingsKey: 'scanChromosome',
				getDisplayStyle: scanOnly,
				options: [
					{ value: '', label: 'Whole genome' },
					...chromosomes.filter(c => c != 'chrM' && c != 'chrMT').map(c => ({ value: c, label: c }))
				],
				title:
					'Show the DMRs called de novo across the whole genome, or only those on one chromosome. DMRs are always called over the whole genome, because DMRcate calibrates its cutoff over every CpG tested: one chromosome run alone calls different DMRs. The first scan of a comparison can take a minute or more on a large cohort, longer with the background drift correction; it is cached, so switching chromosomes after that is quick.'
			},
			{
				label: 'Correct for background drift',
				type: 'checkbox',
				chartType: 'volcano',
				settingsKey: 'backgroundCorrection',
				boxLabel: '',
				getDisplayStyle: scanOnly,
				title: BACKGROUND_CORRECTION_TITLE
			},
			{
				label: 'Y axis',
				type: 'radio',
				chartType: 'volcano',
				settingsKey: 'scanYAxis',
				title:
					'Which region statistic the volcano and the DMR plot put on the y axis. DMRcate calls DMRs with the min smoothed FDR; it reports the other three for each DMR. Hover over an option for what it measures.',
				// the background correction plots its own p, so there is nothing to choose then
				getDisplayStyle: (plot: any) => (isScanPlot(plot) && !plot.settings.volcano.backgroundCorrection ? '' : 'none'),
				options: SCAN_Y_AXIS_OPTIONS
			},
			{
				label: 'Min CpGs per DMR',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'minCpgs',
				getDisplayStyle: scanOnly,
				min: 1,
				max: 1000,
				title:
					'Drop DMRs called from fewer CpGs. DMRs of only two or three CpGs tend to carry the largest effect sizes but the least reliable direction, so a Δβ-sorted table would lead with the rows that mean least. Applied to the cached scan, so changing it redraws rather than refits.'
			},
			/* DMRcate's region-shape knobs. Unlike the CpG floor these change the fit's output, so each
		one refits the scan (and gets its own cache entry). */
			{
				label: 'DMR bandwidth λ (bp)',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'lambda',
				getDisplayStyle: scanOnly,
				min: 50,
				max: 100_000,
				step: 50,
				title:
					'DMRcate lambda. Two things at once: the width of the Gaussian kernel that smooths per-CpG statistics along the genome, and the largest gap allowed between significant CpGs chained into one DMR. Larger values merge nearby signal into fewer, wider DMRs and recover broad domains; smaller values split them into narrow, focal regions. DMRcate recommends 1000 bp for CpG-resolution data. Changing it refits the scan.'
			},
			{
				label: 'DMR kernel scaling C',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'C',
				getDisplayStyle: scanOnly,
				min: 0.5,
				max: 50,
				step: 0.5,
				title:
					'DMRcate C: the kernel standard deviation is lambda / C. A larger C gives a narrower kernel, so each CpG borrows evidence from fewer neighbours: sharper boundaries and more, smaller DMRs, at the cost of power in sparse regions. A smaller C smooths further. DMRcate recommends 2. Changing it refits the scan.'
			},
			{
				label: 'Per-CpG FDR cutoff',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'fdrCutoff',
				getDisplayStyle: scanOnly,
				min: 0.0001,
				max: 0.5,
				step: 0.01,
				title:
					"The FDR a CpG's smoothed statistic must pass to take part in a DMR. Raising it lets weaker CpGs join, which extends DMRs and bridges gaps between them; lowering it keeps only the strongest CpGs, giving shorter, fewer DMRs. DMRcate's default is 0.05. This is not the volcano's significance threshold, which is applied afterwards to each DMR. Changing it refits the scan."
			},
			{
				/* Display width for the methylome-wide profile only. The metric is the 100 kb bin and
			the Statistics rows stay on it whatever this says -- this is here because 29,000 dots
			over 1,000 px overlap however small the dot, so the native figure reads as a band. */
				label: 'Profile bin width',
				type: 'dropdown',
				chartType: 'volcano',
				settingsKey: 'profileBinBp',
				getDisplayStyle: scanOnly,
				options: [
					{ value: 100_000, label: '100 Kb (native)' },
					{ value: 500_000, label: '500 Kb' },
					{ value: 1_000_000, label: '1 Mb' },
					{ value: 5_000_000, label: '5 Mb' }
				],
				// a <select> hands back its value as a string; the setting is a width in bp
				processInput: (v: string) => Number(v),
				title:
					'How wide a bin the methylome-wide profile draws. 100 kb is the width the metric is computed and reported at (Zhou 2018); the coarser widths average neighbouring bins into one dot, weighted by the CpGs each rests on, so a genome-wide shift is legible instead of hidden in a band of overlapping dots. Display only: the Statistics rows and the fraction-of-bins-moved figures stay on the 100 kb bins, and changing this redraws the cached scan rather than refitting it. The most extreme 1,000 bins per direction stay hoverable at any width.'
			},
			{
				label: 'Min samples per group',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'minSamplesPerGroup',
				title: 'Minimum non-NA samples required per group for a promoter to be tested',
				// the scan resolves its own groups (3+ per group, fixed) and has no per-element NA filter
				getDisplayStyle: notScan,
				min: 1,
				max: 100
			},
			{
				label: 'Exclude sex chromosomes',
				type: 'checkbox',
				chartType: 'volcano',
				settingsKey: 'excludeSexChr',
				boxLabel: '',
				// the scan honours it too: scanChromosomes() drops chrX/chrY from a whole-genome scan
				title:
					'Drop chrX and chrY (promoters, elements, or whole chromosomes from a DMR scan). Recommended for mixed-sex cohorts — X-inactivation makes chrX methylation strongly sex-dependent, so a sex-imbalanced comparison reports sex rather than the grouping variable. On a scan this also shifts the autosomal DMRs slightly, since the DMRcate prior and its multiple-testing corrections are genome-wide; gene links and gene set enrichment lose the X-linked genes.'
			},
			{
				label: 'Center Δβ on median',
				type: 'checkbox',
				chartType: 'volcano',
				settingsKey: 'centerDeltaBeta',
				boxLabel: '',
				// the background correction is the scan's version of this question
				getDisplayStyle: notScan,
				title:
					'Move the Δβ origin to the median across all tested elements, so 0 is the typical element rather than no change. Use it to ask "which elements moved MORE than the typical one" — at a symmetric cutoff, a contrast whose whole distribution sits off zero clears the hyper threshold more easily than the hypo one, which skews the hyper:hypo ratio on its own. Leave it off to ask "which elements gained or lost methylation", since a genuine genome-wide shift is itself a result and centering would subtract it. The Δβ values in the table and its download are unaffected either way.'
			},
			{
				label: 'Min Δβ',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'deltaBetaCutoff',
				title:
					'Effect-size cutoff for differential methylation, applied to Δβ. 0.1 is a 10-percentage-point change in methylation, the conventional floor for calling a region differentially methylated. Kept separate from the log₂ cutoff because the two are not interchangeable.',
				min: 0,
				max: 1,
				step: 0.01
			}
		]
		return dmInputs
	},
	/* a DM run plots and thresholds on delta-beta, so a log2 cutoff would set a limit in units the
	plot never shows */
	leavesOutControls: ['foldChangeCutoff'],
	// a methylation analysis counts the time in its message, so a long wait is seen to be still running
	showsElapsedTime: true,

	getRowActions(d, ctx) {
		const { interactions, scan } = ctx
		const actions: ActionMenuItem[] = [
			{ label: 'Violin plot', onClick: async () => interactions.launchDNAMethViolin(d) },
			{
				/* A scan has already called every DMR: the browser shows them from the cache, beside
				the genes and cCREs, with no per-CpG detail; the region view below adds that detail. An
				element-class hit (promoter, cCRE) opens on the genes and cCREs around it. */
				label: 'Genome browser',
				onClick: async () => interactions.launchMethylationGenomeBrowser(d, scan)
			}
		]
		/* The region view on a scan's DMR only. An element-class hit (promoter, cCRE) comes from a
		per-element test; the region view draws DMRcate's de novo calls, which need not agree with it,
		and showing one under the other mixes two analyses. The violin and the browser above serve
		elements. */
		if (scan)
			actions.push({
				label: 'Differentially Methylated Region (DMR) Analysis',
				onClick: async () => interactions.launchDmr({ chr: d.chr, start: d.start, stop: d.stop }, scan)
			})
		const locus = methylationLocusAction(d.gene_name, ctx)
		actions.push(...locus)
		/* a methylation hit that names no gene, or any on a dataset without expression: the same track on
		its region, without expression */
		const q = ctx.queries
		if (!locus.length && Number.isFinite(d.start) && q?.dnaMethylation?.regionAnalysis == 'cpg')
			actions.push({
				label: `Methylation at ${d.chr}:${d.start}-${d.stop}`,
				onClick: async () =>
					interactions.launchMethylationLocus({ chr: d.chr, start: d.start, stop: d.stop }, scan?.bedjFile)
			})
		return actions
	},

	getProvenance(s, response, scan) {
		const parts: string[] = []
		/* Recorded FIRST because it is the only setting that changes what was tested rather
		than how: promoters, cCRE promoters, eQTM blocks and the full cCRE set are different
		features with different coordinates and wildly different test counts, so two exports
		are not comparable without it. Everything else here was already recorded; this was
		the one missing field, which made a saved p-value table impossible to attribute to a
		matrix after the fact. */
		parts.push(`element class: ${s.elementType || 'promoter'}`)
		// Which effect size the run was thresholded on. Two exports with the same p cutoff but
		// different axes are not comparable, and nothing else in the line would reveal it.
		parts.push(`x axis: ${onDeltaBetaAxis(tt.DNA_METHYLATION, s) ? 'delta-beta' : 'log2(fold-change)'}`)
		/* Which reading the counts came from. Two runs of the same contrast give different
		hyper:hypo ratios depending on this one flag, so a file without it cannot be told
		apart from the other run. Records the offset too, since it is a result in itself. */
		const off = response.data.xOffset ?? 0
		if (response.data.centered) parts.push(`centered on median delta-beta ${off > 0 ? '+' : ''}${roundValueAuto(off)}`)
		if (scan) {
			// what was scanned and how the DMRs were selected, since the scan has no element matrix to name
			parts.push(`scan: ${s.scanChromosome || 'whole genome'}`)
			parts.push(`background correction: ${s.backgroundCorrection ? 'yes' : 'no'}`)
			parts.push(`min CpGs per DMR: ${s.minCpgs}`)
		} else parts.push(`min samples per group: ${s.minSamplesPerGroup}`)
		parts.push(`exclude sex chromosomes: ${s.excludeSexChr ? 'yes' : 'no'}`)
		return parts
	},

	preAnalysis: {
		/* which elements to test, so that the first run is the wanted one. The counts of the panel are
		for one class, as each element matrix has its own eligible samples */
		getElementClasses(termdbConfig) {
			const dm = termdbConfig?.queries?.dnaMethylation
			return { elementTypes: dm?.elementTypes || [], defaultElementType: dm?.defaultElementType }
		}
	}
}

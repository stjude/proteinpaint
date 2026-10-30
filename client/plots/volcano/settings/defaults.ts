import { roundValue } from '#shared/roundValue.js'
// the sample limits of a run, shared with the server, which enforces them
import { maxSampleCutoff, sampleLimitAlert } from '#shared'
import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'
import { DEFAULT_MIN_CPGS } from '#types'
import type { DmrScanYAxis } from '#types'
import type {
	ValidatedVolcanoSettings,
	GEVolcanoSettings,
	DMVolcanoSettings,
	DSVolcanoSettings,
	DefaultVolcanoSettings
} from '../settings/Settings'

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
			"Reported by DMRcate for every DMR, but not used to call or rank them. Averages the evidence across all the region's CpGs, corrected for the number of regions: it rewards regions where most CpGs moved the same way, and grows with the number of CpGs."
	},
	{
		value: 'Fisher',
		label: 'Fisher',
		title:
			'Reported by DMRcate for every DMR, but not used to call or rank them. Adds up the evidence of every CpG in the region, weighted toward the strongest, corrected for the number of regions: a few very clear CpGs can carry it, and since it treats neighboring CpGs as independent it reads strongest of the four.'
	}
]

/*********** Set default settings per termType ***********/
export function getDefaultVolcanoSettings(overrides = {}, opts: any): ValidatedVolcanoSettings {
	const defaults = {
		defaultSignColor: 'red',
		defaultNonSignColor: 'black',
		defaultHighlightColor: '#ffa200', // orange-yellow
		foldChangeCutoff: 0.3,
		height: 400,
		pValue: roundValue(-Math.log10(0.05), 2),
		pValueType: 'adjusted',
		showPValueTable: false,
		width: 400,
		maxInteractiveDots: 5000,
		maxTooltipGenes: 5
	} satisfies DefaultVolcanoSettings

	addGEDefaults(opts.termType, defaults)
	addDMDefaults(opts.termType, defaults, opts)
	addDSDefaults(opts.termType, defaults)

	return Object.assign(defaults, overrides)
}

function addGEDefaults(termType: string, defaults: Partial<GEVolcanoSettings>) {
	if (termType != tt.GENE_EXPRESSION) return

	const features = JSON.parse(sessionStorage.getItem('optionalFeatures') as string)
	const method = features?.runDE_methods?.includes('Wilcoxon') ? 'wilcoxon' : 'edgeR'

	defaults.cpmCutoff = 1
	defaults.method = method
	defaults.minCount = 10
	defaults.minTotalCount = 15
	defaults.rankBy = 'abs(foldChange)'
}

function addDMDefaults(termType: string, defaults: Partial<DMVolcanoSettings>, opts?: any) {
	if (termType != tt.DNA_METHYLATION) return
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
}

function addDSDefaults(termType: string, defaults: Partial<DSVolcanoSettings>) {
	if (termType != tt.JUNCTION) return
	defaults.method = 'edgeR'
	defaults.minSamplesPerIntron = 5
	defaults.minSamplesPerGroup = 3
	defaults.minCountsPerCluster = 20
	/* 0.05 = a 5-point PSI shift. */
	defaults.deltaPsiCutoff = 0.05
}

/*********** Setting Validation Functions ***********
 * Validates user input settings after merging with defaults */
const typesUseDefaultSettings = new Set([tt.SINGLECELL_CELLTYPE, tt.PROTEOME_DAP, tt.SINGLECELL_GENE_EXPRESSION])
export function validateVolcanoSettings(config: any, opts: any) {
	if (typesUseDefaultSettings.has(config.termType)) return
	if (!config.settings.volcano) return

	const settings = config.settings.volcano
	const sampleNum = getSampleNum(opts)
	const limitAlert = sampleLimitAlert(sampleNum)
	if (limitAlert) throw new Error(limitAlert)

	validateDMSettings(config.termType, settings)
	validateDSSettings(config.termType, settings, opts)
}

/* Read groups from opts; config.samplelst is populated only after copyMerge().
Apply caps to eligible counts rather than raw groups, and enforce them in 
preAnalysis and at run time. */
function validateDSSettings(termType: string, settings: DSVolcanoSettings | undefined, opts: any) {
	if (termType != tt.JUNCTION || !settings) return
	const groups = opts.samplelst?.groups || []

	/* Leafcutter’s -i/-g thresholds are absolute sample counts, so their effective stringency decreases 
	as cohort size grows. Scale the defaults as a floor plus a fraction of N to keep filtering comparable 
	across cohort sizes. These are defaults only: opts.overrides takes precedence, followed by saved settings 
	via copyMerge(config, opts) */
	/* The Run button in groups.js scales from the eligible pre-analysis counts
	instead and passes the result in settings, which copyMerge lays over these values. */
	const sampleNum = groups.reduce((sum: number, g: any) => sum + (g.values?.length ?? g.sampleCount ?? 0), 0)
	if (sampleNum > 0) {
		const scaled = scaleDsFilters(sampleNum)
		if (opts.overrides?.minSamplesPerIntron == undefined) settings.minSamplesPerIntron = scaled.minSamplesPerIntron
		if (opts.overrides?.minSamplesPerGroup == undefined) settings.minSamplesPerGroup = scaled.minSamplesPerGroup
	}
}

/** Default sample thresholds for n samples: max(5, 2% of n) per intron and max(3, 1% of n)
 * per group. n should be the number of samples with splicing data; a larger raw count can
 * push the thresholds above the group sizes and drop every cluster. */
export function scaleDsFilters(n: number): { minSamplesPerIntron: number; minSamplesPerGroup: number } {
	return {
		minSamplesPerIntron: Math.max(5, Math.round(n * 0.02)),
		minSamplesPerGroup: Math.max(3, Math.round(n * 0.01))
	}
}

export function getSampleNum(config: any) {
	if (
		config.termType == tt.GENE_EXPRESSION ||
		config.termType == tt.DNA_METHYLATION ||
		config.termType == tt.JUNCTION
	) {
		// a group defined by a filter lists no sample, and carries the number that its filter selected
		return config.samplelst.groups.reduce((sum: number, g: any) => sum + (g.values?.length ?? g.sampleCount ?? 0), 0)
	} else {
		return maxSampleCutoff
	}
}

function validateDMSettings(termType: string, settings?: DMVolcanoSettings) {
	if (termType != tt.DNA_METHYLATION || !settings) return
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
}

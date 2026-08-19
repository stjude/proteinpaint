import { roundValue } from '#shared/roundValue.js'
import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'
import type {
	ValidatedVolcanoSettings,
	GEVolcanoSettings,
	DMVolcanoSettings,
	DefaultVolcanoSettings
} from '../settings/Settings'

// The max sample cutoff for volcano rendering
export const maxSampleCutoff = 4000
// The max sample cutoff for gene expression term type
export const maxGESampleCutoff = 3000

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
		//Only declare this value in one place
		sampleNumCutoff: opts.termType == tt.GENE_EXPRESSION ? maxGESampleCutoff : maxSampleCutoff,
		showPValueTable: false,
		width: 400,
		maxInteractiveDots: 5000,
		maxTooltipGenes: 5
	} satisfies DefaultVolcanoSettings

	addGEDefaults(opts.termType, defaults)
	addDMDefaults(opts.termType, defaults, opts)

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
	// Also off by default: both change every p-value, so turning either on silently
	// would invalidate previously reported methylation results.
	defaults.eBayesTrend = false
	defaults.eBayesRobust = false
	// Off by default like the other two, and additionally because it is the slowest of the
	// three -- arrayWeights runs an iterative REML fit over the whole matrix.
	defaults.arrayWeights = false
	/* Starting element class comes from the dataset when it names one, otherwise 'promoter'.
	The server resolves an absent or 'promoter' element_type to the legacy single-matrix config,
	so the fallback reproduces existing behaviour exactly for datasets declaring no elements map.
	A dataset offering several classes can lead with the one it prefers -- MMRF starts on the
	ENCODE cCRE promoter-like elements rather than the wider TSS windows. */
	defaults.elementType = opts?.app?.vocabApi?.termdbConfig?.queries?.dnaMethylation?.defaultElementType || 'promoter'
	// Off by default: pairing changes the design matrix, and on a cohort whose two groups
	// hold different patients it removes every sample rather than adding power.
	defaults.pairByParent = false
	// M-value fold change stays the default axis: it is what the model tests on, so the plot
	// matches the statistics unless the user asks otherwise.
	defaults.xAxis = 'fold_change'
	/* 0.1 = a 10-percentage-point change in methylation, the conventional biological-significance
	floor for a DMR, and roughly where this cohort's hits start being interpretable. Deliberately
	not 0.3: that is the log2FC default and would be a 30-point shift here, which almost nothing
	clears. */
	defaults.deltaBetaCutoff = 0.1
}

/*********** Setting Validation Functions ***********
 * Validates user input settings after merging with defaults */
const typesUseDefaultSettings = new Set([tt.SINGLECELL_CELLTYPE, tt.PROTEOME_DAP, tt.SINGLECELL_GENE_EXPRESSION])
export function validateVolcanoSettings(config: any, opts: any) {
	if (typesUseDefaultSettings.has(config.termType)) return
	if (!config.settings.volcano) return

	const settings = config.settings.volcano
	const sampleNum = getSampleNum(opts)
	if (sampleNum > maxSampleCutoff) {
		throw new Error(
			`Sample size ${sampleNum} exceeds max sample size of ${maxSampleCutoff}. Please reduce sample size.`
		)
	}

	validateGESettings(config.termType, settings, sampleNum, opts)
	validateDMSettings(config.termType, settings)
}

export function getSampleNum(config: any) {
	if (config.termType == tt.GENE_EXPRESSION || config.termType == tt.DNA_METHYLATION) {
		return config.samplelst.groups.reduce((sum: number, g: any) => sum + g.values.length, 0)
	} else {
		return maxSampleCutoff
	}
}

function validateGESettings(termType: string, settings: GEVolcanoSettings, sampleNum: number, opts: any) {
	if (termType != tt.GENE_EXPRESSION) return

	const largeNum = sampleNum > settings.sampleNumCutoff
	if (!opts.overrides && largeNum) {
		settings.method = 'wilcoxon'
	} else if (largeNum && settings.method != 'wilcoxon') {
		throw new Error(
			`${settings.method} is not supported for ${sampleNum} samples when termtype = ${termType}. Please use Wilcoxon.`
		)
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

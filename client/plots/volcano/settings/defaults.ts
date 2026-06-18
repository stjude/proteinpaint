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
	addDMDefaults(opts.termType, defaults)
	addScctDefaults(opts.termType)
	addScgeDefaults(opts.termType)

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

function addDMDefaults(termType: string, defaults: Partial<DMVolcanoSettings>) {
	if (termType != tt.DNA_METHYLATION) return
	defaults.minSamplesPerGroup = 3
}

function addScctDefaults(termType: string) {
	if (termType != tt.SINGLECELL_CELLTYPE) return
	//add SCCT specific defaults when there are any
}

function addScgeDefaults(termType: string) {
	if (termType != tt.SINGLECELL_GENE_EXPRESSION) return
	//add SCGE specific defaults when there are any
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
	validateSCCTSettings(config.termType)
}

export function getSampleNum(config: any) {
	if (config.termType == tt.GENE_EXPRESSION || config.termType == tt.DNA_METHYLATION) {
		return config.samplelst.groups.reduce((sum: number, g: any) => sum + g.values.length, 0)
	}
	if (config.termType == tt.SINGLECELL_CELLTYPE) {
		//Only returning maxSampleCutoff for now.
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
}

function validateSCCTSettings(termType: string) {
	if (termType != tt.SINGLECELL_CELLTYPE) return
	//add validations when there are settings for SCCT
}

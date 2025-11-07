import { roundValue } from '#shared/roundValue.js'
import { TermTypes } from '#shared/terms.js'
import type { ValidatedVolcanoSettings, GEVolcanoSettings, DefaultVolcanoSettings } from '../settings/Settings'

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
		foldChangeCutoff: 0,
		height: 400,
		pValue: roundValue(-Math.log10(0.05), 2),
		pValueType: 'adjusted',
		//Only declare this value in one place
		sampleNumCutoff: opts.termType == TermTypes.GENE_EXPRESSION ? maxGESampleCutoff : maxSampleCutoff,
		width: 400
	} satisfies DefaultVolcanoSettings

	addGEDefaults(opts.termType, defaults)
	addSCCTDefaults(opts.termType)

	return Object.assign(defaults, overrides)
}

function addGEDefaults(termType: string, defaults: Partial<GEVolcanoSettings>) {
	if (termType != TermTypes.GENE_EXPRESSION) return

	const features = JSON.parse(sessionStorage.getItem('optionalFeatures') as string)
	const method = features?.runDE_methods?.includes('Wilcoxon') ? 'wilcoxon' : 'edgeR'

	defaults.cpmCutoff = 1
	defaults.method = method
	defaults.minCount = 10
	defaults.minTotalCount = 15
	defaults.rankBy = 'abs(foldChange)'
}

function addSCCTDefaults(termType: string) {
	if (termType != TermTypes.SINGLECELL_CELLTYPE) return
	//add SCCT specific defaults when there are any
}

/*********** Setting Validation Functions ***********
 * Validates user input settings after merging with defaults */
export function validateVolcanoSettings(config: any, opts: any) {
	if (config.termType == TermTypes.SINGLECELL_CELLTYPE) return
	if (!config.settings.volcano) return

	const settings = config.settings.volcano
	const sampleNum = getSampleNum(opts)
	if (sampleNum > maxSampleCutoff) {
		throw new Error(
			`Sample size ${sampleNum} exceeds max sample size of ${maxSampleCutoff}. Please reduce sample size.`
		)
	}

	validateGESettings(config.termType, settings, sampleNum, opts)
	validateSCCTSettings(config.termType)
}

export function getSampleNum(config: any) {
	if (config.termType == TermTypes.GENE_EXPRESSION) {
		return config.samplelst.groups.reduce((sum: number, g: any) => sum + g.values.length, 0)
	}
	if (config.termType == TermTypes.SINGLECELL_CELLTYPE) {
		//TODO: Set max sample cutoff and calculate number of samples
		return maxSampleCutoff
	}
}

function validateGESettings(termType: string, settings: GEVolcanoSettings, sampleNum: number, opts: any) {
	if (termType != TermTypes.GENE_EXPRESSION) return

	const largeNum = sampleNum > settings.sampleNumCutoff
	if (!opts.overrides && largeNum) {
		settings.method = 'wilcoxon'
	} else if (largeNum && settings.method != 'wilcoxon') {
		throw `${settings.method} is not supported for ${sampleNum} samples when termtype = ${termType}. Please use Wilcoxon.`
	}
}

function validateSCCTSettings(termType: string) {
	if (termType != TermTypes.SINGLECELL_CELLTYPE) return
	//add validations when there are settings for SCCT
}

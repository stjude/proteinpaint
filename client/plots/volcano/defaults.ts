import { roundValue } from '#shared/roundValue.js'
import type { VolcanoSettings } from './VolcanoTypes'

// The max sample cutoff for volcano rendering
const maxSampleCutoff = 4000
// The max sample cutoff for gene expression term type
const maxGESampleCutoff = 3000

export function getDefaultVolcanoSettings(overrides = {}, opts: any): VolcanoSettings {
	const features = JSON.parse(sessionStorage.getItem('optionalFeatures') as string)
	const method = features?.runDE_methods?.includes('Wilcoxon') ? 'wilcoxon' : 'edgeR'
	const defaults: VolcanoSettings = {
		cpmCutoff: 1,
		defaultSignColor: 'red',
		defaultNonSignColor: 'black',
		defaultHighlightColor: '#ffa200', // orange-yellow
		foldChangeCutoff: 0,
		height: 400,
		method,
		minCount: 10,
		minTotalCount: 15,
		pValue: roundValue(-Math.log10(0.05), 2),
		pValueType: 'adjusted',
		rankBy: 'abs(foldChange)',
		//Only declare this value in one place
		sampleNumCutoff: opts.termType == 'geneExpression' ? maxGESampleCutoff : maxSampleCutoff,
		width: 400
	}

	return Object.assign(defaults, overrides)
}

export function getSampleNum(config: any) {
	return config.samplelst.groups.reduce((sum: number, g: any) => sum + g.values.length, 0)
}

export function validateVolcanoSettings(config: any, opts: any) {
	if (!config.settings.volcano) return
	const settings = config.settings.volcano
	const sampleNum = getSampleNum(opts)
	if (sampleNum > maxSampleCutoff) {
		throw `Sample size ${sampleNum} exceeds max sample size of ${maxSampleCutoff}. Please reduce sample size.`
	}

	if (config.termType == 'geneExpression') {
		const largeNum = sampleNum > settings.sampleNumCutoff

		if (!opts.overrides && largeNum) {
			settings.method = 'wilcoxon'
		} else if (largeNum && settings.method != 'wilcoxon') {
			throw `${settings.method} is not supported for ${sampleNum} samples when termtype = ${config.termType}. Please use Wilcoxon.`
		}
	}
}

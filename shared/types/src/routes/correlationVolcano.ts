import type { RoutePayload } from './routeApi.js'
import type { TermWrapper } from '../terms/tw.ts'
import type { Filter } from '../filter.ts'

/** */
export type CorrelationVolcanoRequest = {
	genome: string
	dslabel: string
	filter?: Filter
	filter0?: any // gdc
	/** feature tw */
	featureTw: TermWrapper
	/** variables */
	variableTwLst: TermWrapper[]
	/** correlation method */
	correlationMethod: 'pearson' | 'spearman'
	/** add new param */
}

export type CorrelationVolcanoResponse = {
	/** each element is test result of one variable corresponding to variableTwLst */
	variableItems: {
		/** correlation coefficient, -1 to 1 */
		correlation: number
		/** pvalue */
		pvalue: number
		/** tw.$id, for client to match the item with variableTwLst */
		tw$id: string
		/** number of samples analyzed. samples not having complete data for all terms will be excluded, thus size may be lower than current cohort */
		sampleSize: number
	}[]
}

export const CorrelationVolcanoPayload: RoutePayload = {
	request: {
		typeId: 'CorrelationVolcanoRequest'
	},
	response: {
		typeId: 'CorrelationVolcanoResponse'
	}
	//examples: []
}

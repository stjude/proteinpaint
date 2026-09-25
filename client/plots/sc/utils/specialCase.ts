import { isSingleCellTerm } from '#shared/terms.js'

/** Determines if special tree handling is required.
 * @param config - plot config
 * @param key - tw key in the config
 * @param noCohortTerms - specify whether or not to show cohort level terms with single cell terms when
 * plot is a meta result.
 * @returns 'default' if not a single cell term, otherwise an object with the following properties:
 *  - type: 'singleCell'
 *  - isMeta: boolean indicating if the plot is a meta result
 *  - config: object containing the sample information from the term
 */
export function getSingleCellSpecialCase(
	config,
	key = 'term',
	noCohortTerms = false
): string | { [index: string]: any } {
	const tw = config[key]
	const term = tw?.term
	const chartType = config.childType || config.chartType || 'unknown'
	/** The term might not be available (e.g. when the colorTw is removed in the 
	 * single cell scatter). If the sample obj is present in the config, that's
	 * sufficient. */
	const sample = config?.singleCellPlot?.sample || term?.sample

	if (!term && !sample) {
		//Do not prevent from loading if no term information is provided but log the error.
		console.error(`Term and sample are missing to determine if special case handling is needed for ${chartType} chart.`)
		return 'default'
	}
	if (!isSingleCellTerm(term) && !sample) return 'default'
	if (!sample) {
		//Do not prevent from loading if no sample is specified but log the error.
		console.error(`Single cell term missing sample information in ${chartType} config for term selection.`)
		return 'default'
	}

	/** Note the termdb handler needs either sample.plots or sample.name to filter
	 * the terms.*/
	if (!sample.name && !sample.plots && term?.plot) sample.plots = [term.plot]

	//Always return true/false here to avoid downstream errors
	const isMeta: boolean = noCohortTerms ? false : sample.isMetaResult || false
	return {
		type: 'singleCell',
		isMeta,
		config: { sample }
	}
}

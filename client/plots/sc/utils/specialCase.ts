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
	let specialCase: string | { [index: string]: any } = 'default'
	const term = config[key]
	const chartType = config.childType || config.chartType || 'unknown'
	if (!term || !term.term) {
		//Do not prevent from loading if no term information is provided but log the error.
		console.error(`Term missing to determine if special case handling is needed for ${chartType} chart.`)
	} else if (isSingleCellTerm(term.term)) {
		const sample = term.term?.sample
		//Do not prevent from loading if no sample is specified but log the error.
		if (!sample) {
			console.error(`Single cell term missing sample information in ${chartType} config for term selection.`)
		} else {
			/** Note the termdb handler needs either sample.plots or sample.name to filter
			 * the terms.*/
			if (!sample.name && !sample.plots) {
				if (term.term?.plot) sample.plots = [term.term.plot]
			}

			//Always return true/false here to avoid downstream errors
			const isMeta: boolean = noCohortTerms ? false : sample?.isMetaResult || false
			specialCase = {
				type: 'singleCell',
				isMeta,
				config: { sample }
			}
		}
	}
	return specialCase
}

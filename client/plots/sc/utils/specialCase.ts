import { isSingleCellTerm } from '#shared/terms.js'

export function getSingleCellSpecialCase(config) {
	let specialCase: string | { [index: string]: any } = 'default'
	if (isSingleCellTerm(config.term.term)) {
		const sample = config.term.term?.sample
		//Do not prevent from loading if no sample is specified but log the error.
		if (!sample) {
			const chartType = config.childType || config.chartType || 'unknown'
			console.error(`Single cell term missing sample information in ${chartType} config for term selection.`)
		} else {
			const isMeta = config.term.term.sample?.isMetaResult
			specialCase = {
				type: 'singleCell',
				isMeta,
				config: { sample }
			}
		}
	}
	return specialCase
}

import type { SampleTypes } from '#types'

// renders sample type checkboxes
export function renderSampleTypeSelect(holder: any, querySampleTypes?: any, termdbConfig?: any) {
	holder.selectAll('*').remove()

	if (!Array.isArray(querySampleTypes) || querySampleTypes.length < 2) return

	const sampleTypeConfig: SampleTypes = {}
	for (const sampleType of querySampleTypes) {
		sampleTypeConfig[sampleType] = termdbConfig.sampleTypes[sampleType]
	}

	const sampleTypeCheckboxDiv = holder
		.append('div')
		.attr('class', 'sjpp-genesearch-sampletype-checkboxes')
		.style('margin-right', '8px')

	const sampleTypeCheckboxes: any[] = []

	for (const [k, v] of Object.entries(sampleTypeConfig)) {
		const label = sampleTypeCheckboxDiv
			.append('label')
			.style('display', 'inline-flex')
			.style('align-items', 'center')
			.style('margin-right', '10px')
		const input = label.append('input').attr('type', 'checkbox').attr('value', k)
		label.append('span').style('margin-left', '4px').text(v.name)
		sampleTypeCheckboxes.push(input)
	}

	return sampleTypeCheckboxes
}

// returns selected sample types from checkboxes created by renderSampleTypeSelect().
export function getSelectedSampleTypes(sampleTypeSelect?: any[]) {
	if (!sampleTypeSelect) return
	return sampleTypeSelect
		.filter(checkbox => checkbox.property('checked'))
		.map(checkbox => Number(checkbox.property('value')))
}

// renders a dropdown menu for each term in sampleTypesByTerms, with the term's
// values as options
export function renderSampleTypesByTermsSelect(holder: any, sampleTypesByTerms: any) {
	holder.selectAll('*').remove()

	const sampleTypesByTermsDiv = holder
		.append('div')
		.attr('class', 'sjpp-genesearch-sampletypesbyterms-selects')
		.style('margin-right', '8px')

	const termSelects = {}

	for (const term in sampleTypesByTerms) {
		const values = Object.keys(sampleTypesByTerms[term])
		const label = sampleTypesByTermsDiv
			.append('label')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('margin-bottom', '4px')
		label.append('span').style('margin-right', '4px').text(term)
		const select = label.append('select')
		for (const value of values) {
			select.append('option').attr('value', value).text(value)
		}
		termSelects[term] = select
	}

	return termSelects
}

// returns the intersection of sample types associated with the selected
// term values from dropdowns created by renderSampleTypesByTermsSelect()
export function getSelectedSampleTypesByTerms(termSelects, sampleTypesByTerms) {
	const selected = {}
	for (const term in termSelects) {
		selected[term] = termSelects[term].property('value')
	}
	const selectedSampleTypesByTerms = Object.entries(selected).map(([term, value]) => sampleTypesByTerms[term][value])
	if (!selectedSampleTypesByTerms.length) return []
	const selectedSampleTypes = selectedSampleTypesByTerms.reduce((intersection, sampleTypes) =>
		intersection.filter(sampleType => sampleTypes.includes(sampleType))
	)
	return selectedSampleTypes
}

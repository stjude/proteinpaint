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
	const selectedSampleTypes = sampleTypeSelect
		.filter(checkbox => checkbox.property('checked'))
		.map(checkbox => Number(checkbox.property('value')))
	if (!selectedSampleTypes.length) window.alert('Please select at least one sample type.')
	return selectedSampleTypes
}

// renders a dropdown menu for each term in sampleTypesByTerms, with the term's
// values as options
export function renderSampleTypesByTermsSelect(holder: any, sampleTypesByTerms: any, termdbConfig: any) {
	holder.selectAll('*').remove()

	if (!sampleTypesByTerms || !Object.keys(sampleTypesByTerms).length) return

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
		label.append('span').style('margin-right', '10px').text(termdbConfig.sampleTypeTerms[term].name)
		const select = label.append('select').style('padding-right', '15px')
		select.append('option').attr('value', 'any').text('Any')
		for (const value of values) {
			select.append('option').attr('value', value).text(value)
		}
		termSelects[term] = select
	}

	return termSelects
}

// builds the selected term-value map from dropdowns created by
// renderSampleTypesByTermsSelect()
function getSelectedTermValues(termSelects): { [term: string]: string } | undefined {
	if (!termSelects) return
	const selected = {}
	for (const term in termSelects) {
		selected[term] = termSelects[term].property('value')
	}
	return selected
}

// returns the intersection of sample types associated with the selected
// term values from dropdowns created by renderSampleTypesByTermsSelect()
export function getSelectedSampleTypesByTerms(termSelects, sampleTypesByTerms) {
	if (!termSelects) return
	const selected = getSelectedTermValues(termSelects)
	if (!selected) return
	const selectedSampleTypesByTerms = Object.entries(selected).map(([term, value]) => {
		if (value == 'any') return Object.values(sampleTypesByTerms[term]).flat()
		return sampleTypesByTerms[term][value]
	})
	if (!selectedSampleTypesByTerms.length) return []
	const selectedSampleTypes = selectedSampleTypesByTerms.reduce((intersection, sampleTypes) =>
		intersection.filter(sampleType => sampleTypes.includes(sampleType))
	)
	if (!selectedSampleTypes.length) window.alert('Sample type not found. Please select a different sample type.')
	return selectedSampleTypes
}

// builds a sample type label based on the selected term values from dropdowns
// created by renderSampleTypesByTermsSelect(). Terms for which the 'Any' option
// was selected do not contribute to the label, since that selection is not
// restrictive/informative. If every term used 'Any' (or there are no terms),
// then return is undefined.
export function getSampleTypeLabelByTerms(termSelects) {
	if (!termSelects) return
	const selected = getSelectedTermValues(termSelects)
	if (!selected) return
	const parts = Object.values(selected).filter(value => value != 'any')
	if (!parts.length) return
	return parts.join(' ')
}

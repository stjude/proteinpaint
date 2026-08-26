// renders sample type checkboxes
export function renderSampleTypeSelect(holder: any, querySampleTypes?: any, termdbConfig?: any) {
	if (!Array.isArray(querySampleTypes) || querySampleTypes.length < 2) return

	holder.selectAll('*').remove()

	const sampleTypeConfig = {}
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

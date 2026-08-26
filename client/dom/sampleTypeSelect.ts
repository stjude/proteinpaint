type SampleTypeConfig = {
	[key: string]: { name: string; plural_name: string; parent_id: number | null }
}

// helper for determining whether to render sample type select
// returns true when dataset has sample ancestry and at least two child sample types.
export function mayRenderSampleTypeSelect(termdbConfig?: {
	hasSampleAncestry?: boolean
	sampleTypes?: SampleTypeConfig
}) {
	if (!termdbConfig?.hasSampleAncestry) return
	const sampleTypes = termdbConfig.sampleTypes
	if (!sampleTypes) throw new Error('sampleTypes{} is missing')
	const childSampleTypes = getChildSampleTypes(sampleTypes)
	return Object.keys(childSampleTypes).length >= 2
}

// renders sample type checkboxes
export function renderSampleTypeSelect(
	row: any,
	termdbConfig?: { hasSampleAncestry?: boolean; sampleTypes?: SampleTypeConfig }
) {
	if (!mayRenderSampleTypeSelect(termdbConfig)) return
	const sampleTypes = termdbConfig?.sampleTypes
	if (!sampleTypes) throw new Error('sampleTypes{} is missing')
	const childSampleTypes = getChildSampleTypes(sampleTypes)

	const sampleTypeCheckboxDiv = row
		.append('div')
		.attr('class', 'sjpp-genesearch-sampletype-checkboxes')
		.style('margin-right', '8px')

	const sampleTypeCheckboxes: any[] = []

	for (const [k, v] of Object.entries(childSampleTypes)) {
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

// returns selected sample type ids from checkbox controls created by renderSampleTypeSelect().
export function getSelectedSampleTypes(sampleTypeSelect?: any[]) {
	if (!sampleTypeSelect) return
	return sampleTypeSelect
		.filter(checkbox => checkbox.property('checked'))
		.map(checkbox => Number(checkbox.property('value')))
}

function getChildSampleTypes(sampleTypes: SampleTypeConfig) {
	const childSampleTypes: SampleTypeConfig = {}
	for (const [k, v] of Object.entries(sampleTypes)) {
		if (Number.isInteger(v.parent_id)) childSampleTypes[k] = v
	}
	return childSampleTypes
}

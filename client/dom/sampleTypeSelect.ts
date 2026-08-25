type SampleTypeConfig = {
	[key: string]: { name: string; plural_name: string; parent_id: number | null }
}

/**
 * Renders sample type checkboxes when the dataset has sample ancestry and
 * at least two child sample types.
 *
 * @param row - D3 selection element to append the checkbox list to
 * @param termdbConfig - Termdb configuration containing sample ancestry and sample types
 * @returns The rendered checkbox controls, or undefined when a selector is not needed
 */
export function renderSampleTypeSelect(
	row: any,
	termdbConfig?: { hasSampleAncestry?: boolean; sampleTypes?: SampleTypeConfig }
) {
	if (!termdbConfig?.hasSampleAncestry) return
	const sampleTypes = termdbConfig.sampleTypes
	if (!sampleTypes) throw new Error('sampleTypes{} is missing')

	const childSampleTypes: SampleTypeConfig = {}
	for (const [k, v] of Object.entries(sampleTypes)) {
		if (Number.isInteger(v.parent_id)) childSampleTypes[k] = v
	}

	if (Object.keys(childSampleTypes).length < 2) return

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

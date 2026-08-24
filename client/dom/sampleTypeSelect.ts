type SampleTypeConfig = {
	[key: string]: { name: string; plural_name: string; parent_id: number | null }
}

/**
 * Renders a sample type dropdown when the dataset has sample ancestry and
 * at least two child sample types.
 *
 * @param row - D3 selection element to append the select to
 * @param termdbConfig - Termdb configuration containing sample ancestry and sample types
 * @returns The rendered select, or undefined when a selector is not needed
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

	const sampleTypeSelect = row
		.append('select')
		.attr('class', 'sjpp-genesearch-sampletype-select')
		.style('margin-right', '8px')

	sampleTypeSelect.append('option').attr('value', '').attr('disabled', true).attr('selected', true).text('Sample type')

	for (const [k, v] of Object.entries(childSampleTypes)) {
		sampleTypeSelect.append('option').attr('value', k).text(v.name)
	}

	return sampleTypeSelect
}

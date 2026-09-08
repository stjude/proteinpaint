import tape from 'tape'
import * as d3s from 'd3-selection'
import { renderSampleTypesByTermsSelect } from '../sampleTypeSelect'

tape('renderSampleTypesByTermsSelect(): preserves supplied term-value order', test => {
	const holder = d3s.select('body').append('div')
	const termSelects = renderSampleTypesByTermsSelect(
		holder,
		{
			'samples.collection_event': {
				Baseline: [],
				'Month 3': [],
				Unknown: []
			},
			'samples.specimen_type': {
				'Peripheral Blood': [],
				'Bone Marrow': []
			},
			'samples.sample_type': {
				WBC: [],
				CD138pos: [],
				CD3pos: []
			}
		},
		{
			sampleTypeTerms: {
				'samples.collection_event': { name: 'Collection Event' },
				'samples.specimen_type': { name: 'Specimen Type' },
				'samples.sample_type': { name: 'Sample Type' }
			}
		}
	)

	const optionLabels = term =>
		termSelects[term]
			.selectAll('option')
			.nodes()
			.map(option => option.textContent)
	test.deepEqual(
		optionLabels('samples.collection_event'),
		['Any', 'Baseline', 'Month 3', 'Unknown'],
		'preserves dataset-provided collection event order'
	)
	test.deepEqual(
		optionLabels('samples.specimen_type'),
		['Any', 'Peripheral Blood', 'Bone Marrow'],
		'preserves dataset-provided specimen type order'
	)
	test.deepEqual(
		optionLabels('samples.sample_type'),
		['Any', 'WBC', 'CD138pos', 'CD3pos'],
		'preserves dataset-provided sample type order'
	)

	holder.remove()
	test.end()
})

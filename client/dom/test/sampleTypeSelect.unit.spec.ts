import tape from 'tape'
import * as d3s from 'd3-selection'
import { getSelectedSampleTypesByTerms, renderSampleTypesByTermsSelect } from '../sampleTypeSelect'

const sampleTypesByTerms = {
	'samples.collection_event': {
		Baseline: ['WBC', 'CD3pos'],
		'Month 3': ['CD138pos'],
		Unknown: ['CD3pos']
	},
	'samples.specimen_type': {
		'Peripheral Blood': ['WBC', 'CD3pos'],
		'Bone Marrow': ['CD138pos', 'CD3pos']
	},
	'samples.sample_type': {
		WBC: ['WBC'],
		CD138pos: ['CD138pos'],
		CD3pos: ['CD3pos']
	}
}

const termdbConfig = {
	sampleTypeTerms: {
		'samples.collection_event': { name: 'Collection Event' },
		'samples.specimen_type': { name: 'Specimen Type' },
		'samples.sample_type': { name: 'Sample Type' }
	}
}

function getTermSelects() {
	const holder = d3s.select('body').append('div')
	const termSelects: any = renderSampleTypesByTermsSelect(holder, sampleTypesByTerms, termdbConfig)
	return { holder, termSelects }
}

tape('renderSampleTypesByTermsSelect(): preserves supplied term-value order', test => {
	const { holder, termSelects } = getTermSelects()
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

tape('getSelectedSampleTypesByTerms(): returns all sample types for Any', test => {
	const { holder, termSelects } = getTermSelects()

	test.deepEqual(
		getSelectedSampleTypesByTerms(termSelects, sampleTypesByTerms),
		['WBC', 'CD3pos', 'CD138pos'],
		'returns all sample types when every term is set to Any'
	)

	holder.remove()
	test.end()
})

tape('getSelectedSampleTypesByTerms(): intersects specific and Any selections', test => {
	const { holder, termSelects } = getTermSelects()
	termSelects['samples.collection_event'].property('value', 'Baseline')

	test.deepEqual(
		getSelectedSampleTypesByTerms(termSelects, sampleTypesByTerms),
		['WBC', 'CD3pos'],
		'intersects a specific term value with Any selections from other terms'
	)

	holder.remove()
	test.end()
})

tape('getSelectedSampleTypesByTerms(): handles impossible combinations', test => {
	const { holder, termSelects } = getTermSelects()
	termSelects['samples.collection_event'].property('value', 'Baseline')
	termSelects['samples.specimen_type'].property('value', 'Bone Marrow')
	termSelects['samples.sample_type'].property('value', 'WBC')
	const alert0 = window.alert
	let alertMessage = ''
	window.alert = message => {
		alertMessage = message
	}

	test.deepEqual(
		getSelectedSampleTypesByTerms(termSelects, sampleTypesByTerms),
		[],
		'returns no sample types when the selected term values cannot intersect'
	)
	window.alert = alert0
	test.equal(
		alertMessage,
		'Sample type not found. Please select a different sample type.',
		'alerts on an impossible combination'
	)

	holder.remove()
	test.end()
})

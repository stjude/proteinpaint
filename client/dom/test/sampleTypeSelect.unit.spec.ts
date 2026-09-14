import tape from 'tape'
import * as d3s from 'd3-selection'
import { getSelectedSampleTypesByTerms, renderSampleTypesByTermsSelect } from '../sampleTypeSelect'

const sampleTypesByTerms = {
	'samples.collection_event': {
		Baseline: [2, 3, 4, 5],
		'Month 3': [29, 30, 77],
		'Month 6': [26, 27, 47]
	},
	'samples.specimen_type': {
		'Bone Marrow': [2, 4, 26, 29, 77],
		'Peripheral Blood': [3, 5, 27, 30, 47]
	},
	'samples.sample_type': {
		CD138neg: [4, 77],
		CD138pos: [2, 26, 29],
		CD3pos: [18, 81, 89],
		Plasma: [12, 20, 39, 40, 41],
		WBC: [5, 27],
		'Whole Blood': [3, 30, 47]
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
		['Any', 'Baseline', 'Month 3', 'Month 6'],
		'preserves dataset-provided collection event order'
	)
	test.deepEqual(
		optionLabels('samples.specimen_type'),
		['Any', 'Bone Marrow', 'Peripheral Blood'],
		'preserves dataset-provided specimen type order'
	)
	test.deepEqual(
		optionLabels('samples.sample_type'),
		['Any', 'CD138neg', 'CD138pos', 'CD3pos', 'Plasma', 'WBC', 'Whole Blood'],
		'preserves dataset-provided sample type order'
	)

	holder.remove()
	test.end()
})

tape('getSelectedSampleTypesByTerms(): returns all samples for Any', test => {
	const { holder, termSelects } = getTermSelects()

	test.deepEqual(
		getSelectedSampleTypesByTerms(termSelects, sampleTypesByTerms),
		[2, 3, 4, 5, 29, 30, 77, 26, 27, 47],
		'returns all samples when every term is set to Any'
	)

	holder.remove()
	test.end()
})

tape('getSelectedSampleTypesByTerms(): intersects specific and Any selections', test => {
	const { holder, termSelects } = getTermSelects()
	termSelects['samples.collection_event'].property('value', 'Baseline')

	test.deepEqual(
		getSelectedSampleTypesByTerms(termSelects, sampleTypesByTerms),
		[2, 3, 4, 5],
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

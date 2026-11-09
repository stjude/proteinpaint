import tape from 'tape'
import * as d3s from 'd3-selection'
import {
	getSelectedSampleTypesByTerms,
	getChosenSampleTypes,
	getSampleTypeLabel,
	getSampleTypeSelectValues,
	mayGetSampleTypeLabel,
	mayRenderSampleTypeRow,
	renderSampleTypesByTermsSelect
} from '../sampleTypeSelect'

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

tape('mayGetSampleTypeLabel(): handles an implicit single sample type', test => {
	test.equal(
		mayGetSampleTypeLabel({ querySampleTypes: [2], termdbConfig }),
		'',
		'uses an empty label when the only available sample type is implicitly selected'
	)
	test.equal(
		mayGetSampleTypeLabel({ querySampleTypes: [], termdbConfig }),
		undefined,
		'returns no label when there are no available sample types'
	)
	test.end()
})

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

tape('mayRenderSampleTypeRow(): renders only when there is a choice', test => {
	const holder: any = d3s.select('body').append('div')
	const config = {
		...termdbConfig,
		sampleTypes: { 2: { name: 'Tumor', plural_name: 'Tumors' }, 3: { name: 'Normal', plural_name: 'Normals' } }
	}

	test.equal(mayRenderSampleTypeRow(holder, undefined, config), undefined, 'no query: nothing to choose')
	test.equal(
		mayRenderSampleTypeRow(holder, { sampleTypes: [2] }, config),
		undefined,
		'one sample type: nothing to choose'
	)
	test.equal(
		mayRenderSampleTypeRow(holder, { sampleTypes: [2], sampleTypesByTerms }, config),
		undefined,
		'one sample type: no by-terms dropdowns either'
	)
	test.equal(holder.selectAll('*').size(), 0, 'renders nothing without a choice')

	test.ok(mayRenderSampleTypeRow(holder, { sampleTypes: [2, 3] }, config), 'returns a select for two sample types')
	test.equal(holder.selectAll('input[type=checkbox]').size(), 2, 'renders a checkbox per sample type')

	const termSelects: any = mayRenderSampleTypeRow(holder, { sampleTypes: [2, 3], sampleTypesByTerms }, config)
	test.deepEqual(Object.keys(termSelects), Object.keys(sampleTypesByTerms), 'prefers the by-terms dropdowns')
	test.equal(holder.selectAll('input[type=checkbox]').size(), 0, 'clears the previous select')

	holder.remove()
	test.end()
})

tape('getSampleTypeSelectValues() and getSampleTypeLabel() draw and name sample type ids', test => {
	const termdbConfig = {
		sampleTypes: { 2: { plural_name: 'diagnosis samples' }, 3: { plural_name: 'relapse samples' } }
	}
	test.deepEqual(getSampleTypeSelectValues({ sampleTypes: [2, 3] }, [3]), ['3'], 'should give the checkbox values')
	test.equal(
		getSampleTypeLabel({ sampleTypes: [2, 3] }, [2, 3], termdbConfig),
		'diagnosis samples, relapse samples',
		'should name checkbox sample types by their plural names'
	)

	const query = {
		sampleTypes: [2, 3, 4, 5],
		sampleTypesByTerms: {
			'samples.collection_event': sampleTypesByTerms['samples.collection_event'],
			'samples.specimen_type': sampleTypesByTerms['samples.specimen_type']
		}
	}
	test.deepEqual(
		getSampleTypeSelectValues(query, [2, 4]),
		{ 'samples.collection_event': 'Baseline', 'samples.specimen_type': 'Bone Marrow' },
		'should give, by term, the dropdown value holding every sample type'
	)
	test.deepEqual(
		getSampleTypeSelectValues(query, [2, 3]),
		{ 'samples.collection_event': 'Baseline', 'samples.specimen_type': 'any' },
		'should give any for a term with no single value holding them all'
	)
	test.equal(
		getSampleTypeLabel(query, [2, 4], termdbConfig),
		'Baseline Bone Marrow',
		'should name dropdown sample types by their values'
	)
	termdbConfig.sampleTypes[5] = { plural_name: 'baseline blood samples' }
	test.equal(
		getSampleTypeLabel(query, [2, 5], termdbConfig),
		'diagnosis samples, baseline blood samples',
		'should name them by plural names when the dropdowns cannot select exactly them'
	)
	test.end()
})

tape('getChosenSampleTypes() keeps the ids of the query, and none for every one', test => {
	const query = { sampleTypes: [2, 3, 4] }
	test.deepEqual(getChosenSampleTypes(query, [3, 2]), [2, 3], 'should keep the chosen ids, in the query order')
	test.deepEqual(getChosenSampleTypes(query, [2, 9]), [2], 'should drop an id the query does not have')
	test.equal(getChosenSampleTypes(query, [9]), undefined, 'should read every sample when none is of the query')
	test.equal(getChosenSampleTypes(query, [4, 3, 2]), undefined, 'should read every sample for every sample type')
	test.equal(getChosenSampleTypes(query, null), undefined, 'should read every sample for no choice')
	test.end()
})

tape('mayRenderSampleTypeRow() draws a chosen set of sample types', test => {
	const holder: any = d3s.select('body').append('div')
	const config = {
		...termdbConfig,
		sampleTypes: { 2: { name: 'Tumor', plural_name: 'Tumors' }, 3: { name: 'Normal', plural_name: 'Normals' } }
	}
	mayRenderSampleTypeRow(holder, { sampleTypes: [2, 3] }, config, [3])
	const boxes = holder.selectAll('input[type=checkbox]').nodes() as HTMLInputElement[]
	test.deepEqual(
		boxes.map(b => b.checked),
		[false, true],
		'should check the chosen sample types alone'
	)
	test.equal(
		(boxes[1].parentNode as HTMLElement).style.cursor,
		'not-allowed',
		'should mark the one checked box as the last one'
	)

	const query = { sampleTypes: [2, 3, 4, 5], sampleTypesByTerms }
	const termSelects: any = mayRenderSampleTypeRow(holder, query, config, [2, 4])
	test.equal(termSelects['samples.collection_event'].property('value'), 'Baseline', 'should set each dropdown')
	test.equal(termSelects['samples.specimen_type'].property('value'), 'Bone Marrow', 'should set each dropdown')

	if (test['_ok']) holder.remove()
	test.end()
})

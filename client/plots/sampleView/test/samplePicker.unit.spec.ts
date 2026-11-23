import tape from 'tape'
import { findSamples, getRootSampleNames } from '../samplePicker.ts'

/*
Tests:
	getRootSampleNames()
	findSamples()
*/

tape('\n', test => {
	test.comment('-***- plots/sampleView/samplePicker -***-')
	test.end()
})

tape('getRootSampleNames()', test => {
	const samplesData = {
		P1: { id: 1, name: 'P1', sample_type: 1 },
		S1: { id: 2, name: 'S1', ancestor_name: 'P1', sample_type: 2 },
		X: { id: 3, name: 'X', sample_type: null }
	}
	test.deepEqual(
		getRootSampleNames(samplesData, true),
		['P1', 'X'],
		'Should list the root samples with sample ancestry'
	)
	test.deepEqual(
		getRootSampleNames(samplesData, false),
		['P1', 'S1', 'X'],
		'Should list the samples of the default type without sample ancestry'
	)
	test.deepEqual(getRootSampleNames({ A: { id: 1 } }), ['A'], 'Should list a sample without a type')
	test.end()
})

tape('findSamples()', test => {
	const matches = [
		{ name: 'SJ10', label: 'SJ10-d, SJ10-r' },
		{ name: 'ab-SJ1', label: 'ab-SJ1' },
		{ name: 'SJ1', label: 'SJ1-d' },
		{ name: 'P7', label: 'XSJ1-csf' }
	]
	const names = (str: string, limit = 10) => findSamples(matches, str, limit).map(m => m.name)
	test.deepEqual(names(''), ['SJ10', 'ab-SJ1', 'SJ1', 'P7'], 'Should list the samples in order without a search')
	test.deepEqual(names('', 2), ['SJ10', 'ab-SJ1'], 'Should list up to the limit')
	test.deepEqual(
		names('sj1'),
		['SJ10', 'SJ1', 'ab-SJ1', 'P7'],
		'Should list the names starting with the search, then the names including it, then by a related sample'
	)
	test.deepEqual(names(' SJ1-D '), ['SJ1'], 'Should match a related sample, ignoring case and spaces')
	test.deepEqual(names('sj1', 3), ['SJ10', 'SJ1', 'ab-SJ1'], 'Should stop at the limit')
	test.deepEqual(names('none'), [], 'Should list no sample without a match')
	test.end()
})

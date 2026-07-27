import tape from 'tape'
import {
	getFilteredSamples,
	sample_match_termvaluesetting,
	setDatasetAnnotations,
	filterJoin,
	getWrappedTvslst,
	validateTermCollectionTvs,
	type SampleAnnotation
} from '../filter.js'
import type { Filter } from '#types'

/* test sections

getFilteredSamples()
sample_match_termvaluesetting() - categorical
sample_match_termvaluesetting() - integer/float
sample_match_termvaluesetting() - condition
sample_match_termvaluesetting() - geneVariant
setDatasetAnnotations()
filterJoin()
getWrappedTvslst()
validateTermCollectionTvs()
*/

// Helper to create mock filters for tests - bypasses strict type checking
const mockFilter = (filter: any): Filter => filter as Filter

tape('\n', function (test) {
	test.comment('-***- filter specs -***-')
	test.end()
})

tape('getFilteredSamples() - basic categorical filter', t => {
	const sampleAnno: SampleAnnotation[] = [
		{ sample: 'sample1', s: { sex: 'male' } },
		{ sample: 'sample2', s: { sex: 'female' } },
		{ sample: 'sample3', s: { sex: 'male' } }
	]

	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [{ key: 'male', label: 'Male' }]
				}
			}
		]
	})

	const result = getFilteredSamples(sampleAnno, filter)
	t.equal(result.size, 2, 'should return 2 samples matching male')
	t.ok(result.has('sample1'), 'should include sample1')
	t.ok(result.has('sample3'), 'should include sample3')
	t.notOk(result.has('sample2'), 'should not include sample2')
	t.end()
})

tape('getFilteredSamples() - with data property', t => {
	const sampleAnno: SampleAnnotation[] = [
		{ sample: 'sample1', data: { diagnosis: 'ALL' } },
		{ sample: 'sample2', data: { diagnosis: 'AML' } }
	]

	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'diagnosis', name: 'Diagnosis', type: 'categorical' },
					values: [{ key: 'ALL', label: 'ALL' }]
				}
			}
		]
	})

	const result = getFilteredSamples(sampleAnno, filter)
	t.equal(result.size, 1, 'should return 1 sample')
	t.ok(result.has('sample1'), 'should include sample1 with ALL diagnosis')
	t.end()
})

tape('getFilteredSamples() - handles duplicate samples', t => {
	const sampleAnno: SampleAnnotation[] = [
		{ sample: 'sample1', s: { sex: 'male' } },
		{ sample: 'sample1', s: { sex: 'male' } }, // duplicate
		{ sample: 'sample2', s: { sex: 'female' } }
	]

	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [{ key: 'male', label: 'Male' }]
				}
			}
		]
	})

	const result = getFilteredSamples(sampleAnno, filter)
	t.equal(result.size, 1, 'should return only unique samples')
	t.ok(result.has('sample1'), 'should include sample1')
	t.end()
})

tape('sample_match_termvaluesetting() - categorical match', t => {
	const row = { sex: 'male', diagnosis: 'ALL' }
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [{ key: 'male', label: 'Male' }],
					valueset: new Set(['male'])
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.ok(result, 'should match male value')
	t.end()
})

tape('sample_match_termvaluesetting() - categorical no match', t => {
	const row = { sex: 'female' }
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [{ key: 'male', label: 'Male' }],
					valueset: new Set(['male'])
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.notOk(result, 'should not match female value')
	t.end()
})

tape('sample_match_termvaluesetting() - categorical with isnot', t => {
	const row = { sex: 'female' }
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [{ key: 'male', label: 'Male' }],
					valueset: new Set(['male']),
					isnot: true
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.ok(result, 'should match with isnot flag (female is not male)')
	t.end()
})

tape('sample_match_termvaluesetting() - integer range inclusive', t => {
	const row = { age: 25 }
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'age', name: 'Age', type: 'integer' },
					ranges: [
						{
							start: 20,
							stop: 30,
							startinclusive: true,
							stopinclusive: true
						}
					]
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.ok(result, 'should match age 25 in range [20, 30]')
	t.end()
})

tape('sample_match_termvaluesetting() - integer range exclusive', t => {
	const row = { age: 20 }
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'age', name: 'Age', type: 'integer' },
					ranges: [
						{
							start: 20,
							stop: 30,
							startinclusive: false,
							stopinclusive: false
						}
					]
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.notOk(result, 'should not match age 20 with exclusive start (20, 30)')
	t.end()
})

tape('sample_match_termvaluesetting() - float range', t => {
	const row = { wbc: 5.5 }
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'wbc', name: 'WBC', type: 'float' },
					ranges: [
						{
							start: 5.0,
							stop: 10.0,
							startinclusive: true,
							stopinclusive: true
						}
					]
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.ok(result, 'should match wbc 5.5 in range [5.0, 10.0]')
	t.end()
})

tape('sample_match_termvaluesetting() - integer with exact value', t => {
	const row = { age: 25 }
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'age', name: 'Age', type: 'integer' },
					ranges: [{ value: 25 }]
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.ok(result, 'should match exact age value 25')
	t.end()
})

tape('sample_match_termvaluesetting() - integer unbounded start', t => {
	const row = { age: 10 }
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'age', name: 'Age', type: 'integer' },
					ranges: [
						{
							startunbounded: true,
							stop: 30,
							stopinclusive: true
						}
					]
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.ok(result, 'should match age 10 with unbounded start (-, 30]')
	t.end()
})

tape('sample_match_termvaluesetting() - integer unbounded stop', t => {
	const row = { age: 100 }
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'age', name: 'Age', type: 'integer' },
					ranges: [
						{
							start: 20,
							startinclusive: true,
							stopunbounded: true
						}
					]
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.ok(result, 'should match age 100 with unbounded stop [20, -)')
	t.end()
})

tape('sample_match_termvaluesetting() - condition term', t => {
	const row = {
		condition: {
			maxGrade: 3
		}
	}

	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'condition', name: 'Condition', type: 'condition' },
					bar_by_grade: true,
					value_by_max_grade: true,
					values: [{ key: 3, label: 'Grade 3' }]
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.ok(result, 'should match condition with maxGrade=3')
	t.end()
})

tape('sample_match_termvaluesetting() - geneVariant match', t => {
	const row = {
		genevar: {
			values: [
				{ dt: 1, class: 'WT', origin: 'germline' },
				{ dt: 2, class: 'Blank' }
			]
		}
	}

	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'genevar', name: 'Gene Variant', type: 'geneVariant' },
					values: [
						{
							dt: 1,
							mclasslst: ['WT'],
							origin: 'germline'
						}
					]
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.ok(result, 'should match geneVariant with dt=1, class=WT, origin=germline')
	t.end()
})

tape('sample_match_termvaluesetting() - AND join', t => {
	const row = { sex: 'male', age: 25 }
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [{ key: 'male', label: 'Male' }],
					valueset: new Set(['male'])
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { id: 'age', name: 'Age', type: 'integer' },
					ranges: [
						{
							start: 20,
							stop: 30,
							startinclusive: true,
							stopinclusive: true
						}
					]
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.ok(result, 'should match both sex=male AND age in [20,30]')
	t.end()
})

tape('sample_match_termvaluesetting() - AND join with one mismatch', t => {
	const row = { sex: 'male', age: 35 }
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [{ key: 'male', label: 'Male' }],
					valueset: new Set(['male'])
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { id: 'age', name: 'Age', type: 'integer' },
					ranges: [
						{
							start: 20,
							stop: 30,
							startinclusive: true,
							stopinclusive: true
						}
					]
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.notOk(result, 'should not match when age is outside range (AND fails)')
	t.end()
})

tape('sample_match_termvaluesetting() - OR join', t => {
	const row = { sex: 'male', age: 35 }
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: 'or',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [{ key: 'male', label: 'Male' }],
					valueset: new Set(['male'])
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { id: 'age', name: 'Age', type: 'integer' },
					ranges: [
						{
							start: 20,
							stop: 30,
							startinclusive: true,
							stopinclusive: true
						}
					]
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.ok(result, 'should match when sex=male OR age in range (OR succeeds with one match)')
	t.end()
})

tape('sample_match_termvaluesetting() - nested tvslst', t => {
	const row = { sex: 'male', age: 25, diagnosis: 'ALL' }
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvslst',
				in: true,
				join: 'or',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'sex', name: 'Sex', type: 'categorical' },
							values: [{ key: 'male', label: 'Male' }],
							valueset: new Set(['male'])
						}
					},
					{
						type: 'tvs',
						tvs: {
							term: { id: 'sex', name: 'Sex', type: 'categorical' },
							values: [{ key: 'female', label: 'Female' }],
							valueset: new Set(['female'])
						}
					}
				]
			},
			{
				type: 'tvs',
				tvs: {
					term: { id: 'diagnosis', name: 'Diagnosis', type: 'categorical' },
					values: [{ key: 'ALL', label: 'ALL' }],
					valueset: new Set(['ALL'])
				}
			}
		]
	})

	const result = sample_match_termvaluesetting(row, filter)
	t.ok(result, 'should match nested tvslst: (male OR female) AND diagnosis=ALL')
	t.end()
})

tape('setDatasetAnnotations() - categorical', t => {
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [
						{ key: 'male', label: 'Male' },
						{ key: 'female', label: 'Female' }
					]
				}
			}
		]
	})

	setDatasetAnnotations(filter)
	const tvs = (filter.lst[0] as any).tvs
	t.ok(tvs.valueset, 'should create valueset')
	t.ok(tvs.valueset instanceof Set, 'valueset should be a Set')
	t.equal(tvs.valueset.size, 2, 'valueset should have 2 values')
	t.ok(tvs.valueset.has('male'), 'valueset should contain male')
	t.ok(tvs.valueset.has('female'), 'valueset should contain female')
	t.end()
})

tape('setDatasetAnnotations() - with dataset', t => {
	let calledWithTermId: string | null = null
	const ds = {
		setAnnoByTermId: (termId: string) => {
			calledWithTermId = termId
		}
	}

	const filter = {
		type: 'tvs',
		tvs: {
			term: { id: 'sex', name: 'Sex', type: 'categorical' },
			values: [{ key: 'male', label: 'Male' }]
		}
	}

	setDatasetAnnotations(filter as any, ds)
	t.equal(calledWithTermId, 'sex', 'should call setAnnoByTermId with term id')
	t.end()
})

tape('setDatasetAnnotations() - nested tvslst', t => {
	const filter = mockFilter({
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvslst',
				in: true,
				join: 'or',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'sex', name: 'Sex', type: 'categorical' },
							values: [{ key: 'male', label: 'Male' }]
						}
					}
				]
			},
			{
				type: 'tvs',
				tvs: {
					term: { id: 'diagnosis', name: 'Diagnosis', type: 'categorical' },
					values: [{ key: 'ALL', label: 'ALL' }]
				}
			}
		]
	})

	setDatasetAnnotations(filter)
	const nestedTvs = ((filter.lst[0] as Filter).lst[0] as any).tvs
	const directTvs = (filter.lst[1] as any).tvs

	t.ok(nestedTvs.valueset, 'should create valueset for nested tvs')
	t.ok(directTvs.valueset, 'should create valueset for direct tvs')
	t.end()
})

tape('filterJoin() - single filter', t => {
	const filter1 = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [{ key: 'male', label: 'Male' }]
				}
			}
		]
	})

	const result = filterJoin([filter1])
	t.deepEqual(result, filter1, 'should return same filter when only one provided')
	t.end()
})

tape('filterJoin() - join two filters with empty join', t => {
	const filter1 = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [{ key: 'male', label: 'Male' }]
				}
			}
		]
	})

	const filter2 = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'diagnosis', name: 'Diagnosis', type: 'categorical' },
					values: [{ key: 'ALL', label: 'ALL' }]
				}
			}
		]
	})

	const result = filterJoin([filter1, filter2])
	t.equal(result?.join, 'and', 'result should have AND join')
	t.equal(result?.lst.length, 2, 'result should have 2 items in lst')
	t.end()
})

tape('filterJoin() - join AND and OR filters', t => {
	const filter1 = mockFilter({
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [{ key: 'male', label: 'Male' }]
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { id: 'age', name: 'Age', type: 'integer' },
					ranges: [{ start: 20, stop: 30, startinclusive: true, stopinclusive: true }]
				}
			}
		]
	})

	const filter2 = mockFilter({
		type: 'tvslst',
		in: true,
		join: 'or',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'diagnosis', name: 'Diagnosis', type: 'categorical' },
					values: [{ key: 'ALL', label: 'ALL' }]
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { id: 'diagnosis', name: 'Diagnosis', type: 'categorical' },
					values: [{ key: 'AML', label: 'AML' }]
				}
			}
		]
	})

	const result = filterJoin([filter1, filter2])
	t.equal(result?.join, 'and', 'result should have AND join')
	t.equal(result?.lst.length, 3, 'result should have 3 items: 2 from AND filter, and OR filter')
	t.equal((result?.lst[2] as Filter).join, 'or', 'third item should be OR filter')
	t.end()
})

tape('filterJoin() - wrap OR filter with AND', t => {
	const filter1 = mockFilter({
		type: 'tvslst',
		in: true,
		join: 'or',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [{ key: 'male', label: 'Male' }]
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [{ key: 'female', label: 'Female' }]
				}
			}
		]
	})

	const filter2 = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'diagnosis', name: 'Diagnosis', type: 'categorical' },
					values: [{ key: 'ALL', label: 'ALL' }]
				}
			}
		]
	})

	const result = filterJoin([filter1, filter2])
	t.equal(result?.join, 'and', 'result should have AND join')
	t.equal(result?.lst.length, 2, 'result should wrap OR filter and add new filter')
	t.equal((result?.lst[0] as Filter).join, 'or', 'first item should be wrapped OR filter')
	t.end()
})

tape('filterJoin() - empty list', t => {
	const result = filterJoin([])
	t.equal(result, undefined, 'should return undefined for empty list')
	t.end()
})

tape('filterJoin() - single tvs result', t => {
	const filter1 = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: []
	})

	const filter2 = mockFilter({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical' },
					values: [{ key: 'male', label: 'Male' }]
				}
			}
		]
	})

	const result = filterJoin([filter1, filter2])
	t.equal(result?.join, '', 'should set join to empty string for single tvs')
	t.equal(result?.lst.length, 1, 'should have 1 item')
	t.equal(result?.lst[0].type, 'tvs', 'item should be tvs type')
	t.end()
})

tape('getWrappedTvslst() - basic', t => {
	const result = getWrappedTvslst()
	t.equal(result.type, 'tvslst', 'should have type tvslst')
	t.equal(result.in, true, 'should have in=true')
	t.equal(result.join, '', 'should have empty join')
	t.equal(result.lst.length, 0, 'should have empty lst')
	t.end()
})

tape('getWrappedTvslst() - with parameters', t => {
	const lst: any = [
		{
			type: 'tvs',
			tvs: {
				term: { id: 'sex', name: 'Sex', type: 'categorical' },
				values: [{ key: 'male', label: 'Male' }]
			}
		}
	]

	const result = getWrappedTvslst(lst, 'and', 'test-id')
	t.equal(result.type, 'tvslst', 'should have type tvslst')
	t.equal(result.in, true, 'should have in=true')
	t.equal(result.join, 'and', 'should have AND join')
	t.equal(result.lst.length, 1, 'should have 1 item in lst')
	t.end()
})

const collectionTerm = (overrides: any = {}) => ({
	type: 'termCollection',
	name: 'Test collection',
	termlst: [
		{ id: 'term1', name: 'term1', type: 'isoformExpression' },
		{ id: 'term2', name: 'term2', type: 'isoformExpression' },
		{ id: 'term3', name: 'term3', type: 'isoformExpression' }
	],
	denominators: ['term1', 'term2', 'term3'],
	numerators: ['term1', 'term2'],
	...overrides
})

tape('validateTermCollectionTvs() - valid', t => {
	t.doesNotThrow(() => {
		validateTermCollectionTvs(collectionTerm())
	}, 'should not throw for a valid fraction selection')

	t.doesNotThrow(() => {
		// a tvs brushed on a single member has no numerator, only the term to validate
		validateTermCollectionTvs(collectionTerm({ numerators: undefined, denominators: undefined }))
	}, 'should not throw when numerators are absent')

	t.doesNotThrow(() => {
		// shape of a filter saved before term.denominators[] existed: the pruned termlst[] implies it
		validateTermCollectionTvs({
			termlst: [{ id: 'term1', name: 'term1', type: 'float' }],
			numerators: ['term1']
		})
	}, 'should not throw when the denominator is implied by termlst[]')
	t.end()
})

tape('validateTermCollectionTvs() - invalid term', t => {
	t.throws(
		() => {
			validateTermCollectionTvs(collectionTerm({ termlst: [] }))
		},
		/nonempty term.termlst/,
		'should throw when termlst is empty'
	)

	t.throws(
		() => {
			validateTermCollectionTvs(collectionTerm({ termlst: [{ name: 'term1', type: 'float' }] }))
		},
		/member term id not non-empty string/,
		'should throw when a member term has no id'
	)

	t.throws(
		() => {
			validateTermCollectionTvs(collectionTerm({ termlst: [{ id: 'term1', name: 'term1' }] }))
		},
		/member term type not non-empty string/,
		'should throw when a member term has no type'
	)

	t.throws(
		() => {
			validateTermCollectionTvs(
				collectionTerm({
					termlst: [
						{ id: 'term1', name: 'term1', type: 'float' },
						{ id: 'term2', name: 'term2', type: 'categorical' }
					]
				})
			)
		},
		/not allowed to mix multiple term types/,
		'should throw when member terms mix term types'
	)

	t.throws(
		() => {
			validateTermCollectionTvs(
				collectionTerm({
					termlst: [
						{ id: 'term1', name: 'term1', type: 'float' },
						{ id: 'term1', name: 'term1', type: 'integer' }
					]
				})
			)
		},
		/duplicate member term id/,
		'should throw for a duplicate member term id'
	)
	t.end()
})

tape('validateTermCollectionTvs() - invalid fraction selection', t => {
	t.throws(
		() => {
			validateTermCollectionTvs(collectionTerm({ numerators: 'not-array' }))
		},
		/nonempty numerators/,
		'should throw when numerators is not an array'
	)

	t.throws(
		() => {
			validateTermCollectionTvs(collectionTerm({ numerators: [] }))
		},
		/nonempty numerators/,
		'should throw when numerators is empty'
	)

	t.throws(
		() => {
			validateTermCollectionTvs(collectionTerm({ denominators: [], termlst: [] }))
		},
		/nonempty term.termlst/,
		'should throw when the collection has no member to imply the denominator'
	)

	t.throws(
		() => {
			validateTermCollectionTvs(collectionTerm({ numerators: [123] }))
		},
		/numerator id not non-empty string/,
		'should throw when numerators contains a non-string'
	)

	t.throws(
		() => {
			validateTermCollectionTvs(collectionTerm({ numerators: [''] }))
		},
		/numerator id not non-empty string/,
		'should throw when numerators contains an empty string'
	)

	t.throws(
		() => {
			validateTermCollectionTvs(collectionTerm({ numerators: ['term1', 'term1'] }))
		},
		/numerators\[\] contains duplicates/,
		'should throw for a duplicate numerator'
	)

	t.throws(
		() => {
			validateTermCollectionTvs(collectionTerm({ denominators: ['term1', 'term1'] }))
		},
		/denominators\[\] contains duplicates/,
		'should throw for a duplicate denominator'
	)

	t.throws(
		() => {
			validateTermCollectionTvs(collectionTerm({ denominators: ['term1', 'term4'] }))
		},
		/denominator 'term4' is not a collection member/,
		'should throw when a denominator is not a collection member'
	)

	t.throws(
		() => {
			validateTermCollectionTvs(collectionTerm({ denominators: ['term1'], numerators: ['term1', 'term2'] }))
		},
		/numerator 'term2' is not included in denominators/,
		'should throw when a numerator is not a denominator'
	)
	t.end()
})

import tape from 'tape'
import { isUsableTerm } from '../termdb.usecase.js'

/* Tests
- barchart term
- barchart overlay
- barchart term0
- cuminc term
- cuminc overlay
- survival term
- survival overlay
- evenCount term
- runChart2 date term
- runChart2 numeric term
- summaryInput term
- summaryInput term2
- summaryInput term0
*/

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- termdb.usecase specs -***-')
	test.end()
})

tape('barchart term', test => {
	const usecase = { target: 'barchart', detail: 'term' }
	multiDeepEqual(test, usecase, {
		plot: [{ type: 'categorical' }, { type: 'float' }, { type: 'integer' }, { type: 'condition' }],
		branch: [
			{ child_types: ['categorical'] },
			{ child_types: ['float'] },
			{ child_types: ['integer'] },
			{ child_types: ['condition'] },
			{ type: 'survival', child_types: ['float'] }
		],
		'': [{ type: 'survival', child_types: ['survival'] }]
	})

	test.end()
})

tape('barchart overlay', test => {
	const usecase = { target: 'barchart', detail: 'overlay' }
	multiDeepEqual(test, usecase, {
		plot: [{ type: 'categorical' }, { type: 'float' }, { type: 'integer' }, { type: 'condition' }],
		branch: [
			{ child_types: ['categorical'] },
			{ child_types: ['float'] },
			{ child_types: ['integer'] },
			{ child_types: ['condition'] },
			{ type: 'survival', child_types: ['float'] }
		],
		'': [{ type: 'survival', child_types: ['survival'] }]
	})

	test.end()
})

tape('barchart term0', test => {
	const usecase = { target: 'barchart', detail: 'term0' }
	multiDeepEqual(test, usecase, {
		plot: [{ type: 'categorical' }, { type: 'float' }, { type: 'integer' }, { type: 'condition' }],
		branch: [
			{ child_types: ['categorical'] },
			{ child_types: ['float'] },
			{ child_types: ['integer'] },
			{ child_types: ['condition'] },
			{ type: 'survival', child_types: ['float'] }
		],
		'': [{ type: 'survival', child_types: ['survival'] }]
	})

	test.end()
})

tape('cuminc term', test => {
	const usecase = { target: 'cuminc', detail: 'term' }

	multiDeepEqual(test, usecase, {
		plot: [{ type: 'condition' }],
		branch: [{ child_types: ['condition'] }],
		'': [
			{ type: 'categorical', child_types: ['categorical'] },
			{ type: 'float', child_types: ['float'] },
			{ type: 'integer', child_types: ['integer'] },
			{ type: 'survival', child_types: ['survival'] }
		]
	})

	test.end()
})

tape('cuminc overlay', test => {
	const usecase = { target: 'cuminc', detail: 'term2' }

	multiDeepEqual(test, usecase, {
		plot: [{ type: 'categorical' }, { type: 'float' }, { type: 'integer' }],
		branch: [{ child_types: ['categorical'] }, { child_types: ['float'] }, { child_types: ['integer'] }],
		'': [{ type: 'survival', child_types: ['survival'] }]
	})

	test.end()
})

tape('survival term', test => {
	const usecase = { target: 'survival', detail: 'term' }
	multiDeepEqual(test, usecase, {
		plot: [{ type: 'survival' }],
		branch: [{ child_types: ['survival'] }],
		'': [{}]
	})
	test.end()
})

tape('survival overlay', test => {
	const usecase = { target: 'survival', detail: 'term2' }
	multiDeepEqual(test, usecase, {
		plot: [{ isleaf: true, type: 'categorical' }],
		branch: [{ type: '', child_types: ['categorical'] }],
		'': [{ type: '', child_types: ['survival'] }]
	})

	test.end()
})

tape('pseudobulk is graphable in default and filter use cases', test => {
	const term = { type: 'pseudobulk', isleaf: true }
	test.deepEqual(isUsableTerm(term, {}), new Set(['plot']), 'allows pseudobulk in the default use case')
	test.deepEqual(isUsableTerm(term, { target: 'filter' }), new Set(['plot']), 'allows pseudobulk in filters')
	test.end()
})

tape('evenCount term', test => {
	const usecase = { target: 'evenCount', detail: 'term' }
	multiDeepEqual(test, usecase, {
		plot: [{ isleaf: true, type: 'date' }],
		branch: [{ type: '', child_types: ['date'] }]
	})

	test.end()
})

tape('runChart2 date term', test => {
	const usecase = { target: 'runChart2', detail: 'date' }
	multiDeepEqual(test, usecase, {
		plot: [{ isleaf: true, type: 'date' }],
		branch: [{ type: '', child_types: ['date'] }]
	})

	test.end()
})

tape('runChart2 numeric term', test => {
	const usecase = { target: 'runChart2', detail: 'numeric' }
	multiDeepEqual(test, usecase, {
		plot: [{ type: 'float' }, { type: 'integer' }],
		branch: [{ type: '', child_types: ['float', 'integer'] }]
	})

	test.end()
})

tape('summaryInput term', test => {
	const usecase = { target: 'summaryInput', detail: 'term' }
	multiDeepEqual(test, usecase, {
		plot: [
			{ type: 'categorical', isleaf: true },
			{ type: 'float', isleaf: true },
			{ type: 'integer', isleaf: true },
			{ type: 'condition', isleaf: true },
			{ type: 'survival', isleaf: true }
		],
		branch: [
			{ child_types: ['categorical'] },
			{ child_types: ['float'] },
			{ child_types: ['integer'] },
			{ child_types: ['condition'] },
			{ child_types: ['survival'] }
		]
	})

	test.end()
})

tape('summaryInput term2', test => {
	const usecase = { target: 'summaryInput', detail: 'term2' }
	multiDeepEqual(test, usecase, {
		plot: [
			{ type: 'categorical', isleaf: true },
			{ type: 'float', isleaf: true },
			{ type: 'integer', isleaf: true },
			{ type: 'condition', isleaf: true }
		],
		branch: [
			{ child_types: ['categorical'] },
			{ child_types: ['float'] },
			{ child_types: ['integer'] },
			{ child_types: ['condition'] }
		]
	})

	test.end()
})

tape('summaryInput term0', test => {
	const usecase = { target: 'summaryInput', detail: 'term0' }
	multiDeepEqual(test, usecase, {
		plot: [
			{ type: 'categorical', isleaf: true },
			{ type: 'float', isleaf: true },
			{ type: 'integer', isleaf: true },
			{ type: 'condition', isleaf: true }
		],
		branch: [
			{ child_types: ['categorical'] },
			{ child_types: ['float'] },
			{ child_types: ['integer'] },
			{ child_types: ['condition'] }
		]
	})

	test.end()
})

tape('swimmer pointTerm', test => {
	const usecase = { target: 'swimmer', detail: 'pointTerm', sampleTypes: ['4'] }
	const uses = term => isUsableTerm(term, usecase)
	test.deepEqual(
		uses({ type: 'categorical', isleaf: true, sample_type: '4' }),
		new Set(['plot']),
		'should allow a categorical term of a point sample type'
	)
	test.deepEqual(
		uses({ type: 'float', isleaf: true, sample_type: 4 }),
		new Set(['plot']),
		'should allow a numeric term of a point sample type, also with a numeric sample_type'
	)
	test.deepEqual(
		uses({ type: 'multivalue', isleaf: true, sample_type: '4' }),
		new Set(),
		'should not allow a multivalue term, a marker has one color'
	)
	test.deepEqual(
		uses({ type: 'survival', isleaf: true, sample_type: '4' }),
		new Set(),
		'should not allow a survival term'
	)
	test.deepEqual(
		uses({ type: 'categorical', isleaf: true, sample_type: '2' }),
		new Set(),
		'should not allow a term of another sample type'
	)
	test.deepEqual(
		uses({ type: 'categorical', isleaf: true }),
		new Set(),
		'should not allow a term without a sample type'
	)
	test.deepEqual(
		uses({ isleaf: false, sample_type: '4', child_types: ['categorical', 'float'] }),
		new Set(['branch']),
		'should allow a branch of a point sample type'
	)
	test.deepEqual(
		uses({ isleaf: false, sample_type: '1', child_types: ['categorical'] }),
		new Set(),
		'should not allow a branch of another sample type'
	)
	test.deepEqual(
		isUsableTerm({ type: 'categorical', isleaf: true, sample_type: '2' }, { target: 'swimmer', detail: 'term0' }),
		new Set(['plot']),
		'should still allow any sample type for divide-by (term0)'
	)
	test.end()
})

tape('samplelst term in the filter use case', test => {
	const usecase = { target: 'filter' }
	const listed = {
		type: 'samplelst',
		isleaf: true,
		values: { A: { key: 'A', list: [{ sample: 's1' }] }, B: { key: 'B', list: [{ sample: 's2' }] } }
	}
	test.deepEqual(isUsableTerm(listed, usecase), new Set(['plot']), 'allows a samplelst term whose groups list samples')
	const byFilter = { type: 'samplelst', isleaf: true, values: { A: { key: 'A' }, B: { key: 'B' } } }
	test.deepEqual(
		isUsableTerm(byFilter, usecase),
		new Set(),
		'does not allow a samplelst term whose groups list no sample'
	)
	const mixed = { type: 'samplelst', isleaf: true, values: { A: listed.values.A, B: { key: 'B' } } }
	test.deepEqual(
		isUsableTerm(mixed, usecase),
		new Set(),
		'does not allow a samplelst term with a group that lists no sample'
	)
	test.deepEqual(
		isUsableTerm(byFilter, { target: 'barchart', detail: 'term' }),
		new Set(['plot']),
		'still allows a samplelst term whose groups list no sample in a plot'
	)
	test.end()
})

/*************************
 reusable helper functions
**************************/

function multiDeepEqual(test, usecase, inputs) {
	Object.freeze(usecase)
	for (const key in inputs) {
		const expected = key.split(',').filter(s => !!s)
		const uses = expected.map(d => `'${d}'`).join(', ')

		for (const term of inputs[key]) {
			const child_types = JSON.stringify(term.child_types || [])
			if (!term.type) term.type = ''

			test.deepEqual(
				isUsableTerm(term, usecase),
				new Set(expected),
				`should return {${uses}} for ${usecase.detail}.type='${term.type}' and child_types=${child_types}`
			)
		}
	}
}

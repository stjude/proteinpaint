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

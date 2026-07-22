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
- profileForms2 - leaf term returns empty
- profileForms2 - missing domains config returns empty
- profileForms2 - depth-3 match returns 'plot'
- profileForms2 - depth-3 wrong subtype returns empty
- profileForms2 - depth-3 not in domains returns empty
- profileForms2 - depth-1/2 matching descendant returns 'branch'
- profileForms2 - depth-1/2 no matching descendant returns empty
- profileForms2 - depth-1/2 descendant with wrong subtype returns empty
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

/*************************************
 profileForms2 picker tree-filter tests
**************************************/

// Shared termdbConfig fixture for the profileForms2 cases below: one cohort 'full'
// with two template-bearing domains, each declaring its supported plot types.
const profileForms2TermdbConfig = {
	plotConfigByCohort: {
		full: {
			profileForms2: {
				domains: [
					{ id: 'A__B__YN_Domain', plotTypes: ['Yes/No Barchart'] },
					{ id: 'A__B__Likert_Domain', plotTypes: ['Likert Scale'] }
				]
			}
		}
	}
}

tape('profileForms2 - leaf term returns empty', test => {
	const usecase = { target: 'profileForms2', cohort: 'full', subtype: 'Likert Scale' }
	const uses = isUsableTerm({ id: 'A__B__Likert_Domain', isleaf: true }, usecase, profileForms2TermdbConfig)
	test.deepEqual(uses, new Set(), 'leaf term should yield empty uses regardless of domains config')
	test.end()
})

tape('profileForms2 - missing domains config returns empty', test => {
	const usecase = { target: 'profileForms2', cohort: 'full', subtype: 'Likert Scale' }
	test.deepEqual(
		isUsableTerm({ id: 'A__B__Likert_Domain' }, usecase, undefined),
		new Set(),
		'missing termdbConfig should yield empty uses'
	)
	test.deepEqual(
		isUsableTerm({ id: 'A__B__Likert_Domain' }, usecase, { plotConfigByCohort: {} }),
		new Set(),
		'missing cohort entry should yield empty uses'
	)
	test.deepEqual(
		isUsableTerm({ id: 'A__B__Likert_Domain' }, usecase, { plotConfigByCohort: { full: {} } }),
		new Set(),
		'missing profileForms2 entry should yield empty uses'
	)
	test.end()
})

tape("profileForms2 - depth-3 match returns 'plot'", test => {
	const usecase = { target: 'profileForms2', cohort: 'full', subtype: 'Likert Scale' }
	const uses = isUsableTerm({ id: 'A__B__Likert_Domain' }, usecase, profileForms2TermdbConfig)
	test.deepEqual(uses, new Set(['plot']), "depth-3 id in domains with matching subtype should yield {'plot'}")
	test.end()
})

tape('profileForms2 - depth-3 wrong subtype returns empty', test => {
	const usecase = { target: 'profileForms2', cohort: 'full', subtype: 'Yes/No Barchart' }
	const uses = isUsableTerm({ id: 'A__B__Likert_Domain' }, usecase, profileForms2TermdbConfig)
	test.deepEqual(uses, new Set(), 'depth-3 id in domains but plotTypes lacks active subtype should yield empty uses')
	test.end()
})

tape('profileForms2 - depth-3 not in domains returns empty', test => {
	const usecase = { target: 'profileForms2', cohort: 'full', subtype: 'Likert Scale' }
	const uses = isUsableTerm({ id: 'A__B__UnknownDomain' }, usecase, profileForms2TermdbConfig)
	test.deepEqual(uses, new Set(), 'depth-3 id not present in domains should yield empty uses')
	test.end()
})

tape("profileForms2 - depth-1/2 matching descendant returns 'branch'", test => {
	const usecase = { target: 'profileForms2', cohort: 'full', subtype: 'Likert Scale' }
	test.deepEqual(
		isUsableTerm({ id: 'A' }, usecase, profileForms2TermdbConfig),
		new Set(['branch']),
		"depth-1 ancestor of a matching domain should yield {'branch'}"
	)
	test.deepEqual(
		isUsableTerm({ id: 'A__B' }, usecase, profileForms2TermdbConfig),
		new Set(['branch']),
		"depth-2 ancestor of a matching domain should yield {'branch'}"
	)
	test.end()
})

tape('profileForms2 - depth-1/2 no matching descendant returns empty', test => {
	const usecase = { target: 'profileForms2', cohort: 'full', subtype: 'Likert Scale' }
	const uses = isUsableTerm({ id: 'Z' }, usecase, profileForms2TermdbConfig)
	test.deepEqual(uses, new Set(), 'depth-1 with no descendant matching the prefix should yield empty uses')
	test.end()
})

tape('profileForms2 - depth-1/2 descendant with wrong subtype returns empty', test => {
	// Both domains are descendants of 'A' (prefix 'A__'), but neither has 'Survival' as a plot type.
	const usecase = { target: 'profileForms2', cohort: 'full', subtype: 'Survival' }
	const uses = isUsableTerm({ id: 'A' }, usecase, profileForms2TermdbConfig)
	test.deepEqual(
		uses,
		new Set(),
		'depth-1 with descendants present but none offering active subtype should yield empty uses'
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

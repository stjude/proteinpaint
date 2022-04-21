const tape = require('tape')
const isUsableTerm = require('../termdb.usecase').isUsableTerm

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- termdb.usecase specs -***-')
	test.end()
})

tape('cuminc term', test => {
	test.deepEqual(
		isUsableTerm({ type: 'condition' }, { target: 'cuminc', detail: 'term' }),
		new Set(['plot']),
		`should return Set{'plot'} for term.type='condition'`
	)

	test.deepEqual(
		isUsableTerm({ type: '', child_types: ['condition'] }, { target: 'cuminc', detail: 'term' }),
		new Set(['branch']),
		`should return Set{'branch'} for term.type != 'condition' and term.child_types=['condition',...]`
	)

	test.deepEqual(
		isUsableTerm({ type: '', child_types: [] }, { target: 'cuminc', detail: 'term' }),
		new Set([]),
		`should return an empty set for term.type != 'condition' and !term.child_types.includes('condition')`
	)

	test.end()
})

tape('cuminc overlay', test => {
	test.deepEqual(
		isUsableTerm({ isleaf: true }, { target: 'cuminc', detail: 'term2' }),
		new Set(['plot']),
		`should return Set{'plot'} for any term.isleaf`
	)

	test.deepEqual(
		isUsableTerm({ type: '', child_types: ['categorical'] }, { target: 'cuminc', detail: 'term2' }),
		new Set(['plot', 'branch']),
		`should return Set{'plot', 'branch'} for !term.isleaf and !term.type, but with acceptable term.child_types`
	)

	test.deepEqual(
		isUsableTerm({ type: 'survival', child_types: [] }, { target: 'cuminc', detail: 'term2' }),
		new Set([]),
		`should return an empty set for term.type='survival' and term.child_types=[]`
	)

	test.end()
})

tape('survival term', test => {
	test.deepEqual(
		isUsableTerm({ type: 'survival' }, { target: 'survival', detail: 'term' }),
		new Set(['plot']),
		`should return Set{'plot'} for term.type='survival'`
	)

	test.deepEqual(
		isUsableTerm({ type: '', child_types: ['survival'] }, { target: 'survival', detail: 'term' }),
		new Set(['branch']),
		`should return Set{'branch'} for term.type != 'survival' and term.child_types=['survival',...]`
	)

	test.deepEqual(
		isUsableTerm({ type: '', child_types: [] }, { target: 'survival', detail: 'term' }),
		new Set([]),
		`should return an empty set for term.type != 'survival and !term.child_types.includes('survival')`
	)
	test.end()
})

tape('survival overlay', test => {
	test.deepEqual(
		isUsableTerm({ isleaf: true }, { target: 'survival', detail: 'term2' }),
		new Set(['plot']),
		`should return Set{'plot'} for any term.isleaf`
	)

	test.deepEqual(
		isUsableTerm({ type: '', child_types: ['categorical'] }, { target: 'survival', detail: 'term2' }),
		new Set(['branch']),
		`should return Set{'branch'} for !term.isleaf and !term.type, but with acceptable term.child_types`
	)

	test.deepEqual(
		isUsableTerm({ type: '', child_types: ['survival'] }, { target: 'survival', detail: 'term2' }),
		new Set([]),
		`should return an empty set for !term.isleaf and !term.type and term.child_types=['survival']`
	)

	test.end()
})

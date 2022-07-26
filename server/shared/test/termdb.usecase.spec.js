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
	test.equal(
		isUsableTerm({ type: 'condition' }, { target: 'cuminc', detail: 'term' }),
		'plot',
		`should return 'plot' for term.type='condition'`
	)

	test.equal(
		isUsableTerm({ type: '', included_types: ['condition'] }, { target: 'cuminc', detail: 'term' }),
		'tree',
		`should return 'tree' for term.type != 'condition' and term.included_types=['condition',...]`
	)

	test.equal(
		isUsableTerm({ type: '', included_types: [] }, { target: 'cuminc', detail: 'term' }),
		false,
		`should return false for term.type != 'condition' and !term.included_types.includes('condition')`
	)
	test.end()
})

tape('cuminc overlay', test => {
	test.equal(
		isUsableTerm({ isleaf: true }, { target: 'cuminc', detail: 'term2' }),
		'plot',
		`should return 'plot' for any term.isleaf`
	)

	test.equal(
		isUsableTerm({ type: '', included_types: ['categorical'] }, { target: 'cuminc', detail: 'term2' }),
		'tree',
		`should return 'tree' for !term.isleaf and !term.type, but with acceptable term.included_types`
	)

	test.equal(
		isUsableTerm({ type: '', included_types: ['survival'] }, { target: 'cuminc', detail: 'term2' }),
		false,
		`should return false for !term.isleaf and !term.type and term.included_types=['survival']`
	)

	test.end()
})

tape('survival term', test => {
	test.equal(
		isUsableTerm({ type: 'survival' }, { target: 'survival', detail: 'term' }),
		'plot',
		`should return 'plot' for term.type='survival'`
	)

	test.equal(
		isUsableTerm({ type: '', included_types: ['survival'] }, { target: 'survival', detail: 'term' }),
		'tree',
		`should return 'tree' for term.type != 'survival' and term.included_types=['survival',...]`
	)

	test.equal(
		isUsableTerm({ type: '', included_types: [] }, { target: 'survival', detail: 'term' }),
		false,
		`should return false for term.type != 'survival and !term.included_types.includes('survival')`
	)
	test.end()
})

tape('survival overlay', test => {
	test.equal(
		isUsableTerm({ isleaf: true }, { target: 'survival', detail: 'term2' }),
		'plot',
		`should return 'survival' for any term.isleaf`
	)

	test.equal(
		isUsableTerm({ type: '', included_types: ['categorical'] }, { target: 'survival', detail: 'term2' }),
		'tree',
		`should return 'tree' for !term.isleaf and !term.type, but with acceptable term.included_types`
	)

	test.equal(
		isUsableTerm({ type: '', included_types: ['survival'] }, { target: 'survival', detail: 'term2' }),
		false,
		`should return false for !term.isleaf and !term.type and term.included_types=['survival']`
	)

	test.end()
})

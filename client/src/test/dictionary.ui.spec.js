const tape = require('tape')
const parseTabDelimitedData = require('../dictionary.ui.js').parseTabDelimitedData
const d3s = require('d3-selection')

/***********************************
 reusable helper vars and functions
************************************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
	//.node()
}

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- dictionary.ui -***-')
	test.end()
})

tape('levels before name+note, no gaps', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable name\tvariable note`,
		`A\tA.1\tA.1.a\tA1a\t1=Yes; 0=No`,
		`A\tA.1\tA.1.b\tA1b\t1=Yes; 0=No`,
		`A\tA.2\tA.2.a\tA2a\t1=Treated; 0=Not treated`,
		`B\tB.1\tB.1.a\tB1a\t1=Treated; 0=Not treated`
	].join('\n')

	const holder = getHolder()
	const results = parseTabDelimitedData(holder, tsv) //; console.log(JSON.stringify(results.terms))
	const expected = [
		{
			id: 'A1a',
			name: 'A.1.a',
			type: 'categorical',
			values: { '0': { label: 'No' }, '1': { label: 'Yes' } },
			groupsetting: { inuse: false },
			isleaf: true,
			parent_id: 'A.1'
		},
		{
			id: 'A1b',
			name: 'A.1.b',
			type: 'categorical',
			values: { '0': { label: 'No' }, '1': { label: 'Yes' } },
			groupsetting: { inuse: false },
			isleaf: true,
			parent_id: 'A.1'
		},
		{
			id: 'A2a',
			name: 'A.2.a',
			type: 'categorical',
			values: { '0': { label: 'Not treated' }, '1': { label: 'Treated' } },
			groupsetting: { inuse: false },
			isleaf: true,
			parent_id: 'A.2'
		},
		{
			id: 'B1a',
			name: 'B.1.a',
			type: 'categorical',
			values: { '0': { label: 'Not treated' }, '1': { label: 'Treated' } },
			groupsetting: { inuse: false },
			isleaf: true,
			parent_id: 'B.1'
		},
		{ id: 'A', name: 'A', isleaf: false, parent_id: null },
		{ id: 'A.1', name: 'A.1', isleaf: false, parent_id: 'A' },
		{ id: 'A.2', name: 'A.2', isleaf: false, parent_id: 'A' },
		{ id: 'B', name: 'B', isleaf: false, parent_id: null },
		{ id: 'B.1', name: 'B.1', isleaf: false, parent_id: 'B' }
	]
	test.deepEqual(results.terms, expected, 'should output the expected terms array')
	test.end()
})

tape('levels after name+note, with gap', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`variable name\tvariable note\tlevel_1\tlevel_2\tlevel_3\tlevel_4`,
		`A1ai\t1=Yes; 0=No\tA\tA.1\tA.1.a\tA.1.a.i`,
		`A1b\t1=Yes; 0=No\tA\tA.1\tA.1.b\t-`,
		`A2a\t1=Treated; 0=Not treated\tA\tA.2\tA.2.a\t-`,
		`B1a\t1=Treated; 0=Not treated\tB\tB.1\tB.1.a\t-`
	].join('\n')

	const message = 'should output the expected terms array'
	try {
		const holder = getHolder()
		const results = parseTabDelimitedData(holder, tsv) //; console.log(JSON.stringify(results.terms))
		const expected = [
			{
				id: 'A1ai',
				name: 'A.1.a.i',
				type: 'categorical',
				values: { '0': { label: 'No' }, '1': { label: 'Yes' } },
				groupsetting: { inuse: false },
				isleaf: true,
				parent_id: 'A.1.a'
			},
			{
				id: 'A1b',
				name: 'A.1.b',
				type: 'categorical',
				values: { '0': { label: 'No' }, '1': { label: 'Yes' } },
				groupsetting: { inuse: false },
				isleaf: true,
				parent_id: 'A.1'
			},
			{
				id: 'A2a',
				name: 'A.2.a',
				type: 'categorical',
				values: { '0': { label: 'Not treated' }, '1': { label: 'Treated' } },
				groupsetting: { inuse: false },
				isleaf: true,
				parent_id: 'A.2'
			},
			{
				id: 'B1a',
				name: 'B.1.a',
				type: 'categorical',
				values: { '0': { label: 'Not treated' }, '1': { label: 'Treated' } },
				groupsetting: { inuse: false },
				isleaf: true,
				parent_id: 'B.1'
			},
			{ id: 'A', name: 'A', isleaf: false, parent_id: null },
			{ id: 'A.1', name: 'A.1', isleaf: false, parent_id: 'A' },
			{ id: 'A.1.a', name: 'A.1.a', isleaf: false, parent_id: 'A.1' },
			{ id: 'A.2', name: 'A.2', isleaf: false, parent_id: 'A' },
			{ id: 'B', name: 'B', isleaf: false, parent_id: null },
			{ id: 'B.1', name: 'B.1', isleaf: false, parent_id: 'B' }
		]
		test.deepEqual(results.terms, expected, message)
	} catch (e) {
		test.fail(message + ': ' + e)
	}
	test.end()
})

tape('repeated level names, same line', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable name\tvariable note`,
		`A\tA.1\tA.1\tA1\t1=Yes; 0=No`,
		`A\tA.1\tA.1.b\tA1b\t1=Yes; 0=No`,
		`A\tA.2\tA.2.a\tA2a\t1=Treated; 0=Not treated`,
		`B\tB.1\tB.1.a\tB1a\t1=Treated; 0=Not treated`
	].join('\n')

	const holder = getHolder()
	const message = 'should display an error for repeated level names in the same line'
	try {
		const holder = getHolder()
		const results = parseTabDelimitedData(holder, tsv)
		test.equal(holder.selectAll('.sja_errorbar').size(), 1, message)
	} catch (e) {
		test.equal(holder.selectAll('.sja_errorbar').size(), 1, message)
	}
	test.end()
})

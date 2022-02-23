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
	const results = parseTabDelimitedData(holder, tsv) //console.log(JSON.stringify(results.terms))
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
	test.equal(holder.selectAll('.sja_errorbar').size(), 0, 'should not display any errors')
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
		test.equal(holder.selectAll('.sja_errorbar').size(), 0, 'should not display any errors')
	} catch (e) {
		test.fail(message + ': ' + e)
	}
	test.end()
})

tape('empty variable name', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable name\tvariable note`,
		`A\tA.1\tA.1.a\t\t1=Yes; 0=No`,
		`A\tA.1\tA.1.b\tA1b\t1=Yes; 0=No`,
		`A\tA.2\tA.2.a\tA2a\t1=Treated; 0=Not treated`,
		`B\tB.1\tB.1.a\tB1a\t1=Treated; 0=Not treated`
	].join('\n')

	const holder = getHolder()
	const results = parseTabDelimitedData(holder, tsv) //; console.log(JSON.stringify(results.terms))
	const expected = [
		{
			id: 'A.1.a',
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
	test.deepEqual(results.terms, expected, 'should use the variable name as term.id')
	test.equal(holder.selectAll('.sja_errorbar').size(), 0, 'should not display any errors')
	test.end()
})

tape('extra, non essential column', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tabsolute nonsense\tvariable name\tvariable note`,
		`A\tA.1\tA.1.a\tfoo bar\tA1a\t1=Yes; 0=No`,
		`A\tA.1\tA.1.b\tfoo bar\tA1b\t1=Yes; 0=No`,
		`A\tA.2\tA.2.a\tfoo bar\tA2a\t1=Treated; 0=Not treated`,
		`B\tB.1\tB.1.a\tfoo bar\tB1a\t1=Treated; 0=Not treated`
	].join('\n')

	const message = `should display data properly, no errors`
	try {
		const holder = getHolder()
		const results = parseTabDelimitedData(holder, tsv)
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
		test.deepEqual(results.terms, expected, message)
		test.equal(holder.selectAll('.sja_errorbar').size(), 0, 'should not display any errors')
	} catch (e) {
		test.fail(message + ': ' + e)
	}
	test.end()
})

tape('no level columns', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`variable name\tvariable note`,
		`A1a\t1=Yes; 0=No`,
		`A1b\t1=Yes; 0=No`,
		`A2a\t1=Treated; 0=Not treated`,
		`B1a\t1=Treated; 0=Not treated`
	].join('\n')

	const message = `should display dictionary with variable name (i.e. id) as name`
	try {
		const holder = getHolder()
		const results = parseTabDelimitedData(holder, tsv)
		const expected = [
			{
				id: 'A1a',
				name: 'A1a',
				type: 'categorical',
				values: { '0': { label: 'No' }, '1': { label: 'Yes' } },
				groupsetting: { inuse: false },
				isleaf: true,
				parent_id: null
			},
			{
				id: 'A1b',
				name: 'A1b',
				type: 'categorical',
				values: { '0': { label: 'No' }, '1': { label: 'Yes' } },
				groupsetting: { inuse: false },
				isleaf: true,
				parent_id: null
			},
			{
				id: 'A2a',
				name: 'A2a',
				type: 'categorical',
				values: { '0': { label: 'Not treated' }, '1': { label: 'Treated' } },
				groupsetting: { inuse: false },
				isleaf: true,
				parent_id: null
			},
			{
				id: 'B1a',
				name: 'B1a',
				type: 'categorical',
				values: { '0': { label: 'Not treated' }, '1': { label: 'Treated' } },
				groupsetting: { inuse: false },
				isleaf: true,
				parent_id: null
			}
		]
		test.deepEqual(results.terms, expected, message)
		test.equal(holder.selectAll('.sja_errorbar').size(), 0, 'should not display dictionary, no errors')
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
		const results = parseTabDelimitedData(holder, tsv)
		const errorbar = holder.selectAll('.sja_errorbar')
		test.equal(errorbar.size(), 1, `should display error for identicial level names and not throw`)
		const expectedStr = 'non-unique'
		test.true(
			errorbar
				.text()
				.toLowerCase()
				.includes(expectedStr),
			`should have '${expectedStr}' in the error message`
		)
	} catch (e) {
		test.fail('An error should only be displayed and NOT thrown for this validation step: ' + e)
	}
	test.end()
})

tape('dash between levels', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable name\tvariable note`,
		`A\tA.1\tA.1.a\tA1a\t1=Yes; 0=No`,
		`A\tA.1\tA.1.b\tA1b\t1=Yes; 0=No`,
		`A\t-\tA.2.a\tA2a\t1=Treated; 0=Not treated`,
		`B\tB.1\tB.1.a\tB1a\t1=Treated; 0=Not treated`
	].join('\n')

	const holder = getHolder()
	const message = `should display an error for a '-' between level names`
	try {
		const results = parseTabDelimitedData(holder, tsv)
		const errorbar = holder.selectAll('.sja_errorbar')
		test.equal(errorbar.size(), 1, `should display error for blank of '-' between level names and not throw`)
		const expectedStr = '-'
		test.true(
			errorbar
				.text()
				.toLowerCase()
				.includes(expectedStr),
			`should have '${expectedStr}' in the error message`
		)
	} catch (e) {
		test.fail('An error should only be displayed and NOT thrown for this validation step: ' + e)
	}
	test.end()
})

tape('empty configuration', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable name\tvariable note`,
		`A\tA.1\tA.1.a\tA1a\t1=Yes; 0=No`,
		`A\tA.1\tA.1.b\tA1b\t1=Yes; 0=No`,
		`A\tA2\tA.2.a\tA2a\t`,
		`B\tB.1\tB.1.a\tB1a\t1=Treated; 0=Not treated`
	].join('\n')

	const holder = getHolder()
	try {
		const results = parseTabDelimitedData(holder, tsv)
		// check for error display here if no errors are thrown, otherwise check within the catch block
		const errorbar = holder.selectAll('.sja_errorbar')
		test.equal(errorbar.size(), 1, `should display error for missing configuration and not throw`)
		const expectedStr = 'missing variable note'
		test.true(
			errorbar
				.text()
				.toLowerCase()
				.includes(expectedStr),
			`should have '${expectedStr}' in the error message`
		)
	} catch (e) {
		// there should be a test.equal(..) or test.pass(...) here if code execution is expected to stop
		// otherwise, the test failed
		test.fail('An error should only be displayed and NOT thrown for this validation step: ' + e)
	}
	test.end()
})

tape('missing k=v in config', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable name\tvariable note`,
		`A\tA.1\tA.1.a\tA1a\t1=Yes; 0=No`,
		`A\tA.1\tA.1.b\tA1b\t1=Yes; 0=No`,
		`A\tA2\tA.2.a\tA2a\t1`,
		`B\tB.1\tB.1.a\tB1a\t1=Treated; 0=Not treated`
	].join('\n')

	const holder = getHolder()
	try {
		const results = parseTabDelimitedData(holder, tsv)
		// check for error display here if no errors are thrown, otherwise check within the catch block
		const errorbar = holder.selectAll('.sja_errorbar')
		test.equal(errorbar.size(), 1, `should display an error for missing value for config key and not throw`)
		const expectedStr = 'note is not'
		test.true(
			errorbar
				.text()
				.toLowerCase()
				.includes(expectedStr),
			`should have '${expectedStr}' in the error message`
		)
	} catch (e) {
		// there should be a test.equal(..) or test.pass(...) here if code execution is expected to stop
		// otherwise, the test failed
		test.fail('An error should only be displayed and NOT thrown for this validation step: ' + e)
	}
	test.end()
})

tape('repeated intermediate terms for diff branches, whole dataset', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable name\tvariable note`,
		`A\tA.1\tA.1a\tA1a\t1=Yes; 0=No`,
		`A\tsameterm\tA.1.b\tA1b\t1=Yes; 0=No`,
		`A2\tsameterm\tA.2.a\tA2a\t1=Treated; 0=Not treated`,
		`B\tB.1\tB.1.a\tB1a\t1=Treated; 0=Not treated`
	].join('\n')

	const holder = getHolder()
	try {
		const results = parseTabDelimitedData(holder, tsv)
		// check for error display here if no errors are thrown, otherwise check within the catch block
		const errorbar = holder.selectAll('.sja_errorbar')
		test.equal(errorbar.size(), 1, 'should display an error for identical intermediate level names, but not throw')
		const expectedStr = 'different parents'
		test.true(
			errorbar
				.text()
				.toLowerCase()
				.includes(expectedStr),
			`should have '${expectedStr}' in the error message`
		)
	} catch (e) {
		// there should be a test.equal(..) or test.pass(...) here if code execution is expected to stop
		// otherwise, the test failed
		test.fail('An error should only be displayed and NOT thrown for this validation step: ' + e)
	}
	test.end()
})

tape('missing variable name header', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable\tvariable note`,
		`A\tA.1\tA.1a\tA1a\t1=Yes; 0=No`,
		`A\tA.1\tA.1.b\tA1b\t1=Yes; 0=No`,
		`A2\tA.2\tA.2.a\tA2a\t1=Treated; 0=Not treated`,
		`B\tB.1\tB.1.a\tB1a\t1=Treated; 0=Not treated`
	].join('\n')

	const holder = getHolder()
	const message = 'Should throw on missing variable name header'
	try {
		const results = parseTabDelimitedData(holder, tsv)
		// test fails because the function did not throw
		test.fail(message)
	} catch (e) {
		// test passes because the function is expected to throw
		test.pass(message)
	}

	// an error message should also be displayed for the user
	const errorbar = holder.selectAll('.sja_errorbar')
	test.equal(errorbar.size(), 1, 'should display an error for missing variable name header')
	const expectedStr = 'variable name'
	test.true(
		errorbar
			.text()
			.toLowerCase()
			.includes(expectedStr),
		`should have '${expectedStr}' in the error message`
	)

	test.end()
})

tape('missing variable note header', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable name\tvariable`,
		`A\tA.1\tA.1a\tA1a\t1=Yes; 0=No`,
		`A\tA.1\tA.1.b\tA1b\t1=Yes; 0=No`,
		`A2\tA.2\tA.2.a\tA2a\t1=Treated; 0=Not treated`,
		`B\tB.1\tB.1.a\tB1a\t1=Treated; 0=Not treated`
	].join('\n')

	const holder = getHolder()
	const message = 'Should throw on missing variable note header'
	try {
		const results = parseTabDelimitedData(holder, tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message)
	}

	const errorbar = holder.selectAll('.sja_errorbar')
	test.equal(errorbar.size(), 1, 'should display an error for missing variable note header, but not throw')
	const expectedStr = 'variable note'
	test.true(
		errorbar
			.text()
			.toLowerCase()
			.includes(expectedStr),
		`should have '${expectedStr}' in the error message`
	)

	test.end()
})

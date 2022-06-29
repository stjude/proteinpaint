const tape = require('tape')
const parseDictionary = require('../dictionary.parse').parseDictionary
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
	test.pass('-***- dictionary.ui, phenotree parsing -***-')
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
	const results = parseDictionary(tsv) //console.log(JSON.stringify(results.terms))
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
		const results = parseDictionary(tsv) //; console.log(JSON.stringify(results.terms))
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
	const results = parseDictionary(tsv) //; console.log(JSON.stringify(results.terms))
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
		const results = parseDictionary(tsv)
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
		const results = parseDictionary(tsv)
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
		`A\tA.1\tA.1.a\tA1a\t1=Yes; 0=No`,
		`A\tA.1\tA.1.b\tA1b\t1=Yes; 0=No`,
		`A\tA.2\tA.2.a\tA2a\t1=Treated; 0=Not treated`,
		`B\tB.1\tB.1.a\tB1a\t1=Treated; 0=Not treated`
	].join('\n')

	const holder = getHolder()
	const message = 'should display an error for repeated level names in the same line'
	try {
		const results = parseDictionary(tsv)
		test.equal(holder.selectAll('.sja_errorbar').size(), 0, 'should not display dictionary, no errors')
	} catch (e) {
		test.fail(message + ': ' + e)
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

	const message = `should throw an error for a '-' between level names in line 4`
	try {
		parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
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

	const message = `should throw an error for missing configuration in line 4`
	try {
		parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}
	test.end()
})

tape('missing k=v in config (phenotree format)', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable name\tvariable note`,
		`A\tA.1\tA.1.a\tA1a\t1=Yes; 0=No`,
		`A\tA.1\tA.1.b\tA1b\t1=Yes; 0=No`,
		`A\tA2\tA.2.a\tA2a\t1`,
		`B\tB.1\tB.1.a\tB1a\t1=Treated; 0=Not treated`
	].join('\n')

	const message = `should throw an error for configuration key in line 4`
	try {
		parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
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

	const message = `should throw an error for identical intermediate level name in lines 3 & 4`
	try {
		parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
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

	const message = 'Should throw on unrecognized file format'
	try {
		parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}

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

	const message = 'Should throw on missing variable note header'
	try {
		parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}
	test.end()
})

tape('\n', function(test) {
	test.pass('-***- dictionary.ui, data dictionary parsing-***-')
	test.end()
})

tape('missing parent_id header', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`term_id\tname\ttype\tvalues`,
		`A\tA+B\tcategorical\t1=Yes; 0=No`,
		`B\tB+C\tcategorical\t1=Yes; 0=No`,
		`A\tA+D\tcategorical\t1=Pending`,
		`B\tB+E\tcategorical\t1=Treated; 0=Not treated`
	].join('\n')

	const message = 'Should throw on missing parent_id header'
	try {
		parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}

	test.end()
})

tape('missing name header', function(test) {
	test.timeoutAfter(100)

	const tsv = [
		`term_id\tparent_id\tn\ttype\tvalues`,
		`A\tB\tA+B\tcategorical\t1=Yes; 0=No`,
		`B\tC\tB+C\tcategorical\t1=Yes; 0=No`,
		`A\tD\tA+D\tcategorical\t1=Pending`,
		`B\tE\tB+E\tcategorical\t1=Treated; 0=Not treated`
	].join('\n')

	const message = 'Should throw on missing name header'
	try {
		parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}

	test.end()
})

tape('missing type header', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`term_id\tparent_id\tname\tt\tvalues`,
		`A\tB\tA+B\tcategorical\t1=Yes; 0=No`,
		`B\tC\tB+C\tcategorical\t1=Yes; 0=No`,
		`A\tD\tA+D\tcategorical\t1=Pending`,
		`B\tE\tB+E\tcategorical\t1=Treated; 0=Not treated`
	].join('\n')

	const message = 'Should throw on missing type header'
	try {
		parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}

	test.end()
})

tape('missing values header', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`term_id\tparent_id\tname\ttype\tvalue`,
		`A\tB\tA+B\tcategorical\t1=Yes; 0=No`,
		`B\tC\tB+C\tcategorical\t1=Yes; 0=No`,
		`A\tD\tA+D\tcategorical\t1=Pending`,
		`B\tE\tB+E\tcategorical\t1=Treated; 0=Not treated`
	].join('\n')

	const message = 'Should throw on missing values header'
	try {
		const results = parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}
	test.end()
})

tape('blank or dash in required data column', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`term_id\tparent_id\tname\ttype\tvalues`,
		`A\tB\t\tcategorical\t1=Yes; 0=No`,
		`B\tC\tB+C\tcategorical\t1=Yes; 0=No`,
		`A\tD\tA+D\tcategorical\t1=Pending`,
		`B\tE\tB+E\tcategorical\t1=Treated; 0=Not treated`
	].join('\n')

	const message = `should throw an error for a '-' in required data columns, line 2`
	try {
		parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}
	test.end()
})

tape('missing k=v in values (dictionary format)', function(test) {
	test.timeoutAfter(100)
	const tsv = [
		`term_id\tparent_id\tname\ttype\tvalues`,
		`A\tB\tA+B\tcategorical\t1=Yes; 0=No`,
		`B\tC\tB+C\tcategorical\t1=Yes; 0=No`,
		`A\tD\tA+D\tcategorical\t1`,
		`B\tE\tB+E\tcategorical\t1=Treated; 0=Not treated`
	].join('\n')

	const message = `should throw an error for non k:v format, line 4`
	try {
		parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}
	test.end()
})

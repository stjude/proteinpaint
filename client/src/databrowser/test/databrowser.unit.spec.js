import tape from 'tape'
import { parseDictionary } from '../dictionary.parse'

/****************
Tests

- Phenotree parsing tests
	levels before variable, type, and categories - no gaps
	levels after variable, type, categories - with gap
	empty variable
	extra, non essential column
	no level columns
	repeated level names, same line
	dash between levels
	missing type
	repeated intermediate terms for diff branches, whole dataset
	missing Variable header
	missing Type header
	uncomputable category is a string but not number
	uncomputable category is empty string but not number
	add additional attributes to term

- Data dictionary parsing tests
	missing parent_id header
	missing name header
	missing type header
	missing values header
	blank or dash in required data column
	missing k=v in values (dictionary format)

*****************/

tape('\n', function (test) {
	test.comment('-***- dictionary, phenotree parsing -***-')
	test.end()
})

/**************
Phenotree tests
***************/

tape('levels before variable, type, and categories - no gaps', function (test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable\ttype\tcategories`,
		`A\tA.1\tA.1.a\tA1a\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\tA.1\tA.1.b\tA1b\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\tA.2\tA.2.a\tA2a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`,
		`B\tB.1\tB.1.a\tB1a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`
	].join('\n')

	const results = parseDictionary(tsv)
	const expected = [
		{
			id: 'A1a',
			name: 'A.1.a',
			type: 'categorical',
			values: { 0: { label: 'No' }, 1: { label: 'Yes' } },
			groupsetting: { disabled: true },
			child_order: 1,
			isleaf: true,
			parent_id: 'A.1'
		},
		{
			id: 'A1b',
			name: 'A.1.b',
			type: 'categorical',
			values: { 0: { label: 'No' }, 1: { label: 'Yes' } },
			groupsetting: { disabled: true },
			child_order: 2,
			isleaf: true,
			parent_id: 'A.1'
		},
		{
			id: 'A2a',
			name: 'A.2.a',
			type: 'categorical',
			values: { 0: { label: 'Not treated' }, 1: { label: 'Treated' } },
			groupsetting: { disabled: true },
			child_order: 1,
			isleaf: true,
			parent_id: 'A.2'
		},
		{
			id: 'B1a',
			name: 'B.1.a',
			type: 'categorical',
			values: { 0: { label: 'Not treated' }, 1: { label: 'Treated' } },
			groupsetting: { disabled: true },
			child_order: 1,
			isleaf: true,
			parent_id: 'B.1'
		},
		{ id: 'A', name: 'A', isleaf: false, child_order: 1, parent_id: null },
		{ id: 'A.1', name: 'A.1', isleaf: false, child_order: 1, parent_id: 'A' },
		{ id: 'A.2', name: 'A.2', isleaf: false, child_order: 2, parent_id: 'A' },
		{ id: 'B', name: 'B', isleaf: false, child_order: 2, parent_id: null },
		{ id: 'B.1', name: 'B.1', isleaf: false, child_order: 1, parent_id: 'B' }
	]
	test.deepEqual(results.terms, expected, 'should output the expected terms array')
	test.end()
})

tape('levels after variable, type, categories - with gap', function (test) {
	test.timeoutAfter(100)
	const tsv = [
		`variable\ttype\tcategories\tlevel_1\tlevel_2\tlevel_3\tlevel_4`,
		`A1ai\tcategorical\t{ "0": {"label": "No" }, "1": { "label": "Yes" } }\tA\tA.1\tA.1.a\tA.1.a.i`,
		`A1b\tcategorical\t{ "0": {"label": "No" }, "1": { "label": "Yes" } }\tA\tA.1\tA.1.b\t-`,
		`A2a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }\tA\tA.2\tA.2.a\t-`,
		`B1a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }\tB\tB.1\tB.1.a\t-`
	].join('\n')

	const message = 'should output the expected terms array'
	try {
		const results = parseDictionary(tsv)
		const expected = [
			{
				id: 'A1ai',
				name: 'A.1.a.i',
				type: 'categorical',
				values: { 0: { label: 'No' }, 1: { label: 'Yes' } },
				groupsetting: { disabled: true },
				child_order: 1,
				isleaf: true,
				parent_id: 'A.1.a'
			},
			{
				id: 'A1b',
				name: 'A.1.b',
				type: 'categorical',
				values: { 0: { label: 'No' }, 1: { label: 'Yes' } },
				groupsetting: { disabled: true },
				child_order: 2,
				isleaf: true,
				parent_id: 'A.1'
			},
			{
				id: 'A2a',
				name: 'A.2.a',
				type: 'categorical',
				values: { 0: { label: 'Not treated' }, 1: { label: 'Treated' } },
				groupsetting: { disabled: true },
				child_order: 1,
				isleaf: true,
				parent_id: 'A.2'
			},
			{
				id: 'B1a',
				name: 'B.1.a',
				type: 'categorical',
				values: { 0: { label: 'Not treated' }, 1: { label: 'Treated' } },
				groupsetting: { disabled: true },
				child_order: 1,
				isleaf: true,
				parent_id: 'B.1'
			},
			{ id: 'A', name: 'A', isleaf: false, child_order: 1, parent_id: null },
			{ id: 'A.1', name: 'A.1', isleaf: false, child_order: 1, parent_id: 'A' },
			{ id: 'A.1.a', name: 'A.1.a', isleaf: false, child_order: 1, parent_id: 'A.1' },
			{ id: 'A.2', name: 'A.2', isleaf: false, child_order: 2, parent_id: 'A' },
			{ id: 'B', name: 'B', isleaf: false, child_order: 2, parent_id: null },
			{ id: 'B.1', name: 'B.1', isleaf: false, child_order: 1, parent_id: 'B' }
		]
		test.deepEqual(results.terms, expected, message)
	} catch (e) {
		test.fail(message + ': ' + e)
	}
	test.end()
})

tape('empty variable', function (test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable\ttype\tcategories`,
		`A\tA.1\tA.1.a\tA1a\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\tA.1\tA.1.b\tA1b\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\tA.2\tA.2.a\tA2a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`,
		`B\tB.1\tB.1.a\tB1a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`
	].join('\n')

	const results = parseDictionary(tsv)
	const expected = [
		{
			id: 'A1a',
			name: 'A.1.a',
			type: 'categorical',
			values: { 0: { label: 'No' }, 1: { label: 'Yes' } },
			groupsetting: { disabled: true },
			child_order: 1,
			isleaf: true,
			parent_id: 'A.1'
		},
		{
			id: 'A1b',
			name: 'A.1.b',
			type: 'categorical',
			values: { 0: { label: 'No' }, 1: { label: 'Yes' } },
			groupsetting: { disabled: true },
			child_order: 2,
			isleaf: true,
			parent_id: 'A.1'
		},
		{
			id: 'A2a',
			name: 'A.2.a',
			type: 'categorical',
			values: { 0: { label: 'Not treated' }, 1: { label: 'Treated' } },
			groupsetting: { disabled: true },
			child_order: 1,
			isleaf: true,
			parent_id: 'A.2'
		},
		{
			id: 'B1a',
			name: 'B.1.a',
			type: 'categorical',
			values: { 0: { label: 'Not treated' }, 1: { label: 'Treated' } },
			groupsetting: { disabled: true },
			child_order: 1,
			isleaf: true,
			parent_id: 'B.1'
		},
		{ id: 'A', name: 'A', isleaf: false, child_order: 1, parent_id: null },
		{ id: 'A.1', name: 'A.1', isleaf: false, child_order: 1, parent_id: 'A' },
		{ id: 'A.2', name: 'A.2', isleaf: false, child_order: 2, parent_id: 'A' },
		{ id: 'B', name: 'B', isleaf: false, child_order: 2, parent_id: null },
		{ id: 'B.1', name: 'B.1', isleaf: false, child_order: 1, parent_id: 'B' }
	]
	test.deepEqual(results.terms, expected, 'should use the variable name as term.id')
	test.end()
})

tape('extra, non essential column', function (test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tabsolute nonsense\tvariable\ttype\tcategories`,
		`A\tA.1\tA.1.a\tfoo bar\tA1a\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\tA.1\tA.1.b\tfoo bar\tA1b\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\tA.2\tA.2.a\tfoo bar\tA2a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`,
		`B\tB.1\tB.1.a\tfoo bar\tB1a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`
	].join('\n')

	const message = `should display data properly, no errors`
	try {
		const results = parseDictionary(tsv)
		const expected = [
			{
				id: 'A1a',
				name: 'A.1.a',
				type: 'categorical',
				values: { 0: { label: 'No' }, 1: { label: 'Yes' } },
				groupsetting: { disabled: true },
				child_order: 1,
				isleaf: true,
				parent_id: 'A.1'
			},
			{
				id: 'A1b',
				name: 'A.1.b',
				type: 'categorical',
				values: { 0: { label: 'No' }, 1: { label: 'Yes' } },
				groupsetting: { disabled: true },
				child_order: 2,
				isleaf: true,
				parent_id: 'A.1'
			},
			{
				id: 'A2a',
				name: 'A.2.a',
				type: 'categorical',
				values: { 0: { label: 'Not treated' }, 1: { label: 'Treated' } },
				groupsetting: { disabled: true },
				child_order: 1,
				isleaf: true,
				parent_id: 'A.2'
			},
			{
				id: 'B1a',
				name: 'B.1.a',
				type: 'categorical',
				values: { 0: { label: 'Not treated' }, 1: { label: 'Treated' } },
				groupsetting: { disabled: true },
				child_order: 1,
				isleaf: true,
				parent_id: 'B.1'
			},
			{ id: 'A', name: 'A', isleaf: false, child_order: 1, parent_id: null },
			{ id: 'A.1', name: 'A.1', isleaf: false, child_order: 1, parent_id: 'A' },
			{ id: 'A.2', name: 'A.2', isleaf: false, child_order: 2, parent_id: 'A' },
			{ id: 'B', name: 'B', isleaf: false, child_order: 2, parent_id: null },
			{ id: 'B.1', name: 'B.1', isleaf: false, child_order: 1, parent_id: 'B' }
		]
		test.deepEqual(results.terms, expected, message)
	} catch (e) {
		test.fail(message + ': ' + e)
	}
	test.end()
})

tape('no level columns', function (test) {
	test.timeoutAfter(100)
	const tsv = [
		`variable\ttype\tcategories`,
		`A1a\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A1b\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A2a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`,
		`B1a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`
	].join('\n')

	const message = `should display dictionary with variable name (i.e. id) as name`
	try {
		const results = parseDictionary(tsv)
		const expected = [
			{
				id: 'A1a',
				name: 'A1a',
				type: 'categorical',
				values: { 0: { label: 'No' }, 1: { label: 'Yes' } },
				groupsetting: { disabled: true },
				child_order: 1,
				isleaf: true,
				parent_id: null
			},
			{
				id: 'A1b',
				name: 'A1b',
				type: 'categorical',
				values: { 0: { label: 'No' }, 1: { label: 'Yes' } },
				groupsetting: { disabled: true },
				child_order: 2,
				isleaf: true,
				parent_id: null
			},
			{
				id: 'A2a',
				name: 'A2a',
				type: 'categorical',
				values: { 0: { label: 'Not treated' }, 1: { label: 'Treated' } },
				groupsetting: { disabled: true },
				child_order: 3,
				isleaf: true,
				parent_id: null
			},
			{
				id: 'B1a',
				name: 'B1a',
				type: 'categorical',
				values: { 0: { label: 'Not treated' }, 1: { label: 'Treated' } },
				groupsetting: { disabled: true },
				child_order: 4,
				isleaf: true,
				parent_id: null
			}
		]
		test.deepEqual(results.terms, expected, message)
	} catch (e) {
		test.fail(message + ': ' + e)
	}
	test.end()
})

tape('repeated level names, same line', function (test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable\ttype\tcategories`,
		`A\tA\tA.1.a\tA1a\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\tA.1\tA.1.b\tA1b\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\tA.2\tA.2.a\tA2a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`,
		`B\tB.1\tB.1.a\tB1a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`
	].join('\n')

	const message = 'Should display an error for repeated level names in the same line'
	try {
		parseDictionary(tsv) //parsePhenoTree()
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}
	test.end()
})

tape('dash between levels', function (test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable\ttype\tcategories`,
		`A\tA.1\tA.1.a\tA1a\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\tA.1\tA.1.b\tA1b\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\t-\tA.2.a\tA2a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`,
		`B\tB.1\tB.1.a\tB1a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`
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

tape('missing type', function (test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable\ttype\tcategories`,
		`A\tA.1\tA.1.a\tA1a\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\tA.1\tA.1.b\tA1b\t\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\tA2\tA.2.a\tA2a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`,
		`B\tB.1\tB.1.a\tB1a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`
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

tape('repeated intermediate terms for diff branches, whole dataset', function (test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable\ttype\tcategories`,
		`A\tA.1\tA.1a\tA1a\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\tsameterm\tA.1.b\tA1b\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A2\tsameterm\tA.2.a\tA2a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`,
		`B\tB.1\tB.1.a\tB1a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`
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

tape('missing Variable header', function (test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvar\ttype\tcategories`,
		`A\tA.1\tA.1a\tA1a\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\tA.1\tA.1.b\tA1b\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A2\tA.2\tA.2.a\tA2a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`,
		`B\tB.1\tB.1.a\tB1a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`
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

tape('missing Type header', function (test) {
	test.timeoutAfter(100)
	const tsv = [
		`level_1\tlevel_2\tlevel_3\tvariable\tt\tcategories`,
		`A\tA.1\tA.1a\tA1a\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A\tA.1\tA.1.b\tA1b\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A2\tA.2\tA.2.a\tA2a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`,
		`B\tB.1\tB.1.a\tB1a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`
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

tape('uncomputable category is a string but not number', function (test) {
	test.timeoutAfter(100)
	// user can totally encode missing numeric values with words like "unk". our system requires those to be coded as number instead otherwise it crashes our sql query. in below "unk" key is rejected
	const tsv = [`variable\ttype\tcategories`, `A1a\tinteger\t{ "unk": { "label": "unknown" } }`].join('\n')

	const message = 'Should throw on uncomputable category not being number'
	try {
		parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}
	test.end()
})

tape('uncomputable category is empty string but not number', function (test) {
	test.timeoutAfter(100)
	const tsv = [`variable\ttype\tcategories`, `A1a\tinteger\t{ "": { "label": "empty!!" } }`].join('\n')

	const message = 'Should throw on uncomputable category not being number'
	try {
		parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}
	test.end()
})

tape('add unit to term', function (test) {
	test.timeoutAfter(100)
	const tsv = [
		`Level_1\tLevel_2\tLevel_3\tLevel_4\tLevel_5\tVariable\ttype\tCategories\tUnit`,
		`Root\tL2\tL3\t-\t-\tdiaggrp\tcategorical\t`,
		`Root\tAge at Sample\t-\t-\t-\tsnp6_sample_age\tinteger\t{\"999\":{\"label\":\"N/A:CCSS\"}}\tyears`
	].join('\n')
	const message = `Should add unit to term`
	try {
		const results = parseDictionary(tsv)
		const expected = [
			{
				id: 'diaggrp',
				name: 'L3',
				type: 'categorical',
				values: {},
				groupsetting: {
					disabled: true
				},
				child_order: 1,
				isleaf: true,
				parent_id: 'L2'
			},
			{
				id: 'snp6_sample_age',
				name: 'Age at Sample',
				type: 'integer',
				groupsetting: undefined,
				values: {
					999: {
						label: 'N/A:CCSS',
						uncomputable: true
					}
				},
				child_order: 2,
				isleaf: true,
				unit: 'years',
				parent_id: 'Root'
			},
			{
				id: 'Root',
				name: 'Root',
				isleaf: false,
				child_order: 1,
				parent_id: null
			},
			{
				id: 'L2',
				name: 'L2',
				isleaf: false,
				child_order: 1,
				parent_id: 'Root'
			}
		]
		test.deepEqual(results.terms, expected, message)
	} catch (e) {
		test.fail(message + ': ' + e)
	}

	test.end()
})

tape('add additional attributes to term', function (test) {
	test.timeoutAfter(100)
	const tsv = [
		`Level_1\tLevel_2\tVariable\ttype\tCategories\tadditional attributes`,
		`Root\tTerm 2\tterm2\tinteger\t{\"999\":{\"label\":\"N/A:CCSS\"}}\t{"xx":"yy"}`
	].join('\n')
	try {
		const results = parseDictionary(tsv)
		const term = results.terms.find(i => i.id == 'term2')
		test.ok(term, 'term is found by id=term2')
		test.equal(term.xx, 'yy', 'new property found: term.xx=yy')
	} catch (e) {
		test.fail('additional attributes: ' + e)
	}
	test.end()
})

/*********************
Data Dictionary tests
*********************/

tape('missing parent_id header', function (test) {
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

tape('missing name header', function (test) {
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

tape('missing type header', function (test) {
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

tape('missing values header', function (test) {
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
		parseDictionary(tsv)
		test.fail(message)
	} catch (e) {
		test.pass(message + ': ' + e)
	}
	test.end()
})

tape('blank or dash in required data column', function (test) {
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

tape('missing k=v in values (dictionary format)', function (test) {
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

import tape from 'tape'
import { SingleCellNumericValueBase } from '../singleCellNumericValue.ts'
import { SINGLECELL_NUMERIC_VALUE, type RawSingleCellNumValueTerm } from '#types'

/*************************
 reusable helper functions
**************************/

function createValidTerm(overrides: any = {}): RawSingleCellNumValueTerm {
	return {
        id: 'test',
        name: 'test_term',
		type: SINGLECELL_NUMERIC_VALUE as typeof SINGLECELL_NUMERIC_VALUE,
		sample: 'test_sample',
		plot: 'test_plot',
		...overrides
	} as RawSingleCellNumValueTerm
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- tw/singleCellNumericValue -***-')
	test.end()
})

// ===== Constructor Tests =====
tape('constructor: creates instance with valid term containing sample and plot', function (test) {
	const term = createValidTerm()
	const instance = new SingleCellNumericValueBase(term)
	
	test.equal(instance.type, SINGLECELL_NUMERIC_VALUE, 'type is set correctly')
	test.equal(instance.sample, 'test_sample', 'sample is set correctly')
	test.equal(instance.plot, 'test_plot', 'plot is set correctly')
	test.end()
})

tape('constructor: creates instance with valid term missing plot', function (test) {
	const term = createValidTerm({ plot: undefined })
	const instance = new SingleCellNumericValueBase(term)
	
	test.equal(instance.type, SINGLECELL_NUMERIC_VALUE, 'type is set correctly')
	test.equal(instance.sample, 'test_sample', 'sample is set correctly')
	test.equal(instance.plot, '', 'plot defaults to empty string')
	test.end()
})

tape('constructor: throws error for null term', function (test) {
	test.throws(
		() => new SingleCellNumericValueBase(null as any),
		/term is not an object/,
		'throws error for null term'
	)
	test.end()
})

tape('constructor: throws error for non-object term', function (test) {
	test.throws(
		() => new SingleCellNumericValueBase('string' as any),
		/term is not an object/,
		'throws error for string term'
	)
	test.throws(
		() => new SingleCellNumericValueBase(123 as any),
		/term is not an object/,
		'throws error for number term'
	)
	test.end()
})

tape('constructor: throws error for incorrect term.type', function (test) {
	const term = createValidTerm({ type: 'wrongType' })
	test.throws(
		() => new SingleCellNumericValueBase(term as any),
		new RegExp(`incorrect term.type='${term.type}', expecting '${SINGLECELL_NUMERIC_VALUE}'`),
		'throws error for incorrect type'
	)
	test.end()
})

tape('constructor: throws error for missing term.sample', function (test) {
	const term = createValidTerm({ sample: undefined })
	test.throws(
		() => new SingleCellNumericValueBase(term as any),
		/missing term.sample/,
		'throws error for missing sample'
	)
	test.end()
})

tape('constructor: throws error for null term.sample', function (test) {
	const term = createValidTerm({ sample: null })
	test.throws(
		() => new SingleCellNumericValueBase(term as any),
		/missing term.sample/,
		'throws error for null sample'
	)
	test.end()
})

tape('constructor: throws error for empty string term.sample', function (test) {
	const term = createValidTerm({ sample: '' })
	test.throws(
		() => new SingleCellNumericValueBase(term as any),
		/missing term.sample/,
		'throws error for empty string sample'
	)
	test.end()
})

// ===== Validate Tests =====
tape('validate: accepts valid term', function (test) {
	const term = createValidTerm()
	test.doesNotThrow(
		() => SingleCellNumericValueBase.validate(term as any),
		'validate accepts valid term'
	)
	test.end()
})

tape('validate: accepts valid term without plot', function (test) {
	const term = createValidTerm({ plot: undefined })
	test.doesNotThrow(
		() => SingleCellNumericValueBase.validate(term as any),
		'validate accepts term without plot'
	)
	test.end()
})

tape('validate: throws error for null term', function (test) {
	test.throws(
		() => SingleCellNumericValueBase.validate(null as any),
		/term is not an object/,
		'throws error for null term'
	)
	test.end()
})

tape('validate: throws error for non-object term', function (test) {
	test.throws(
		() => SingleCellNumericValueBase.validate(undefined as any),
		/term is not an object/,
		'throws error for undefined term'
	)
	test.throws(
		() => SingleCellNumericValueBase.validate({} as any),
		/incorrect term\.type='undefined'.*singleCellNumericValue/,
		'throws error for object without sample'
	)
	test.end()
})

tape('validate: throws error for incorrect type', function (test) {
	const term = createValidTerm({ type: 'differentType' })
	test.throws(
		() => SingleCellNumericValueBase.validate(term as any),
		new RegExp(`incorrect term.type='${term.type}'`),
		'throws error for incorrect type'
	)
	test.end()
})

tape('validate: throws error for missing sample', function (test) {
	const term = createValidTerm({ sample: undefined })
	test.throws(
		() => SingleCellNumericValueBase.validate(term as any),
		/missing term.sample/,
		'throws error for missing sample'
	)
	test.end()
})

// ===== Fill Tests =====
tape('fill: does not throw for already instantiated term', function (test) {
	const term = new SingleCellNumericValueBase(createValidTerm())
	test.doesNotThrow(
		() => SingleCellNumericValueBase.fill(term as any),
		'fill does not throw when term is already instance'
	)
	test.end()
})

tape('fill: does not throw for valid raw term', function (test) {
	const term = createValidTerm()
	test.doesNotThrow(
		() => SingleCellNumericValueBase.fill(term as any),
		'fill does not throw for valid raw term'
	)
	test.end()
})

tape('fill: throws error for invalid term', function (test) {
	test.throws(
		() => SingleCellNumericValueBase.fill(null as any),
		/term is not an object/,
		'fill throws error for null term'
	)
	test.end()
})

tape('fill: handles term with optional name property', function (test) {
	const term = createValidTerm({ name: 'optional_name' })
	test.doesNotThrow(
		() => SingleCellNumericValueBase.fill(term as any),
		'fill accepts term with optional name property'
	)
	test.end()
})

// ===== Edge Cases =====
tape('edge case: sample accepts various data types', function (test) {
	const validSamples = ['string_sample', 123, { nested: 'object' }, ['array', 'sample']]
	
	validSamples.forEach((sample) => {
		const term = createValidTerm({ sample })
		test.doesNotThrow(
			() => new SingleCellNumericValueBase(term as any),
			`constructor accepts sample of type ${typeof sample}`
		)
	})
	test.end()
})

tape('edge case: plot accepts various string values', function (test) {
	const plots = ['', 'single_plot', 'plot_with_underscore', '123', 'plot/with/slashes']
	
	plots.forEach((plot) => {
		const term = createValidTerm({ plot })
		const instance = new SingleCellNumericValueBase(term)
		test.equal(instance.plot, plot, `plot is set to '${plot}'`)
	})
	test.end()
})

tape('edge case: instance properties are independent', function (test) {
	const term1 = createValidTerm({ sample: 'sample1', plot: 'plot1' })
	const term2 = createValidTerm({ sample: 'sample2', plot: 'plot2' })
	
	const instance1 = new SingleCellNumericValueBase(term1)
	const instance2 = new SingleCellNumericValueBase(term2)
	
	test.equal(instance1.sample, 'sample1', 'instance1 sample is independent')
	test.equal(instance2.sample, 'sample2', 'instance2 sample is independent')
	test.equal(instance1.plot, 'plot1', 'instance1 plot is independent')
	test.equal(instance2.plot, 'plot2', 'instance2 plot is independent')
	test.end()
})


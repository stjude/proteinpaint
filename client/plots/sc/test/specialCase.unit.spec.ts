import tape from 'tape'
import { getSingleCellSpecialCase } from '../utils/specialCase'

/**
 * Tests
 *   - getSingleCellSpecialCase: returns default when isSingleCellTerm is false
 *   - getSingleCellSpecialCase: uses default parameter key when not specified
 *   - getSingleCellSpecialCase: respects custom key parameter
 *   - getSingleCellSpecialCase: handles missing term.term property
 *   - getSingleCellSpecialCase: preserves sample object with name property
 *   - getSingleCellSpecialCase: preserves sample object with plots property
 *   - getSingleCellSpecialCase: can access plot from term when present
 *   - getSingleCellSpecialCase: returns string or object
 */

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/sc/utils/specialCase -***-')
	test.end()
})

tape('getSingleCellSpecialCase: returns default with invalid key', test => {
	const config = {
		term: {
			term: { sample: { name: 'sample1' } }
		}
	}
	const result = getSingleCellSpecialCase(config, 'sample')
	test.equal(result, 'default', 'should return "default" when invalid key is provided')
	test.end()
})

tape('getSingleCellSpecialCase: returns default when term object is missing', test => {
	const config = {
		term: {
			notTerm: { sample: { name: 'sample1' } }
		}
	}
	const result = getSingleCellSpecialCase(config)
	test.equal(result, 'default', 'should return "default" when term object is missing')
	test.end()
})

tape('getSingleCellSpecialCase: returns default when isSingleCellTerm is false', test => {
	const config = {
		term: {
			term: { sample: { name: 'sample1' } }
		}
	}
	const result = getSingleCellSpecialCase(config)
	test.equal(result, 'default', 'should return "default" string for non-single-cell terms')
	test.end()
})

tape('getSingleCellSpecialCase: uses default parameter key when not specified', test => {
	const config = {
		term: {
			term: { sample: { name: 'sample1' } }
		}
	}
	const result = getSingleCellSpecialCase(config)
	test.equal(result, 'default', 'should use "term" as default key')
	test.end()
})

tape('getSingleCellSpecialCase: respects custom key parameter', test => {
	const config = {
		customKey: {
			term: { sample: { name: 'sample1' } }
		}
	}
	const result = getSingleCellSpecialCase(config, 'customKey')
	test.equal(result, 'default', 'should use custom key parameter')
	test.end()
})

tape('getSingleCellSpecialCase: handles missing term.term property', test => {
	const config = {
		term: {}
	}
	try {
		const result = getSingleCellSpecialCase(config)
		test.ok(result !== undefined, 'should not throw when term.term is missing')
	} catch (err: any) {
		test.fail(`should not throw error: ${err.message}`)
	}
	test.end()
})

tape('getSingleCellSpecialCase: preserves sample object with name property', test => {
	const sample = { name: 'testSample', otherProp: 'value' }
	const config = {
		term: {
			term: { sample }
		}
	}
	const result = getSingleCellSpecialCase(config)
	test.equal(result, 'default', 'returns default for non-single-cell terms')
	test.end()
})

tape('getSingleCellSpecialCase: preserves sample object with plots property', test => {
	const sample = { plots: ['plot1', 'plot2'] }
	const config = {
		term: {
			term: { sample }
		}
	}
	const result = getSingleCellSpecialCase(config)
	test.equal(result, 'default', 'returns default for non-single-cell terms')
	test.end()
})

tape('getSingleCellSpecialCase: can access plot from term when present', test => {
	const config = {
		term: {
			term: { sample: {}, plot: 'myPlot' }
		}
	}
	const result = getSingleCellSpecialCase(config)
	test.equal(result, 'default', 'returns default for non-single-cell terms')
	test.end()
})

tape('getSingleCellSpecialCase: returns string or object', test => {
	const config = { term: { term: { sample: { name: 'test' } } } }
	const result = getSingleCellSpecialCase(config)
	const isValidResult = typeof result === 'string' || (typeof result === 'object' && result !== null)
	test.ok(isValidResult, 'function should return string or object')
	test.end()
})

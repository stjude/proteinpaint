import tape from 'tape'
import { TermTypes } from '#types'
import { getSingleCellSpecialCase } from '../utils/specialCase'

/**
 * Tests
 *   - getSingleCellSpecialCase: supports a sample with a non-single-cell term
 *   - getSingleCellSpecialCase: uses default parameter key when not specified
 *   - getSingleCellSpecialCase: respects custom key parameter
 *   - getSingleCellSpecialCase: handles missing term.term property
 *   - getSingleCellSpecialCase: preserves sample object with name property
 *   - getSingleCellSpecialCase: preserves sample object with plots property
 *   - getSingleCellSpecialCase: can access plot from term when present
 *   - getSingleCellSpecialCase: supports sample from singleCellPlot
 *   - getSingleCellSpecialCase: returns default for a single-cell term without sample
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

tape('getSingleCellSpecialCase: supports a sample with a non-single-cell term', test => {
	const config = {
		term: {
			term: { sample: { name: 'sample1' } }
		}
	}
	const result = getSingleCellSpecialCase(config)
	test.deepEqual(result, { type: 'singleCell', isMeta: false, config: { sample: config.term.term.sample } })
	test.end()
})

tape('getSingleCellSpecialCase: uses default parameter key when not specified', test => {
	const config = {
		term: {
			term: { sample: { name: 'sample1' } }
		}
	}
	const result = getSingleCellSpecialCase(config)
	test.deepEqual(result, { type: 'singleCell', isMeta: false, config: { sample: config.term.term.sample } })
	test.end()
})

tape('getSingleCellSpecialCase: respects custom key parameter', test => {
	const config = {
		customKey: {
			term: { sample: { name: 'sample1' } }
		}
	}
	const result = getSingleCellSpecialCase(config, 'customKey')
	test.deepEqual(result, { type: 'singleCell', isMeta: false, config: { sample: config.customKey.term.sample } })
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
	test.deepEqual(result, { type: 'singleCell', isMeta: false, config: { sample } })
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
	test.deepEqual(result, { type: 'singleCell', isMeta: false, config: { sample } })
	test.end()
})

tape('getSingleCellSpecialCase: can access plot from term when present', test => {
	const config = {
		term: {
			term: { sample: {}, plot: 'myPlot' }
		}
	}
	const result = getSingleCellSpecialCase(config)
	test.deepEqual(result, { type: 'singleCell', isMeta: false, config: { sample: { plots: ['myPlot'] } } })
	test.end()
})

tape('getSingleCellSpecialCase: supports sample from singleCellPlot', test => {
	const sample = { name: 'testSample' }
	const config = {
		singleCellPlot: { sample },
		term: { term: { type: TermTypes.SINGLECELL_CELLTYPE } }
	}
	const result = getSingleCellSpecialCase(config)
	test.deepEqual(result, { type: 'singleCell', isMeta: false, config: { sample } })
	test.end()
})

tape('getSingleCellSpecialCase: returns default for a single-cell term without sample', test => {
	const config = { term: { term: { type: TermTypes.SINGLECELL_CELLTYPE } } }
	const result = getSingleCellSpecialCase(config)
	test.equal(result, 'default')
	test.end()
})

tape('getSingleCellSpecialCase: returns string or object', test => {
	const config = { term: { term: { sample: { name: 'test' } } } }
	const result = getSingleCellSpecialCase(config)
	const isValidResult = typeof result === 'string' || (typeof result === 'object' && result !== null)
	test.ok(isValidResult, 'function should return string or object')
	test.end()
})

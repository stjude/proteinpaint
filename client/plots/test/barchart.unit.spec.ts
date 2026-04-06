import tape from 'tape'
// import * as d3s from 'd3-selection'
// import * as helpers from '../../test/front.helpers.js'
import {
	Barchart,
	compareIdsDeterministic,
	findCanonicalOrderIndex,
	findKeyLabelDrifts,
	getDeclaredValueOrder,
	getCanonicalIdCandidates,
	getNumericValueOrder,
	hasNumericValueKeys,
	isNumericId
} from '#plots/barchart.js'
// import { detectGte } from '../../test/test.helpers.js'

/* 
Tests:
    - Default barchart component
*/

/*************************
 reusable helper functions
**************************/

// function getHolder() {
// 	return d3s
// 		.select('body')
// 		.append('div')
// 		.style('border', '1px solid #aaa')
// 		.style('padding', '5px')
// 		.style('margin', '5px')
// }

// const runpp = helpers.getRunPp('mass', {
// 	state: {
// 		nav: { header_mode: 'hidden' },
// 		dslabel: 'TermdbTest',
// 		genome: 'hg38-test'
// 	},
// 	debug: 1
// })

// function getBarchart(opts) {

// }

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/barchart -***-')
	test.end()
})

tape('Default barchart component', test => {
	test.timeoutAfter(100)

	const testBarchart = new Barchart()

	test.equal(testBarchart.type, 'barchart', 'Should set type to barchart')
	test.equal(typeof testBarchart.setControls, 'function', 'Should have a .setControls() function')
	test.equal(typeof testBarchart.getState, 'function', 'Should have a .getState() function')
	test.equal(typeof testBarchart.getDataRequestOpts, 'function', 'Should have a .getDataRequestOpts() function')
	test.equal(typeof testBarchart.getDescrStats, 'function', 'Should have a .getDescrStats() function')
	test.equal(typeof testBarchart.updateSettings, 'function', 'Should have a .updateSettings() function')
	test.equal(typeof testBarchart.mayResetHidden, 'function', 'Should have a .mayResetHidden() function')
	test.equal(typeof testBarchart.mayEditHiddenValues, 'function', 'Should have a .mayEditHiddenValues() function')
	test.equal(typeof testBarchart.setExclude, 'function', 'Should have a .setExclude() function')
	test.equal(typeof testBarchart.processData, 'function', 'Should have a .processData() function')
	test.equal(typeof testBarchart.setMaxVisibleTotals, 'function', 'Should have a .setMaxVisibleTotals() function')
	test.equal(typeof testBarchart.sortStacking, 'function', 'Should have a .sortStacking() function')
	test.equal(typeof testBarchart.setTerm2Color, 'function', 'Should have a .setTerm2Color() function')
	test.equal(typeof testBarchart.getColor, 'function', 'Should have a .getColor() function')
	test.equal(typeof testBarchart.getMutationColor, 'function', 'Should have a .getMutationColor() function')
	test.equal(typeof testBarchart.getLegendGrps, 'function', 'Should have a .getLegendGrps() function')
	test.equal(typeof testBarchart.getOneLegendGrps, 'function', 'Should have a .getOneLegendGrps() function')
	test.equal(typeof testBarchart.toggleLoadingDiv, 'function', 'Should have a .toggleLoadingDiv() function')

	test.end()
})

tape('barchart helper: isNumericId detects numeric ids only', test => {
	test.equal(isNumericId('2'), true, 'Should treat integer strings as numeric ids')
	test.equal(isNumericId('2.5'), true, 'Should treat decimal strings as numeric ids')
	test.equal(isNumericId('Stage Ia'), false, 'Should not treat labels as numeric ids')
	test.equal(isNumericId('2a'), false, 'Should not treat mixed alphanumeric ids as numeric ids')
	test.end()
})

tape('barchart helper: compareIdsDeterministic sorts numeric ids numerically', test => {
	const ids = ['10', '2', '1']
	ids.sort(compareIdsDeterministic)
	test.deepEqual(ids, ['1', '2', '10'], 'Should sort numeric-looking ids numerically, not lexically')
	test.end()
})

tape('barchart helper: declared value order includes numeric and label forms deterministically', test => {
	const tw = {
		term: {
			values: {
				'10': { key: '10', label: 'M1' },
				'2': { key: '2', label: 'Stage Ia' },
				'1': { key: '1', label: 'Stage I' },
				'Stage Ia': { label: 'Stage Ia' },
				M1: { label: 'M1' }
			}
		}
	}
	const order = getDeclaredValueOrder(tw)
	test.deepEqual(
		order,
		['1', 'Stage I', '2', 'Stage Ia', '10', 'M1'],
		'Should place numeric ids in numeric order and then add unique labels deterministically'
	)
	test.end()
})

tape('barchart helper: numeric value order and numeric key detection handle pure numeric value maps', test => {
	const numericTw = {
		term: {
			values: {
				'10': { key: '10', label: 'Ten' },
				'2': { key: '2', label: 'Two' },
				'1': { key: '1', label: 'One' }
			}
		}
	}
	const mixedTw = {
		term: {
			values: {
				'1': { key: '1', label: 'One' },
				One: { label: 'One' }
			}
		}
	}
	test.equal(hasNumericValueKeys(numericTw), true, 'Should detect numeric value keys when present')
	test.deepEqual(getNumericValueOrder(numericTw), ['1', '2', '10'], 'Should sort numeric value keys numerically')
	test.equal(hasNumericValueKeys(mixedTw), true, 'Should still detect numeric keys in mixed maps')
	test.equal(
		getNumericValueOrder(mixedTw),
		null,
		'Should not return numeric-only ordering when non-numeric ids are also present'
	)
	test.end()
})

tape('barchart helper: key/label drift detection finds mixed runtime ids', test => {
	const tw = {
		term: {
			values: {
				'1': { key: '1', label: 'Stage I' },
				'2': { key: '2', label: 'Stage II' }
			}
		}
	}
	const drifts = findKeyLabelDrifts(tw, ['1', 'Stage I', '2'])
	test.deepEqual(
		drifts,
		[{ key: '1', label: 'Stage I' }],
		'Should report only ids where both key and label forms are present'
	)
	test.end()
})

tape('barchart helper: canonical candidates and order index handle CareReg mixed key/label staging ids', test => {
	const tw = {
		term: {
			values: {
				'2': { key: '2', label: 'Stage Ia' },
				'5': { key: '5', label: 'Stage IIa' },
				'Stage Ia': { label: 'Stage Ia' },
				'Stage IIa': { label: 'Stage IIa' }
			}
		}
	}
	const candidates = getCanonicalIdCandidates(tw, 'Stage Ia')
	test.deepEqual(candidates, ['2', 'Stage Ia'], 'Should include both numeric key and label forms for a mixed-id value')
	const orderedIds = ['Stage Ia', 'Stage IIa', 'Unknown']
	test.equal(
		findCanonicalOrderIndex(tw, orderedIds, 'Stage Ia'),
		0,
		'Should match the label-form ordered id instead of failing on the numeric candidate'
	)
	test.equal(
		findCanonicalOrderIndex(tw, orderedIds, 'Stage IIa'),
		1,
		'Should preserve clinical order for mixed key/label staging values'
	)
	test.end()
})

tape('barchart helper: unknown values not in metadata fall back gracefully', test => {
	const tw = {
		term: {
			values: {
				'1': { key: '1', label: 'Known Value' }
			}
		}
	}
	const orderedIds = ['1', 'Unknown Value', 'Another Unknown']
	// When an annotation value is not in metadata, getCanonicalIdCandidates should return just the value itself
	const candidates = getCanonicalIdCandidates(tw, 'Unknown Value')
	test.deepEqual(candidates, ['Unknown Value'], 'Should return value itself when not found in metadata')
	// findCanonicalOrderIndex should find it by trying all candidates
	test.equal(
		findCanonicalOrderIndex(tw, orderedIds, 'Unknown Value'),
		1,
		'Should find unknown value in ordered list even though not in metadata'
	)
	test.end()
})

tape('barchart helper: non-contiguous numeric key ids sort by v.order, not by key value', test => {
	// Key values intentionally differ from order values so sorting by key vs sorting by order gives different results.
	// getDeclaredValueOrder() must use v.order (consistent with server-side getOrderedLabels()).
	const tw = {
		term: {
			values: {
				'100': { key: '100', label: 'First', order: 0 }, // large key, order=0 → must appear first
				'2': { key: '2', label: 'Second', order: 1 }, // small key, order=1 → must appear second
				'30': { key: '30', label: 'Third', order: 2 } // mid key, order=2 → must appear third
			}
		}
	}
	const order = getDeclaredValueOrder(tw)
	// Sorted by v.order (0,1,2): 100, 2, 30 — NOT by key value (2, 30, 100)
	test.ok(order !== null, 'order should not be null')
	if (order) {
		test.deepEqual(
			order,
			['100', 'First', '2', 'Second', '30', 'Third'],
			'Should sort by v.order (0,1,2 → keys 100,2,30), not by numeric key value (2,30,100)'
		)
	}
	test.end()
})

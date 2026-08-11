import tape from 'tape'
import { computeTickValues } from '../processData'

/*
Tests:
    - computeTickValues should return the correctly computed ticks
    - computeTickValues should handle invalid and degenerate ranges
 */

/**************
 test sections
 ***************/

tape('\n', function (test) {
	test.comment('-***- plots/cuminc/processData -***-')
	test.end()
})

tape('computeTickValues should return the correctly computed ticks', function (test) {
    test.timeoutAfter(100)

    // Standard range: rounded tick width becomes 10 and includes an over-max tick.
    test.deepEqual(computeTickValues(10, 55), [0, 10, 20, 30, 40, 50, 60], 'rounds width and prepends 0 when missing')

    // Already includes zero in computed ticks; should not add duplicate zero.
    test.deepEqual(computeTickValues(-20, 20), [-20, -10, 0, 10, 20, 30], 'keeps existing zero and extends one tick past max')

    // Upper limit is hard-capped at 100 even when max is higher.
    test.deepEqual(computeTickValues(70, 130), [0, 70, 80, 90, 100], 'caps ticks at 100 and still prepends 0')

    test.end()
})

tape('computeTickValues should handle invalid and degenerate ranges', function (test) {
    test.timeoutAfter(100)

    // Non-finite values are treated as invalid input.
    test.deepEqual(computeTickValues(Number.NaN, 10), [0], 'returns [0] when min is NaN')
    test.deepEqual(computeTickValues(10, Number.POSITIVE_INFINITY), [0], 'returns [0] when max is infinite')

    // Reversed ranges are normalized by swapping min/max.
    test.deepEqual(computeTickValues(30, 10), [0, 10, 15, 20, 25, 30, 35], 'swaps min and max when max < min')

    // Degenerate ranges are handled without entering the tick loop.
    test.deepEqual(computeTickValues(0, 0), [0], 'returns [0] when min and max are both zero')
    test.deepEqual(computeTickValues(150, 150), [0, 100], 'caps equal non-zero value at 100')
    test.deepEqual(computeTickValues(20, 20), [0, 20], 'returns [0, min] for equal non-zero values <= 100')

    test.end()
})

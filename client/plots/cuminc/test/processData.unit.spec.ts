import tape from 'tape'
import { computeTickValues } from '../processData'

/*
Tests:
    - computeTickValues should return the correctly computed ticks
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

import tape from 'tape'
import { setGroupTest } from '../tk'

/**
 * Tests
 *   - setGroupTest: y is the difference of the groups' shares in percentage points; a junction is colored by group only
 *     when q < 0.05, however small the difference
 */

tape('\n', test => {
	test.comment('-***- j2/tk -***-')
	test.end()
})

tape('setGroupTest', test => {
	const big: any = { groupShares: [0.018, 0.001], q: 1e-20 }
	const small: any = { groupShares: [0.0001, 0.002], q: 1e-8 }
	const ns: any = { groupShares: [0.05, 0.04], q: 0.2 }
	const none: any = {}
	setGroupTest({ junctions: [big, small, ns, none] })
	test.ok(Math.abs(big.absDeltaPsi - 1.7) < 1e-9, 'y is the difference in percentage points')
	test.deepEqual([big.psi_control, big.psi_case], [0.018, 0.001], 'a large significant difference is colored')
	test.deepEqual([small.psi_control, small.psi_case], [0.0001, 0.002], 'a small significant difference is colored too')
	test.equal(ns.psi_control, undefined, 'nor is a difference that is not significant')
	test.equal(none.absDeltaPsi, 0, 'a junction without shares is at 0')
	test.end()
})

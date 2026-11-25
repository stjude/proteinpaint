import tape from 'tape'
import { setGroupTest } from '../tk'
import { makeJunctionTerm } from '../render'

/**
 * Tests
 *   - setGroupTest: y is the difference of the groups' shares in percentage points; a junction is colored by group only
 *     when q < 0.05, however small the difference
 *   - makeJunctionTerm: a share term carries the gene and region of the denominator, an id and name of its own, and is
 *     refused without them
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

tape('makeJunctionTerm', test => {
	const j = { chr: 'chr4', start: 1871541, stop: 1900625, strand: '+', gene: 'NSD2' }
	const region = { chr: 'chr4', start: 1866392, stop: 1987192, extra: 1 }
	const counts = makeJunctionTerm(j)
	const share: any = makeJunctionTerm(j, 'share', region)
	test.equal(share.measure, 'share', 'measure share')
	test.equal(share.gene, 'NSD2', "the junction's gene is the denominator")
	test.deepEqual(
		share.region,
		{ chr: 'chr4', start: 1866392, stop: 1987192 },
		'the region of the denominator, as given'
	)
	test.notEqual(share.id, counts.id, 'an id of its own, so that the read count and share terms are told apart')
	test.ok(share.name.endsWith(', % of NSD2 junction reads'), 'its name says what the value is')
	test.throws(
		() => makeJunctionTerm({ ...j, gene: undefined }, 'share', region),
		/gene and region/,
		'refused without a gene'
	)
	test.throws(() => makeJunctionTerm(j, 'share'), /gene and region/, 'refused without a region')
	test.end()
})

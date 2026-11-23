import tape from 'tape'
import { isoformParts } from '../tk'

/**
 * Tests
 *   - isoformParts: the most expressed isoforms apart, the rest as one part, no parts for a sample without expression
 */

tape('\n', test => {
	test.comment('-***- dnameth/tk -***-')
	test.end()
})

tape('isoformParts', test => {
	const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
	const parts = isoformParts({
		expressedIsoforms: ids,
		isoformUnit: 'TPM',
		samples: [
			{ isoformValues: [1, 2, 3, 4, 5, 6, 9] },
			{ isoformValues: [0, 0, 0, 0, 0, 0, 0] },
			{},
			{ isoformValues: [1, 2, 3, 4, 5, 6, null] }
		]
	})!
	test.deepEqual(
		parts.labels,
		['g', 'f', 'e', 'd', 'c', '2 other isoforms'],
		'should list the 5 most expressed, then the rest'
	)
	test.equal(parts.colors.length, 6, 'should give each part a color')
	test.deepEqual(
		parts.shares[0].map(v => Math.round(v * 30)),
		[9, 6, 5, 4, 3, 3],
		"should give each part its share of the sample's isoform expression, the rest summed"
	)
	test.deepEqual(parts.shares[1], [], 'should give no parts to a sample whose isoforms add up to nothing')
	test.deepEqual(parts.shares[2], [], 'and none to a sample without isoform values')
	test.deepEqual(parts.shares[3], [], 'and none to a sample missing the value of an isoform, whose makeup is not known')
	test.equal(parts.unit, 'TPM', "should name the isoforms' unit")
	test.deepEqual(
		isoformParts({ expressedIsoforms: ['a', 'b'], samples: [{ isoformValues: [0.0004, 0.0006] }] })!.shares[0].map(v =>
			Math.round(v * 100)
		),
		[60, 40],
		'should keep the shares of small values'
	)
	test.equal(
		isoformParts({ expressedIsoforms: ['a'], samples: [{ isoformValues: [1] }] }),
		undefined,
		'should give none for one isoform'
	)
	test.end()
})

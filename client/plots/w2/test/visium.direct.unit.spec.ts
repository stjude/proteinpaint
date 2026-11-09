import tape from 'tape'
import { maxOverSpots, spotMark, clampOpacity, dominantType, pieSlices, shadeColor } from '../visium.direct'

tape('shadeColor is darker for a higher proportion and clamps', test => {
	const sum = (s: string) =>
		s
			.match(/\d+/g)!
			.slice(0, 3)
			.reduce((a, v) => a + Number(v), 0)
	test.ok(sum(shadeColor('31, 119, 180', 0.9)) < sum(shadeColor('31, 119, 180', 0.3)), '90% darker than 30%')
	test.equal(shadeColor('31, 119, 180', 5), shadeColor('31, 119, 180', 1), 'clamped above 1')
	test.end()
})

tape('\n', function (test) {
	test.comment('-***- plots/w2/visium.direct -***-')
	test.end()
})

tape('dominantType picks the largest proportion among the given types', test => {
	const props = { A: [0.2, null, 0.1], B: [0.7, null, 0.1], C: [0.1, null, 0.8] }
	test.equal(dominantType(props, 0, ['A', 'B', 'C']), 1, 'B dominates spot 0')
	test.equal(dominantType(props, 0, ['A', 'C']), 0, 'restricted to A,C: A dominates')
	test.equal(dominantType(props, 1, ['A', 'B', 'C']), -1, 'spot without proportions has no type')
	test.equal(dominantType(props, 2, ['A', 'B', 'C']), 2, 'C dominates spot 2')
	test.end()
})

tape('pieSlices gives one path per value, and a full circle for a single value', test => {
	test.equal(pieSlices([0.5, 0.3, 0.2], 10).length, 3, 'one path per slice')
	test.ok(pieSlices([0.7], 10)[0].includes('A 10 10'), 'single slice is a drawn circle')
	test.ok(pieSlices([0.6, 0.4], 10)[0].includes('0 1 1'), 'slice over half the circle uses the large-arc flag')
	test.end()
})

tape('clampOpacity clamps to 0-1 and defaults to opaque', test => {
	test.equal(clampOpacity(0.4), 0.4, 'in range kept')
	test.equal(clampOpacity(5), 1, 'clamped above')
	test.equal(clampOpacity(-1), 0, 'clamped below')
	test.equal(clampOpacity(0), 0, '0 is valid, not "missing"')
	test.equal(clampOpacity(undefined), 1, 'missing = opaque')
	test.equal(clampOpacity('abc'), 1, 'not a number = opaque')
	test.end()
})

tape(
	'spotMark: circle when dominant is selected; square only for a single selected type that is merely present',
	test => {
		const props = { A: [0.7, 0.2, 0.005, null], B: [0.2, 0.6, 0.6, null], C: [0.1, 0.2, 0.395, null] }
		const types = ['A', 'B', 'C']
		test.deepEqual(spotMark(props, 0, types, ['A']), { type: 'A', shape: 'circle' }, 'A dominates spot 0')
		test.deepEqual(spotMark(props, 1, types, ['A']), { type: 'A', shape: 'square' }, 'A present (20%) but B dominates')
		test.equal(spotMark(props, 2, types, ['A']), null, 'A below the presence cutoff')
		test.equal(spotMark(props, 3, types, ['A']), null, 'spot without proportions')
		test.deepEqual(
			spotMark(props, 0, types, ['A', 'C']),
			{ type: 'A', shape: 'circle' },
			'several selected: dominant still a circle'
		)
		test.equal(spotMark(props, 1, types, ['A', 'C']), null, 'several selected: no square for a non-dominant type')
		test.deepEqual(spotMark(props, 1, types, types), { type: 'B', shape: 'circle' }, 'no filter: always a circle')
		test.end()
	}
)

tape('maxOverSpots ignores counts of barcodes that are not drawn', test => {
	const counts = new Map([
		['in1', 3],
		['in2', 5],
		['outOfTissue', 99]
	])
	test.equal(maxOverSpots(counts, ['in1', 'in2', 'noCount']), 5, 'out-of-tissue 99 is not the max')
	test.equal(maxOverSpots(counts, ['noCount']), 0, 'no drawn spot has a count')
	test.end()
})

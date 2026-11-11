import tape from 'tape'
import {
	correlate,
	groupRankScores,
	orthonormalize,
	residualize,
	rhoP,
	samplePCs
} from '#src/utils/dmrGeneCorrelation.ts'

/*
test sections:

groupRankScores: ranks within each group, centered there, ties averaged, missing kept missing
correlate: Pearson over the samples both vectors have
rhoP: Fisher z with the Spearman variance, fewer degrees of freedom per covariate
residualize: a shared patient-wide factor no longer correlates two series once it is regressed out
samplePCs: recovers the axis that dominates the samples
*/

tape('\n', t => {
	t.comment('-***- dmrGeneCorrelation specs -***-')
	t.end()
})

tape('groupRankScores ranks within each group, so a group shift does not count', t => {
	const groups = Uint8Array.from([0, 0, 0, 1, 1, 1])
	// group 1 sits 100 above group 0 but has the same order inside
	const s = groupRankScores([1, 2, 3, 101, 102, 103], groups)
	t.deepEqual([...s.slice(0, 3)], [...s.slice(3)], 'both groups get the same scores')
	t.deepEqual([...s.slice(0, 3)], [-1 / 3, 0, 1 / 3], 'centered on the group middle, scaled by its size')
	const ties = groupRankScores([5, 5, 7, NaN, 1, 2], groups)
	t.equal(ties[0], ties[1], 'ties share their average rank')
	t.ok(Number.isNaN(ties[3]), 'a missing value stays missing')
	t.deepEqual([...ties.slice(4)], [-0.25, 0.25], 'and the group is ranked over the values it has')
	t.end()
})

tape('correlate is Pearson over the samples both vectors have', t => {
	const { r, n } = correlate(Float64Array.from([1, 2, 3, NaN, 5]), Float64Array.from([2, 4, 6, 100, 10]))
	t.equal(n, 4, 'the missing sample is skipped')
	t.ok(Math.abs(r - 1) < 1e-12, 'a perfect line gives 1')
	t.ok(Number.isNaN(correlate(Float64Array.from([1, 1, 1]), Float64Array.from([1, 2, 3])).r), 'no spread, no r')
	t.end()
})

tape('rhoP: Fisher z with the Spearman variance, a covariate costs a degree of freedom', t => {
	t.equal(rhoP(0, 300), 1, 'rho 0 gives p 1')
	t.ok(rhoP(0.3, 300) < 1e-6, 'rho 0.3 over 300 patients is far out')
	t.ok(rhoP(0.3, 300, 20) > rhoP(0.3, 300), 'covariates make the same rho less significant')
	t.ok(Number.isNaN(rhoP(0.5, 10, 5)), 'too few degrees of freedom gives no p')
	t.end()
})

tape('residualize: a shared patient-wide factor no longer links two series once regressed out', t => {
	const n = 200
	const factor = Float64Array.from({ length: n }, (_, i) => Math.sin(i))
	// independent noise for each, plus the same factor
	const a = Float64Array.from({ length: n }, (_, i) => factor[i] + 0.1 * Math.cos(i * 7.3))
	const b = Float64Array.from({ length: n }, (_, i) => factor[i] + 0.1 * Math.sin(i * 3.1 + 1))
	t.ok(correlate(a, b).r > 0.9, 'raw, they correlate through the factor')
	const Q = orthonormalize([new Float64Array(n).fill(1), factor])
	t.ok(Math.abs(correlate(residualize(a, Q), residualize(b, Q)).r) < 0.2, 'residualized, they do not')
	const withGap = Float64Array.from(a)
	withGap[3] = NaN
	t.ok(Number.isNaN(residualize(withGap, Q)[3]), 'a missing value stays missing')
	t.equal(orthonormalize([factor, factor]).length, 1, 'a column that adds nothing is dropped')
	t.end()
})

tape('samplePCs recovers the axis that dominates the samples', t => {
	const n = 50
	const axis = Float64Array.from({ length: n }, (_, i) => (i % 2 ? 1 : -1) * (1 + i / n))
	const rows = Array.from({ length: 300 }, (_, g) =>
		Float64Array.from({ length: n }, (_, i) => axis[i] * ((g % 7) - 3) + 0.01 * Math.sin(g * i))
	)
	const [pc1] = samplePCs(rows, n, 2)
	t.ok(Math.abs(correlate(pc1, axis).r) > 0.999, 'the first PC is that axis, up to sign')
	t.end()
})

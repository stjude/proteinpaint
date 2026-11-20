import tape from 'tape'
import { levelResiduals, LEVEL_BINS } from '../genesetEnrichment.ts'

/*
Tests:
	levelResiduals() removes a level effect and keeps the within-level signal
	levelResiduals() drops genes without an expression level
	levelResiduals() gives z within each bin, and with one bin leaves level in
*/

tape('levelResiduals() removes a level effect and keeps the within-level signal', t => {
	// 2 genes per bin; delta-beta = level effect + a +-0.1 within-bin signal
	const n = LEVEL_BINS * 2
	const genes = Array.from({ length: n }, (_, i) => 'g' + i)
	const level = Object.fromEntries(genes.map((g, i) => [g, i]))
	const fc = genes.map((_, i) => Math.floor(i / 2) * 0.05 + (i % 2 ? 0.1 : -0.1))
	const out = levelResiduals(genes, fc, level)
	t.deepEqual(out.genes, genes, 'every gene kept, in input order')
	t.ok(
		out.fold_change.every((v, i) => Math.abs(v - (i % 2 ? 0.1 : -0.1)) < 1e-12),
		'only the within-bin signal is left'
	)
	t.end()
})

tape('levelResiduals() drops genes without an expression level', t => {
	const out = levelResiduals(['A', 'B', 'C'], [1, 2, 3], { A: 5, C: NaN })
	t.deepEqual(out.genes, ['A'], 'B has no level and C a non-number')
	t.deepEqual(out.fold_change, [0], 'a lone gene is its own bin mean')
	t.end()
})

tape('levelResiduals() gives z within each bin, and with one bin leaves level in', t => {
	const genes = ['a', 'b', 'c', 'd']
	const level = { a: 1, b: 2, c: 3, d: 4 }
	const fc = [0, 2, 10, 14]
	const two = levelResiduals(genes, fc, level, 2)
	t.deepEqual(two.fold_change, [-1, 1, -2, 2], 'each gene minus its bin mean (a,b) and (c,d)')
	t.ok(
		two.z.every((z, i) => Math.abs(z - (i % 2 ? 1 : -1) / Math.SQRT2) < 1e-12),
		'z is the residual over its bin sd'
	)
	const one = levelResiduals(genes, fc, level, 1)
	t.deepEqual(one.fold_change, [-6.5, -4.5, 3.5, 7.5], 'one bin: minus the overall mean only')
	t.end()
})

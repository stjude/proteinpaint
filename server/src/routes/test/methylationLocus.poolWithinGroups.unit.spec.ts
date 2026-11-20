import tape from 'tape'
import { poolWithinGroups } from '../termdb.methylationLocus.ts'

/*
Tests:
	poolWithinGroups() weights each group's rho by its size, and tests the pooled rho
	poolWithinGroups() leaves a bin with no usable group alone
*/

const bin = (byGroup: any[]) => ({ start: 0, stop: 1, nCpg: 5, beta: [], byGroup } as any)

tape('poolWithinGroups() weights each group rho by its size, and tests the pooled rho', t => {
	const bins = [
		bin([
			{ group: 'a', rho: 0.5, n: 43 },
			{ group: 'b', rho: 0.5, n: 19 }
		]),
		bin([
			{ group: 'a', rho: 0.6, n: 103 },
			{ group: 'b', rho: -0.6, n: 3 }
		]),
		bin([
			{ group: 'a', rho: 0.02, n: 23 },
			{ group: 'b', rho: -0.02, n: 23 }
		])
	]
	poolWithinGroups(bins)
	t.ok(Math.abs(bins[0].rhoWithin - 0.5) < 1e-9, 'equal rhos pool to themselves')
	t.ok(Math.abs(bins[1].rhoWithin - 0.6) < 1e-9, 'a group of 3 has no weight')
	t.ok(Math.abs(bins[2].rhoWithin) < 1e-9, 'opposite rhos of equal groups cancel')
	t.ok(bins[0].qWithin < 0.05 && bins[2].qWithin > 0.5, 'a clear rho is significant and a null one is not')
	t.end()
})

tape('poolWithinGroups() leaves a bin with no usable group alone', t => {
	const bins = [bin([{ group: 'a' }, { group: 'b', rho: 0.3, n: 2 }])]
	poolWithinGroups(bins)
	t.equal(bins[0].rhoWithin, undefined)
	t.equal(bins[0].qWithin, undefined)
	t.end()
})

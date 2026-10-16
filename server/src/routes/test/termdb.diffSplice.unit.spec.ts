import tape from 'tape'
import { getClusterJunctions, resolveDsSampleGroups } from '../termdb.diffSplice.ts'
import { getAuthApi, authApi } from '#src/auth.js'

/*
test sections:

resolveDsSampleGroups lists the samples of a group that is defined by a filter
getClusterJunctions returns the junctions of one cluster
getClusterJunctions throws for a cluster without junction data
*/

const names: Record<number, string> = { 1: 's1', 2: 's2', 3: 's3', 4: 's4' }
function getDs(byFilter: Record<string, number[]>) {
	return {
		genomename: 'hg38-test',
		label: `spec-${Date.now()}-${Math.random()}`,
		cohort: {
			termdb: {
				q: { id2sampleName: (id: number) => names[id] },
				// the samples of a filter are those that its tag names
				async filterSamples(q: any) {
					return byFilter[q.filter.tag]
				}
			}
		}
	}
}
const filter = (tag: string) => ({
	type: 'tvslst',
	in: true,
	join: '',
	tag,
	lst: [{ type: 'tvs', tvs: { term: { id: 'x', type: 'categorical' }, values: [{ key: tag }] } }]
})
const all = new Set(Object.values(names))

tape('\n', t => {
	t.comment('-***- routes/termdb.diffSplice -***-')
	t.end()
})

tape('resolveDsSampleGroups lists the samples of a group that is defined by a filter', async t => {
	// assign the shared open-access api once, the same idempotent way termdb.matrix.unit.spec.js does
	if (!authApi) {
		const app = { doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }
		await getAuthApi(app, {}, {}, true)
	}
	const ds = getDs({ a: [1, 2], b: [3, 4], c: [2, 3] })
	const req = (groups: any[]) => ({ kind: 'DS', genome: 'hg38-test', dslabel: 'x', samplelst: { groups } } as any)

	let out = await resolveDsSampleGroups(
		req([
			{ name: 'a', in: true, filter: filter('a') },
			{ name: 'b', in: true, filter: filter('b') }
		]),
		all,
		ds,
		[],
		[]
	)
	t.deepEqual(
		[out.group1names, out.group2names],
		[
			['s1', 's2'],
			['s3', 's4']
		],
		'two groups that are filters'
	)
	t.deepEqual(out.alerts, [], 'no alert for groups that share no sample')

	out = await resolveDsSampleGroups(
		req([
			{ name: 'a', in: true, filter: filter('a') },
			{ name: 'listed', in: true, values: [{ sampleId: 3 }, { sampleId: 4 }] }
		]),
		all,
		ds,
		[],
		[]
	)
	t.deepEqual(
		[out.group1names, out.group2names],
		[
			['s1', 's2'],
			['s3', 's4']
		],
		'a filter group and a group that lists its samples'
	)

	out = await resolveDsSampleGroups(
		req([
			{ name: 'a', in: true, filter: filter('a') },
			{ name: 'c', in: true, filter: filter('c') }
		]),
		all,
		ds,
		[],
		[]
	)
	t.deepEqual(
		out.alerts,
		['Common samples found between both groups: 1 sample'],
		'the number of shared samples, for filter groups'
	)

	out = await resolveDsSampleGroups(
		req([
			{ name: 'a', in: true, values: [{ sampleId: 1 }, { sampleId: 2 }] },
			{ name: 'c', in: true, values: [{ sampleId: 2 }, { sampleId: 3 }] }
		]),
		all,
		ds,
		[],
		[]
	)
	t.deepEqual(
		out.alerts,
		['Common samples found between both groups: 1 sample'],
		'and for groups that list their samples'
	)

	out = await resolveDsSampleGroups(
		req([
			{ name: 'a', in: true, values: [{ sampleId: 1 }, { sampleId: 2 }, { sampleId: 3 }] },
			{ name: 'c', in: true, values: [{ sampleId: 2 }, { sampleId: 3 }] }
		]),
		all,
		ds,
		[],
		[]
	)
	t.deepEqual(
		out.alerts,
		['Common samples found between both groups: 2 samples'],
		'and in the plural for more than one shared sample'
	)
	t.end()
})

tape('getClusterJunctions returns the junctions of one cluster', t => {
	const result: any = {
		junctionsByCluster: {
			'chr1:clu_4_-': [
				[1390864, 1393395, 1.2e-8, 0.95, 0.88],
				[1390864, 1393500, 0.06, 0.05, null]
			],
			'chr2:clu_9_+': [[100, 200, 0.5, 0.5, 0.5]]
		}
	}
	t.deepEqual(
		getClusterJunctions(result, 'chr1:clu_4_-'),
		[
			{ chr: 'chr1', start: 1390864, stop: 1393395, p: 1.2e-8, psi_control: 0.95, psi_case: 0.88 },
			{ chr: 'chr1', start: 1390864, stop: 1393500, p: 0.06, psi_control: 0.05, psi_case: null }
		],
		'should return only that cluster, with the chr of its id'
	)
	t.end()
})

tape('getClusterJunctions throws for a cluster without junction data', t => {
	const result: any = { junctionsByCluster: { 'chr1:clu_4_-': [[1, 2, 0.1, 0.5, 0.5]] } }
	t.throws(
		() => getClusterJunctions(result, 'chr1:clu_5_-'),
		/No junction data for cluster chr1:clu_5_-/,
		'should throw for a cluster that is not in the screen'
	)
	t.throws(
		() => getClusterJunctions(result, '__proto__'),
		/No junction data for cluster __proto__/,
		'should throw for an inherited property name'
	)
	t.throws(
		() => getClusterJunctions({} as any, 'chr1:clu_4_-'),
		/No junction data for cluster chr1:clu_4_-/,
		'should throw for a cache result written without junction data'
	)
	t.end()
})

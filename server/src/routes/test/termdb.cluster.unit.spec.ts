import tape from 'tape'
import { getNumericDictTermAnnotation } from '../termdb.cluster.ts'
import { getAuthApi, authApi } from '../../auth.js'

async function ensureOpenAuth() {
	if (authApi) return
	const app = { doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }
	await getAuthApi(app, {}, {}, true)
}

// getNumericDictTermAnnotation() reshapes getData()'s per-sample output into a
// { term -> { sampleId -> value } } map for clustering. sampleId is dataset content (it flows
// through unchanged from getData()'s samples{}, which now preserves a '__proto__' key rather
// than losing it), so this reshape must not lose that sample's value the same way the original
// bug would have.
tape('getNumericDictTermAnnotation: a sample id of __proto__ keeps its value', async t => {
	await ensureOpenAuth()
	const tw = { $id: 'agedx', term: { id: 'agedx', name: 'Age', type: 'float' }, q: { mode: 'continuous' } }
	const ds: any = {
		cohort: { db: null, termdb: {} },
		termid2sample2value: new Map([['agedx', new Map([['__proto__', 42]])]])
	}
	const q = { terms: [tw] }
	const { term2sample2value } = await getNumericDictTermAnnotation(q, ds)
	const s2v = term2sample2value.get('agedx')
	t.ok(Object.hasOwn(s2v, '__proto__'), 'stores the sample value under a real own __proto__ key')
	t.equal(s2v['__proto__'], 42, 'the value is retrievable rather than silently dropped')
	t.end()
})

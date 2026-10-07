import type { Mds3 } from '#types'
// see dataset/protected.test.ts on using the .js extension when importing termdb.test
import termdbTestInit from '../../dataset/termdb.test.js'

/*
	TermdbTest with a role-based sample filter, for request tests of the routes that select samples
	with the dataset's getAdditionalFilter() -- the shape of a dataset where a session's grants decide
	which samples it reads. The 'admin' role has no filter, and any other role reads the samples with
	an id up to maxSampleId. TermdbTest and ProtectedTest have no sample filter, so they cannot
	exercise that branch.

	Load it from a test serverconfig with:
	{ "name": "TermdbTest", "jsfile": "test/testdata/termdb.test.sampleFilter.ts" }
*/

// the sample ids 1 to 100 of TermdbTest are of the 'sample' type, see the sampleidmap table of its db
const maxSampleId = 50

export default function (): Mds3 {
	const ds = termdbTestInit()
	if (!ds.cohort) ds.cohort = { termdb: {} }
	ds.cohort.termdb.getAdditionalFilter = ({ clientAuthResult }) => {
		if (clientAuthResult?.role == 'admin') return
		const list = Array.from({ length: maxSampleId }, (_, i) => ({ sampleId: i + 1 }))
		return {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [{ type: 'tvs', tvs: { term: { type: 'samplelst', values: { '': { key: '', list } } } } }]
		} as any
	}
	return ds
}

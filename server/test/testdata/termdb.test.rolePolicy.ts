import type { Mds3 } from '#types'
// see dataset/protected.test.ts on using the .js extension when importing termdb.test
import termdbTestInit from '../../dataset/termdb.test.js'

/*
	TermdbTest with a role-based displaySampleIds policy, for request tests that need a logged-in
	session that is still denied sample ids -- the shape of careReg, where an 'admin' sees sample ids
	and a 'user' does not. TermdbTest and ProtectedTest allow every request, so they cannot exercise
	that branch.

	Load it from a test serverconfig with:
	{ "name": "TermdbTest", "jsfile": "test/testdata/termdb.test.rolePolicy.ts" }
*/
export default function (): Mds3 {
	const ds = termdbTestInit()
	if (!ds.cohort) ds.cohort = { termdb: {} }
	ds.cohort.termdb.displaySampleIds = clientAuthResult => clientAuthResult?.role == 'admin'
	return ds
}

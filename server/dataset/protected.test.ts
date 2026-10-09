import type { Mds3 } from '#types'
// on using .js instead of .ts extension when importing termdb.test:
// - in local dev, `tsx` will automatically find and use the correct file
// - in container-based CI, the installed @sjrch/proteinpaint-server/dataset has js files only
import termdbTestInit from './termdb.test.js'

const minSize = 10
// must match the dsnames[].id in the ProtectedTest dsCredentials, see serverconfig.js
const allowedDatasets = ['ABC', 'XYZ']

// export a function to allow reuse of this dataset without causing conflicts
// for the different use cases in runtime/tests
export default function (): Mds3 {
	// NOTE: may need to supply arguments to termdbTestInit if it requires it
	const ds = termdbTestInit()
	if (!ds.cohort) ds.cohort = { termdb: {} }
	ds.cohort.termdb.checkAccessToSampleData = (q, data) => {
		const userDatasets = q.__protected__?.datasets
		return {
			minSize,
			canAccess:
				data.count >= minSize || (Array.isArray(userDatasets) && allowedDatasets.every(d => userDatasets.includes(d)))
		}
	}

	ds.demoJwtInput = {
		user: {
			datasets: ['ABC', 'XYZ']
		}
	}
	return ds
}

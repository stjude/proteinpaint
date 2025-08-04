import type { Mds3 } from '#types'
import termdbTestInit from './termdb.test.ts'

// export a function to allow reuse of this dataset without causing conflicts
// for the different use cases in runtime/tests
export default function (): Mds3 {
	// NOTE: may need to supply arguments to termdbTestInit if it requires it
	const ds = termdbTestInit()
	if (!ds.cohort) ds.cohort = { termdb: {} }
	ds.cohort.termdb.hasMinSampleSize = sampleCount => {
		//console.log(11, 'hasMinSampleSize()', sampleCount)
		return sampleCount >= 10
	}
	return ds
}

import type { Mds3 } from '#types'
// on using .js instead of .ts extension when importing termdb.test:
// - in local dev, `tsx` will automatically find and use the correct file
// - in container-based CI, the installed @sjrch/proteinpaint-server/dataset has js files only
import termdbTestInit from './termdb.test.js'

// export a function to allow reuse of this dataset without causing conflicts
// for the different use cases in runtime/tests
export default function (): Mds3 {
	// NOTE: may need to supply arguments to termdbTestInit if it requires it
	const ds = termdbTestInit()
	if (!ds.queries) ds.queries = {}
	ds.queries.cnv = {
		file: ds.queries?.cnv?.file
		// cnvMaxLength: 20000000,
		// cnvGainCutoff: 0.1,
		// cnvLossCutoff: -0.1
	}
	return ds
}

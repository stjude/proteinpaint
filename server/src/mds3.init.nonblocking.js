import serverconfig from './serverconfig.js'
import { gdcInitCache } from './gdc.initCache.js'

/*
********************   Comment   *****************
This script only runs once, when PP server/container launches.
It is called by mds3.init.js after all other validation steps are done for
a dataset. The remaining steps are assumed to be non-blocking.

This is not a route, it does not accept request parameters from client.

On any error, a non-blocking step should throw an exception, and set
ds.init = {
	status: 'recoverableError' | 'fatalError'
	[recoverableError | fatalError]: string
}
*/

export async function mds3InitNonblocking(ds) {
	if (!ds.init) ds.init = {}
	ds.init.status = 'nonblocking'

	// The nonblocking functions below should be called after all ds queries are validated in mds3.init.js init().
	// Otherwise, it's much harder to coordinate failures from either query validation or caching
	// it they are running at the same time.
	//
	// These dataset-specific init steps are not coded in the dataset js files because
	// the nonblocking code uses helper functions that is not exposed by
	// the `@sjcrh/proteinpaint-server` package. For example, gdc.initCache.js imports
	// cachedFetch() and isRecoverableError() helpers from server/utils.js
	//
	// TODO: either
	// - expose these helper functions from the server package
	// - supply helpers as arguments to this function, so they can be passed to the non-blocking function below
	//
	const initNonblocking = ds.label == 'GDC' ? gdcInitCache : undefined
	if (!initNonblocking) return

	initNonblocking(ds)
		.then(() => {
			if (ds.init.status == 'nonblocking') {
				ds.init.status = ds.init.recoverableError ? 'recoverableError' : ds.init.fatalError ? 'fatalError' : 'done'
			}
		})
		.catch(e => {
			if (ds.init.recoverableError) return
			ds.init.status = 'fatalError'
			ds.init.fatalError = e
			console.log(`${ds.genomename}/${ds.label} fatal error`, e)
			// TODO: notify team of ds load failure
		})
}

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

	// The dataset owns its launch-time caching via ds.preInit.cacheSamples, which injects any
	// server-internal helpers it needs (see gdc.hg38.ts). It runs here — after all query
	// validation — for datasets that opt into the nonblocking phase (hasNonblockingSteps, e.g.
	// gdc); blocking datasets (e.g. mmrf) run cacheSamples earlier, in mds3.init.js.
	const initNonblocking = ds.preInit?.cacheSamples
	if (!initNonblocking) return

	return initNonblocking(ds)
		.then(() => {
			// uncomment below to test '--- failed dataset init ... ---' in startup log
			// ds.init = {status: 'fatalError', fatalError: 'test ds.init.status == fatalError'}
			// uncomment below to test '--- active retries ... ---' in startup log
			// ds.init = {status: 'recoverableError', fatalError: 'test ds.init.status == recovarableError'}

			if (ds.init.status == 'nonblocking') {
				if (ds.init.recoverableError) ds.init.status = 'recoverableError'
				if (ds.init.fatalError) ds.init.status = 'fatalError'
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

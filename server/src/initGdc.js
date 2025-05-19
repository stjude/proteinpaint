import serverconfig from './serverconfig.js'
import { buildGDCdictionary } from './initGdc.termdb.js'
import { runRemainingWithoutAwait } from './initGdc.cache.js'

/*
********************   Comment   *****************
this script only runs once, when PP server/container launches.
it is conditionally called by mds3.init.js when gdc dataset is present
it caches publicly available info from some GDC apis, which doesn't require user token
it is not a route, it does not accept request parameters from client
upon any error, it throws exception.
any error is considered critical and must be presented in server log for diagnosis, and thus can abort launch when running in gdc prod environment



******************** major tasks *****************
- parsing gdc variables and constructing in-memory termdb:
  HARDCODED LOGIC, does not need any configuration in dataset file
  standard termdb "interface" functions are added to ds.cohort.termdb.q{}

- determine default binconfig for all numeric terms
  added to term json objects

  (above two tasks will enable gdc ds initiation during launch sequence. thus following tasks are not awaited to speed up launch)

- querying list of open-access projects
  stores at: ds.gdcOpenProjects = set of project ids that are open-access

- test gdc api, make sure they're all online

- cache sample/case name/uuid mapping
  creates these new dataset-level attributes
  ds.__gdc {
  	aliquot2submitter{ get() }
  	map2caseid{ get() }
  	doneCaching: boolean, falg to indicate when the sample ID caching is done
	casesWithExpData Set
	caseid2submitter
	data_release_version
  }

- periodic check of stale cache and re-cache above
*/
let i = 0
export async function initGDCdictionary(ds) {
	// TODO: should include this in versioned cache
	await buildGDCdictionary(ds)
	// uncomment to test, should trigger mds3_init() retry
	// i++; if (i < 4) throw {status: 500}

	if (serverconfig.features.await4completeGdcCaseCache) {
		// only use on dev environment. here as soon as server is launched,
		// it will signal client to refresh (sse). if still caching asyncly,
		// a gdc view may break due to incomplete cache, thus await a bit for cache to complete.
		// also should use extApiCache;
		// calling here means it's invoked before ds queries are validated in mds3.init.js init()
		await runRemainingWithoutAwait(ds)
	} else {
		ds.init.status = 'nonblocking'
		// below will be called after all ds queries are validated in mds3.init.js init(),
		// otherwise it's harder to coordinate failures from either query validation or caching
		ds.initRemainingWithoutAwait = () => {
			// use on prod, not to hold up container launch while caching
			runRemainingWithoutAwait(ds)
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
	}
}

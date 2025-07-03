import ky from 'ky'
import { isUsableTerm } from '#shared/termdb.usecase.js'
import serverconfig from './serverconfig.js'
import { cachedFetch, isRecoverableError } from './utils'
import { deepEqual } from '#shared/helpers.js'
import { joinUrl } from '#shared/joinUrl.js'

// wait time for next check on stale case-id cache, 5min. feature flag allows testing with short internal
const cacheCheckWait = serverconfig.features.gdcCacheCheckWait || 5 * 60 * 1000

/****************************************************
   remaining tasks after dictionary is built:
   - cache gdc case id mapping, cases with exp data
   - open-access projects
   - continuous check for stale cache
*****************************************************

********************   functions    *************
gdcInitCache
	cacheMappingOnNewRelease
		getOpenProjects
		fetchIdsFromGdcApi
		getCasesWithGeneExpression
		getAnalysisTsv2loom4scrna


Important!
- do not await when calling this function, as following steps execute logic that are optional 
  for server function, and should not halt server launch
- inside the function should await each step so they work in sequence
*/

/******************** major tasks *****************
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
export async function gdcInitCache(ds) {
	// caching action is fine-tuned by the feature toggle on a pp instance; log out detailed status per setting
	// NOTE: serverconfig.features."mustExitPendingValidation" has replaced "stopGdcCacheAliquot" option,
	// serverconfig.js will automatically convert the latter to the "mustExitPendingValidation" as needed
	if (serverconfig.features.mustExitPendingValidation) {
		// do not cache at all. this flag is auto-set for container validation.
		// running stale cache check will cause the server process not to quit,
		// and break validation, thus must skip this when flag is true
		console.log('GDC: sample IDs are not cached! No periodic check will take place!')
		if (!ds.__gdc) ds.__gdc = getCacheRef(ds) // though nothing is cached, must init the cache holder so not to break code that accesses this holder
		///////////////////// NOTE ///////////////////////
		// with missing cache for case id mapping and cases with exp data, any query using gdc gene exp data will not work!!
		// this should be fine for container validation, but may not do so on a dev environment
		return
	}

	if (ds.init.status != 'nonblocking') {
		// NOTE: mds3.init.js calls initNonBlocking after all validation steps are done
		throw `initGdcCache() should only be called when ds.init.status == 'nonblocking'`
	}

	// !!! DISABLED option to await the initial check below !!!
	// This was previously implied by the serverconfig.features.gdcCacheCheckWait option, but it
	// complicates the handling of mds3 non-blocking init steps after all the validation steps are done.
	// Consumer code should instead detect `"doneCaching": true` from the `/healthcheck?dslabel=GDC` reponse,
	// and there is also a `The server has not finished caching ...` error message that's displayed in the UI.
	mayRefreshCache(ds) // do not await initial call
	setInterval(mayRefreshCache, cacheCheckWait, ds) // periodic check after initial call
}

async function mayRefreshCache(ds) {
	let version
	try {
		version = await hasNewVersion(ds)
		if (!version) return
		await cacheMappingOnNewRelease(ds, version)
	} catch (e) {
		// uncomment to test cancellation of retries and also requires
		// one of the `.then()` test callbacks to be uncommented
		// delete ds.init.recoverableError

		// always allow retries, regardless of error type (fatal or recoverable)
		delete ds.__pendingCacheVersion
		if (ds.__gdc) delete ds.__gdc.data_release_version

		if (ds.init.recoverableError) {
			console.log(`allow retries of cacheMappingOnNewRelease()`)
			console.trace(e)
		} else if (isRecoverableError(e)) {
			console.log('recoverableError: ', e)
			delete ds.__pendingCacheVersion
		} else {
			console.log(`force retries of cacheMappingOnNewRelease()`)
			console.trace(e)

			// !!! forced retry of caching, assume caching error should always be recoverable !!!
			console.log('cacheSampleIdMapping() failed: ' + (e.message || e), ds.init.fatalError)
			ds.init.recoverableError = 'fatal error forced to recoverable: cacheSampleIdMapping()'
			// delete ds.init.fatalError
			delete ds.__pendingCacheVersion
			// forced retry: do not return
		}
	}
}

async function hasNewVersion(ds) {
	// an empty run will cancel the subsequent recache step in mayRefreshCache
	if (ds.__pendingCacheVersion) {
		console.log(`${ds.label}: allow pending cache to finish (${JSON.stringify(ds.__pendingCacheVersion)})`)
		return
	}
	delete ds.init.getStatusError

	console.log('GDC: checking if cache is stale OR should recover from an error')
	let version
	try {
		// since this runs in a loop, the API status could change between requests
		const response = await ds.preInit.getStatus()
		version = response?.data_release_version
		if (!version) return
	} catch (e) {
		console.log('preInit.getStatus() error', e)
		ds.init.getStatusError = e
		return // next call to hasNewVersion() will delete ds.init.getStatusError
	}

	// __pendingCacheVersion: started, but not completed
	if (deepEqual(version, ds.__pendingCacheVersion) || deepEqual(version, ds.__gdc?.data_release_version)) {
		if (ds.preInit.test)
			console.log(
				'GDC: skip recache of ',
				version.minor,
				ds.__pendingCacheVersion?.minor,
				ds.__gdc?.data_release_version.minor
			)
		// do not trigger duplicate caching for the same release version, whether pending or completed

		// even if version has not changed, still recache if a recoverable error was encountered,
		// should try restart caching optimistically (that the network or server issue was resolved)
		if (!ds.init.recoverableError) return
		else {
			console.log(`detected caching error: `, ds.init.recoverableError)
			console.log(`cached gdc data version is up-to-date, but there was a caching error, will restart cache`)
			//
		}
	}
	// if ds.preInit.getStatus() took a long time, another mayRefreshCache() could have been triggered,
	// and potentially result in this detection being stale
	if (mayCancelStalePendingCache(ds, { data_release_version: version })) return
	return version
}

/*
cache gdc sample id mappings
** this is an optional step and can be skipped on dev machines **
- create a map from sample aliquot id to sample submitter id, for displaying in mds3 tk
- create a map from differet ids to case uuid, for creating gdc cohort with selected samples
- cache list of case uuids with expression data

function will rerun when it detects stale case id cache
*/
async function cacheMappingOnNewRelease(ds, version) {
	// clear init.recoverableError that was generated by a previous recache attempt
	delete ds.init.recoverableError

	// to avoid issues from race condition:
	// - do not set ds.__gdc until the caching is complete, unless none exists initially
	// - create a new ref object to map pending cacheable data
	// - if a new cacheMapping call is triggered before the previous one is finished,
	//   then make sure the previous cacheRef object is not used as ds.__gdc
	const ref = getCacheRef(ds) // a new empty nested cache object
	if (!ds.__gdc) ds.__gdc = ref // would reference the same object only on initial call

	const begin = new Date()

	try {
		// not using deepEqual() here, since on initial call ds.__gdc and ref directly reference the same object
		if (ds.__gdc !== ref) console.log(`GDC: cache is stale. Caching version.minor='${version.minor}' ...`)

		// reset doneCaching to false, which may overwrite it for a previous data version that has completed caching:
		// the healthcheck?dslabel=GDC response will include doneCaching, so that the client code can display
		// `the dataset has not finished loading` message
		ds.__gdc.doneCaching = false
		// above is equivalent to having a ds.__pendingCacheVersion object present
		// it's important to keep the existing ds.__gdc cacheRef
		// - to allow the server to finish serving data for a request that has started before a pending recache attempt
		// - to prevent race condition causing a stale cacheRef to be filled-in as ds.__gdc during a recache

		// the pending version will be tracked outside of ds.__gdc and ref objects,
		// so that be use to compare for staleness
		ds.__pendingCacheVersion = version

		// ref is not equal to ds.__gdc at this point during a retry/recache,
		// must attach the release version to the pending ref object that will be filled-in
		ref.data_release_version = version

		const date = new Date()
		ref.cacheTimes.start = {
			unixTime: Date.now(),
			local: date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
		}
		await getOpenProjects(ds, ref)
		const size = 1000 // fetch 1000 ids at a time
		// may force totalCases to 8000 for quicker testing but still multiple fetch iterations
		const totalCases = serverconfig.features.gdcCacheCheckWait ? 8000 : await fetchIdsFromGdcApi(ds, 1, 0, ref)
		if (!Number.isInteger(totalCases)) throw 'totalCases not integer'
		ds.init.expectedTotalCases = totalCases

		console.log('GDC: Start to cache sample IDs of', totalCases, 'cases...')
		for (let i = 0; i < Math.ceil(totalCases / size); i++) {
			const count = await fetchIdsFromGdcApi(ds, size, i * 1000, ref)
			// IMPORTANT to break the loop early if no data is fetched in a loop iteration,
			// there's a chance that expectedTotalCases may not be reached after a data version change
			if (count === 0) break
		}

		await getCasesWithGeneExpression(ds, ref)
		await getAnalysisTsv2loom4scrna(ds, ref)
		await setAssayAvailability(ds, ref)
	} catch (e) {
		if (mayCancelStalePendingCache(ds, ref)) return // avoid resetting ds.__* variables that may affect newer data version caching
		if (isRecoverableError(e)) {
			console.log(ds.__gdc?.recoverableError || ds.init?.recoverableError)
			delete ds.__pendingCacheVersion
			if (ds.__gdc) delete ds.__gdc.data_release_version
			// the periodic rerun of this function will allow auto-recovery
		}
		throw e
	}

	// if the version has changed while caching was being performed,
	// do not proceed to marking caching as being done, otherwise
	// stale cache data will be served to users
	if (mayCancelStalePendingCache(ds, ref)) return
	if (ds.init.recoverableError) return // should not allow doneCaching: true when there is an ignored error
	delete ds.__pendingCacheVersion
	// swap to the newly completed cache reference
	ds.__gdc = ref
	ds.__gdc.doneCaching = true
	console.log('GDC: Done caching sample IDs. Time:', Math.ceil((new Date() - begin) / 1000), 's')
	console.log('\t', ds.__gdc.aliquot2submitter.cache.size, 'aliquot IDs to sample submitter id,')
	console.log('\t', ds.__gdc.caseid2submitter.size, 'case uuid to submitter id,')
	console.log('\t', ds.__gdc.map2caseid.cache.size, 'different ids to case uuid,')
	console.log('\t', ds.__gdc.casesWithExpData.size, 'cases with gene expression data.')
	const date = new Date()
	ds.__gdc.cacheTimes.stop = {
		unixTime: Date.now(),
		local: date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
	}
}

function getCacheRef(ds) {
	const date = new Date()

	// gather these arbitrary gdc stuff under __gdc{} to be safe
	// do not freeze the object; they will be rewritten if cache is stale
	const ref = {
		aliquot2submitter: {
			cache: new Map(),
			get: async aliquot_id => {
				if (ref.aliquot2submitter.cache.has(aliquot_id)) return ref.aliquot2submitter.cache.get(aliquot_id)

				/* 
				as on the fly api query is still slow, especially to query one at a time for hundreds of ids
				simply return unconverted id to preserve performance
				*/
				return aliquot_id

				// converts one id on the fly while the cache is still loading
				//await fetchIdsFromGdcApi(ds, null, null, ref, aliquot_id)
				//return ref.aliquot2submitter.cache.get(aliquot_id)
			}
		},
		// create new attr to map to case uuid, from 3 kinds of ids: aliquot, sample submitter, and case submitter
		// this mapping serves case selection from mds3 and matrix, where input can be one of these different types
		map2caseid: {
			cache: new Map(),
			get: input => {
				return ref.map2caseid.cache.get(input)
				// NOTE if mapping is not found, do not return input, caller will call convert2caseId() to map on demand
			}
		},
		caseid2submitter: new Map(), // k: case uuid, v: case submitter id
		caseIds: new Set(), //
		casesWithExpData: new Set(),
		gdcOpenProjects: new Set(), // names of open-access projects
		scrnaAnalysis2hdf5: new Map(), // for scrna, k: seurat.analysis.tsv uuid, v: hdf5/loom uuid. maps a analysis tvs file to loom file, latter is required for querying scrna gene exp data
		doneCaching: false,
		cacheTimes: {
			// uncomment for testing scenario where cacheTimes.start is somehow not set
			// requested: { unixTime: Date.now(), local: date.toLocaleDateString() + ' ' + date.toLocaleTimeString() }
		}
	}

	return ref
}

// may cancel unfinished caching for an older data_release_version,
// if a new data_release_version is detected in cacheMappingOnNewRelease() runs
function mayCancelStalePendingCache(ds, ref) {
	const current = ds.__pendingCacheVersion || ds.__gdc?.data_release_version
	if (!current) return false
	const next = ref.data_release_version
	if (next.major < current.major || next.minor < current.minor) {
		console.log(`GDC: !!! cancel stale pending cache for `, next)
		return true
	}
	return false
}

/*
	ds: gdc dataset object
	ref: the cache reference object from getCacheRef(), used to track caching status, progress, errors
*/
async function getOpenProjects(ds, ref) {
	const data = {
		filters: {
			op: 'and',
			content: [
				{
					op: '=',
					content: {
						field: 'access',
						value: 'open'
					}
				},
				{
					op: '=',
					content: {
						field: 'data_type',
						value: 'Masked Somatic Mutation'
					}
				}
			]
		},
		facets: 'cases.project.project_id',
		size: 0
	}

	const { host, headers } = ds.getHostHeaders()
	const url = joinUrl(host.rest, 'files')
	const { body: re } = await cachedFetch(url, { method: 'POST', headers, body: data })
		// uncomment this then() callback to test recoverable error handling,
		// use `npx tsx server.ts` from sjpp instead of `npm start`, and
		// have serverconfig.features.gdcCacheCheckWait=9000 to more clearly observe server crash
		//.then(_ => {throw {status: 404}}) // client request error detected by healthy API -- should cause an IMMEDIATE crash
		.catch(e => {
			if (isRecoverableError(e)) ds.init.recoverableError = `getOpenProjects() ${url}`
			// still throw to stop code execution here and allow caller to catch
			throw e
		})

	if (!Array.isArray(re?.data?.aggregations?.['cases.project.project_id']?.buckets)) {
		console.log("getting open project_id but return is not re.data.aggregations['cases.project.project_id'].buckets[]")
		return
	}
	for (const b of re.data.aggregations['cases.project.project_id'].buckets) {
		// key is project_id value
		if (b.key) ref.gdcOpenProjects.add(b.key)
	}
	console.log('GDC open-access projects:', ref.gdcOpenProjects.size)
}

/*
input:
	ds:
		gdc dataset object
	size:int
	from:int
		null or integer
		if null, aliquot_id must be given
	aliquot_id:str

output:
	re.data.pagination.total

aliquot-to-submitter mapping are automatically cached
*/
async function fetchIdsFromGdcApi(ds, size, from, ref, aliquot_id) {
	// since this function is called in a loop, exit early as needed to avoid unnecessary requests;
	// also, when a data version changes, it's possible that the expected number of cases or
	// pagination results from the response may be less than the previous version's expected number of cases,
	// in which case the loop to fetch IDs will never reach the total count, therefore trigger the caching to stop
	if (mayCancelStalePendingCache(ds, ref)) return 0
	const param = ['fields=submitter_id,samples.portions.analytes.aliquots.aliquot_id,samples.submitter_id']
	if (aliquot_id) {
		param.push(
			'filters={"op":"and","content":[{"op":"=","content":{"field":"samples.portions.analytes.aliquots.aliquot_id","value":["' +
				aliquot_id +
				'"]}}]}'
		)
	} else {
		if (!Number.isInteger(size) || !Number.isInteger(from)) throw 'size and from not integers'
		param.push('size=' + size)
		param.push('from=' + from)
	}

	const { host, headers } = ds.getHostHeaders()
	const { body: re } = await cachedFetch(host.rest + '/cases?' + param.join('&'), { headers })
		// uncomment this then() callback to test recoverable error handling,
		// use `npx tsx server.ts` from sjpp instead of `npm start`, and
		// have serverconfig.features.gdcCacheCheckWait=9000 to more clearly observe server log of errors
		// .then(_ => {
		// 	throw { status: 500 } // server-side error, should be recoverable and not cause a crash
		// })
		.catch(e => {
			if (isRecoverableError(e)) ds.init.recoverableError = 'fetchIdsFromGdcApi() /cases'
			// still throw to stop code execution here and allow caller to catch
			throw e
		})
	if (!Array.isArray(re?.data?.hits)) throw 're.data.hits[] not array'

	//console.log(re.data.hits[0]) // uncomment to examine output

	/*
	re.data.hits = [
	  {
	  	// the "id" value seems to be case.case_id
		// it is always here even if 'case.case_id' is not included in fields
		"id": "c2829ab9-d5b2-5a82-a134-de9c591363de",
		submitter_id: 'TCGA-LL-A6FQ', // case submitter id
		"samples": [
		  {
			"submitter_id": "TARGET-50-PAJNID-01A",
			"portions": [
			  {
				"analytes": [
				  {
					"aliquots": [
					  {
						"aliquot_id": "123bd4c3-6e36-4514-8d06-9f1f408cd1aa"
					  }
					]
				  }
				]
			  },
			  { ... more analytes ... }
			]
		  }
		]
	  }
	 ]
	*/
	for (const h of re.data.hits) {
		const case_id = h.id
		if (!case_id) throw 'h.id (case uuid) missing'
		ref.caseIds.add(case_id)

		const case_submitter_id = h.submitter_id
		if (!case_submitter_id) throw 'h.submitter_id missing'

		ref.caseid2submitter.set(case_id, case_submitter_id)

		/*
		below shows different uuids mapping to same submitter id
		this is the reason case submitter id must not be used to align data in oncomatrix, as it's not unique across Projects

		if(ref.map2caseid.cache.has(case_submitter_id)) {
			console.log(case_submitter_id, case_id, ref.map2caseid.cache.get(case_submitter_id))
		}
		*/

		ref.map2caseid.cache.set(case_submitter_id, case_id)

		if (!Array.isArray(h.samples)) continue //throw 'hit.samples[] not array'
		for (const sample of h.samples) {
			const sample_submitter_id = sample.submitter_id
			if (!sample_submitter_id) throw 'sample.submitter_id missing'

			ref.map2caseid.cache.set(sample_submitter_id, case_id)

			if (!Array.isArray(sample.portions)) continue // throw 'sample.portions[] not array'
			for (const portion of sample.portions) {
				if (!Array.isArray(portion.analytes)) continue //throw 'portion.analytes not array'
				for (const analyte of portion.analytes) {
					if (!Array.isArray(analyte.aliquots)) continue //throw 'analyte.aliquots not array'
					for (const aliquot of analyte.aliquots) {
						const aliquot_id = aliquot.aliquot_id
						if (!aliquot_id) throw 'aliquot.aliquot_id missing'
						ref.aliquot2submitter.cache.set(aliquot_id, sample_submitter_id)
						ref.map2caseid.cache.set(aliquot_id, case_id)
					}
				}
			}
		}
	}
	// NOTE: If total=0, it will cause the caching to terminate early
	return re.data?.pagination?.total
}

async function getCasesWithGeneExpression(ds, ref) {
	// it's simpler to avoid stale requests that may run concurrently with new version caching,
	// since there are shared tracking variables across each caching attempts, such as ds.__pendingCacheVersion
	if (mayCancelStalePendingCache(ds, ref)) return

	const { host, headers } = ds.getHostHeaders()
	const url = joinUrl(host.rest, 'gene_expression/availability')

	try {
		const idLst = [...ref.caseIds]
		const { body: re } = await cachedFetch(url, {
			method: 'post',
			headers,
			body: { case_ids: idLst, gene_ids: ['ENSG00000141510'] }
		})
		// uncomment this then() callback to test recoverable error handling,
		// use `npx tsx server.ts` from sjpp instead of `npm start`, and
		// have serverconfig.features.gdcCacheCheckWait=9000 to more clearly observe server crash
		// .then(_ => {
		// 	// network connection error, should be recoverable and not cause a crash
		// 	throw { code: 'ENOTFOUND' }
		// 	// IMPORTANT: Make sure that the `Done caching` terminal log does not show up
		// })

		// {"cases":{"details":[{"case_id":"4abbd258-0f0c-4428-901d-625d47ad363a","has_gene_expression_values":true}],"with_gene_expression_count":1,"without_gene_expression_count":0},"genes":null}
		if (!Array.isArray(re.cases?.details)) throw 're.cases.details[] not array'
		for (const c of re.cases.details) {
			if (c.has_gene_expression_values) ref.casesWithExpData.add(c.case_id)
		}

		delete ref.caseIds
	} catch (e) {
		console.log(e)

		if (isRecoverableError(e)) {
			ds.init.recoverableError = `getCasesWithGeneExpression() gene_expression/availability`
		} else {
			// is this related to caching and is this true for all users, or just for a single request?
			// if for all users, the message makes it seem like it's for a single user
			console.log("You don't have access to /gene_expression/availability/, you cannot run GDC hierCluster")
		}

		delete ds.__pendingCacheVersion

		// still throw to stop code execution within getCasesWithGeneExpression() and allow its caller to catch
		throw e
	}
}

async function getAnalysisTsv2loom4scrna(ds, ref) {
	// it's simpler to avoid stale requests that may run concurrently with new version caching,
	// since there are shared tracking variables across each caching attempts, such as ds.__pendingCacheVersion
	if (mayCancelStalePendingCache(ds, ref)) return

	const { host, headers } = ds.getHostHeaders()
	const filters = {
		op: 'and',
		content: [
			{
				op: 'or',
				content: [
					{ op: '=', content: { field: 'data_format', value: 'tsv' } },
					{ op: '=', content: { field: 'data_format', value: 'hdf5' } }
				]
			},
			{ op: '=', content: { field: 'data_type', value: 'Single Cell Analysis' } },
			{ op: '=', content: { field: 'experimental_strategy', value: 'scRNA-Seq' } }
		]
	}
	const json = {
		filters,
		size: 10000,
		fields: 'data_format,file_name,cases.samples.portions.analytes.aliquots.submitter_id'
	}
	/*
	{
  data: {
    hits: [
	{
  "id": "e4e54f7f-5bbc-4131-9749-8cfdad3f0608",
  "data_format": "HDF5",
  "cases": [
    {
      "samples": [
        {
          "portions": [
            {
              "analytes": [
                {
                  "aliquots": [
                    {
                      "submitter_id": "aq-BA3216R"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "file_name": "fc3f47f0-b7d9-453b-9263-ed60f2401841.seurat.1000x1000.loom"
}
	  ...
    ],
    pagination: {
      count: 88,
      total: 88,
      size: 10000,
      from: 0,
      sort: '',
      page: 1,
      pages: 1
    }
  },
  warnings: {}
}
*/
	let re
	const url = joinUrl(host.rest, 'files')
	try {
		re = await ky.post(url, { timeout: false, headers, json }).json()
	} catch (e) {
		if (isRecoverableError(e)) {
			ds.init.recoverableError = `getAnalysisTsv2loom4scrna() '${url}'`
		}
		delete ds.__pendingCacheVersion
		// should still throw here to stop getAnalysisTsv2loom4scrna() code execution and allow its caller to catch
		throw e
	}
	if (!Array.isArray(re.data.hits)) throw 'scrna: re.data.hits[] not array'
	const submitter2tsv = new Map(),
		submitter2hdf5 = new Map()
	for (const hit of re.data.hits) {
		if (!hit.id) throw 'hit.id missing'
		const submitter = hit.cases?.[0]?.samples?.[0]?.portions?.[0]?.analytes?.[0]?.aliquots?.[0]?.submitter_id
		if (!submitter) throw 'aliquot submitter missing'
		if (hit.data_format == 'HDF5') {
			if (submitter2hdf5.has(submitter)) throw 'submitter already there'
			submitter2hdf5.set(submitter, hit.id)
		} else if (hit.data_format == 'TSV') {
			if (submitter2tsv.has(submitter)) throw 'submitter already there'
			submitter2tsv.set(submitter, hit.id)
		} else {
			throw 'unknown data_format'
		}
	}
	for (const [submitter, tsv] of submitter2tsv) {
		const hdf5 = submitter2hdf5.get(submitter)
		if (!hdf5) throw 'aliquot has tsv but missing hdf5'
		ref.scrnaAnalysis2hdf5.set(tsv, hdf5)
	}
}

async function setAssayAvailability(ds, ref) {
	if (mayCancelStalePendingCache(ds, ref)) return
	const json = {
		filters: {},
		size: 100000, // TODO set limit or not?
		fields: [
			'case_id', // only need to report case uuid to match with mayGetGeneVariantData which also uses case uuid
			'available_variation_data'
		].join(',')
	}

	const { host, headers } = ds.getHostHeaders()

	const t0 = Date.now()

	const response = await fetch(joinUrl(host.rest, 'case_ssms'), {
		method: 'POST',
		headers,
		body: JSON.stringify(json),
		signal: undefined
	})

	if (!response.ok) throw 'Failed to fetch. Status: ' + response.status

	const re = await response.json()

	if (!Number.isInteger(re.data?.pagination?.total)) throw 're.data.pagination.total is not int'
	if (!Array.isArray(re.data?.hits)) throw 're.data.hits[] not array'

	const ssmYes = new Set(),
		ssmNo = new Set(),
		cnvYes = new Set(),
		cnvNo = new Set()

	for (const h of re.data.hits) {
		const caseid = h.case_id
		if (!caseid) throw 'h.case_id missing'
		if (!Array.isArray(h.available_variation_data)) throw 'h.available_variation_data[] not array'
		if (h.available_variation_data.includes('ssm')) {
			ssmYes.add(caseid)
		} else {
			ssmNo.add(caseid)
		}
		if (h.available_variation_data.includes('cnv')) {
			cnvYes.add(caseid)
		} else {
			cnvNo.add(caseid)
		}
	}

	ds.assayAvailability = {
		useFilter0: true,
		byDt: {
			1: { yesSamples: ssmYes, noSamples: ssmNo },
			4: { yesSamples: cnvYes, noSamples: cnvNo }
		}
	}
	console.log(
		'GDC case_ssms:',
		Date.now() - t0,
		'ms,',
		re.data.pagination.total,
		'total records,',
		ssmYes.size,
		'ssmYes,',
		ssmNo.size,
		'ssmNo,',
		cnvYes.size,
		'cnvYes,',
		cnvNo.size,
		'cnvNo'
	)
}

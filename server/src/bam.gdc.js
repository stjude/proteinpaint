import got from 'got'
import path from 'path'
import { fileSize } from '#shared/fileSize.js'

/*
hardcoded logic to work with gdc APIs
  /files/ to get list of files
  /cases/ to test if a case if case id

input: 
	<inputId> optional, a gdc id of unspecified type entered by user on the ui
	<filter0> optional gdc cohort filter

does:
	if has inputId:
		determine the type of id by trying to query multiple gdc apis
		/cases/<inputId>
			valid return indicates the id is about a case
			will fetch all bam files eligible for slicing
			and return to client
		/files/<inputId>
			valid return indicates the id is about a file
			must also ensure it's a bam file
		
	if no inputId:
		query list of case uuids based on filter0; then get bams from the uuids
		consideration is that filter0 may have conflicting filter e.g. experimental_strategy=Methylation Array
		when this filter is used on /files/ api, it prevents bam file from being returned
		this way, the app shows all bam files from just those cases passing filter



function cascade:

gdc_bam_request
	get_gdc_data
		try_query
			ifIdIsEntity('cases.case_id')
				queryApi
				-> getFileByCaseId('cases.case_id')
					queryApi
			ifIdIsEntity('cases.submitter_id')
				-> getFileByCaseId('cases.submitter_id')
					queryApi
			getBamfileByFileId('file_id')
				queryApi
			getBamfileByFileId('file_name')
				queryApi
	
*/

// used in getFileByCaseId()
const filesApi = {
	end_point: 'files/',
	fields: [
		'id',
		'file_size',
		'data_type',
		'experimental_strategy',
		'cases.submitter_id', // used when listing all cases & files
		'associated_entities.entity_submitter_id', // semi human readable
		'associated_entities.case_id', // case uuid
		'cases.samples.tissue_type',
		'cases.samples.tumor_descriptor',
		'analysis.workflow_type' // to drop out those as skip_workflow_type
	],
	size: 100
}

// used in ifIdIsEntity()
const casesApi = {
	end_point: 'cases/',
	fields: ['case_id']
}
// fields to be used with casesApi, to test if user input is any of these
const entityTypes = [
	{ type: 'case', field: 'cases.case_id' },
	{ type: 'case', field: 'cases.submitter_id' },
	{ type: 'sample', field: 'cases.samples.submitter_id' },
	{ type: 'sample', field: 'cases.samples.sample_id' },
	{ type: 'aliquot', field: 'cases.samples.portions.analytes.aliquots.submitter_id' },
	{ type: 'aliquot', field: 'cases.samples.portions.analytes.aliquots.aliquot_id' }
]

const skip_workflow_type = 'STAR 2-Pass Transcriptome'

const maxCaseNumber = 300 // max number of cases to request based on cohort. use big number of 300 but not 150 allows number of available bams to easily max out listCaseFileSize which is desirable on client
const listCaseFileSize = 1000 // max number of bam files to request based on case ids

let queryApi
export function gdc_bam_request(genomes) {
	return async function (req, res) {
		try {
			const g = genomes.hg38
			if (!g) throw 'hg38 missing'
			const ds = g.datasets.GDC
			if (!ds) throw 'hg38 GDC missing'
			if (!queryApi) queryApi = getQueryApi(ds)

			if (req.query.gdc_id) {
				// has user input, test on which id it is and any bam file associated with it
				const bamdata = await get_gdc_data(req.query)
				await mayCheckPermissionWithFileAndSession(bamdata, req, ds)
				res.send(bamdata)
			} else {
				// no user input, list all available bam files from current cohort
				const re = await getCaseFiles(req.query.filter0, req.query, ds)
				res.send(re)
			}
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function get_gdc_data(q) {
	const { gdc_id, filter0 } = q
	// data to be returned
	const bamdata = {
		file_metadata: [],
		isCaseSample: '', // set to a value type if input id is submitter/uuid of case/sample/aliquot. only used on backend, not on client
		numFilesSkippedByWorkflow: 0
	}

	const re = await try_query(gdc_id, bamdata, filter0, q)

	if (!re.data.hits.length) {
		// no bam file found
		if (bamdata.isCaseSample) {
			// id is valid case_id/case_uuid, then respond that bam files are not available for this case_id
			throw `No bam files available for this ${bamdata.isCaseSample}.`
		}

		// no id found

		if (filter0) {
			// is using filter
			// try again without filter. if found hit, meaning case not in filter
			const re = await try_query(gdc_id, bamdata, null, q)
			if (re.data.hits.length) {
				// has hit without filter
				throw 'Case not in current cohort.'
			}
			// still no hit
			throw 'Invalid input ID.'
		} else {
			// no filter; id must be invalid
			throw 'Invalid input ID.'
		}
	}

	// 1 or multiple hits/files are available for submitted gdc id

	for (const s of re.data.hits) {
		if (s.analysis.workflow_type == skip_workflow_type) {
			// skipped by workflow
			bamdata.numFilesSkippedByWorkflow++
			continue
		}

		/*
		if (s.analysis.workflow_type.toLowerCase().includes('chimeric')) continue
		*/

		const file = {}
		file.file_uuid = s.id
		file.file_size = fileSize(s.file_size)
		file.experimental_strategy = s.experimental_strategy
		file.entity_id = s.associated_entities[0].entity_submitter_id
		file.case_id = s.associated_entities[0].case_id
		file.tissue_type = s.cases[0].samples[0].tissue_type
		file.tumor_descriptor = s.cases[0].samples[0].tumor_descriptor

		bamdata.file_metadata.push(file)
	}
	return bamdata
}

/*
given user input id, test if it's one of four valid ones
if true, return the list of bam files associated with that id
*/

async function try_query(id, bamdata, filter0, q) {
	// first, test if is case uuid

	// test user input against all types of entities
	for (const entity of entityTypes) {
		if (await ifIdIsEntity(id, entity.field, filter0, q)) {
			// input id is this type of field. copy field type to this flag to pass on (in case it got no bam files)
			bamdata.isCaseSample = entity.type
			/* get bam files from this entity
			do not supply filter0 in this query! if filter0 contains non_bam_filter, using filter0 will prevent finding any bam files
			*/
			return await getFileByCaseId(id, entity.field, 10, q)
		}
	}

	// is not any of above fields
	// then, test if is file uuid
	const re = await getBamfileByFileId(id, 'file_id', q)
	if (re.data.hits.length) {
		// is file uuid, "re" contains the bam file from it (what if this is not indexed?)
		bamdata.is_file_uuid = true
		return re
	}

	// is not case id, case uuid, file uuid
	// last, test if is file id
	const re2 = await getBamfileByFileId(id, 'file_name', q)
	if (re2.data.hits.length) {
		// is file id
		bamdata.is_file_id = true
	}
	// no matter if id is any of these 4 or not, always return re2
	return re2
}

/*
query /cases/ api with id; if valid return, is case id or case uuid, depends on value of field
returns boolean
*/
async function ifIdIsEntity(id, field, filter0, q) {
	const filter = {
		op: 'and',
		content: [
			{
				op: '=',
				content: { field, value: id }
			}
		]
	}
	// filter0 is case filter and must not be combined into filter{}
	const re = await queryApi(filter, casesApi, null, filter0, q)
	return re.data.hits.length > 0
}

/*
inputs:
- id
	1 case submitter id, or 1 case uuid, or an array of uuids
	when missing, will query bam files from all cases
- caseField
	corresponding filter field of first argument
- returnSize
	max number of items api will return, default 10

query /files/ to retrieve all indexed bam files using this id
*/
async function getFileByCaseId(id, caseField, returnSize, q) {
	const filter = {
		op: 'and',
		content: [
			{
				op: '=',
				content: { field: 'data_category', value: 'Sequencing Reads' }
			},
			// wendy's method to limit to bam files that are indexed
			{
				op: '=',
				content: { field: 'index_files.data_format', value: 'bai' }
			},
			{
				op: '=',
				content: { field: 'data_type', value: 'Aligned Reads' }
			},
			{
				op: '=',
				content: { field: 'data_format', value: 'bam' }
			}
		]
	}

	if (id && caseField) {
		filter.content.push({
			op: 'in',
			content: { field: caseField, value: id }
		})
	}

	return await queryApi(filter, filesApi, returnSize, null, q)
}

/*
id is not case id or case uuid.
assuming this id can only be file name or file uuid
query /files/ directly with this
handles 3 scenarios:
- id is valid bam file
	returns re with valid re.data.hits[0]
- id is valid non-bam file
	throw error string to be shown on ui
- id is invalid
	return re with blank re.data.hits[]

NOTE: no filter0 is checked here. a file from a case outside of cohort is thus allowed. need to confirm with gdc
*/
async function getBamfileByFileId(id, field, q) {
	const filter = {
		op: 'and',
		content: [
			{
				op: 'in',
				content: { field, value: id }
			}
		]
	}

	const re = await queryApi(filter, filesApi, null, null, q)
	const hit = re.data.hits[0]
	if (hit) {
		// matches with a valid file on gdc
		if (hit.data_type != 'Aligned Reads') {
			/*
			indicate this err on ui
			do not include this in filter{}, this allows to distinguish invalid id versus valid file which is not a bam
			*/
			throw 'Requested file is not a BAM file.'
		}
		// matches with a bam file, this is what's needed and proceed to return this
	} else {
		// do not match with any file on gdc (invalid input id), return blank array but do not throw as this may be testing what kind of id this is
	}
	return re
}

export function getQueryApi(ds) {
	// Should be generated once per dataset, in this case once for gdc only
	if (queryApi) throw `The gdc queryApi has already been set.`

	/* helper to query api
		filters: non-case filter, e.g. to test if file id is valid, must not be used in case_filters
		api:
		returnSize:
		filter0: case filters, must not be combined with 1st arg
	*/

	return async function (filters, api, returnSize, filter0, q) {
		const { host, headers } = ds.getHostHeaders(q)
		const end_point = path.join(host.rest, api.end_point)

		const data = {
			filters,
			case_filters: filter0,
			size: returnSize || 10,
			fields: api.fields.join(',')
		}

		const response = await got(end_point, { method: 'POST', headers, body: JSON.stringify(data) })

		let re
		try {
			re = JSON.parse(response.body)
		} catch (e) {
			throw 'invalid JSON from ' + api.end_point
		}
		if (!Array.isArray(re.data?.hits)) throw 'data structure not re.data.hits[]'
		return re
	}
}

/*
if bam file has been found, and user session is available, check user's permission on those files;
if no permission, return an indicator to allow ui to indicate this in a helpful manner
on gdc portal, when user has signed in, the session will be available from cookie, this feature is intended to work there
*/
async function mayCheckPermissionWithFileAndSession(bamdata, req, ds) {
	if (!bamdata.file_metadata?.length) return
	// has found files
	const sessionid = req.cookies.sessionid
	if (!sessionid) return // no session
	// session is given (from react pp wrapper where user has logged into gdc ATF)
	// check user's permission, if no, set a flag
	// assumption is that when user has access to a case, the user can access all bam files from the case (thus no need to check every file in file_metadata[]
	try {
		await gdcCheckPermission(bamdata.file_metadata[0].file_uuid, ds, req.query)
	} catch (e) {
		if (e == 'Permission denied') bamdata.userHasNoAccess = true
	}
}

export async function gdcCheckPermission(gdcFileUUID, ds, reqQuery) {
	const { host, headers } = ds.getHostHeaders(reqQuery)
	// suggested by Phil on 4/19/2022
	// use the download endpoint and specify a zero byte range
	// since the expected response is binary data, should not set Accept: application/json as a request header
	// also no body is submitted with a GET request, should not set a Content-type request header
	headers.Range = 'bytes=0-0'
	const url = host.rest + '/data/' + gdcFileUUID
	try {
		// decompress: false prevents got from setting an 'Accept-encoding: gz' request header,
		// which may not be handled properly by the GDC API in qa-uat
		// per Phil, should only be used as a temporary workaround
		const response = await got(url, { headers, decompress: false })
		if (response.statusCode >= 200 && response.statusCode < 400) {
			// permission okay
		} else {
			console.log(`gdcCheckPermission() error for got(${url})`, response)
			throw 'Invalid status code: ' + response.statusCode
		}
		/* 
		// 
		// TODO: may use node-fetch if it provides more informative error status and/or messages
		// for example, got sometimes emits non_2XX_3XX_status status instead of the more informative Status 400
		//
		const fetch = require('node-fetch')
		const response = await fetch(url, { headers, compress: false }); 
		const body = await response.text(); console.log(3267, body, response, Object.fromEntries(response.headers), response.disturbed, response.error)
		if (response.status > 399) { console.log(3268, Object.fromEntries(response.headers))
			throw 'Invalid status code: ' + response.status
		}
		*/
	} catch (e) {
		console.log('gdcCheckPermission error: ', e?.code || e)
		// TODO refer to e.code
		throw 'Permission denied'
	}
}

/*
get list of cases by filter0, then get bam files for these cases
to be displayed in a UI table and user can browse and select one
*/
async function getCaseFiles(filter0, q, ds) {
	const cases = await getCasesByFilter(filter0, q)
	if (cases.length == 0) throw 'No cases available' // shows this msg in the handle on ui
	const re = await getFileByCaseId(cases, 'cases.case_id', listCaseFileSize, q)
	const case2files = {}
	if (!Array.isArray(re.data?.hits)) throw 're.data.hits[] not array'
	for (const h of re.data.hits) {
		if (h.analysis.workflow_type == skip_workflow_type) continue
		const c = h.cases?.[0]?.submitter_id // case submitter id, for display
		if (!c) continue
		if (!case2files[c]) case2files[c] = []
		case2files[c].push({
			file_uuid: h.id,
			tissue_type: h.cases?.[0].samples?.[0].tissue_type,
			tumor_descriptor: h.cases?.[0].samples?.[0].tumor_descriptor,
			experimental_strategy: h.experimental_strategy,
			file_size: fileSize(Number.parseFloat(h.file_size))
		})
	}
	return {
		case2files,
		total: Math.min(listCaseFileSize, re.data?.pagination?.total), // actual number of bam files pulled from api and returned to client. asks api to return up to listCaseFileSize number of files. due to filtering may return less than that
		// in bam slice download app (versus sequence reads viz) client calls api directly thus need the rest host. since client always makes this request, send the host url to client
		restapihost: ds.getHostHeaders(q).host.rest
	}
}

async function getCasesByFilter(filter0, q) {
	const re = await queryApi(null, casesApi, maxCaseNumber, filter0, q)
	return re.data.hits.map(i => i.id)
}

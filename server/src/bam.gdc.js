import got from 'got'
import path from 'path'
import { fileSize } from '../shared/fileSize'

/*
exports one function

hardcoded logic to work with gdc APIs
  /files/ to get list of files
  /cases/ to test if a case if case id

input: <inputId>
	a gdc id of unspecified type entered by user on the ui

does:
	determine the type of id by trying to query multiple gdc apis
	/cases/<inputId>
		valid return indicates the id is about a case
		will fetch all bam files eligible for slicing
		and return to client
	/files/<inputId>
		valid return indicates the id is about a file
		must also ensure it's a bam file? test with a maf file
		will fetch info about the case of this file


function cascade:

gdc_bam_request
	get_gdc_data
		try_query
			ifIdIsCase('cases.case_id')
				queryApi
				-> getFileByCaseId('cases.case_id')
					queryApi
			ifIdIsCase('cases.submitter_id')
				-> getFileByCaseId('cases.submitter_id')
					queryApi
			getBamfileByFileId('file_id')
				queryApi
			getBamfileByFileId('file_name')
				queryApi
	
*/

export async function gdc_bam_request(req, res) {
	try {
		if (req.query.gdc_id) {
			// has user input, test on which id it is and any bam file associated with it
			const bamdata = await get_gdc_data(
				req.query.gdc_id,
				req.query.filter0 // optional gdc cohort filter
			)

			await mayCheckPermission(bamdata, req)

			res.send(bamdata)
		} else {
			// no user input, list all available bam files from current cohort
			const re = await getCaseFiles(req.query.filter0)
			res.send(re)
		}
	} catch (e) {
		res.send({ error: e.message || e })
		if (e.stack) console.log(e.stack)
	}
}

const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'

/**********************************************************
all the rest is copied to /utils/gdc/fileCase2bam.js
for testing and posting to https://proteinpaint.stjude.org/GDC/
*/

// used in getFileByCaseId() and getFileByCaseId()
const filesApi = {
	end_point: path.join(apihost, 'files/'),
	fields: [
		'id',
		'file_size',
		'data_type',
		'experimental_strategy',
		'cases.submitter_id', // used when listing all cases & files
		'associated_entities.entity_submitter_id', // semi human readable
		'associated_entities.case_id', // case uuid
		'cases.samples.sample_type',
		'analysis.workflow_type' // to drop out those as skip_workflow_type
	],
	size: 100
}

// used in ifIdIsCase()
const casesApi = {
	end_point: path.join(apihost, 'cases/'),
	fields: ['case_id']
}

const skip_workflow_type = 'STAR 2-Pass Transcriptome'

async function get_gdc_data(gdc_id, filter0) {
	// data to be returned
	const bamdata = {
		file_metadata: [],
		numFilesSkippedByWorkflow: 0
	}

	const re = await try_query(gdc_id, bamdata, filter0)

	if (!re.data.hits.length) {
		// no bam file found
		if (bamdata.is_case_id || bamdata.is_case_uuid) {
			// id is valid case_id/case_uuid, then respond that bam files are not available for this case_id
			throw 'No bam files available for this case.'
		}

		// no id found

		if (filter0) {
			// is using filter
			// try again without filter. if found hit, meaning case not in filter
			const re = await try_query(gdc_id, bamdata)
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
		file.sample_type = s.cases[0].samples[0].sample_type

		bamdata.file_metadata.push(file)
	}
	return bamdata
}

/*
given user input id, test if it's one of four valid ones
if true, return the list of bam files associated with that id
*/
async function try_query(id, bamdata, filter0) {
	// first, test if is case uuid
	if (await ifIdIsCase(id, 'cases.case_id', filter0)) {
		// is case uuid
		bamdata.is_case_uuid = true
		// get bam files from this case uuid
		return await getFileByCaseId(id, 'cases.case_id', filter0)
	}

	// is not case uuid
	// then, test if is case id
	if (await ifIdIsCase(id, 'cases.submitter_id', filter0)) {
		// is case id
		bamdata.is_case_id = true
		// get bam files
		return await getFileByCaseId(id, 'cases.submitter_id', filter0)
	}

	// is not case id or case uuid
	// then, test if is file uuid
	const re = await getBamfileByFileId(id, 'file_id', filter0)
	if (re.data.hits.length) {
		// is file uuid, "re" contains the bam file from it (what if this is not indexed?)
		bamdata.is_file_uuid = true
		return re
	}

	// is not case id, case uuid, file uuid
	// last, test if is file id
	const re2 = await getBamfileByFileId(id, 'file_name', filter0)
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
async function ifIdIsCase(id, field, filter0) {
	const filter = {
		op: 'and',
		content: [
			{
				op: '=',
				content: { field, value: id }
			}
		]
	}

	if (filter0) {
		filter.content.push(filter0)
	}

	const re = await queryApi(filter, casesApi)
	return re.data.hits.length > 0
}

/*
inputs:
- id
	case id or case uuid
	when missing, will query all cases and file
- caseField
	corresponding filter field of first argument
- filter0
	gdc cohort filter
- returnSize
	max number of items api will return, default 10

query /files/ to retrieve all indexed bam files using this id
*/
async function getFileByCaseId(id, caseField, filter0, returnSize) {
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

	if (filter0) {
		filter.content.push(filter0)
	}

	return await queryApi(filter, filesApi, returnSize)
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
*/
async function getBamfileByFileId(id, field, filter0) {
	const filter = {
		op: 'and',
		content: [
			{
				op: 'in',
				content: { field, value: id }
			}
		]
	}

	if (filter0) {
		filter.content.push(filter0)
	}

	const re = await queryApi(filter, filesApi)
	const hit = re.data.hits[0]
	if (hit) {
		// matches with a valid file on gdc
		if (hit.data_type != 'Aligned Reads') throw 'Requested file is not a BAM file.' // indicate this err on ui
		// matches with a bam file, this is what's needed and proceed to return this
	} else {
		// do not match with any file on gdc (invalid input id), return blank array but do not throw as this may be testing what kind of id this is
	}
	return re
}

// helper to query api
async function queryApi(filters, api, returnSize) {
	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }

	const data = {
		filters,
		size: returnSize || 10,
		fields: api.fields.join(',')
	}

	const response = await got(api.end_point, { method: 'POST', headers, body: JSON.stringify(data) })

	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from ' + api.end_point
	}
	if (!Array.isArray(re.data?.hits)) throw 'data structure not re.data.hits[]'
	return re
}

async function mayCheckPermission(bamdata, req) {
	if (!bamdata.file_metadata?.length) return
	// has found files
	const sessionid = req.cookies.sessionid
	if (!sessionid) return // no session
	// session is given (from react pp wrapper where user has logged into gdc ATF)
	// check user's permission, if no, set a flag
	// assumption is that when user has access to a case, the user can access all bam files from the case (thus no need to check every file in file_metadata[]
	try {
		await gdcCheckPermission(bamdata.file_metadata[0].file_uuid, null, sessionid)
	} catch (e) {
		if (e == 'Permission denied') bamdata.userHasNoAccess = true
	}
}

export async function gdcCheckPermission(gdcFileUUID, token, sessionid) {
	// suggested by Phil on 4/19/2022
	// use the download endpoint and specify a zero byte range
	const headers = {
		// since the expected response is binary data, should not set Accept: application/json as a request header
		// also no body is submitted with a GET request, should not set a Content-type request header
		Range: 'bytes=0-0'
	}
	if (sessionid) headers['Cookie'] = `sessionid=${sessionid}`
	else headers['X-Auth-Token'] = token

	const url = apihost + '/data/' + gdcFileUUID
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

const listCaseFileSize = 1000

async function getCaseFiles(filter0) {
	const re = await getFileByCaseId(null, null, filter0, listCaseFileSize)
	const case2files = {}
	if (!Array.isArray(re.data?.hits)) throw 're.data.hits[] not array'
	for (const h of re.data.hits) {
		if (h.analysis.workflow_type == skip_workflow_type) continue
		const c = h.cases?.[0]?.submitter_id // case submitter id, for display
		if (!c) continue
		if (!case2files[c]) case2files[c] = []
		case2files[c].push({
			file_uuid: h.id,
			sample_type: h.cases?.[0].samples?.[0].sample_type,
			experimental_strategy: h.experimental_strategy,
			file_size: (Number.parseFloat(h.file_size) / 10e8).toFixed(2) + ' GB'
		})
	}
	return {
		case2files,
		total: re.data?.pagination?.total,
		loaded: listCaseFileSize
	}
}

/*
this script is hosted at https://proteinpaint.stjude.org/GDC/fileCase2bam.js

examples:

node fileCase2bam.js # queries all files from TCGA-06-0211

node fileCase2bam.js 9a2a226e-9605-4214-9320-469305e664e6 # by case uuid

node fileCase2bam.js 00493087-9d9d-40ca-86d5-936f1b951c93_wxs_gdc_realn.bam # file id
node fileCase2bam.js 35918f42-c424-48ef-8c95-2d87b48fdf41 # file uuid
node fileCase2bam.js e2d8ca95-6a3d-48e3-abfc-ce5ee294e954 # this bam file is not viewable (skipped by workflow)
node fileCase2bam.js invalid_name 

# case not found in given cohort
node fileCase2bam.js TCGA-06-0211 '{ "op": "and", "content": [ { "op": "in", "content": { "field": "cases.primary_site", "value": [ "breast", "bronchus and lung" ] } } ] }'

# case is found in the cohort
node fileCase2bam.js TCGA-06-0211 '{ "op": "and", "content": [ { "op": "in", "content": { "field": "cases.primary_site", "value": [ "brain" ] } } ] }'


corresponds to isoform2ssm_getvariant{} in gdc.hg38.js

*/

const got = require('got')
const path = require('path')

const apihost = 'https://api.gdc.cancer.gov'

/************************************************
following part is copied from bam.gdc.js (lines 63 to the end)
*/
// used in getFileByCaseId() and getFileByCaseId()
const filesApi = {
	end_point: path.join(apihost, 'files/'),
	fields: [
		'id',
		'file_size',
		'experimental_strategy',
		'associated_entities.entity_submitter_id', // semi human readable
		'associated_entities.entity_type',
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
		file_metadata: []
	}

	const re = await try_query(gdc_id, bamdata, filter0)

	if (!re.data.hits.length) {
		// no bam file found
		if (bamdata.is_case_id || bamdata.is_case_uuid) {
			// id is valid case_id/case_uuid, then respond that bam files are not available for this case_id
			throw 'No bam files available for this case'
		}
		// id must be invalid
		throw 'Invalid GDC ID'
	}

	// 1 or multiple hits/files are available for submitted gdc id

	for (const s of re.data.hits) {
		if (s.analysis.workflow_type == skip_workflow_type) continue // skip

		/*
		if (s.analysis.workflow_type.toLowerCase().includes('chimeric')) continue
		*/

		const file = {}
		file.file_uuid = s.id
		file.file_size = (Number.parseFloat(s.file_size) / 10e8).toFixed(2) + ' GB'
		file.experimental_strategy = s.experimental_strategy
		file.entity_id = s.associated_entities[0].entity_submitter_id
		file.entity_type = s.associated_entities[0].entity_type
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
	const re = await getFileByFileId(id, 'file_id', filter0)
	if (re.data.hits.length) {
		// is file uuid, "re" contains the bam file from it (what if this is not indexed?)
		bamdata.is_file_uuid = true
		return re
	}

	// is not case id, case uuid, file uuid
	// last, test if is file id
	const re2 = await getFileByFileId(id, 'file_name', filter0)
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
				op: 'in',
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
id is case id or case uuid; corresponding field is caseField
query /files/ to retrieve all indexed bam files using this id
*/
async function getFileByCaseId(id, caseField, filter0) {
	const filter = {
		op: 'and',
		content: [
			{
				op: 'in',
				content: { field: caseField, value: id }
			},
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

	if (filter0) {
		filter.content.push(filter0)
	}

	return await queryApi(filter, filesApi)
}

/*
id is not case id or case uuid.
assuming this id can only be file id or file uuid
query /files/ directly with this
*/
async function getFileByFileId(id, field, filter0) {
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

	return await queryApi(filter, filesApi)
}

// helper to query api
async function queryApi(filters, api) {
	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }

	const data = {
		filters,
		size: api.size || 10,
		fields: api.fields.join(',')
	}

	const response = await got(api.end_point, { method: 'POST', headers, body: JSON.stringify(data) })

	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from ' + api.end_point
	}
	if (!re.data || !re.data.hits) throw 'data structure not data.hits[]'
	return re
}

/************************************************
above part is copied from bam.gdc.js
*/

const input = process.argv[2] || 'TCGA-06-0211'
const filter0 = process.argv[3]

;(async () => {
	try {
		let f
		if (filter0) {
			f = JSON.parse(filter0)
		}

		const re = await get_gdc_data(input, f)
		console.log(re)
	} catch (e) {
		console.log('ERROR: ' + (e.message || e))
	}
})()

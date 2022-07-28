const got = require('got')
const path = require('path')

/*
hardcoded logic to work with gdc apis
exports one function

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
*/

const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'

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
const casesApi = {
	end_point: path.join(apihost, 'cases/'),
	fields: ['case_id']
}

/* types of GDC ids
tricky: element order matters. should redo to use simpler logic
*/
const filter_types = [
	{ is_file_uuid: 1, field: 'file_id' },
	{ is_file_id: 1, field: 'file_name' },
	{ is_case_uuid: 1, field: 'cases.case_id' },
	{ is_case_id: 1, field: 'cases.submitter_id' }
]

const skip_workflow_type = 'STAR 2-Pass Transcriptome'
// will also drop out those with workflow containing "chimeric"

const sequencing_read_filter = { op: '=', content: { field: 'data_category', value: 'Sequencing Reads' } }

export async function gdc_bam_request(req, res) {
	try {
		if (!req.query.gdc_id) throw 'query.gdc_id missing'
		const bamdata = await get_gdc_data(req.query.gdc_id)
		res.send(bamdata)
	} catch (e) {
		res.send({ error: e.message || e })
		if (e.stack) console.log(e.stack)
	}
}

async function get_gdc_data(gdc_id) {
	// data to be returned
	const bamdata = {
		file_metadata: []
	}

	const [re, valid_case_uuid, valid_case_id] = await try_query(gdc_id, bamdata)

	// scenario 1: no hits/files, but valid case_id/case_uuid, then respond that bam files are not available for this case_id
	if (!re.data.hits.length && (valid_case_uuid || valid_case_id)) throw 'No bam files available for this case'
	// scenario 2: no hits/files, submitted id is not valid
	else if (!re.data.hits.length) throw 'Invalid GDC ID'
	// scenario 3: 1 or multiple hits/files are available for submitted gdc id
	for (const s of re.data.hits) {
		/*
		if (s.analysis.workflow_type == skip_workflow_type) continue // skip
		if (s.analysis.workflow_type.toLowerCase().includes('chimeric')) continue
		*/

		const file = {}
		file.file_uuid = s.id
		file.file_size = (parseFloat(s.file_size) / 10e8).toFixed(2) + ' GB'
		file.experimental_strategy = s.experimental_strategy
		file.entity_id = s.associated_entities[0].entity_submitter_id
		file.entity_type = s.associated_entities[0].entity_type
		file.case_id = s.associated_entities[0].case_id
		file.sample_type = s.cases[0].samples[0].sample_type

		bamdata.file_metadata.push(file)
	}
	return bamdata
}

async function try_query(gdc_id, bamdata) {
	const filter = {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: '',
					value: gdc_id
				}
			}
		]
	}

	let re,
		valid_case_id = true,
		valid_case_uuid = true

	/*
	jaimin's code. maybe clever. VERY tricky and confusing. impossible to maintain
	if input is file id or file uuid:
		runs /files/ query, get valid input, and break loop (will not run /cases/)
	if input is case id or case uuid:
		runs /files/ query, gets no return
		next, runs /cases/ query, works.
		!Then! continue to run /files/ with the sequencing_read_filter


	iterate through filter_types (4 possibilities: file_id, file_uuid, case_id or case_uuid)
	it's better to iterate using for loop, because all 4 flags must be updated for each possibility
	for example, valid_case_uuid and valid_case_id, both can be false for invalid gdc id
	*/

	for (const f of filter_types) {
		filter.content[0].content.field = f.field

		// scenario 1: entered id is case_uuid or case_id
		// process: query cases endpoint and see if any hits/case returned
		// outcome 1: valid case_uuid or case_id, add seq_read_filter
		// outcome 2: invalid case_uuid or case_uuid (no hits/case)

		if (f.is_case_uuid || f.is_case_id) {
			// check if submitted id is valid case id or not
			const case_check = await query_gdc_api(filter, casesApi)
			if (!case_check.data.hits.length) {
				if (f.is_case_uuid) valid_case_uuid = false
				else if (f.is_case_id) valid_case_id = false
				console.log(111, f.is_case_uuid ? 'case uuid' : 'case id')
				continue
			}

			// gdc_id is a case or uuid
			// do not break or continue, run the /files/ query to get its files

			console.log(999, f.is_case_uuid ? 'case uuid' : 'case id')

			filter.content.push(sequencing_read_filter)
		}

		// scenario 2: entered id is file_id or file_uuid
		// process: query gdc_files endpoint and see if any hits/files returned
		// outcome: add is_file_id or is_file_uuid = true in bamdata

		/* wendy's method to check for bam files that are indexed
		 */
		const tmpfilter = JSON.parse(JSON.stringify(filter))
		tmpfilter.content.push({
			op: '=',
			content: {
				field: 'index_files.data_format',
				value: 'bai'
			}
		})
		tmpfilter.content.push({
			op: '=',
			content: {
				field: 'data_type',
				value: 'Aligned Reads'
			}
		})
		tmpfilter.content.push({
			op: '=',
			content: {
				field: 'data_format',
				value: 'bam'
			}
		})

		re = await query_gdc_api(tmpfilter, filesApi)
		if (re.data.hits.length) {
			bamdata[Object.keys(f)[0]] = true

			console.log(999, f.is_file_uuid ? 'file uuid' : 'file id')
			break
		}
		console.log(111, f.is_file_uuid ? 'file uuid' : 'file id')
	}
	return [re, valid_case_uuid, valid_case_id]
}

async function query_gdc_api(query_filter, gdc_api) {
	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }

	const data = {
		filters: query_filter,
		size: gdc_api.size || 10,
		fields: gdc_api.fields.join(',')
	}

	const response = await got(gdc_api.end_point, { method: 'POST', headers, body: JSON.stringify(data) })

	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from GDC for bamfile'
	}
	if (!re.data || !re.data.hits) throw 'data structure not data.hits[]'
	return re
}

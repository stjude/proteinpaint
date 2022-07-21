const got = require('got')

const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'

// type of gdc_ids
const filter_types = [
	{ is_file_uuid: 1, field: 'file_id' },
	{ is_file_id: 1, field: 'file_name' },
	{ is_case_uuid: 1, field: 'cases.case_id' },
	{ is_case_id: 1, field: 'cases.submitter_id' }
]

// type of gdc_apis
// NOTE: it's need to use '/cases/' and '/files/' endpoints,
// because if case_id/case_uuid supplied, it must be checked with '/cases/' endpoint
// throw error if it's invalid and if it's valid, check if files are available for that
// refer to example rest queries at this document:
// https://docs.google.com/document/d/1WzrrCUrY2A4u7PGDQeDZN8U3oLJAd-4wxuXPaQTIr_s/edit?usp=sharing
const gdc_apis = {
	gdc_files: {
		end_point: apihost + '/files/',
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
	},
	gdc_cases: {
		end_point: apihost + '/cases/',
		fields: ['case_id']
	}
}

const skip_workflow_type = 'STAR 2-Pass Transcriptome'
// will also drop out those with workflow containing "chimeric"

const sequencing_read_filter = { op: '=', content: { field: 'data_category', value: 'Sequencing Reads' } }

export async function gdc_bam_request(req, res) {
	try {
		if (req.query.gdc_id) {
			const gdc_data = await get_gdc_data(req.query.gdc_id)
			res.send(gdc_data)
			return
		}
	} catch (e) {
		res.send({ error: e.message || e })
		if (e.stack) console.log(e.stack)
	}
}

async function get_gdc_data(gdc_id) {
	// data to returned
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
		if (s.analysis.workflow_type == skip_workflow_type) continue // skip
		if (s.analysis.workflow_type.toLowerCase().includes('chimeric')) continue

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
	// iterate through filter_types (4 possibilities: file_id, file_uuid, case_id or case_uuid)
	// it's better to iterate using for loop, because all 4 flags must be updated for each possibility
	// for example, valid_case_uuid and valid_case_id, both can be false for invalid gdc id
	for (const f of filter_types) {
		filter.content[0].content.field = f.field
		// scenario 1: entered id is case_uuid or case_id
		// process: query gdc_cases endpoint and see if any hits/case returned
		// outcome 1: valid case_uuid or case_id, add seq_read_filter
		// outcome 2: invalid case_uuid or case_uuid (no hits/case)
		if (f.is_case_uuid || f.is_case_id) {
			// check if submitted id is valid case id or not
			const case_check = await query_gdc_api(filter, gdc_apis.gdc_cases)
			if (!case_check.data.hits.length) {
				if (f.is_case_uuid) valid_case_uuid = false
				else if (f.is_case_id) valid_case_id = false
				continue
			}
			filter.content.push(sequencing_read_filter)
		}
		// scenario 2: entered id is file_id or file_uuid
		// process: query gdc_files endpoint and see if any hits/files returned
		// outcome: add is_file_id or is_file_uuid = true in bamdata
		re = await query_gdc_api(filter, gdc_apis.gdc_files)
		if (re.data.hits.length) {
			bamdata[Object.keys(f)[0]] = true
			break
		}
	}
	return [re, valid_case_uuid, valid_case_id]
}

async function query_gdc_api(query_filter, gdc_api) {
	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
	const response = await got(
		gdc_api.end_point +
			'?filters=' +
			encodeURIComponent(JSON.stringify(query_filter)) +
			'&size=' +
			(gdc_api.size || '10') +
			'&fields=' +
			gdc_api.fields.join(','),
		{ method: 'GET', headers }
	)
	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from GDC for bamfile'
	}
	if (!re.data || !re.data.hits) throw 'data structure not data.hits[]'
	return re
}

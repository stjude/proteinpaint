const app = require('./app')
const got = require('got')

module.exports = () => {
	return async (req, res) => {
		app.log(req)
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
}

async function get_gdc_data(gdc_id) {
	// type of gdc_ids
	const filter_types = [
		{ is_file_uuid: 1, field: 'file_id' },
		{ is_file_id: 1, field: 'file_name' },
		{ is_case_uuid: 1, field: 'cases.case_id' },
		{ is_case_id: 1, field: 'cases.submitter_id' }
	]

    // type of gdc_apis
    const gdc_apis = {
        gdc_files: 
        {
            end_point: 'https://api.gdc.cancer.gov/files/',
            fields: [
                'id',
                'file_size',
                'experimental_strategy',
                'associated_entities.entity_submitter_id',
                'associated_entities.entity_type',
                'associated_entities.case_id',
                'cases.samples.sample_type'
            ],
            size: 100
        },
        gdc_cases:
        {
            end_point: 'https://api.gdc.cancer.gov/cases/',
            fields: ['case_id']
        }
    }

	// data to returned
	const bamdata = {
		file_metadata: []
	}

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

	const sequencing_read_filter = { op: '=', content: { field: 'data_category', value: 'Sequencing Reads' } }
	let re, valid_case_id = true, valid_case_uuid = true
	for (const f of filter_types) {
		filter.content[0].content.field = f.field
        // only if gdc_id is not file_id
        // check if submitted id is valid case id or not
		if (!f.is_file_uuid && !f.is_file_id){
            const case_check = await query_gdc_api(filter, gdc_apis.gdc_cases)
            if (!case_check.data.hits.length){
                if (f.is_case_uuid) valid_case_uuid = false
                else if(f.is_case_id) valid_case_id = false
                continue
            }
            filter.content.push(sequencing_read_filter)
        }
		re = await query_gdc_api(filter, gdc_apis.gdc_files)
        // re = await query_gdc_api_files(filter)
		if (re.data.hits.length) {
			bamdata[Object.keys(f)[0]] = true
			break
		}
	}
    // if submitted id is valid case_id, then respond that bam files are not available for this case_id
    if (!re.data.hits.length && (valid_case_uuid || valid_case_id)) throw 'No bam files available for this case'
	else if (!re.data.hits.length) throw 'GDC ID is not valid'
	for (const s of re.data.hits) {
        // console.log(s)
		const file = {}
		file.file_uuid = s.id
		file.file_size = (parseFloat(s.file_size) / 10e9).toFixed(2) + ' GB'
		file.experimental_strategy = s.experimental_strategy
		file.entity_id = s.associated_entities[0].entity_submitter_id
		file.entity_type = s.associated_entities[0].entity_type
		file.sample_type = s.cases[0].samples[0].sample_type
		bamdata.file_metadata.push(file)
	}
	return bamdata
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

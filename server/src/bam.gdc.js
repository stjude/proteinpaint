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
		{ gdc_id: 'file_uuid', field: 'file_id' },
		{ gdc_id: 'case_uuid', field: 'cases.case_id' },
		{ gdc_id: 'case_id', field: 'cases.submitter_id' }
	]

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
	let re
	for (const f of filter_types) {
		filter.content[0].content.field = f.field
		if (f.gdc_id != 'file_uuid') filter.content.push(sequencing_read_filter)
		re = await query_gdc_api(filter)
		if (re.data.hits.length) {
			bamdata[f.gdc_id] = true
			break
		}
	}
	if (!re.data.hits.length) throw 'gdc_id is not file uuid'
	for (const s of re.data.hits) {
		const file = {}
		file.file_size = (parseFloat(s.file_size) / 10e9).toFixed(2) + ' GB'
		file.experimental_strategy = s.experimental_strategy
		file.entity_id = s.associated_entities[0].entity_submitter_id
		file.entity_type = s.associated_entities[0].entity_type
		file.sample_type = s.cases[0].samples[0].sample_type
		bamdata.file_metadata.push(file)
	}
	return bamdata
}

async function query_gdc_api(query_filter) {
	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
	const fields = [
		'file_size',
		'experimental_strategy',
		'associated_entities.entity_submitter_id',
		'associated_entities.entity_type',
		'associated_entities.case_id',
		'cases.samples.sample_type'
	]
	const response = await got(
		'https://api.gdc.cancer.gov/files/' +
			// 'size=' +
			// api.size +
			'?filters=' +
			encodeURIComponent(JSON.stringify(query_filter)) +
			'&fields=' +
			fields.join(','),
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

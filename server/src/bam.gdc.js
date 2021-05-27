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
	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
    const filter = {
        op:'in',
        content:{
            field:'file_id',
            value: gdc_id
        }
    }
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
			encodeURIComponent(JSON.stringify(filter)) +
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
    if(!re.data.hits.length) throw 'gdc_id is not file uuid'
    const file_metadata = {}
    for (const s of re.data.hits) {
        file_metadata.file_size = (parseFloat(s.file_size)/10e9).toFixed(2) + ' GB'
        file_metadata.experimental_strategy = s.experimental_strategy
        file_metadata.entity_id = s.associated_entities[0].entity_submitter_id
        file_metadata.entity_type = s.associated_entities[0].entity_type
        file_metadata.sample_type = s.cases[0].samples[0].sample_type
    }
    return file_metadata
}
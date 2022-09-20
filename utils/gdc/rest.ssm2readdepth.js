/*
this script is hosted at https://proteinpaint.stjude.org/GDC/rest.ssm2readdepth.js

examples:

node rest.ssm2readdepth.js # uses AKT1 W80R by default

node rest.ssm2readdepth.js token=<yourGdcToken>

node rest.ssm2readdepth.js ssmid=<id>

// AKT1 E17K with only one case of stomach cancer
node rest.ssm2readdepth.js ssmid=ab96fb54-dfc0-58d9-b727-20a857d58dad filter='{ "op": "and", "content": [ { "op": "in", "content": { "field": "cases.primary_site", "value": [ "stomach" ] } } ] }'

corresponds to variant2samples query in gdc.hg38.js
*/
const got = require('got')
const path = require('path')

const p = get_parameter()
const filters = get_filters(p)

const fields = [
	'case.case_id',
	'case.observation.read_depth.t_alt_count',
	'case.observation.read_depth.t_ref_count',
	'case.observation.read_depth.t_depth',
	'case.observation.read_depth.n_depth',
	'case.observation.variant_calling.variant_caller',
	'case.observation.sample.tumor_sample_barcode'
]

;(async () => {
	try {
		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		if (p.token) headers['X-Auth-Token'] = p.token
		const response = await got(
			'https://api.gdc.cancer.gov/ssm_occurrences?size=10000000&fields=' +
				fields.join(',') +
				'&filters=' +
				encodeURIComponent(JSON.stringify(filters)),
			{ method: 'GET', headers }
		)

		const re = JSON.parse(response.body)
		for (const acase of re.data.hits) {
			const caseid = acase.id
			for (const observe of acase.case.observation) {
				const d = observe.read_depth
				console.log(
					caseid,
					'tumorRef',
					d.t_ref_count,
					'tumorAlt',
					d.t_alt_count,
					'tumorTotal',
					d.t_depth,
					'normal',
					d.n_depth,
					observe.variant_calling.variant_caller,
					observe.sample.tumor_sample_barcode
				)
			}
		}
	} catch (error) {
		console.log(error)
	}
})()

function get_parameter() {
	const p = {}
	for (let i = 2; i < process.argv.length; i++) {
		const [k, v] = process.argv[i].split('=')
		p[k] = v
	}
	if (!p.ssmid) p.ssmid = '85931b10-2dfc-5711-ad10-52e8df9d4116' // AKT1 W80R with 5 cases
	return p
}
function get_filters(p) {
	const filters = {
		op: 'and',
		content: [
			{
				op: '=',
				content: { field: 'ssm.ssm_id', value: [p.ssmid] }
			}
			//{op:'=', content: { field: 'case.observation.variant_calling.variant_caller', value: ['mutect2'] }}
		]
	}

	if (p.filter) {
		const f = JSON.parse(p.filter)
		filters.content.push(f)
	}

	return filters
}

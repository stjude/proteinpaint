const got = require('got')
const path = require('path')

const p = {}
for (let i = 2; i < process.argv.length; i++) {
	const [k, v] = process.argv[i].split('=')
	p[k] = v
}

const fields = [
	'case.case_id',
	'case.observation.read_depth.t_alt_count',
	'case.observation.read_depth.t_ref_count',
	'case.observation.read_depth.t_depth',
	'case.observation.read_depth.n_depth',
	'case.observation.variant_calling.variant_caller',
	'case.observation.validation.tumor_validation_allele1',
	'case.observation.validation.tumor_validation_allele2',
	'case.observation.validation.validation_method',
	'case.observation.sample.tumor_sample_barcode'
]

const filters = {
	op: 'and',
	content: [
		{
			op: '=',
			content: {
				field: 'ssm.ssm_id',
				value: [p.ssmid ? path.basename(p.ssmid) : '883d6564-b868-589a-9908-25b76b9f434c']
			}
		}
		//{op:'=', content: { field: 'case.observation.variant_calling.variant_caller', value: ['mutect2'] }}
	]
}
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
					observe.validation,
					observe.sample.tumor_sample_barcode
				)
			}
		}
	} catch (error) {
		console.log(error)
	}
})()

const got = require('got')

const p = {}
for (let i = 2; i < process.argv.length; i++) {
	const [k, v] = process.argv[i].split('=')
	p[k] = v
}
if (!p.ssmid) p.ssmid = '288a8e0d-059a-520c-b457-fc8464e68154' // p53 R196*, n=53

const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
if (p.token) headers['X-Auth-Token'] = p.token
const fields = [
	'ssm.ssm_id',
	'case.project.project_id',
	'case.case_id',
	'case.primary_site',
	'case.disease_type',
	'case.available_variation_data',
	'case.state',
	'case.demographic.gender',
	'case.demographic.year_of_birth',
	'case.demographic.race',
	'case.demographic.ethnicity'
]

const filters = {
	op: 'and',
	content: [{ op: '=', content: { field: 'ssm.ssm_id', value: [p.ssmid] } }]
}
if (p.set_id) {
	filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [p.set_id] } })
}

const url =
	'https://api.gdc.cancer.gov/ssm_occurrences?size=1000000&fields=' +
	fields.join(',') +
	'&filters=' +
	encodeURIComponent(JSON.stringify(filters))
console.log(url)
;(async () => {
	try {
		const tmp = await got(url, { method: 'GET', headers })

		const re = JSON.parse(tmp.body)
		for (const h of re.data.hits) {
			console.log(h)
		}
	} catch (error) {
		console.log(error)
	}
})()

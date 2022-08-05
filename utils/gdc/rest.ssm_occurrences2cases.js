const got = require('got')
// corresponds to isoform2ssm_getcase{}

const p = {}
for (let i = 2; i < process.argv.length; i++) {
	const [k, v] = process.argv[i].split('=')
	p[k] = v
}

if (!p.isoform) p.isoform = 'ENST00000407796' // AKT1

const fields = [
	'ssm.ssm_id',
	'case.case_id',
	'case.diagnoses.age_at_diagnosis',
	'case.diagnoses.treatments.therapeutic_agents'
]
// add 'case.diagnoses' to fields won't return diagnoses count

const filters = {
	op: 'and',
	content: [{ op: '=', content: { field: 'ssms.consequence.transcript.transcript_id', value: [p.isoform] } }]
}
if (p.set_id) filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [p.set_id] } })
if (p.case_id) filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [p.case_id] } })
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
		const caseidset = new Map() // k: id, v: count
		const ssmset = new Set()
		console.log(JSON.stringify(re.data.hits[0], null, 2))
		for (const hit of re.data.hits) {
			caseidset.set(hit.case.case_id, 1 + (caseidset.get(hit.case.case_id) || 0))
			ssmset.add(hit.ssm.ssm_id)
		}
		for (const [i, v] of caseidset) console.log(i, v)
		console.log('pagination.total', re.data.pagination.total)
		console.log(caseidset.size, 'cases')
		console.log(ssmset.size, 'ssms')
		// output is by ssm occurrence, when a case has multiple ssm on this isoform, the case appears multiple times
		// thus pagination.total may be bigger than unique list of cases
	} catch (error) {
		console.log(error)
	}
})()

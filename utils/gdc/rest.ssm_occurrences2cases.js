const got = require('got')

const p = {}
for (let i = 2; i < process.argv.length; i++) {
	const [k, v] = process.argv[i].split('=')
	p[k] = v
}

if (!p.isoform) p.isoform = 'ENST00000407796' // AKT1

const fields = ['case.case_id']

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
		for (const hit of re.data.hits) {
			caseidset.set(hit.case.case_id, 1 + (caseidset.get(hit.case.case_id) || 0))
		}
		for (const [i, v] of caseidset) console.log(i, v)
		console.log('pagination.total', re.data.pagination.total)
		// output is by ssm occurrence, when a case has multiple ssm on this isoform, the case appears multiple times
		// thus pagination.total may be bigger than unique list of cases
	} catch (error) {
		console.log(error)
	}
})()

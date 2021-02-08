const got = require('got')

const p = {}
for (let i = 2; i < process.argv.length; i++) {
	const [k, v] = process.argv[i].split('=')
	p[k] = v
}
if (!p.isoform) p.isoform = 'ENST00000407796' // AKT1

const fields = [
	'ssm.ssm_id',
	'ssm.chromosome',
	'ssm.consequence.transcript.transcript_id',
	'ssm.consequence.transcript.aa_change',
	'ssm.consequence.transcript.consequence_type',
	'case.project.project_id',
	'case.case_id',
	'case.primary_site'
]

const filters = {
	op: 'and',
	content: [{ op: '=', content: { field: 'ssms.consequence.transcript.transcript_id', value: [p.isoform] } }]
}
if (p.set_id) filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [p.set_id] } })
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
		const aa2case = new Map()
		const caseidset = new Set()
		for (const hit of re.data.hits) {
			const consequence = hit.ssm.consequence.find(i => i.transcript.transcript_id == p.isoform)
			const aa = consequence.transcript.aa_change
			if (!aa2case.has(aa)) aa2case.set(aa, { type: consequence.transcript.consequence_type, cases: [] })
			aa2case.get(aa).cases.push(hit.case)

			caseidset.add(hit.case.case_id)
		}
		for (const [aa, o] of aa2case) {
			console.log(aa, o.type, o.cases.length)
		}

		console.log(aa2case.size, ' variants')
		console.log(caseidset.size, ' cases')
	} catch (error) {
		console.log(error)
	}
})()

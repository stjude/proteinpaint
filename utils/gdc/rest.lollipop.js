const got = require('got')

const p = {}
for (let i = 2; i < process.argv.length; i++) {
	const [k, v] = process.argv[i].split('=')
	p[k] = v
}
if (!p.isoform) p.isoform = 'ENST00000407796'

//const isoform = process.argv[2] || 'ENST00000407796' // AKT1, with first as E17K with 53 cases

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
		const response = await got(
			'https://api.gdc.cancer.gov/ssm_occurrences?size=10000&fields=' +
				fields.join(',') +
				'&filters=' +
				encodeURIComponent(JSON.stringify(filters)),
			{
				method: 'GET',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
			}
		)

		const re = JSON.parse(response.body)
		const aa2case = new Map()
		for (const hit of re.data.hits) {
			const consequence = hit.ssm.consequence.find(i => i.transcript.transcript_id == p.isoform)
			const aa = consequence.transcript.aa_change
			if (!aa2case.has(aa)) aa2case.set(aa, { type: consequence.transcript.consequence_type, cases: [] })
			aa2case.get(aa).cases.push(hit.case)
		}
		for (const [aa, o] of aa2case) {
			console.log(aa, o.type, o.cases.length)
		}

		console.log(aa2case.size, ' variants')
	} catch (error) {
		console.log(error)
	}
})()

const got = require('got')

const p = {}
for (let i = 2; i < process.argv.length; i++) {
	const [k, v] = process.argv[i].split('=')
	p[k] = v
}
if (!p.isoform) p.isoform = 'ENST00000407796' // AKT1

const fields = [
	'ssm_id',
	'chromosome',
	'start_position',
	'reference_allele',
	'tumor_allele',
	'consequence.transcript.transcript_id',
	'consequence.transcript.aa_change',
	'consequence.transcript.consequence_type'
]

const filters = {
	op: 'and',
	content: [{ op: '=', content: { field: 'consequence.transcript.transcript_id', value: [p.isoform] } }]
}
if (p.set_id) filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [p.set_id] } })
;(async () => {
	try {
		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		if (p.token) headers['X-Auth-Token'] = p.token
		const response = await got(
			'https://api.gdc.cancer.gov/ssms?size=10000000&fields=' +
				fields.join(',') +
				'&filters=' +
				encodeURIComponent(JSON.stringify(filters)),
			{ method: 'GET', headers }
		)

		const re = JSON.parse(response.body)
		const aaset = new Set()
		for (const hit of re.data.hits) {
			const consequence = hit.consequence.find(i => i.transcript.transcript_id == p.isoform)
			const aa = consequence.transcript.aa_change
			aaset.add(aa)
		}
		console.log(aaset.size, 'aachange')
	} catch (error) {
		console.log(error)
	}
})()

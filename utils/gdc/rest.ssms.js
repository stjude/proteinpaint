const got = require('got')
// gene=AKT1 isoform=ENST00000407796 case_id=0772cdbe-8b0d-452b-8df1-bd70d1306363

/* following code should be shared with rest.ssm_occurrences.js or more
const [p, filters] = arg2filter(process.argv)
*/

const p = {}
for (let i = 2; i < process.argv.length; i++) {
	const [k, v] = process.argv[i].split('=')
	p[k] = v
}
/*
if (!p.gene && !p.isoform) {
	// if missing gene/isoform, use AKT1
	p.isoform = 'ENST00000407796'
}
*/
const filters = {
	op: 'and',
	content: []
}
if (p.isoform)
	filters.content.push({ op: '=', content: { field: 'consequence.transcript.transcript_id', value: [p.isoform] } })
if (p.gene) filters.content.push({ op: '=', content: { field: 'consequence.transcript.gene.symbol', value: [p.gene] } })
if (p.set_id) filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [p.set_id] } })
if (p.case_id) filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [p.case_id] } })

const fields = [
	'ssm_id',
	'chromosome',
	'start_position',
	'reference_allele',
	'tumor_allele',
	'consequence.transcript.transcript_id',
	'consequence.transcript.aa_change',
	'consequence.transcript.consequence_type',
	'consequence.transcript.gene.symbol'
]

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
		const aa2case = new Map()
		const caseidset = new Set()
		const projectset = new Set()
		const siteset = new Set()
		for (const hit of re.data.hits) {
			if (p.isoform) {
				const consequence = hit.consequence.find(i => i.transcript.transcript_id == p.isoform)
				const aa = consequence.transcript.aa_change || consequence.transcript.consequence_type // no aa change for utr variants
				console.log(
					aa,
					consequence.transcript.gene.symbol,
					hit.chromosome,
					hit.start_position,
					hit.reference_allele,
					hit.tumor_allele
				)
			} else {
				for (const consequence of hit.consequence) {
					const aa = consequence.transcript.aa_change || consequence.transcript.consequence_type // no aa change for utr variants
					console.log(
						aa,
						consequence.transcript.gene.symbol,
						hit.chromosome,
						hit.start_position,
						hit.reference_allele,
						hit.tumor_allele
					)
				}
			}
		}
	} catch (error) {
		console.log(error)
	}
})()

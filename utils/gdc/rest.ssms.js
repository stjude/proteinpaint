/*
this script is hosted at https://proteinpaint.stjude.org/GDC/rest.ssms.js

examples:

node rest.ssms.js # uses AKT1 by default

node rest.ssms.js token=<yourGdcToken>

node rest.ssms.js gene=AKT1

node rest.ssms.js isoform=ENST00000407796

node rest.ssms.js case_id=0772cdbe-8b0d-452b-8df1-bd70d1306363

node rest.ssms.js filter='{ "op": "and", "content": [ { "op": "in", "content": { "field": "cases.primary_site", "value": [ "breast", "bronchus and lung" ] } } ] }'

corresponds to isoform2ssm_getvariant{} in gdc.hg38.js
*/

const got = require('got')

const p = get_parameter()

const filters = get_filters(p)

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
		console.log(re.data.hits.length, 'ssms total')
	} catch (error) {
		console.log(error)
	}
})()

/////////////////// helpers

function get_parameter() {
	const p = {}
	for (let i = 2; i < process.argv.length; i++) {
		const [k, v] = process.argv[i].split('=')
		p[k] = v
	}
	if (!p.gene && !p.isoform) {
		// if missing gene/isoform, use AKT1
		p.isoform = 'ENST00000407796'
	}
	return p
}

function get_filters(p) {
	const filters = {
		op: 'and',
		content: []
	}

	if (p.isoform) {
		filters.content.push({ op: '=', content: { field: 'consequence.transcript.transcript_id', value: [p.isoform] } })
	}

	if (p.gene) {
		filters.content.push({ op: '=', content: { field: 'consequence.transcript.gene.symbol', value: [p.gene] } })
	}

	if (p.case_id) {
		filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [p.case_id] } })
	}

	if (p.filter) {
		const f = JSON.parse(p.filter)
		filters.content.push(f)
	}

	//if (p.set_id) filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [p.set_id] } })
	return filters
}

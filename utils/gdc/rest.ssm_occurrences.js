/*
this script is hosted at https://proteinpaint.stjude.org/GDC/rest.ssm_occurrences.js

examples:

node rest.ssm_occurrences.js # uses AKT1 by default

node rest.ssm_occurrences.js token=<yourGdcToken>

node rest.ssm_occurrences.js isoform=ENST00000407796

node rest.ssm_occurrences.js case_id=0772cdbe-8b0d-452b-8df1-bd70d1306363

node rest.ssm_occurrences.js filter='{ "op": "and", "content": [ { "op": "in", "content": { "field": "cases.primary_site", "value": [ "breast", "bronchus and lung" ] } } ] }'

corresponds to isoform2ssm_getcase{} in gdc.hg38.js
*/

const got = require('got')

const p = get_parameter()

const filters = get_filters(p)

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
		const projectset = new Set()
		const siteset = new Set()
		for (const hit of re.data.hits) {
			const consequence = hit.ssm.consequence.find(i => i.transcript.transcript_id == p.isoform)
			const aa = consequence.transcript.aa_change || consequence.transcript.consequence_type // no aa change for utr variants
			if (!aa2case.has(aa)) aa2case.set(aa, { type: consequence.transcript.consequence_type, cases: [] })
			aa2case.get(aa).cases.push(hit.case)

			caseidset.add(hit.case.case_id)
			projectset.add(hit.case.project.project_id)
			siteset.add(hit.case.primary_site)
		}
		for (const [aa, o] of aa2case) {
			console.log(aa, o.type, o.cases.length)
		}

		console.log(aa2case.size, ' variants')
		console.log(caseidset.size, ' cases')
		console.log(projectset.size, ' projects')
		console.log(siteset.size, ' sites')
	} catch (error) {
		console.log(error)
	}
})()

////////////// helpers

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
		filters.content.push({
			op: '=',
			content: { field: 'ssms.consequence.transcript.transcript_id', value: [p.isoform] }
		})
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

/*
this script is hosted at https://proteinpaint.stjude.org/GDC/rest.cnv_occurrences.js

examples:

node rest.ssm_occurrences.js # uses AKT1 by default

node rest.ssm_occurrences.js token=<yourGdcToken>

node rest.ssm_occurrences.js isoform=ENST00000407796

node rest.ssm_occurrences.js isoforms=ENST00000407796,ENST00000650651

node rest.ssm_occurrences.js case_id=0772cdbe-8b0d-452b-8df1-bd70d1306363

node rest.ssm_occurrences.js filter='{ "op": "and", "content": [ { "op": "in", "content": { "field": "cases.primary_site", "value": [ "breast", "bronchus and lung" ] } } ] }'

corresponds to isoform2ssm_getcase{} in gdc.hg38.js
*/

const got = require('got')

const p = get_parameter()

const filters = get_filters(p)

const fields = ['case.project.project_id', 'case.case_id', 'case.primary_site']

;(async () => {
	try {
		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		if (p.token) headers['X-Auth-Token'] = p.token
		const response = await got(
			'https://api.gdc.cancer.gov/cnv_occurrences?size=10000000&fields=' +
				fields.join(',') +
				'&filters=' +
				encodeURIComponent(JSON.stringify(filters)),
			{ method: 'GET', headers }
		)

		const re = JSON.parse(response.body)
		const caseidset = new Set()
		const projectset = new Set()
		const siteset = new Set()
		console.log(re.data.hits[0])
		for (const hit of re.data.hits) {
			caseidset.add(hit.case.case_id)
			projectset.add(hit.case.project.project_id)
			siteset.add(hit.case.primary_site)
		}

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
	if (!p.gene) p.gene = 'AKT1'
	return p
}

function get_filters(p) {
	const filters = {
		op: 'and',
		content: []
	}

	if (p.gene) {
		filters.content.push({
			op: '=',
			content: { field: 'cnv.consequence.gene.symbol', value: [p.gene] }
		})
	}

	if (p.case_id) {
		filters.content.push({ op: 'in', content: { field: 'case.case_id', value: [p.case_id] } })
	}

	if (p.filter) {
		const f = JSON.parse(p.filter)
		filters.content.push(f)
	}

	//if (p.set_id) filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [p.set_id] } })
	return filters
}

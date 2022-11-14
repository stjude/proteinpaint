/*
this script is hosted at https://proteinpaint.stjude.org/GDC/rest.cnvs.js

examples:

node rest.cnvs.js # uses AKT1 by default

node rest.cnvs.js token=<yourGdcToken>

node rest.cnvs.js position=chr.start.stop

node rest.cnvs.js case_id=0772cdbe-8b0d-452b-8df1-bd70d1306363

node rest.cnvs.js filter='{ "op": "and", "content": [ { "op": "in", "content": { "field": "cases.primary_site", "value": [ "breast", "bronchus and lung" ] } } ] }'

node rest.cnvs.js filterObj='{"type":"tvslst","in":true,"join":"and","lst":[{"type":"tvs","tvs":{"term":{"id":"case.disease_type","name":"Disease type","isleaf":true,"type":"categorical","values":{}},"values":[{"key":"Adenomas and Adenocarcinomas"}]}}]}'

*/

const got = require('got')

const p = get_parameter()

const filters = get_filters(p)

/*
{
	"data": {
		"hits": [

		// Loss event

		{
			"id": "b4cd1937-2fc4-551b-b119-64b901ae1cf0",
			"gene_level_cn": true,
			"cnv_change": "Loss",
			"occurrence": [
				{
					"case": {
						"primary_site": "Liver and intrahepatic bile ducts",
						"case_id": "41b97b11-acaa-4fbc-b3b0-0abc1bcac13b"
					}
				}, {
					"case": {
						"primary_site": "Other and ill-defined sites in lip, oral cavity and pharynx",
						"case_id": "2c985b30-0f8f-4c8f-a924-cc6aad7ebf0d"
					}
				},
				... more cases ...
			]
		},

		// Gain event

		{
			"id": "b4cd1937-2fc4-551b-b119-64b901ae1cf0",
			"gene_level_cn": true,
			"cnv_change": "Gain",
			"occurrence": [
				{
					"case": {
						"primary_site": "Liver and intrahepatic bile ducts",
						"case_id": "41b97b11-acaa-4fbc-b3b0-0abc1bcac13b"
					}
				}, {
					"case": {
						"primary_site": "Other and ill-defined sites in lip, oral cavity and pharynx",
						"case_id": "2c985b30-0f8f-4c8f-a924-cc6aad7ebf0d"
					}
				},
				... more cases ...
			]
		}
*/

const fields = [
	'cnv_id',
	//'chromosome', 'start_position', 'end_position',
	'cnv_change',
	'gene_level_cn',
	'occurrence.case.case_id',
	'occurrence.case.primary_site',
	'occurrence.case.observation.sample.tumor_sample_uuid'
]

;(async () => {
	try {
		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		if (p.token) headers['X-Auth-Token'] = p.token

		const url =
			'https://api.gdc.cancer.gov/cnvs?size=10000000&fields=' +
			fields.join(',') +
			'&filters=' +
			encodeURIComponent(JSON.stringify(filters))

		const response = await got(url, { method: 'GET', headers })

		const re = JSON.parse(response.body)

		let totalevents = 0

		for (const hit of re.data.hits) {
			if (!hit.cnv_id) throw 'hit.cnv_id missing'
			if (typeof hit.cnv_change != 'string') throw 'hit.cnv_change not string'
			if (typeof hit.gene_level_cn != 'boolean') throw 'hit.gene_level_cn not boolean'
			if (!Array.isArray(hit.occurrence)) throw 'hit.occurrence[] missing'
			for (const acase of hit.occurrence) {
				if (!acase.case) throw 'hit.occurrence[].case{} missing'
				if (!acase.case_id) throw 'case.case_id missing'
				console.log(`${hit.cnv_change}\t${hit.gene_level_cn}\t${acase.case_id}`)
				totalevents++
			}
		}
		console.log(totalevents, 'events total')
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

	if (!p.gene) p.gene = 'AKT1'

	/*
	if (!p.position) {
		// if missing gene/isoform, use AKT1
		p.position = '14:104769349-104795748'
	}
	const tmp = p.position.split(/[:-]/)
	if(tmp.length!=3) throw 'position not chr:start-stop'
	p.chr = tmp[0]
	p.start = Number(tmp[1])
	p.stop = Number(tmp[2])
	delete p.position
	*/

	return p
}

function get_filters(p) {
	const filters = {
		op: 'and',
		content: [
			//{ op: 'in', content: { field: 'chromosome', value: [p.chr] } },
			// https://docs.gdc.cancer.gov/API/Users_Guide/Search_and_Retrieval/#filters-specifying-the-query
			// no min/max operator thus no way to implement max(start1,start2)<min(stop1,stop2)
		]
	}

	if (p.gene) {
		filters.content.push({ op: '=', content: { field: 'consequence.gene.symbol', value: p.gene } })
	}

	if (p.case_id) {
		filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [p.case_id] } })
	}

	if (p.filter) {
		const f = JSON.parse(p.filter)
		filters.content.push(f)
	}
	if (p.filterObj) {
		const f = JSON.parse(p.filterObj)
		filters.content.push(filter2GDCfilter(f))
	}

	//if (p.set_id) filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [p.set_id] } })
	return filters
}

/*
f{}
	filter object
returns a GDC filter object
TODO support nested filter
*/
function filter2GDCfilter(f) {
	// gdc filter
	const obj = {
		op: 'and',
		content: []
	}
	if (!Array.isArray(f.lst)) throw 'filter.lst[] not array'
	for (const item of f.lst) {
		if (item.type != 'tvs') throw 'filter.lst[] item.type!="tvs"'
		if (!item.tvs) throw 'item.tvs missing'
		if (!item.tvs.term) throw 'item.tvs.term missing'
		const f = {
			op: 'in',
			content: {
				field: mayChangeCase2Cases(item.tvs.term.id),
				value: item.tvs.values.map(i => i.key)
			}
		}
		obj.content.push(f)
	}
	return obj
}

/*
input: case.disease_type
output: cases.disease_type

when a term id begins with "case"
for the term to be used as a field in filter,
it must be written as "cases"
*/
function mayChangeCase2Cases(s) {
	const l = s.split('.')
	if (l[0] == 'case') l[0] = 'cases'
	return l.join('.')
}

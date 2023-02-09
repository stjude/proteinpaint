/*
this script is hosted at https://proteinpaint.stjude.org/GDC/topSSMgenes.js

examples:

node topSSMgenes.js # GBM, CGC genes

node topSSMgenes.js 0 # GBM, CGC

node topSSMgenes.js 1 # GBM, all genes

node topSSMgenes.js 1 '{"op":"and","content":[{"op":"in","content":{"field":"cases.primary_site","value":["breast","bronchus and lung"]}},{"op":">=","content":{"field":"cases.diagnoses.age_at_diagnosis","value":10000}},{"op":"<=","content":{"field":"cases.diagnoses.age_at_diagnosis","value":20000}}]}'


the two functions are copied from server/src/mds3.gdc.js
get_filter2topGenes()
mayAddCGC2filter()

*/

const got = require('got')
const path = require('path')
const apihost = 'https://api.gdc.cancer.gov'

;(async () => {
	try {
		const CGConly = !process.argv[2] || process.argv[2] == '0'
		const filter = process.argv[3] || '{"op":"in","content":{"field":"cases.disease_type","value":["Gliomas"]}}'

		const genes = await get_filter2topGenes({ filter: JSON.parse(filter), CGConly })
		console.log(genes)
	} catch (e) {
		console.log(e)
	}
})()

//////////////////////// following are copied over from mds3.gdc.js

async function get_filter2topGenes({ filter, CGConly }) {
	if (!filter) throw 'filter missing'
	if (typeof filter != 'object') throw 'filter not object'
	const response = await got.post(path.join(apihost, '/analysis/top_mutated_genes_by_project'), {
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({
			size: 50,
			fields: 'symbol',
			filters: mayAddCGC2filter(filter, CGConly)
		})
	})
	const re = JSON.parse(response.body)
	const genes = []
	for (const hit of re.data.hits) {
		if (!hit.symbol) continue
		genes.push(hit.symbol)
	}
	return genes
}

/*
str:
	stringified gdc filter object, should not include the "genes.is_cancer_gene_census" filter element
CGConly: boolean
	if true, insert following element into the filter and return stringified obj

	{
		"op":"and",
		"content":[
			{
				"content":{ "field":"genes.is_cancer_gene_census", "value":["true"] },
				"op":"in"
			}
		]
	}
*/
function mayAddCGC2filter(f, CGConly) {
	// reformulate f into f2
	// f may be "in" or "and". f2 is always "and", in order to join in additional filters
	let f2

	if (f.op == 'in') {
		// wrap f into f2
		f2 = { op: 'and', content: [f] }
	} else if (f.op == 'and') {
		// no need to wrap
		f2 = f
	} else {
		throw 'f.op not "in" or "and"'
	}

	// per Phil on 12/16/2022, following filters ensure to return IDH1 as 1st gene for gliomas
	f2.content.push({
		op: 'NOT',
		content: {
			field: 'ssms.consequence.transcript.annotation.vep_impact',
			value: 'missing'
		}
	})
	f2.content.push({
		op: 'in',
		content: {
			field: 'ssms.consequence.transcript.consequence_type',
			value: ['missense_variant', 'frameshift_variant', 'start_lost', 'stop_lost', 'stop_gained']
		}
	})

	if (CGConly) {
		// using CGC genes, add in filter
		f2.content.push({ op: 'in', content: { field: 'genes.is_cancer_gene_census', value: ['true'] } })
	}

	return f2
}

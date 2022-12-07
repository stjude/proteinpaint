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
const apihost = 'https://api.gdc.cancer.gov'

;(async () => {
	try {
		const CGConly = !process.argv[2] || process.argv[2] == '0'
		const filter = process.argv[3] || '{"op":"in","content":{"field":"cases.disease_type","value":["Gliomas"]}}'

		const genes = await get_filter2topGenes({ filter, CGConly })
		console.log(genes)
	} catch (e) {
		console.log(e)
	}
})()

async function get_filter2topGenes({ filter, CGConly }) {
	if (!filter) throw 'filter missing'
	if (typeof filter != 'string') throw 'filter not string'
	const response = await got(
		apihost +
			'/analysis/top_mutated_genes_by_project' +
			'?size=50' +
			'&fields=symbol' +
			'&filters=' +
			mayAddCGC2filter(filter, CGConly),
		{ method: 'GET', headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
	)
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
function mayAddCGC2filter(str, CGConly) {
	if (!CGConly) {
		// not using CGC genes. no need to modify filter
		return str
	}
	const f = JSON.parse(decodeURIComponent(str))

	if (f.op == 'in') {
		// create new filter obj with AND join of CGC element and existing filter
		const f2 = {
			op: 'and',
			content: [f, { op: 'in', content: { field: 'genes.is_cancer_gene_census', value: ['true'] } }]
		}
		return encodeURIComponent(JSON.stringify(f2))
	}

	if (f.op == 'and') {
		// filter is already "and"; insert CGC element into list
		f.content.push({ op: 'in', content: { field: 'genes.is_cancer_gene_census', value: ['true'] } })
		return encodeURIComponent(JSON.stringify(f))
	}

	throw 'mayAddCGC2filter: f.op is not "in" or "and"'
}

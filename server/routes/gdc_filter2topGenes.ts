import { GdcTopMutatedGeneResponse } from '#shared/types/routes/gdc_filter2topGenes.ts'
import path from 'path'
import got from 'got'

const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'

export const api = {
	endpoint: 'gdc_filter2topGenes',
	methods: {
		get: {
			init({ genomes }) {
				/*
				genomes parameter is currently not used
				could be used later to:
				- verify hg38/GDC is on this instance and otherwise disable this route..
				- perform conversion on gene name/id for future on needs
				*/

				return async (req: any, res: any): Promise<void> => {
					try {
						const genes = await getGenes(req.query)
						const payload = { genes } as GdcTopMutatedGeneResponse
						res.send(payload)
					} catch (e: any) {
						res.send({ status: 'error', error: e.message || e })
					}
				}
			},
			request: {
				typeId: null
				//valid: default to type checker
			},
			response: {
				typeId: 'gdc_filter2topGenes'
				// will combine this with type checker
				//valid: (t) => {}
			}
		}
	}
}

/*
req.query {
	filter0 // optional gdc GFF cohort filter, invisible and read only
		FIXME should there be pp filter too?
	geneFilter?: str
	maxGenes: int
}

mayAddCGC2filter() are copied to
/utils/gdc/topSSMgenes.js
and hosted on https://proteinpaint.stjude.org/GDC/
*/
async function getGenes(q: any) {
	let _f = { op: 'and', content: [] } // allow blank filter to test geneset edit ui (without filter)
	if (q.filter0) {
		if (typeof q.filter0 != 'object') throw 'filter0 not object'
		_f = q.filter0
	}
	const response = await got.post(path.join(apihost, '/analysis/top_mutated_genes_by_project'), {
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({
			size: q.maxGenes || 50,
			fields: 'symbol',
			filters: mayAddCGC2filter(_f, q.geneFilter)
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
geneFilter: str
	if = 'CGC', insert following element into the filter and return stringified obj

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
function mayAddCGC2filter(f: any, geneFilter?: string) {
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

	if (geneFilter == 'CGC') {
		// using CGC genes, add in filter
		f2.content.push({ op: 'in', content: { field: 'genes.is_cancer_gene_census', value: ['true'] } })
	}

	return f2
}

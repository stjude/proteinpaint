import type { GdcTopMutatedGeneRequest, GdcTopMutatedGeneResponse, GdcGene } from '#routeTypes/gdc.topMutatedGenes.ts'
import { mclasscnvgain, mclasscnvloss, dtsnvindel } from '#shared/common.js'
import ky from 'ky'

// TODO change to /termdb/topMutatedGenes

export const api = {
	endpoint: 'gdc/topMutatedGenes',
	methods: {
		all: {
			init,
			request: {
				typeId: 'GdcTopMutatedGeneRequest'
			},
			response: {
				typeId: 'GdcTopMutatedGeneResponse'
			}
		}
	}
}

function init({ genomes }) {
	/*
	genomes parameter is currently not used
	could be used later to:
	- verify hg38/GDC is on this instance and otherwise disable this route..
	- perform conversion on gene name/id for future on needs
	*/
	return async (req: any, res: any): Promise<void> => {
		const q: GdcTopMutatedGeneRequest = req.query
		const g = genomes.hg38
		if (!g) throw 'hg38 missing'
		const ds = g.datasets.GDC
		if (!ds) throw 'hg38 GDC missing'
		try {
			const genes = await getGenesGraphql(q, ds)
			const payload: GdcTopMutatedGeneResponse = { genes }
			res.send(payload)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e.stack) console.log(e.stack)
			else console.trace(e)
		}
	}
}

const queryV2: any = {
	query: `
          query GenesTable(
            $caseFilters: FiltersArgument
            $genesTable_filters: FiltersArgument
            $genesTable_size: Int
            $genesTable_offset: Int
            $score: String
            $ssmCase: FiltersArgument
            $geneCaseFilter: FiltersArgument
            $ssmTested: FiltersArgument
            $cnvTested: FiltersArgument
            $cnvGainFilters: FiltersArgument
            $cnvLossFilters: FiltersArgument
            $sort: [Sort]
          ) {
            genesTableViewer: viewer {
              explore {
                cases {
                  hits(first: 0, case_filters: $ssmTested) {
                    total
                  }
                }
                filteredCases: cases {
                  hits(first: 0, case_filters: $geneCaseFilter) {
                    total
                  }
                }
                cnvCases: cases {
                  hits(first: 0, case_filters: $cnvTested) {
                    total
                  }
                }
                genes {
                  hits(
                    first: $genesTable_size
                    offset: $genesTable_offset
                    filters: $genesTable_filters
                    case_filters: $caseFilters
                    score: $score
                    sort: $sort
                  ) {
                    total
                    edges {
                      node {
                        id
                        numCases: score
                        symbol
                        name
                        cytoband
                        biotype
                        gene_id
                        is_cancer_gene_census
                        ssm_case: case {
                          hits(first: 0, filters: $ssmCase) {
                            total
                          }
                        }
                        cnv_case: case {
                          hits(first: 0, filters: $cnvTested) {
                            total
                          }
                        }
                        case_cnv_gain: case {
                          hits(first: 0, filters: $cnvGainFilters) {
                            total
                          }
                        }
                        case_cnv_loss: case {
                          hits(first: 0, filters: $cnvLossFilters) {
                            total
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }`,
	getVariables: (q: any) => {
		const variables: any = {
			caseFilters: { op: 'and', content: [] },
			genesTable_filters: { op: 'and', content: [] },
			genesTable_size: q.maxGenes || 50,
			genesTable_offset: 0,
			score: 'case.project.project_id',
			ssmCase: {
				op: 'and',
				content: [
					{
						op: 'in',
						content: {
							field: 'cases.available_variation_data',
							value: ['ssm']
						}
					},
					{
						op: 'NOT',
						content: {
							field: 'genes.case.ssm.observation.observation_id',
							value: 'MISSING'
						}
					}
				]
			},
			geneCaseFilter: {
				content: [
					{
						content: {
							field: 'cases.available_variation_data',
							value: ['ssm']
						},
						op: 'in'
					}
				],
				op: 'and'
			},
			ssmTested: {
				content: [
					{
						content: {
							field: 'cases.available_variation_data',
							value: ['ssm']
						},
						op: 'in'
					}
				],
				op: 'and'
			},
			cnvTested: {
				op: 'and',
				content: [
					{
						content: {
							field: 'cases.available_variation_data',
							value: ['cnv']
						},
						op: 'in'
					}
				]
			},
			cnvGainFilters: {
				op: 'and',
				content: [
					{
						content: {
							field: 'cases.available_variation_data',
							value: ['cnv']
						},
						op: 'in'
					},
					{
						content: {
							field: 'cnvs.cnv_change',
							value: ['Gain']
						},
						op: 'in'
					}
				]
			},
			cnvLossFilters: {
				op: 'and',
				content: [
					{
						content: {
							field: 'cases.available_variation_data',
							value: ['cnv']
						},
						op: 'in'
					},
					{
						content: {
							field: 'cnvs.cnv_change',
							value: ['Loss']
						},
						op: 'in'
					}
				]
			}
		}

		if (q.filter0) {
			// Phil 8/9/2024: must set case filter to both "ssmCase" and "caseFilters" to get correct ssm affected counts
			variables.ssmCase.content.push(JSON.parse(JSON.stringify(q.filter0)))
			variables.caseFilters.content.push(JSON.parse(JSON.stringify(q.filter0)))
			variables.geneCaseFilter.content.push(JSON.parse(JSON.stringify(q.filter0)))
			variables.cnvLossFilters.content.push(JSON.parse(JSON.stringify(q.filter0)))
			variables.cnvGainFilters.content.push(JSON.parse(JSON.stringify(q.filter0)))
			variables.cnvTested.content.push(JSON.parse(JSON.stringify(q.filter0)))
		}

		if (q.geneFilter == 'CGC') {
			variables.genesTable_filters.content.push(geneCGC())
			variables.cnvLossFilters.content.push(geneCGC())
			variables.cnvGainFilters.content.push(geneCGC())
		}
		return variables
	}
}

async function getGenesGraphql(q: GdcTopMutatedGeneRequest, ds) {
	const { host, headers } = ds.getHostHeaders(q)

	const query: string = queryV2.query
	const variables: object = queryV2.getVariables(q)

	const re: any = await ky
		.post(host.graphql, {
			timeout: false, // do not let ky timeout
			headers,
			json: { query, variables }
		})
		.json()

	const genes: GdcGene[] = []
	for (const g of re.data.genesTableViewer.explore.genes.hits.edges) {
		/* g.node is:
		{
		  "biotype": "protein_coding",
		  "case_cnv_gain": { "hits": { "total": 65 } },
		  "case_cnv_loss": { "hits": { "total": 93 } },
		  "cnv_case": { "hits": { "total": 173 } },
		  "cytoband": [
			"12q15"
		  ],
		  "gene_id": "ENSG00000127329",
		  "is_cancer_gene_census": true,
		  "name": "protein tyrosine phosphatase receptor type B",
		  "numCases": 18,
		  "ssm_case": { "hits": { "total": 630 } },
		  "symbol": "PTPRB"
		}
		*/
		if (typeof g.node != 'object') throw 'node missing from re.data.genesTableViewer.explore.genes.hits.edges[]'
		const mutationStat: any = []
		if (Number.isInteger(g.node.case_cnv_gain?.hits?.total) && g.node.case_cnv_gain.hits.total > 0)
			mutationStat.push({ class: mclasscnvgain, count: g.node.case_cnv_gain.hits.total })
		if (Number.isInteger(g.node.case_cnv_loss?.hits?.total) && g.node.case_cnv_loss.hits.total > 0)
			mutationStat.push({ class: mclasscnvloss, count: g.node.case_cnv_loss.hits.total })
		if (Number.isInteger(g.node.ssm_case?.hits?.total) && g.node.ssm_case.hits.total > 0)
			mutationStat.push({ dt: dtsnvindel, count: g.node.ssm_case.hits.total })
		genes.push({
			gene: g.node.symbol,
			mutationStat
		})
	}
	return genes
}

function geneCGC() {
	// return a copy of cgc filter obj each time
	return {
		content: {
			field: 'genes.is_cancer_gene_census',
			value: ['true']
		},
		op: 'in'
	} as object
}

/*************************************
	  below are old code
      old method to use rest api
**************************************
this api only gets ssm-cases and does not account for cnv cases, will not return any gene for ssm-less cohort e.g. APOLLO-LUAD
thus is replaced by getGenesGraphql
async function getGenes(q: GdcTopMutatedGeneRequest) {
	const _f = q.filter0 || { op: 'and', content: [] } // allow blank filter to test geneset edit ui (without filter)
	const response = await got.post(path.join(host.rest, '/analysis/top_mutated_genes_by_project'), {
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({
			size: q.maxGenes || 50,
			fields: 'symbol',
			filters: mayAddCGC2filter(_f, q.geneFilter)
		})
	})
	const re = JSON.parse(response.body)
	const genes = [] as string[]
	for (const hit of re.data.hits) {
		if (!hit.symbol) continue
		genes.push(hit.symbol)
	}
	return genes
}
*/

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
*/

const got = require('got')

const gene = process.argv[2] || 'ENSG00000133703' // kras

const query = `query CancerDistributionBarChart_relayQuery(
	$caseAggsFilters: FiltersArgument
	$ssmTested: FiltersArgument
	$cnvGain: FiltersArgument
	$cnvLoss: FiltersArgument
	$cnvTested: FiltersArgument
	$cnvTestedByGene: FiltersArgument
	$cnvAll: FiltersArgument
	$ssmFilters: FiltersArgument
) {
	viewer {
		explore {
			ssms {
				hits(first: 0, filters: $ssmFilters) { total }
			}
			cases {
				cnvAll: hits(filters: $cnvAll) { total }
				cnvTestedByGene: hits(filters: $cnvTestedByGene) { total }
				gain: aggregations(filters: $cnvGain) {
					project__project_id {
						buckets {
							doc_count
							key
						}
					}
				}
				loss: aggregations(filters: $cnvLoss) {
					project__project_id {
						buckets {
							doc_count
							key
						}
					}
				}
				cnvTotal: aggregations(filters: $cnvTested) {
					project__project_id {
						buckets {
							doc_count
							key
						}
					}
				}
				filtered: aggregations(filters: $caseAggsFilters) {
					project__project_id {
						buckets {
							doc_count
							key
						}
					}
				}
				total: aggregations(filters: $ssmTested) {
					project__project_id {
						buckets {
							doc_count
							key
						}
					}
				}
			}
		}
	}
}`

const variables = {
	caseAggsFilters: {
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
					field: 'cases.gene.ssm.observation.observation_id',
					value: 'MISSING'
				}
			},
			{
				op: 'in',
				content: {
					field: 'genes.gene_id',
					value: [gene]
				}
			}
		]
	},
	ssmTested: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['ssm']
				}
			}
		]
	},
	cnvGain: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['cnv']
				}
			},
			{
				op: 'in',
				content: {
					field: 'cnvs.cnv_change',
					value: ['Gain']
				}
			},
			{
				op: 'in',
				content: {
					field: 'genes.gene_id',
					value: [gene]
				}
			}
		]
	},
	cnvLoss: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['cnv']
				}
			},
			{
				op: 'in',
				content: {
					field: 'cnvs.cnv_change',
					value: ['Loss']
				}
			},
			{
				op: 'in',
				content: {
					field: 'genes.gene_id',
					value: [gene]
				}
			}
		]
	},
	cnvTested: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['cnv']
				}
			}
		]
	},
	cnvTestedByGene: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['cnv']
				}
			},
			{
				op: 'in',
				content: {
					field: 'genes.gene_id',
					value: [gene]
				}
			}
		]
	},
	cnvAll: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['cnv']
				}
			},
			{
				op: 'in',
				content: {
					field: 'cnvs.cnv_change',
					value: ['Gain', 'Loss']
				}
			},
			{
				op: 'in',
				content: {
					field: 'genes.gene_id',
					value: [gene]
				}
			}
		]
	},
	ssmFilters: {
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
				op: 'in',
				content: {
					field: 'genes.gene_id',
					value: [gene]
				}
			}
		]
	}
}

;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		})
		const re = JSON.parse(response.body).data.viewer.explore
		console.log(re.cases)
		/*
		const hit0 = re.hits[0]
		console.log(JSON.stringify(hit0, null, 2))
		console.log(re.hits.length, 'hits')
		*/
	} catch (error) {
		console.log(error)
	}
})()

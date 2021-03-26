const got = require('got')

const gene = process.argv[2] || 'ENSG00000157764'
const set_id = process.argv[3]

const query = `query CancerDistributionBarChart_relayQuery(
  $caseAggsFilters: FiltersArgument
  $ssmTested: FiltersArgument
) {
  viewer {
    explore {
	  cases {
		filtered: aggregations(filters: $caseAggsFilters) {
		  project__project_id {
		    buckets { doc_count key }
		  }
		}
		total: aggregations(filters: $ssmTested) {
		  project__project_id {
		    buckets {  doc_count      key   }
		  }
		}
	  }
	}
  }
}`

const variables = {
	ssmTested: {
		op: 'and',
		content: [{ op: 'in', content: { field: 'cases.available_variation_data', value: ['ssm'] } }]
	},
	caseAggsFilters: {
		op: 'and',
		content: [
			{ op: 'in', content: { field: 'cases.available_variation_data', value: ['ssm'] } },
			{ op: 'NOT', content: { field: 'cases.gene.ssm.observation.observation_id', value: 'MISSING' } },
			{ op: 'in', content: { field: 'genes.gene_id', value: [gene] } }
		]
	}
}
if (set_id) {
	variables.caseAggsFilters.content.push({
		op: 'in',
		content: { field: 'cases.case_id', value: [set_id] }
	})
}

;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		})
		const r = JSON.parse(response.body)
		const n2c = new Map()
		for (const a of r.data.viewer.explore.cases.total.project__project_id.buckets) {
			n2c.set(a.key, a.doc_count)
		}
		for (const a of r.data.viewer.explore.cases.filtered.project__project_id.buckets) {
			console.log(a.key, a.doc_count, n2c.get(a.key))
		}
	} catch (error) {
		console.log(error)
	}
})()

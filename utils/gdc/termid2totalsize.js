const got = require('got')
const token = process.argv[2]

// this query may work better than projectsize.js

const query = `
query termislst2total( $filters: FiltersArgument) {
	explore {
		cases {
			aggregations (filters: $filters, aggregations_filter_themselves: true) {
				disease_type {buckets { doc_count, key }}
				primary_site {buckets { doc_count, key }}
				project__project_id {buckets { doc_count, key }}
				demographic__gender {buckets { doc_count, key }}
				demographic__race {buckets { doc_count, key }}
				demographic__ethnicity {buckets { doc_count, key }}
			}
		}
	}
}`

const variables = {
	filters: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['ssm']
				}
			}
			//////////////
			// to filter by a project, use "cases.project.project_id"
			//{ op: 'in', content: { field: 'cases.project.project_id', value: ['TCGA-COAD'] } }
			//{ op: 'in', content: { field: 'cases.disease_type', value: ['Adenomas and Adenocarcinomas'] } }
			//{ op: 'in', content: { field: 'cases.demographic.gender', value: ['male'] } }
		]
	}
}

const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
if (token) headers['X-Auth-Token'] = token
;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers,
			body: JSON.stringify({ query, variables })
		})
		const re = JSON.parse(response.body)
		for (const termid in re.data.explore.cases.aggregations) {
			console.log(termid)
			for (const bucket of re.data.explore.cases.aggregations[termid].buckets) {
				console.log(`\t${bucket.doc_count}\t${bucket.key}`)
			}
		}
	} catch (error) {
		console.log(error)
	}
})()

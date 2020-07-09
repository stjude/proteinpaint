const got = require('got')

const query = `
query CancerDistributionSsmTable_relayQuery(
  $ssmTested: FiltersArgument
) {
  viewer {
    explore {
      cases {
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
}
`

const variables = {
	ssmTested: {
		op: 'and',
		content: [{ op: 'in', content: { field: 'cases.available_variation_data', value: ['ssm'] } }]
	}
}

;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		})
		console.log(JSON.stringify(JSON.parse(response.body), null, 2))
	} catch (error) {
		console.log(error)
	}
})()

const got = require('got')

const query = `query PROJECTS_EDGES($filters_2: FiltersArgument) {
  explore {
    ssms {
      hits(first: 100000, filters: $filters_2) {
        total
        edges {
          node {
            ssm_id
            chromosome
            start_position
            end_position
            genomic_dna_change
			reference_allele
            tumor_allele
            occurrence {
              hits {
                total
				edges {
				  node {
				    case {
					  project {
					    project_id
					  }
					  primary_site
					  disease_type
					}
				  }
				}
              }
            }
			consequence{
              hits{
                total
                edges{
                  node{
                    transcript{
                      transcript_id
					  aa_change
					  consequence_type
					  gene{
					  	symbol
					  }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`

const range = {
	filters_2: {
		op: 'and',
		content: [
			{ op: 'in', content: { field: 'chromosome', value: ['chr11'] } },
			{ op: '>=', content: { field: 'start_position', value: [108222831] } },
			{ op: '<=', content: { field: 'end_position', value: [108369099] } }
		]
	}
}

;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({
				query,
				variables: range
			})
		})
		console.log(JSON.stringify(JSON.parse(response.body), null, 2))
	} catch (error) {
		console.log(error)
	}
})()

const got = require('got')

let chr = 'chr1',
	start = 114704468,
	stop = 114716771
if (process.argv[2]) {
	const l = process.argv[2].split(/[:-]/)
	chr = l[0]
	start = Number(l[1])
	stop = Number(l[2])
}

const query = `query PROJECTS_EDGES($filters: FiltersArgument) {
  explore {
    ssms {
      hits(first: 100000, filters: $filters) {
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
					  case_id
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
	filters: {
		op: 'and',
		content: [
			{ op: '=', content: { field: 'chromosome', value: [chr] } },
			{ op: '>=', content: { field: 'start_position', value: [start] } },
			{ op: '<=', content: { field: 'end_position', value: [stop] } }
			//{ op: 'in', content: { field: 'cases.case_id', value: ['set_id:DDw3QnUB_tcD1Zw3Af72']}},
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
		const hits = JSON.parse(response.body).data.explore.ssms.hits.edges
		console.log(hits.length, 'variants')
		console.log(hits[0].node.occurrence.hits.edges[0])
		for (const m of hits) {
			console.log(
				'\n' +
					m.node.consequence.hits.edges
						.map(i => i.node.transcript.transcript_id + '/' + i.node.transcript.aa_change)
						.join(',')
			)
			console.log('==> ' + m.node.occurrence.hits.edges.length + ' cases')
		}
	} catch (error) {
		console.log(error)
	}
})()

const got = require('got')

const arg = {}
for (let i = 2; i < process.argv.length; i++) {
	const [k, v] = process.argv[i].split('=')
	arg[k] = v
}
const isoform = process.argv[2] || 'ENST00000407796' // AKT1, with first as E17K with 53 cases

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

const variables = {
	filters: {
		op: 'and',
		content: [
			{
				op: '=',
				content: { field: 'ssms.consequence.transcript.transcript_id', value: [arg.isoform || 'ENST00000269305'] }
			} // TP53
			//{ op: 'in', content: { field: 'cases.case_id', value: ['set_id:DDw3QnUB_tcD1Zw3Af72'] } }
		]
	}
}
if (arg.set_id) {
	variables.filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [arg.set_id] } })
}

;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		})
		const hits = JSON.parse(response.body).data.explore.ssms.hits.edges
		console.log(hits.length, 'variants')
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

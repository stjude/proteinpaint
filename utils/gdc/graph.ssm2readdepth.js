const got = require('got')
const path = require('path')
const arg = {}
for (let i = 2; i < process.argv.length; i++) {
	const [k, v] = process.argv[i].split('=')
	arg[k] = v
}
const query = `query ssm_count($filters: FiltersArgument, $filters2: FiltersArgument) {
  explore {
    ssms {
      hits(filters: $filters) {
        edges {
          node {
            ssm_id
            occurrence {
              hits {
                edges {
                  node {
                    case {
                      case_id
                      observations {
                        hits(filters: $filters2) {
                          edges {
                            node {
                              read_depth {
                                t_alt_count
                                t_ref_count
                                t_depth
                                n_depth
                              }
							  variant_calling {
							    variant_process
								variant_caller
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
				content: {
					field: 'ssms.ssm_id',
					value: [arg.ssmid ? path.basename(arg.ssmid) : '883d6564-b868-589a-9908-25b76b9f434c']
				}
			}
		]
	},
	filters2: {
		op: '=',
		content: { field: 'occurrence.case.observation.variant_calling.variant_caller', value: ['mutect2'] }
	}
}
if (arg.caseid) {
	variables.filters.content.push({
		op: '=',
		content: { field: 'occurrence.case.case_id', value: [path.basename(arg.caseid)] }
	})
}
;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		})
		const json = JSON.parse(response.body)
		const ssms = json.data.explore.ssms.hits.edges
		const ssm = ssms[0]
		const cases = ssm.node.occurrence.hits.edges
		for (const c of cases) {
			const caseid = c.node.case.case_id
			const observations = c.node.case.observations.hits.edges
			for (const observe of observations) {
				const d = observe.node.read_depth
				console.log(
					caseid,
					'tumorRef',
					d.t_ref_count,
					'tumorAlt',
					d.t_alt_count,
					'tumorTotal',
					d.t_depth,
					'normal',
					d.n_depth,
					observe.node.variant_calling.variant_process,
					observe.node.variant_calling.variant_caller
				)
			}
		}
	} catch (error) {
		console.log(error)
	}
})()

const got = require('got')

const ssmid = process.argv[2] || '288a8e0d-059a-520c-b457-fc8464e68154' // p53 R196*, n=53
const set_id = process.argv[3] // optional

const query = `query ExploreCasesTable_derived_relayQuery(
  $filters: FiltersArgument,
  $first: Int
) {
  explore {
    cases {
      hits(first: $first, filters: $filters) {
        total
        edges {
          node {
            disease_type
            primary_site
            project { project_id }
          }
        }
      }
    }
  }
}`

const variables = {
	first: 10000,
	filters: {
		op: 'and',
		content: [
			{
				op: '=',
				content: {
					field: 'ssms.ssm_id',
					value: [ssmid]
				}
			}
		]
	}
}
if (set_id) {
	variables.filters.content.push({
		op: 'in',
		content: {
			field: 'cases.case_id',
			value: [set_id]
		}
	})
}

;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		})
		const cases = JSON.parse(response.body).data.explore.cases.hits.edges
		console.log(cases.length, 'cases')
		for (const c of cases) {
			console.log(c.node.primary_site, c.node.project.project_id)
		}
	} catch (error) {
		console.log(error)
	}
})()

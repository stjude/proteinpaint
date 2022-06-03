// https://github.com/NCI-GDC/portal-ui/blob/92f0dfa17838746093c3c011141d08391016da91/data/schema.graphql

const got = require('got')
const path = require('path')
const arg = {}
for (let i = 2; i < process.argv.length; i++) {
	const [k, v] = process.argv[i].split('=')
	arg[k] = v
}
const query = `
query barcode($filters: FiltersArgument) {
  repository {
    cases {
      hits(first: 10, filters: $filters) { edges { node {
        samples {
          hits (first: 10, filters: $filters) { edges { node {
            submitter_id
            portions {
              hits { edges { node {
			    analytes {
				  hits { edges { node { 
				    aliquots {
					  hits { edges { node { submitter_id }}}
					}
				  }}}
				}
              } } }
            }
          } } }
        }
      } } }
    }
  }
}`

const queryIds = arg.id ? [arg.id] : ['TCGA-F4-6805-01A-11D-1835-10', 'MMRF_2428_1_BM_CD138pos_T1_KHS5U_L11231']

const variables = {
	filters: {
		op: '=',
		content: {
			// one aliquot id will match with one sample id
			field: 'samples.portions.analytes.aliquots.submitter_id',
			value: queryIds
			/*
			// one case id can match with multiple samples
			field: 'cases.case_id',
			value: arg.id || 'e76258b7-e13a-4b05-855b-d792701ffba1'
			*/
		}
	}
}
;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		})
		const json = JSON.parse(response.body)
		for (const c of json.data.repository.cases.hits.edges) {
			for (const s of c.node.samples.hits.edges) {
				const submitter_id = s.node.submitter_id
				for (const p of s.node.portions.hits.edges) {
					for (const a of p.node.analytes.hits.edges) {
						for (const al of a.node.aliquots.hits.edges) {
							const al_id = al.node.submitter_id
							if (queryIds.includes(al_id)) {
								// a match!
								console.log(al_id, submitter_id)
							}
						}
					}
				}
			}
		}
	} catch (error) {
		console.log(error)
	}
})()

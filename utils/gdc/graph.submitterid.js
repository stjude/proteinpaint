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
      hits(first: 10, filters: $filters) {
        edges {
          node {
            samples {
              hits (first: 10, filters: $filters) {
                edges {
                  node {
                    submitter_id
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
		op: '=',
		content: {
			/*
			//aliquot submitter id
			field: 'samples.portions.analytes.aliquots.submitter_id',
			value: arg.id || 'TCGA-F4-6805-01A-11D-1835-10'
			*/
			field: 'cases.case_id',
			value: arg.id || 'e76258b7-e13a-4b05-855b-d792701ffba1'
		}
	}
}
;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		})
		console.log(response.body)
		const json = JSON.parse(response.body)
	} catch (error) {
		console.log(error)
	}
})()

const got = require('got')

const isoform = process.argv[2] || 'ENST00000407796' // AKT1, with first as E17K with 53 cases

const query = `query Lolliplot_relayQuery(
  $filters: FiltersArgument
  $score: String
) {
  analysis {
    protein_mutations {
      data(first: 10000, score: $score,  filters: $filters, fields: [
	  	"ssm_id"
		"consequence.transcript.aa_change"
		"consequence.transcript.consequence_type"
		"consequence.transcript.transcript_id"
		"occurrence.case.project.project_id"
		"occurrence.case.primary_site"
		"occurrence.case.disease_type"
		"occurrence.case.case_id"
		])
    }
  }
}`

const variables = {
	filters: { op: '=', content: { field: 'ssms.consequence.transcript.transcript_id', value: [isoform] } },
	score: 'occurrence.case.project.project_id'
}

;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		})
		//console.log(response.body)

		const re = JSON.parse(JSON.parse(response.body).data.analysis.protein_mutations.data)
		const hit0 = re.hits[0]
		console.log(JSON.stringify(hit0, null, 2))
		console.log(re.hits.length, 'hits')
	} catch (error) {
		console.log(error)
	}
})()

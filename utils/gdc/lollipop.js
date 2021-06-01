const got = require('got')

const isoform = process.argv[2] || 'ENST00000407796' // AKT1, with first as E17K with 53 cases

const query = `query Lolliplot_relayQuery(
  $filter: FiltersArgument
  $score: String
) {
  analysis {
    protein_mutations {
      data(first: 10000, score: $score,  filters: $filter, fields: [
	  	"ssm_id"
		"chromosome"
		"start_position"
		"reference_allele"
		"tumor_allele"
		"consequence.transcript.aa_change"
		"consequence.transcript.consequence_type"
		"consequence.transcript.transcript_id"
		])
    }
  }
}`

const variables = {
	filter: {
		op: 'and',
		content: [
			{ op: '=', content: { field: 'ssms.consequence.transcript.transcript_id', value: [isoform] } }
			//{ op: 'in', content: { field: 'cases.case_id', value: ['set_id:bfhJqXkB6YqjLFd7yhrb'] } }
		]
	},
	score: 'occurrence.case.project.project_id'
}

;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		})

		const re = JSON.parse(JSON.parse(response.body).data.analysis.protein_mutations.data)

		console.log(re.hits.length, 'variants')
		for (const m of re.hits) {
			const csq = m._source.consequence.find(i => i.transcript.transcript_id == isoform)
			console.log('\n' + csq.transcript.consequence_type + '/' + csq.transcript.aa_change)
			console.log('==> ' + m._score + ' cases')
		}
		console.log(re.hits[0])
	} catch (error) {
		console.log(error)
	}
})()

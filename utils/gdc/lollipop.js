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
	filter: {
		op: 'and',
		content: [
			{ op: '=', content: { field: 'ssms.consequence.transcript.transcript_id', value: [isoform] } },
			//{ op: 'in', content: { field: 'cases.case_id', value: ['set_id:DDw3QnUB_tcD1Zw3Af72'] } }
			{
				op: 'in',
				content: {
					field: 'cases.case_id',
					value: [
						'56c07b06-c6d3-4c03-9e57-7be636e7cc5c',
						'8b3b1f24-419e-4043-82be-2bd41268bb0e',
						'cd6f37d5-d192-48b9-a63f-54d8d1e810c6'
					]
				}
			}
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
			console.log(
				'\n' + m._source.consequence.map(i => i.transcript.transcript_id + '/' + i.transcript.aa_change).join(',')
			)
			console.log('==> ' + m._source.occurrence.length + ' cases')
		}
	} catch (error) {
		console.log(error)
	}
})()

const got = require('got')

const query = `query Lolliplot_relayQuery(
  $filters: FiltersArgument
  $first: Int
  $score: String
) {
  analysis {
    protein_mutations {
      data(first: $first, score: $score, filters: $filters, fields: [
	  	#"ssm_id",
		#"genomic_dna_change",
		"consequence.transcript.aa_change",
		#"consequence.transcript.aa_start",
		"consequence.transcript.consequence_type",
		#"consequence.transcript.is_canonical",
		#"consequence.transcript.transcript_id",
		#"consequence.transcript.annotation.vep_impact",
		#"consequence.transcript.annotation.polyphen_impact",
		#"consequence.transcript.annotation.polyphen_score",
		#"consequence.transcript.annotation.sift_impact",
		#"consequence.transcript.annotation.sift_score",
		#"consequence.transcript.gene.gene_id",
		#"consequence.transcript.gene.symbol",
		#"occurrence"
		])
    }
  }
}`

const variables = {
	filters: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'ssms.consequence.transcript.consequence_type',
					value: ['missense_variant', 'frameshift_variant', 'start_lost', 'stop_lost', 'stop_gained']
				}
			},
			{ op: '=', content: { field: 'ssms.consequence.transcript.transcript_id', value: ['ENST00000554581'] } }
		]
	},
	first: 10000,
	score: 'occurrence.case.project.project_id'
}

;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		})
		console.log(JSON.stringify(JSON.parse(response.body), null, 2))
	} catch (error) {
		console.log(error)
	}
})()

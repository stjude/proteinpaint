const query = `query GdcSsmByGene($filter: FiltersArgument) {
  explore {
    ssms {
      hits(first: 10000, filters: $filter) {
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
	filter: {
		op: 'and',
		content: [
			{ op: 'in', content: { field: 'chromosome', value: [] } },
			{ op: '>=', content: { field: 'start_position', value: [] } },
			{ op: '<=', content: { field: 'end_position', value: [] } }
		]
	}
}

module.exports = {
	color: '#545454',
	dsinfo: [
		{ k: 'Source', v: '<a href=https://portal.gdc.cancer.gov/ target=_blank>NCI Genomic Data Commons</a>' },
		{ k: 'Data type', v: 'SNV/Indel' },
		{ k: 'Query method', v: 'GDC GraphQL API' }
	],
	genome: 'hg38',
	queries: [
		{
			name: 'gdc',
			gdcgraphql_snvindel: { query, variables }
		}
	]
}

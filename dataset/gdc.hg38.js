////////////////////////// list of query strings

/*
query list of variants by genomic range (of a gene/transcript)
does not include info on individual tumors
the "filter" name is hardcoded and used in app.js
*/
const query_range2variants = `
query GdcSsmByGene($filter: FiltersArgument) {
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

/*
query a specific variant
with info about all tumors harbording this variant
variant2tumors intends to be a generic mechanism for fetching tumors harbording a variant
same name attribute will be exposed to client (ds.variant2tumors: true)
and hiding the implementation details on server
*/
const query_variant2tumors = `
query OneSsm($filter: FiltersArgument) {
	explore {
		ssms {
			hits(first: 10000, filters: $filter) {
				edges {
					node {
						occurrence {
							hits {
								edges {
									node {
										case {
											project {
												project_id
											}
											disease_type
											primary_site
											# case_id
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

/*
one time query: will only run once and result is cached on serverside
to retrieve total number of tumors per project
the number will be displayed in both sunburst and singleton variant panel
must associate the "project" with project_id in sunburst

for now this is only triggered in variant2tumors query
*/
const query_projectsize = `
query projectSize( $ssmTested: FiltersArgument) {
	viewer {
		explore {
			cases {
				total: aggregations(filters: $ssmTested) {
					project__project_id {
						buckets {
							doc_count
							key
						}
					}
				}
			}
		}
	}
}`

//////////////// end of query strings ///////////////

const occurrence_key = 'total' // for the numeric axis showing occurrence

const vcfinfofilter = {
	//setidx4numeric: 0,
	setidx4occurrence: 0, // an info key to define #tumors of each mutation
	lst: [
		{
			name: 'Occurrence',
			locusinfo: { key: occurrence_key },
			numericfilter: [
				{ side: '>', value: 1 },
				{ side: '>', value: 5 },
				{ side: '>', value: 10 },
				{ side: '>', value: 20 },
				{ side: '>', value: 100 }
			]
		}
	]
}

// attributes to show for list of variants
const snvindel_attributes = [
	{
		label: 'Mutation',
		get: m => m.mname || ''
	},
	{
		label: 'Genome pos.',
		hide: true,
		get: m => {
			if (m.chr && m.pos) return m.chr + ':' + (m.pos + 1)
			return null
		}
	},
	{
		label: 'Allele',
		lst: [
			{
				get: function(m) {
					return m.ref || ''
				},
				label: 'Ref',
				valuecenter: true
			},
			{
				get: function(m) {
					return m.alt || ''
				},
				label: 'Alt',
				valuecenter: true
			}
		]
	},
	{
		label: 'Occurrence',
		get: m => m.info.total
	}
]

module.exports = {
	color: '#545454',
	dsinfo: [
		{ k: 'Source', v: '<a href=https://portal.gdc.cancer.gov/ target=_blank>NCI Genomic Data Commons</a>' },
		{ k: 'Data type', v: 'SNV/Indel' },
		{ k: 'Query method', v: 'GDC GraphQL API' }
	],
	genome: 'hg38',
	vcfinfofilter,
	snvindel_attributes,

	onetimequery_projectsize: {
		gdcgraphql: {
			query: query_projectsize,
			variables: {
				ssmTested: {
					op: 'and',
					content: [{ op: 'in', content: { field: 'cases.available_variation_data', value: ['ssm'] } }]
				}
			}
		}
	},

	variant2tumors: {
		variantkey: 'ssm_id', // required, tells client to return ssm_id for identifying variants
		// required
		levels: [
			{
				k: 'project', // attribute for stratinput
				keys: ['project', 'project_id']
			},
			{
				k: 'disease',
				keys: ['disease_type']
			}
		],
		// the actual query method is using gdc api
		gdcgraphql: {
			query: query_variant2tumors,
			variables: {
				filter: {
					op: 'in',
					content: {
						field: 'ssm_id'
					}
				}
			}
		}
	},

	queries: [
		{
			name: 'gdc',
			gdcgraphql_snvindel: {
				query: query_range2variants,
				variables: {
					filter: {
						op: 'and',
						content: [
							{ op: 'in', content: { field: 'chromosome' } }, // to add "value" at runtime
							{ op: '>=', content: { field: 'start_position' } },
							{ op: '<=', content: { field: 'end_position' } }
						]
					}
				},
				occurrence_key
			}
		}
	]
}

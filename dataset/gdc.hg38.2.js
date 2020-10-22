////////////////////////// list of query strings

/*
query list of variants by isoform
*/
const query_isoform2variants = `
query Lolliplot_relayQuery(
	$filters: FiltersArgument
	$score: String
) {
	analysis {
		protein_mutations {
			data(first: 10000, score: $score, filters: $filters, fields: [
				"ssm_id"
				"chromosome"
				"start_position"
				"reference_allele"
				"tumor_allele"
				"consequence.transcript.aa_change"
				"consequence.transcript.consequence_type"
				"consequence.transcript.transcript_id"
				"consequence.transcript.annotation.vep_impact"
				"consequence.transcript.annotation.polyphen_impact"
				"consequence.transcript.annotation.polyphen_score"
				"consequence.transcript.annotation.sift_impact"
				"consequence.transcript.annotation.sift_score"
				"occurrence.case.project.project_id"
				"occurrence.case.primary_site"
				"occurrence.case.disease_type"
				"occurrence.case.case_id"
			])
		}
	}
}`

function variables_isoform2variants(p) {
	// p:{}
	// .isoform
	// .set_id
	if (!p.isoform) throw '.isoform missing'
	if (typeof p.isoform != 'string') throw '.isoform value not string'
	const f = {
		filters: {
			op: 'and',
			content: [
				{
					op: '=',
					content: {
						field: 'consequence.transcript.transcript_id',
						value: [p.isoform]
					}
				}
			]
		},
		score: 'occurrence.case.project.project_id'
	}
	if (p.set_id) {
		if (typeof p.set_id != 'string') throw '.set_id value not string'
		f.filters.content.push({
			op: 'in',
			content: {
				field: 'cases.case_id',
				value: [p.set_id]
			}
		})
	}
	return f
}

/*
not in use for the moment
query list of variants by genomic range (of a gene/transcript)
does not include info on individual tumors
the "filter" name is hardcoded and used in app.js
TODO convert to text output
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
function variables_range2variants(p) {
	// p:{}
	// .chr/start/stop
	// .set_id
	if (!p.chr) throw '.chr missing'
	if (typeof p.chr != 'string') throw '.chr value not string'
	if (!Number.isInteger(p.start)) throw '.start not integer'
	if (!Number.isInteger(p.stop)) throw '.stop not integer'
	const f = {
		filter: {
			op: 'and',
			content: [
				{ op: '=', content: { field: 'chromosome', value: [p.chr] } },
				{ op: '>=', content: { field: 'start_position', value: [p.start] } },
				{ op: '<=', content: { field: 'end_position', value: [p.stop] } }
			]
		}
	}
	if (p.set_id) {
		if (typeof p.set_id != 'string') throw '.set_id value not string'
		f.filter.content.push({
			op: 'in',
			content: { field: 'cases.case_id', value: [p.set_id] }
		})
	}
	return f
}

/*
using one or multiple variants, get info about all tumors harbording them
variant2samples intends to be a generic mechanism for fetching tumors harbording a variant
same name attribute will be exposed to client (ds.variant2samples: true)
and hiding the implementation details on server

on client, get() is added to tk.ds.variant2samples to make GET request for list of variants
this happens for sunburst and itemtable

query mode: samples/sunburst/summaries
difference is how many sample attributes are included
don't know a js method to alter the list of attributes in `case { }` part
- samples
  return entire list of attributes on the sample
  use for returning list of samples, or summarizing all attributes
- sunburst
  only return subset of attributes selected for sunburst chart
*/
const query_variant2samples_sunburst = `
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
const query_variant2samples_list = `
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
											case_id
											available_variation_data
											state
											# tissue_source_site { name }
											demographic {
												gender
												year_of_birth
												race
												ethnicity
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
function variables_variant2samples(p) {
	// p:{}
	// .ssm_id_lst, string
	// .set_id
	if (!p.ssm_id_lst) throw '.ssm_id_lst missing'
	if (typeof p.ssm_id_lst != 'string') throw '.ssm_id_lst value not string'
	return {
		filter: { op: 'in', content: { field: 'ssm_id', value: p.ssm_id_lst.split(',') } }
	}
	const f = {
		filter: {
			op: 'and',
			content: [{ op: 'in', content: { field: 'ssm_id', value: p.ssm_id_lst.split(',') } }]
		}
	}
	if (p.set_id) {
		if (typeof p.set_id != 'string') throw '.set_id value not string'
		f.filter.content.push({
			op: 'in',
			content: { field: 'cases.case_id', value: [p.set_id] }
		})
	}
	return f
}

/*
one time query: will only run once and result is cached on serverside
to retrieve total number of tumors per project
the number will be displayed in both sunburst and singleton variant panel
must associate the "project" with project_id in sunburst

for now this is only triggered in variant2samples query
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
const variables_projectsize = {
	ssmTested: {
		op: 'and',
		content: [{ op: 'in', content: { field: 'cases.available_variation_data', value: ['ssm'] } }]
	}
}

const query_genecnv = `query CancerDistributionBarChart_relayQuery(
	$caseAggsFilters: FiltersArgument
	$ssmTested: FiltersArgument
	$cnvGain: FiltersArgument
	$cnvLoss: FiltersArgument
	$cnvTested: FiltersArgument
	$cnvTestedByGene: FiltersArgument
	$cnvAll: FiltersArgument
	$ssmFilters: FiltersArgument
) {
	viewer {
		explore {
			ssms {
				hits(first: 0, filters: $ssmFilters) { total }
			}
			cases {
				cnvAll: hits(filters: $cnvAll) { total }
				cnvTestedByGene: hits(filters: $cnvTestedByGene) { total }
				gain: aggregations(filters: $cnvGain) {
					project__project_id {
						buckets {
							doc_count
							key
						}
					}
				}
				loss: aggregations(filters: $cnvLoss) {
					project__project_id {
						buckets {
							doc_count
							key
						}
					}
				}
				cnvTotal: aggregations(filters: $cnvTested) {
					project__project_id {
						buckets {
							doc_count
							key
						}
					}
				}
				filtered: aggregations(filters: $caseAggsFilters) {
					project__project_id {
						buckets {
							doc_count
							key
						}
					}
				}
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

const variables_genecnv = {
	caseAggsFilters: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['ssm']
				}
			},
			{
				op: 'NOT',
				content: {
					field: 'cases.gene.ssm.observation.observation_id',
					value: 'MISSING'
				}
			},
			{
				op: 'in',
				content: {
					field: 'genes.gene_id'
					// value=[gene] added here
				}
			}
		]
	},
	ssmTested: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['ssm']
				}
			}
		]
	},
	cnvGain: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['cnv']
				}
			},
			{
				op: 'in',
				content: {
					field: 'cnvs.cnv_change',
					value: ['Gain']
				}
			},
			{
				op: 'in',
				content: {
					field: 'genes.gene_id'
					// value=[gene] added here
				}
			}
		]
	},
	cnvLoss: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['cnv']
				}
			},
			{
				op: 'in',
				content: {
					field: 'cnvs.cnv_change',
					value: ['Loss']
				}
			},
			{
				op: 'in',
				content: {
					field: 'genes.gene_id'
					// value=[gene] added here
				}
			}
		]
	},
	cnvTested: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['cnv']
				}
			}
		]
	},
	cnvTestedByGene: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['cnv']
				}
			},
			{
				op: 'in',
				content: {
					field: 'genes.gene_id'
					// value=[gene] added here
				}
			}
		]
	},
	cnvAll: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['cnv']
				}
			},
			{
				op: 'in',
				content: {
					field: 'cnvs.cnv_change',
					value: ['Gain', 'Loss']
				}
			},
			{
				op: 'in',
				content: {
					field: 'genes.gene_id'
					// value=[gene] added here
				}
			}
		]
	},
	ssmFilters: {
		op: 'and',
		content: [
			{
				op: 'in',
				content: {
					field: 'cases.available_variation_data',
					value: ['ssm']
				}
			},
			{
				op: 'in',
				content: {
					field: 'genes.gene_id'
					// value=[gene] added here
				}
			}
		]
	}
}

///////////////////////////////// end of query strings ///////////////

/* flat list of term objects, not hierarchical
may make a central termdb (or in memory term list)
and only include a list of term ids in variant2samples.terms[]
*/
const ssmCaseAttr = [
	{
		name: 'Project',
		id: 'project',
		type: 'categorical',
		get: m => {
			// the getter will not be passed to client
			if (m.project) return m.project.project_id
			return null
		}
	},
	{
		name: 'Disease',
		id: 'disease',
		type: 'categorical',
		get: m => m.disease_type
	},
	{
		name: 'Primary site',
		id: 'primary_site',
		type: 'categorical',
		get: m => m.primary_site
	},
	{
		name: 'Available variation data',
		id: 'available_variation_data',
		type: 'categorical',
		get: m => m.available_variation_data
	},
	{ name: 'State', id: 'state', type: 'categorical', get: m => m.state },
	/*
	{
		name: 'Tissue source site',
		id: 'tissue_source_site',
		type:'categorical',
		get: m => {
			if (m.tissue_source_site) return m.tissue_source_site.name
			return null
		}
	},
	*/
	{
		name: 'Gender',
		id: 'gender',
		type: 'categorical',
		get: m => {
			if (m.demographic) return m.demographic.gender
			return null
		}
	},
	{
		name: 'Birth year',
		id: 'year_of_birth',
		type: 'integer',
		get: m => {
			if (m.demographic) return m.demographic.year_of_birth
			return null
		}
	},
	{
		name: 'Race',
		id: 'race',
		type: 'categorical',
		get: m => {
			if (m.demographic) return m.demographic.race
			return null
		}
	},
	{
		name: 'Ethnicity',
		id: 'ethnicity',
		type: 'categorical',
		get: m => {
			if (m.demographic) return m.demographic.ethnicity
			return null
		}
	}
]

const occurrence_key = 'total' // for the numeric axis showing occurrence

/* this now applies not only to vcf track but also legacy ds
 */

// attributes to show for list of variants
const snvindel_attributes = [
	{
		label: 'Mutation',
		get: m => m.mname || ''
	},
	{
		label: 'Genome pos.',
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
	},
	{
		label: 'Polyphen impact',
		get: m => m.info.polyphen_impact
	},
	{
		label: 'Polyphen score',
		get: m => m.info.polyphen_score
	},
	{
		label: 'SIFT impact',
		get: m => m.info.sift_impact
	},
	{
		label: 'SIFT score',
		get: m => m.info.sift_score
	},
	{
		label: 'VEP impact',
		get: m => m.info.vep_impact
	}
]

// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
// XXX hardcoded to use .sample_id to dedup samples
// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
const sampleSummaries = [
	// for a group of samples that carry certain variants
	// TODO project/disease hierarchy
	{ label1: 'project', label2: 'disease' },
	{ label1: 'site' }
]

module.exports = {
	isMds3: true,
	color: '#545454',
	genome: 'hg38',
	snvindel_attributes,
	apihost: 'https://api.gdc.cancer.gov/v0/graphql',

	onetimequery_projectsize: {
		gdcapi: {
			query: query_projectsize,
			variables: variables_projectsize
		}
	},

	variant2samples: {
		variantkey: 'ssm_id', // required, tells client to return ssm_id for identifying variants
		// required
		terms: ssmCaseAttr,
		sunburst_ids: ['project', 'disease'], // term id
		gdcapi: {
			query_sunburst: query_variant2samples_sunburst,
			query_list: query_variant2samples_list,
			variables: variables_variant2samples
		}
	},

	// this is meant for the leftside labels under tklabel
	// should not be called sample summary but mclassSummary
	sampleSummaries: {
		lst: sampleSummaries
	},
	// how to let gene-level gain/loss data shown as additional labels?

	queries: {
		snvindel: {
			forTrack: true,
			byrange: {
				gdcapi: {
					query: query_range2variants,
					variables: variables_range2variants
				}
			},
			byisoform: {
				gdcapi: {
					query: query_isoform2variants,
					variables: variables_isoform2variants
				}
			},
			occurrence_key
		},
		genecnv: {
			gaincolor: '#c1433f',
			losscolor: '#336cd5',
			// gene-level cnv of gain/loss categories
			// only produce project summary, not sample level query
			byisoform: {
				sqlquery_isoform2gene: {
					statement: 'select gene from isoform2gene where isoform=?'
				},
				gdcapi: {
					query: query_genecnv,
					variables: variables_genecnv
				}
			}
		}
		/*
		svfusion: {
		},
		cnvpileup:{},
		geneexpression: {
		},
		*/
	}
}

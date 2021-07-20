const got = require('got')

const GDC_HOST = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'

/* if filter0 is missing necessary attr, adding it to api query will cause error
if valid, returns object
otherwise returns null, so it won't be added to query and will not print error
*/
function validate_filter0(f) {
	if (typeof f != 'object') return null
	if (typeof f.op != 'string') return null
	// may check if f.op value is valid
	if (typeof f.content == 'object') {
	} else if (typeof f.content == 'array') {
		// may do recursion
	} else {
		return null
	}
	return f
}

////////////////////////// list of query strings

/*
query list of variants by isoform
*/

// TODO FIXME investigate if this api supports both isoform and coordinate query
// if so then no need for snvindel.byrange and .byisoform
const protein_mutations = {
	apihost: GDC_HOST + '/v0/graphql',
	query: `query Lolliplot_relayQuery(
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
		}`,
	filters: p => {
		if (!p.isoform) throw '.isoform missing'
		const f = {
			filter: {
				op: 'and',
				content: [{ op: '=', content: { field: 'ssms.consequence.transcript.transcript_id', value: [p.isoform] } }]
			},
			score: 'occurrence.case.project.project_id'
		}
		if (p.set_id) {
			if (typeof p.set_id != 'string') throw '.set_id value not string'
			f.filter.content.push({
				op: 'in',
				content: {
					field: 'cases.case_id',
					value: [p.set_id]
				}
			})
		}
		if (p.filter0) {
			f.filter.content.push(p.filter0)
		}
		return f
	}
}

/*
// REST: get list of ssm with consequence, no case info and occurrence
// isoform2ssm_getvariant and isoform2ssm_getcase are the "tandem REST api" for lollipop+summary label, which is not in use now
const isoform2ssm_getvariant = {
	endpoint: GDC_HOST + '/ssms',
	size: 100000,
	fields: [
		'ssm_id',
		'chromosome',
		'start_position',
		'reference_allele',
		'tumor_allele',
		'consequence.transcript.transcript_id',
		'consequence.transcript.consequence_type',
		'consequence.transcript.aa_change'
	],
	filters: p => {
		// p:{}
		// .isoform
		// .set_id
		if (!p.isoform) throw '.isoform missing'
		if (typeof p.isoform != 'string') throw '.isoform value not string'
		const f = {
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
		}
		if (p.set_id) {
			if (typeof p.set_id != 'string') throw '.set_id value not string'
			f.content.push({
				op: 'in',
				content: {
					field: 'cases.case_id',
					value: [p.set_id]
				}
			})
		}
		if (p.filter0) {
			f.content.push(p.filter0)
		}
		return f
	}
}

// REST: get case details for each ssm, no variant-level info
const isoform2ssm_getcase = {
	endpoint: GDC_HOST + '/ssm_occurrences',
	size: 100000,
	fields: ['ssm.ssm_id', 'case.project.project_id', 'case.case_id', 'case.primary_site', 'case.disease_type'],
	filters: p => {
		// p:{}
		// .isoform
		// .set_id
		if (!p.isoform) throw '.isoform missing'
		if (typeof p.isoform != 'string') throw '.isoform value not string'
		const f = {
			op: 'and',
			content: [
				{
					op: '=',
					content: {
						field: 'ssms.consequence.transcript.transcript_id',
						value: [p.isoform]
					}
				}
			]
		}
		if (p.set_id) {
			if (typeof p.set_id != 'string') throw '.set_id value not string'
			f.content.push({
				op: 'in',
				content: {
					field: 'cases.case_id',
					value: [p.set_id]
				}
			})
		}
		if (p.filter0) {
			f.content.push(p.filter0)
		}
		return f
	}
}
*/

// REST: get list of ssm with consequence, no case info and occurrence
// isoform2ssm_getvariant and isoform2ssm_getcase are the "tandem REST api" for lollipop+summary label, which is not in use now
const samplesummary2_getvariant = {
	endpoint: GDC_HOST + '/ssms',
	fields: ['ssm_id', 'consequence.transcript.transcript_id', 'consequence.transcript.consequence_type'],
	filters: p => {
		// p:{}
		// .isoform
		// .set_id
		if (!p.isoform) throw '.isoform missing'
		if (typeof p.isoform != 'string') throw '.isoform value not string'
		const f = {
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
		}
		if (p.set_id) {
			if (typeof p.set_id != 'string') throw '.set_id value not string'
			f.content.push({
				op: 'in',
				content: {
					field: 'cases.case_id',
					value: [p.set_id]
				}
			})
		}
		if (p.filter0) {
			f.content.push(p.filter0)
		}
		return f
	}
}
// REST: get case details for each ssm, no variant-level info
const samplesummary2_getcase = {
	endpoint: GDC_HOST + '/ssm_occurrences',
	fields: ['ssm.ssm_id', 'case.project.project_id', 'case.case_id', 'case.primary_site', 'case.disease_type'],
	filters: p => {
		// p:{}
		// .isoform
		// .set_id
		if (!p.isoform) throw '.isoform missing'
		if (typeof p.isoform != 'string') throw '.isoform value not string'
		const f = {
			op: 'and',
			content: [
				{
					op: '=',
					content: {
						field: 'ssms.consequence.transcript.transcript_id',
						value: [p.isoform]
					}
				}
			]
		}
		if (p.set_id) {
			if (typeof p.set_id != 'string') throw '.set_id value not string'
			f.content.push({
				op: 'in',
				content: {
					field: 'cases.case_id',
					value: [p.set_id]
				}
			})
		}
		if (p.filter0) {
			f.content.push(p.filter0)
		}
		return f
	}
}

/*
sampleSummaries2 first query, to get the number of categories for each sub label under track name
TODO support range query
TODO change to a list of queries to support both ssm and fusion etc
** fields are hardcoded from label1 of each ele of sampleSummaries2.lst
   no need to fix it now as it will be replaced by a query for number of cases/samples
   and only display one sub label of "xx cases" rather than two labels (projects and sites)
   then, click the "xx cases" label to show a menu to list the terms,
   click a term to show the categories and mclass breakdown (via current query)
   also UI support for selecting two terms to cross tabulate (project+disease, via current query)
*/
const isoform2casesummary = {
	endpoint: GDC_HOST + '/ssm_occurrences',
	fields: ['case.project.project_id', 'case.primary_site'],
	filters: p => {
		// p:{}
		// .isoform
		// .set_id
		if (!p.isoform) throw '.isoform missing'
		if (typeof p.isoform != 'string') throw '.isoform value not string'
		const f = {
			op: 'and',
			content: [
				{
					op: '=',
					content: {
						field: 'ssms.consequence.transcript.transcript_id',
						value: [p.isoform]
					}
				}
			]
		}
		if (p.set_id) {
			if (typeof p.set_id != 'string') throw '.set_id value not string'
			f.content.push({
				op: 'in',
				content: {
					field: 'cases.case_id',
					value: [p.set_id]
				}
			})
		}
		if (p.filter0) {
			f.content.push(p.filter0)
		}
		return f
	}
}

/*
TODO if can be done in protein_mutations
query list of variants by genomic range (of a gene/transcript)
does not include info on individual tumors
the "filter" name is hardcoded and used in app.js
*/
const query_range2variants = `query range2variants($filters: FiltersArgument) {
  explore {
    ssms {
      hits(first: 100000, filters: $filters) {
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
					  case_id
					  project {
					    project_id
					  }
					  primary_site
					  disease_type
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
	// .rglst[{chr/start/stop}]
	// .set_id
	if (!p.rglst) throw '.rglst missing'
	const r = p.rglst[0]
	if (!r) throw '.rglst[0] missing'
	if (typeof r.chr != 'string') throw '.rglst[0].chr not string'
	if (!Number.isInteger(r.start)) throw '.rglst[0].start not integer'
	if (!Number.isInteger(r.stop)) throw '.rglst[0].stop not integer'
	const f = {
		filters: {
			op: 'and',
			content: [
				{ op: '=', content: { field: 'chromosome', value: [r.chr] } },
				{ op: '>=', content: { field: 'start_position', value: [r.start] } },
				{ op: '<=', content: { field: 'end_position', value: [r.stop] } }
			]
		}
	}
	if (p.set_id) {
		if (typeof p.set_id != 'string') throw '.set_id value not string'
		f.filters.content.push({
			op: 'in',
			content: { field: 'cases.case_id', value: [p.set_id] }
		})
	}
	if (p.filter0) {
		f.filters.content.push(p.filter0)
	}
	return f
}

/*
using one ssmid, get the full list of consequences
*/
const ssmid2csq = {
	endpoint: GDC_HOST + '/ssms/',
	fields: [
		'consequence.transcript.transcript_id',
		'consequence.transcript.consequence_type',
		'consequence.transcript.aa_change'
	]
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
const variant2samples = {
	endpoint: GDC_HOST + '/ssm_occurrences',
	size: 100000,
	fields_sunburst: ['case.project.project_id', 'case.case_id', 'case.disease_type'],
	fields_summary: [
		'case.project.project_id',
		'case.case_id',
		'case.disease_type',
		'case.primary_site',
		'case.demographic.gender',
		'case.demographic.year_of_birth',
		'case.demographic.race',
		'case.demographic.ethnicity'
	],
	fields_samples: [
		'case.project.project_id',
		'case.case_id',
		'case.disease_type',
		'case.primary_site',
		'case.demographic.gender',
		'case.demographic.year_of_birth',
		'case.demographic.race',
		'case.demographic.ethnicity',
		'case.observation.read_depth.t_alt_count',
		'case.observation.read_depth.t_depth',
		'case.observation.read_depth.n_depth',
		'case.observation.sample.tumor_sample_barcode'
	],
	filters: p => {
		if (!p.ssm_id_lst) throw '.ssm_id_lst missing'
		const f = {
			op: 'and',
			content: [
				{
					op: '=',
					content: {
						field: 'ssm.ssm_id',
						value: p.ssm_id_lst.split(',')
					}
				}
			]
		}
		if (p.set_id) {
			if (typeof p.set_id != 'string') throw '.set_id value not string'
			f.content.push({
				op: 'in',
				content: {
					field: 'cases.case_id',
					value: [p.set_id]
				}
			})
		}
		if (p.filter0) {
			f.content.push(p.filter0)
		}
		if (p.tid2value) {
			for (const tid in p.tid2value) {
				let t = terms.find(i => i.id == tid)
				// Quick Fix: tid2value from sample table has term.name rather than term.id
				if (!t) t = terms.find(i => i.name == tid)
				if (t && t.type == 'categorical') {
					f.content.push({
						op: 'in',
						content: { field: 'cases.' + t.fields.join('.'), value: [p.tid2value[tid]] }
					})
				} else if (t && t.type == 'integer') {
					for (const val of p.tid2value[tid]) {
						f.content.push({
							op: val.op,
							content: { field: 'cases.' + t.fields.join('.'), value: val.range }
						})
					}
				}
			}
		}
		return f
	}
}

const ssm_occurrences_dictionary = {
	endpoint: GDC_HOST + '/ssm_occurrences/_mapping',
	mapping_prefix: 'ssm_occurrence_centrics'
}

/*
getting total cohort sizes
*/
function totalsize_filters(p) {
	// same filter maker function is shared for all terms that need to get total size
	const f = {
		filters: {
			op: 'and',
			content: [{ op: 'in', content: { field: 'cases.available_variation_data', value: ['ssm'] } }]
		}
	}
	if (p.set_id) {
		f.filters.content.push({
			op: 'in',
			content: {
				field: 'cases.case_id',
				value: [p.set_id]
			}
		})
	}
	if (p.filter0) {
		f.filters.content.push(p.filter0)
	}
	if (p.tid2value) {
		for (const tid in p.tid2value) {
			const t = terms.find(i => i.id == tid)
			if (t) {
				f.filters.content.push({
					op: 'in',
					content: { field: 'cases.' + t.fields.join('.'), value: [p.tid2value[tid]] }
				})
			}
		}
	}
	return f
}
const project_size = {
	query: ` query projectSize( $filters: FiltersArgument) {
	viewer {
		explore {
			cases {
				total: aggregations(filters: $filters) {
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
}`,
	keys: ['data', 'viewer', 'explore', 'cases', 'total', 'project__project_id', 'buckets'],
	filters: totalsize_filters
}
const disease_size = {
	query: ` query diseaseSize( $filters: FiltersArgument) {
	viewer {
		explore {
			cases {
				total: aggregations(filters: $filters) {
					disease_type {
						buckets {
							doc_count
							key
						}
					}
				}
			}
		}
	}
}`,
	keys: ['data', 'viewer', 'explore', 'cases', 'total', 'disease_type', 'buckets'],
	filters: totalsize_filters
}
const site_size = {
	query: ` query siteSize( $filters: FiltersArgument) {
	viewer {
		explore {
			cases {
				total: aggregations(filters: $filters) {
					primary_site {
						buckets {
							doc_count
							key
						}
					}
				}
			}
		}
	}
}`,
	keys: ['data', 'viewer', 'explore', 'cases', 'total', 'primary_site', 'buckets'],
	filters: totalsize_filters
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

/* not part of generic mds3 dataset
to map a SSM id to a canonical ENST name
*/
const ssm2canonicalisoform = {
	endpoint: GDC_HOST + '/ssms/',
	fields: ['consequence.transcript.is_canonical', 'consequence.transcript.transcript_id']
}

// gdc-specific logic, for converting aliquot id to sample id
// per greg: Confusingly, the tumor_sample_barcode is actually the submitter ID of the tumor aliquot for which a variant was called. If you want to display the submitter ID of the sample, you’ll have to query the GDC case API for the sample for that aliquot.
const aliquot2sample = {
	query: `query barcode($filters: FiltersArgument) {
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
	}`,
	variables: aliquotid => {
		return {
			filters: {
				op: '=',
				content: {
					// one aliquot id will match with one sample id
					field: 'samples.portions.analytes.aliquots.submitter_id',
					value: aliquotid
				}
			}
		}
	},
	get: async (aliquotid, headers) => {
		const response = await got.post(GDC_HOST + '/v0/graphql', {
			headers,
			body: JSON.stringify({ query: aliquot2sample.query, variables: aliquot2sample.variables(aliquotid) })
		})
		const d = JSON.parse(response.body)
		if (
			!d.data ||
			!d.data.repository ||
			!d.data.repository.cases ||
			!d.data.repository.cases.hits ||
			!d.data.repository.cases.hits.edges
		)
			throw 'structure not data.repository.cases.hits.edges'
		const acase = d.data.repository.cases.hits.edges[0]
		if (!acase) throw 'data.repository.cases.hits.edges[0] missing'
		if (!acase.node || !acase.node.samples || !acase.node.samples.hits || !acase.node.samples.hits.edges)
			throw 'case not .node.samples.hits.edges'
		const sample = acase.node.samples.hits.edges[0]
		if (!sample) throw 'acase.node.samples.hits.edges[0] missing'
		if (!sample.node || !sample.node.submitter_id) throw 'a sample is not node.submitter_id'
		return sample.node.submitter_id
	}
}

///////////////////////////////// end of query strings ///////////////

/*
hardcoding a flat list of terms here
any possibility of dynamically querying terms from api??
*/
const terms = [
	{
		name: 'Project',
		id: 'project',
		type: 'categorical',
		fields: ['project', 'project_id']
	},
	{
		name: 'Disease',
		id: 'disease',
		type: 'categorical',
		fields: ['disease_type']
	},
	{
		name: 'Primary site',
		id: 'primary_site',
		type: 'categorical',
		fields: ['primary_site']
	},
	{
		name: 'Gender',
		id: 'gender',
		type: 'categorical',
		fields: ['demographic', 'gender']
	},
	{
		name: 'Birth year',
		id: 'year_of_birth',
		type: 'integer',
		fields: ['demographic', 'year_of_birth'],
		unit: 'year'
	},
	{
		name: 'Race',
		id: 'race',
		type: 'categorical',
		fields: ['demographic', 'race']
	},
	{
		name: 'Ethnicity',
		id: 'ethnicity',
		type: 'categorical',
		fields: ['demographic', 'ethnicity']
	}
]

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

module.exports = {
	isMds3: true,
	genome: 'hg38',
	snvindel_attributes,
	apihost: GDC_HOST + '/v0/graphql',

	validate_filter0,

	// termdb as a generic interface
	// getters will be added to abstract the detailed implementations
	termdb: {
		terms,
		termid2totalsize: {
			// keys are term ids
			project: { gdcapi: project_size },
			disease: { gdcapi: disease_size },
			primary_site: { gdcapi: site_size }
		},
		dictionary: {
			variant2samples: { gdcapi: ssm_occurrences_dictionary }
		}
	},

	ssm2canonicalisoform,

	/* hope this can be applied to all types of variants
	but if it can only be applied to ssm, then it may be moved to queries.snvindel{}
	*/
	variant2samples: {
		variantkey: 'ssm_id', // required, tells client to return ssm_id for identifying variants
		// list of terms to show as items in detailed info page
		termidlst: ['project', 'disease', 'primary_site', 'gender', 'year_of_birth', 'race', 'ethnicity'],
		sunburst_ids: ['project', 'disease'], // term id

		// either of sample_id_key or sample_id_getter will be required for making url link for a sample
		//sample_id_key: 'case_id',
		sample_id_getter: async (d, headers) => {
			// the getter is a dataset-specific, generic feature, so it should be defined here
			// passing in headers is a gdc-specific logic for controlled data
			if (d.observation && d.observation[0].sample && d.observation[0].sample.tumor_sample_barcode) {
				return await aliquot2sample.get(d.observation[0].sample.tumor_sample_barcode, headers)
			}
			return ''
		},

		url: {
			base: 'https://portal.gdc.cancer.gov/cases/',
			// if "namekey" is provided, use the given key to obtain sample name to append to url
			// if missing, will require sample_id_key
			namekey: 'case_uuid'
		},
		gdcapi: variant2samples
	},

	// this is meant for the leftside labels under tklabel
	// should not be called sample summary but mclassSummary
	/*
	sampleSummaries: {
		lst: [
			// for a group of samples that carry certain variants
			{ label1: 'project', label2: 'disease' },
			{ label1: 'primary_site' }
		]
	},
	*/

	// query in paralell, not based on skewer data
	sampleSummaries2: {
		get_number: { gdcapi: isoform2casesummary },
		get_mclassdetail: { gdcapi: [samplesummary2_getvariant, samplesummary2_getcase] },
		lst: [{ label1: 'project', label2: 'disease' }, { label1: 'primary_site', label2: 'disease' }]
	},

	queries: {
		snvindel: {
			forTrack: true,
			url: {
				// for adding url link in variant panel
				base: 'https://portal.gdc.cancer.gov/ssms/',
				key: 'ssm_id'
			},
			byrange: {
				gdcapi: {
					query: query_range2variants,
					variables: variables_range2variants
				}
			},
			byisoform: {
				gdcapi: protein_mutations
				//{ lst: [isoform2ssm_getvariant, isoform2ssm_getcase] }
			},
			m2csq: {
				// may also support querying a vcf by chr.pos.ref.alt
				by: 'ssm_id',
				gdcapi: ssmid2csq
			}
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

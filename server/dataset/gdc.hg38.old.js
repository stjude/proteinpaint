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

	// query in paralell, not based on skewer data
	sampleSummaries2: {
		get_number: { gdcapi: isoform2casesummary },
		get_mclassdetail: { gdcapi: [samplesummary2_getvariant, samplesummary2_getcase] },
		lst: [{ label1: 'project_id', label2: 'disease_type' }, { label1: 'primary_site', label2: 'disease_type' }]
	},
	*/

/* gene-level cnv is no longer supported
		to delete all corresponding code later
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
		*/

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

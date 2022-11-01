const got = require('got')

/*
validate_filter0
isoform2ssm_getvariant
isoform2ssm_getcase
query_range2variants
variables_range2variants
variant2samplesGdcapi
termTotalSizeGdcapi
	termid2size_query
	termid2size_filters
ssm2canonicalisoform
sample_id_getter
	aliquot2sample
*/

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

/*
REST: get list of ssm with consequence, no case info and occurrence
isoform2ssm_getvariant and isoform2ssm_getcase are the "tandem REST api"
yields list of ssm, each with .samples[{sample_id}]
can use .samples[] to derive .occurrence for each ssm, and overal number of unique samples

in comparison to "protein_mutations" graphql query
*/
const isoform2ssm_getvariant = {
	endpoint: '/ssms',
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
	endpoint: '/ssm_occurrences',
	size: 100000,
	fields: [
		'ssm.ssm_id',
		'case.case_id', // can be used to make sample url link
		'case.observation.sample.tumor_sample_uuid' // gives aliquot id and convert to submitter id for display
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
this is gdc api-specific implementation

query by variants or isoform(s):
- a list of variants, get samples harboring the variants
- an isoform, get samples harboring any variant of the isoform

variant2samples intends to be a generic mechanism for fetching tumors harboring a variant
same name attribute will be exposed to client

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
const variant2samplesGdcapi = {
	endpoint: '/ssm_occurrences',

	filters: (p, ds) => {
		const f = { op: 'and', content: [] }
		if (p.ssm_id_lst) {
			f.content.push({
				op: '=',
				content: {
					field: 'ssm.ssm_id',
					value: p.ssm_id_lst.split(',')
				}
			})
		} else if (p.isoform) {
			// note purpose!!
			if (typeof p.isoform != 'string') throw 'p.isoform is not string'
			f.content.push({
				op: '=',
				content: {
					field: 'ssms.consequence.transcript.transcript_id',
					value: [p.isoform]
				}
			})
		} else if (p.isoforms) {
			let value
			if (Array.isArray(p.isoforms)) value = p.isoforms
			else if (typeof p.isoforms == 'string') value = p.isoforms.split(',')
			else throw 'p.isoforms not array or string'
			f.content.push({
				op: 'in',
				content: { field: 'ssms.consequence.transcript.transcript_id', value }
			})
		} else {
			throw '.ssm_id_lst, .isoform, .isoforms are all missing'
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
			for (const termid in p.tid2value) {
				const t = ds.cohort.termdb.q.termjsonByOneid(termid)
				if (!t) continue
				if (t.type == 'categorical') {
					f.content.push({
						op: 'in',
						content: { field: termid, value: [p.tid2value[termid]] }
					})
				} else if (t.type == 'integer') {
					for (const val of p.tid2value[termid]) {
						f.content.push({
							op: val.op,
							content: { field: termid, value: val.range }
						})
					}
				}
			}
		}
		return f
	}
}

/*
argument is array, each element: {type, id}

for term id of 'case.project.project_id', convert to "project__project_id", for graphql
*/
function termid2size_query(termlst) {
	const lst = []
	for (const term of termlst) {
		if (!term.id) continue
		if ((term.type = 'categorical')) {
			lst.push(term.path + ' {buckets { doc_count, key }}')
		} else if (term.type == 'integer' || term.type == 'float') {
			lst.push(term.path + ' {stats { count }}')
		} else {
			throw 'unknown term type'
		}
	}

	// for all terms from termidlst will be added to single query
	const query = `query termislst2total( $filters: FiltersArgument) {
		explore {
			cases {
				aggregations (filters: $filters, aggregations_filter_themselves: true) {
					${lst.join('\n')}
				}
			}
		}
	}`
	return query
}

function termid2size_filters(p, ds) {
	const f = {
		filters: {
			op: 'and',
			content: [{ op: 'in', content: { field: 'cases.available_variation_data', value: ['ssm'] } }]
		}
	}

	if (p && p.tid2value) {
		for (const termid in p.tid2value) {
			const t = ds.cohort.termdb.q.termjsonByOneid(termid)
			if (t) {
				f.filters.content.push({
					op: 'in',
					content: {
						/*********************
						extremely tricky, no explanation
						**********************
						term id all starts with "case.**"
						but in this graphql query, fields must start with "cases.**"
						*/
						field: termid.replace(/^case\./, 'cases.'),
						value: [p.tid2value[termid]]
					}
				})
			}
		}
	}

	if (p && p.ssm_id_lst) {
		f.filters.content.push({
			op: '=',
			content: { field: 'cases.gene.ssm.ssm_id', value: p.ssm_id_lst.split(',') }
		})
	}
	//console.log(JSON.stringify(f,null,2))
	return f
}

const termTotalSizeGdcapi = {
	query: termid2size_query,
	keys: ['data', 'explore', 'cases', 'aggregations'],
	filters: termid2size_filters
}

/* not part of generic mds3 dataset
to map a SSM id to a canonical ENST name
*/
const ssm2canonicalisoform = {
	endpoint: GDC_HOST + '/ssms/',
	fields: ['consequence.transcript.is_canonical', 'consequence.transcript.transcript_id']
}

const aliquot2sample = {
	getMatch: (sample, aliquotSet) => {
		// for a sample, decide if it contains an aliquot in given list
		// if true, return matching aliquot id; otherwise return undefined
		if (!sample.portions) return
		for (const portion of sample.portions) {
			if (!portion.analytes) continue
			for (const analyte of portion.analytes) {
				if (!analyte.aliquots) continue
				for (const a of analyte.aliquots) {
					if (aliquotSet.has(a.aliquot_id)) return a.aliquot_id
				}
			}
		}
	},

	cache: new Map(),
	// k: aliquot id, v: submitter id

	get: async (aliquotidLst, headers) => {
		// TODO check cache

		const filters = {
			op: 'and',
			content: [
				{
					op: '=',
					content: {
						field: 'samples.portions.analytes.aliquots.aliquot_id',
						value: aliquotidLst.length > 300 ? aliquotidLst.slice(0, 300) : aliquotidLst
					}
				}
			]
		}

		const response = await got.post(GDC_HOST + '/cases', {
			headers,
			body: JSON.stringify({
				size: 10000,
				fields: 'samples.submitter_id,samples.portions.analytes.aliquots.aliquot_id',
				filters
			})
		})

		const aliquotSet = new Set(aliquotidLst)
		const idmap = new Map() // k: input id, v: output id

		const re = JSON.parse(response.body)

		for (const h of re.data.hits) {
			for (const sample of h.samples) {
				const matchingAliquot = aliquot2sample.getMatch(sample, aliquotSet)

				if (matchingAliquot) {
					// has a match
					idmap.set(matchingAliquot, sample.submitter_id)
				}
			}
		}
		return idmap
	}
}

async function sample_id_getter(samples, headers) {
	/*
	samples[], each element:

		{
			tumor_sample_uuid: str,
			sample_id: str
		}

	the "tumor_sample_uuid" is the aliquot id
	it will be converted to sample submitter id *in place*
	resulting submitter id is assigned to "sample_id"

	the use of "tumor_sample_uuid" key is arbitrary logic in gdc and should not impact mds3
	if tumor_sample_uuid is not present, the "sample_id" value will not be assigned

	fire one query to convert id of all samples
	the getter is a dataset-specific, generic feature, so it should be defined here
	passing in headers is a gdc-specific logic for controlled data
	*/
	const id2sample = new Map()
	// k: aliquot id
	// v: list of sample objects that are using the same aliquot id
	for (const sample of samples) {
		const n = sample.tumor_sample_uuid
		if (n) {
			if (!id2sample.has(n)) id2sample.set(n, [])
			id2sample.get(n).push(sample)
		}
	}

	if (id2sample.size == 0) {
		// no applicable sample id to map
		// possible when query didn't ask for sample name
		return
	}

	const idmap = await aliquot2sample.get([...id2sample.keys()], headers)

	for (const [id, sampleLst] of id2sample) {
		for (const s of sampleLst) {
			s.sample_id = idmap.get(id) || id
		}
	}
}

///////////////////////////////// end of query strings ///////////////

// mds3 hardcodes to use .sample_id to dedup samples

module.exports = {
	isMds3: true,
	genome: 'hg38',
	apihost: GDC_HOST + '/v0/graphql',

	validate_filter0,

	// termdb as a generic interface
	// getters will be added to abstract the detailed implementations
	termdb: {
		// quick fix to convert category values from a term to lower cases for comparison
		// as different api returns case-mismatching strings for the same category Breast/breast
		// need example
		useLower: true,

		// for each term from an input list, get total sizes for each category
		// used for sunburst and summary
		termid2totalsize2: {
			gdcapi: termTotalSizeGdcapi
		},

		dictionary: {
			// runs termdb.gdc.js to init gdc dictionary
			// create standard helpers at ds.cohort.termdb.q{}
			gdcapi: true
		},

		// pending
		allowCaseDetails: {
			sample_id_key: 'case_uuid',
			terms: ['case.diagnoses']
		}
	},

	ssm2canonicalisoform,

	/* hope this can be applied to all types of variants
	but if it can only be applied to ssm, then it may be moved to queries.snvindel{}
	*/
	variant2samples: {
		variantkey: 'ssm_id', // required, tells client to return ssm_id for identifying variants

		//////////////////////////////
		// termidlst and sunburst_ids are sent to client as default lists for different purposes
		// subject to user-customization there, and sent back via request arg for computing
		// not to be used on server-side!

		// list of term ids as sample details
		twLst: [
			{ id: 'case.disease_type', q: {} },
			{ id: 'case.primary_site', q: {} },
			{ id: 'case.project.project_id', q: {} },
			{ id: 'case.demographic.gender', q: {} },
			//'case.diagnoses.age_at_diagnosis',
			//'case.diagnoses.treatments.therapeutic_agents',
			{ id: 'case.demographic.race', q: {} },
			{ id: 'case.demographic.ethnicity', q: {} }
		],

		// small list of terms for sunburst rings
		sunburst_twLst: [{ id: 'case.disease_type', q: {} }, { id: 'case.primary_site', q: {} }],

		//////////////////////////////
		// optional extra terms to append to client-provided term ids when get='samples'
		// not to send to client but secretly used in backend computing
		extra_termids_samples: [
			'ssm.ssm_id',
			'case.case_id',
			'case.observation.read_depth.t_alt_count',
			'case.observation.read_depth.t_depth',
			'case.observation.read_depth.n_depth',
			'case.observation.sample.tumor_sample_uuid'
		],

		// quick fix: flag to indicate availability of these fields, so as to create new columns in sample table
		sampleHasSsmReadDepth: true, // corresponds to .ssm_read_depth{} of a sample
		sampleHasSsmTotalNormal: true, // corresponds to .totalNormal:int of a sample

		// either of sample_id_key or sample_id_getter will be required for making url link for a sample
		//sample_id_key: 'case_id',
		sample_id_getter,

		url: {
			base: 'https://portal.gdc.cancer.gov/cases/',
			// if "namekey" is provided, use the given key to obtain sample name to append to url
			// if missing, will require sample_id_key
			namekey: 'sample_URLid'
		},
		gdcapi: variant2samplesGdcapi
	},

	queries: {
		snvindel: {
			forTrack: true,
			variantUrl: {
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
				// tandem rest api method
				gdcapi: {
					query1: isoform2ssm_getvariant,
					query2: isoform2ssm_getcase
				}

				/* 
				graphql method *not in use*, as former returns list of samples
				and easier to summarize
				gdcapi: protein_mutations
				*/
			},
			m2csq: {
				// may also support querying a vcf by chr.pos.ref.alt
				by: 'ssm_id',
				gdcapi: ssmid2csq
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

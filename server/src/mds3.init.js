const gdc = require('./mds3.gdc')
const { initGDCdictionary } = require('./termdb.gdc')
const { variant2samples_getresult } = require('./mds3.variant2samples')
const utils = require('./utils')
const compute_mclass = require('./termdb.snp').compute_mclass
const path = require('path')
const serverconfig = require('./serverconfig')

/*
********************** EXPORTED
init
client_copy
snvindelVcfByRangeGetter
mayAddSamplesFromVcfLine
********************** INTERNAL
*/

// in case chr name may contain '.', can change to __
export const ssmIdFieldsSeparator = '.'

export async function init(ds, genome, _servconfig) {
	if (!ds.queries) throw 'ds.queries{} missing'
	// must validate termdb first
	await validate_termdb(ds)
	// must validate snvindel query before variant2sample
	// as vcf header must be parsed to supply samples for v2s
	await validate_query_snvindel(ds, genome)
	validate_variant2samples(ds)
	validate_ssm2canonicalisoform(ds)

	may_add_refseq2ensembl(ds, genome)
}

export function client_copy(ds) {
	/* make client copy of the ds
	to be stored at genome.datasets
*/
	const ds2 = {
		isMds3: true,
		label: ds.label,
		queries: copy_queries(ds)
	}

	if (ds.termdb) {
		ds2.termdb = {}
		// if using flat list of terms, do not send terms[] to client
		// as this is official ds, and client will create vocabApi
		// to query /termdb server route with standard methods
		if (ds.termdb.allowCaseDetails) {
			ds2.termdb.allowCaseDetails = {
				sample_id_key: ds.termdb.allowCaseDetails.sample_id_key // optional key
			}
		}
	}
	if (ds.queries.snvindel) {
		ds2.has_skewer = true
	}
	if (ds.variant2samples) {
		const v = ds.variant2samples
		ds2.variant2samples = {
			sunburst_ids: v.sunburst_ids,
			termidlst: v.termidlst,
			type_samples: v.type_samples,
			type_summary: v.type_summary,
			type_sunburst: v.type_sunburst,
			url: v.url,
			variantkey: v.variantkey
		}
	}
	return ds2
}

async function validate_termdb(ds) {
	const tdb = ds.termdb
	if (!tdb) return

	////////////////////////////////////////
	// ds.cohort.termdb{} is created to be compatible with termdb.js
	ds.cohort = {}
	ds.cohort.termdb = {}

	if (tdb.dictionary) {
		if (tdb.dictionary.gdcapi) {
			await initGDCdictionary(ds)
		} else {
			throw 'unknown method to initiate dictionary'
		}
	} else if (tdb.terms) {
		// flat list of terms
		for (const t of tdb.terms) {
			if (!t.id) throw 'id missing from a term'
			if (!t.fields) throw '.fields[] missing from a term'
			if (!Array.isArray(t.fields)) throw '.fields[] not an array'
		}
	} else {
		throw 'unknown source of termdb vocabulary'
	}

	if (tdb.termid2totalsize2) {
		if (tdb.termid2totalsize2.gdcapi) {
			// validate gdcapi
			const gdcapi = tdb.termid2totalsize2.gdcapi
			if (typeof gdcapi.query != 'function') throw '.query() not function in termid2totalsize2'
			if (!gdcapi.keys && !gdcapi.keys.length) throw 'termid2totalsize2 missing keys[]'
			if (typeof gdcapi.filters != 'function') throw '.filters is not in termid2totalsize2'
		} else {
			throw 'unknown method for termid2totalsize2'
		}

		/* add getter
		input:
			termidlst=[ id1, ...]
			q={}
				.tid2value={id1:v1, ...}
				.ssm_id_lst=str
			combination={}
				optional,
		output:
			a map, key is termid, value is array, each element: [category, total]
		*/
		tdb.termid2totalsize2.get = async (termidlst, q = {}, combination = null) => {
			if (tdb.termid2totalsize2.gdcapi) {
				return await gdc.get_termlst2size(termidlst, q, combination, ds)
			}
			throw 'unknown method for termid2totalsize2'
		}
	}
}

function validate_variant2samples(ds) {
	const vs = ds.variant2samples
	if (!vs) return
	vs.type_samples = 'samples'
	vs.type_sunburst = 'sunburst'
	vs.type_summary = 'summary'
	if (!vs.variantkey) throw '.variantkey missing from variant2samples'
	if (['ssm_id'].indexOf(vs.variantkey) == -1) throw 'invalid value of variantkey'
	if (vs.termidlst) {
		if (!Array.isArray(vs.termidlst)) throw 'variant2samples.termidlst[] is not array'
		if (vs.termidlst.length == 0) throw '.termidlst[] empty array from variant2samples'
		if (!ds.termdb) throw 'ds.termdb missing when variant2samples.termidlst is in use'
		for (const id of vs.termidlst) {
			if (!ds.cohort.termdb.q.termjsonByOneid(id)) throw 'term not found for an id of variant2samples.termidlst: ' + id
		}
	}

	if (vs.sunburst_ids) {
		if (!Array.isArray(vs.sunburst_ids)) throw '.sunburst_ids[] not array from variant2samples'
		if (vs.sunburst_ids.length == 0) throw '.sunburst_ids[] empty array from variant2samples'
		if (!ds.termdb) throw 'ds.termdb missing when variant2samples.sunburst_ids is in use'
		for (const id of vs.sunburst_ids) {
			if (!ds.cohort.termdb.q.termjsonByOneid(id)) throw 'term not found for an id of variant2samples.sunburst_ids: ' + id
		}
	}

	if (vs.gdcapi) {
		gdc.validate_variant2sample(vs.gdcapi)
	} else {
		// look for server-side vcf/bcf/tabix file
		// file header should already been parsed and samples obtain if any
		let hasSamples = false
		if(ds.queries.snvindel) {
			// has snvindel
			if(ds.queries.snvindel.byrange) {
				if(ds.queries.snvindel.byrange._tk) {
					if(ds.queries.snvindel.byrange._tk.samples) {
						// this file has samples
						hasSamples=true
					}
				}
			}
			// expand later
		}
		if(!hasSamples) throw 'cannot find a sample source from ds.queries{}'
	}

	vs.get = async q => {
		return await variant2samples_getresult(q, ds)
	}

	if (vs.url) {
		if (!vs.url.base) throw '.variant2samples.url.base missing'

		if (vs.sample_id_key) {
			// has a way to get sample name
		} else if (vs.sample_id_getter) {
			if (typeof vs.sample_id_getter != 'function') throw '.sample_id_getter is not function'
			// has a way to get sample name
		} else {
			throw 'both .sample_id_key and .sample_id_getter are missing while .variant2samples.url is used'
		}
	}
}

function copy_queries(ds) {
	const copy = {}
	if (ds.queries.snvindel) {
		copy.snvindel = {
			forTrack: ds.queries.snvindel.forTrack,
			url: ds.queries.snvindel.url
		}
		if (ds.queries.snvindel.m2csq) {
			copy.snvindel.m2csq = { by: ds.queries.snvindel.m2csq.by }
		}
	}
	// new query
	return copy
}

function sort_mclass(set) {
	const lst = []
	for (const [c, s] of set) {
		lst.push([c, s.size])
	}
	lst.sort((i, j) => j[1] - i[1])
	return lst
}

async function validate_query_snvindel(ds, genome) {
	const q = ds.queries.snvindel
	if (!q) return
	if (q.url) {
		if (!q.url.base) throw '.snvindel.url.base missing'
		if (!q.url.key) throw '.snvindel.url.key missing'
	}
	if (q.byrange) {
		if (q.byrange.gdcapi) {
			gdc.validate_query_snvindel_byrange(ds)
		} else if (q.byrange.vcffile) {
			q.byrange.vcffile = path.join(serverconfig.tpmasterdir, q.byrange.vcffile)
			q.byrange._tk = { file: q.byrange.vcffile }
			q.byrange.get = await snvindelVcfByRangeGetter(ds, genome)
		} else {
			throw 'unknown query method for queries.snvindel.byrange'
		}
	}

	if (q.byisoform) {
		if (q.byisoform.gdcapi) {
			//gdc.validate_query_snvindel_byisoform(ds) // tandem rest apis
			gdc.validate_query_snvindel_byisoform(ds)
		} else {
			throw 'unknown query method for queries.snvindel.byisoform'
		}
	}

	if (q.m2csq) {
		if (!q.m2csq.by) throw '.by missing from queries.snvindel.m2csq'
		if (q.m2csq.by != 'ssm_id') throw 'unknown value of queries.snvindel.m2csq.by' // add additional
		if (q.m2csq.gdcapi) {
			gdc.validate_m2csq(ds)
			// added q.m2csq.get()
		} else {
			throw 'unknown query method for queries.snvindel.m2csq'
		}
	}
}

function validate_ssm2canonicalisoform(ds) {
	// gdc-specific logic
	if (!ds.ssm2canonicalisoform) return
	gdc.validate_ssm2canonicalisoform(ds.ssm2canonicalisoform) // add get()
}

/* if genome allows converting refseq/ensembl
add a convertor in ds to map refseq to ensembl
this is required for gdc dataset
so that gencode-annotated stuff can show under a refseq name
*/
function may_add_refseq2ensembl(ds, genome) {
	if (!genome.genedb.refseq2ensembl) return
	ds.refseq2ensembl_query = genome.genedb.db.prepare('select ensembl from refseq2ensembl where refseq=?')
}

/* generate getter as ds.queries.snvindel.byrange.get()

usage scenario:
1. to initiate official dataset
2. to make temp ds{} on the fly when querying a custom track

get(param{}):
.rglst=[ {chr, start, stop} ]

returns array of variants
*/
export async function snvindelVcfByRangeGetter(ds, genome) {
	const q = ds.queries.snvindel.byrange
	/* q{}
	._tk={}
		.file=str
		.url, .indexURL
		.dir=str
		.nochr=true
		.indexURL
		.info={}
		.format={
			ID: {
				ID: 'dna_assay',
				Number: '1',
				Type: 'String',
				Description: '...'
	  		}
		}
		.samples=[ {name:str}, ... ] // blank array if vcf has no samples
	.
	*/
	await utils.init_one_vcf(q._tk, genome)
	// tk{ dir, info, format, samples, nochr }
	if (q._tk.samples.length && !q._tk.format) {
		throw 'vcf file has samples but no FORMAT'
	}
	if(q._tk.format) {
		for(const id in q._tk.format) {
			if(id=='GT') {
				q._tk.format.isGT = true
			}
		}
	}

	return async param => {
		const variants = [] // to be returned
		for (const r of param.rglst) {
			await utils.get_lines_bigfile({
				args: [
					q._tk.file || q._tk.url,
					(q._tk.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop
				],
				dir: q._tk.dir,
				callback: line => {
					const l = line.split('\t')
					// [9] for samples
					const refallele = l[3]
					const altalleles = l[4].split(',')
					const m0 = {} // temp obj
					compute_mclass(
						q._tk,
						refallele,
						altalleles,
						m0,
						l[7], // info str
						l[2] // vcf line ID
					)
					// make a m{} for every alt allele
					for (const alt in m0.alt2csq) {
						const m = m0.alt2csq[alt]
						m.chr = r.chr
						m.pos = Number(l[1])
						m.ssm_id = [m.chr, m.pos, m.ref, m.alt].join(ssmIdFieldsSeparator)
						variants.push(m)
						mayAddSamplesFromVcfLine(q, m, l)
					}
				}
			})
		}
		return variants
	}
}

/* tentative, subject to change

usage:
call at snvindel.byrange.get() to assign .samples[] to each m for counting total number of unique samples
call at variant2samples.get() to get list of samples

parameters:
q={}
	q._tk{}
		.samples=[ {name=str}, ... ] // list of samples corresponding to vcf header
		.format={}
m={}
	m.samples=[] will be created if any are found
l=[]
	list of fields from a vcf line, corresponding to m{}
addFormatValues=true
	if true, k:v for format fields are added to each sample of m.samples[]
	set to false for counting samples, or doing sample summary
*/
export function mayAddSamplesFromVcfLine(q, m, l, addFormatValues) {
	if (!q._tk.samples || q._tk.samples.length == 0) {
		// vcf file has no samples
		return
	}
	// l[8] is FORMAT, l[9] is first sample
	if (!l[8] || l[8] == '.') {
		// no format field
		return
	}
	const formatlst = [] // list of format object from q._tk.format{}, by the order of l[8]
	for (const s of l[8].split(':')) {
		const f = q._tk.format[s]
		if (f) {
			// a valid format field
			formatlst.push(f)
		} else {
			throw 'invalid format field: ' + f
		}
	}
	const samples = []
	for (const [i, sampleHeaderObj] of q._tk.samples.entries()) {
		const v = l[i + 9]
		if (!v || v == '.') {
			// no value for this sample
			continue
		}
		const vlst = v.split(':')
		const sampleObj = vcfFormat2sample(vlst, formatlst, sampleHeaderObj, addFormatValues)
		if(sampleObj) {
			// this sample is annotated with this variant
			samples.push(sampleObj)
		}
	}
	if (samples.length) m.samples = samples
}

function vcfFormat2sample(vlst, formatlst, sampleHeaderObj, addFormatValues) {
	const sampleObj = {
		sample_id: sampleHeaderObj.name
	}
	for (const [j, format] of formatlst.entries()) {
		const fv = vlst[j] // value for this format field
		if (!fv || fv == '.') {
			// no value for this format field
			continue
		}
		if (format.isGT) {
			if (fv == './.' || fv == '.|.') {
				// no gt
				continue
			}
			// has gt value
			if(addFormatValues) {
				sampleObj.GT = fv
			} else {
				// no need to add any format fields, only need to return sample id for counting
				return sampleObj
			}
		} else {
			/* has value for a non-GT field
			indicating the variant is annotated to this sample
			irrespective of what this format field is
			later may check by meanings of each format field
			*/
			if(addFormatValues) {
				sampleObj[format.ID] = fv
			} else {
				// no need to add field, just return
				return sampleObj
			}
		}
	}
	if(Object.keys(sampleObj).length==1) {
		return null
	}
	return sampleObj
}

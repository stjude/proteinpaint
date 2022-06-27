const gdc = require('./mds3.gdc')
const fs = require('fs')
const path = require('path')
const { initGDCdictionary } = require('./termdb.gdc')
const { variant2samples_getresult } = require('./mds3.variant2samples')
const utils = require('./utils')
const compute_mclass = require('./termdb.snp').compute_mclass
const serverconfig = require('./serverconfig')
const { dtfusionrna, dtsv, mclassfusionrna, mclasssv } = require('../shared/common')
const { server_init_db_queries } = require('./termdb.sql')
const { makeTempSqliteDb } = require('./tempdb')

/*
********************** EXPORTED
init
client_copy
	copy_queries
********************** INTERNAL
validate_termdb
	initTermdb_termsAndFile
		loadAnnotationFile
validate_query_snvindel
	snvindelByRangeGetter_bcf
		mayLimitSamples
		addSamplesFromBcfLine
			vcfFormat2sample
validate_query_svfusion
	svfusionByRangeGetter_file
validate_variant2samples
*/

// in case chr name may contain '.', can change to __
export const ssmIdFieldsSeparator = '.'

export async function init(ds, genome, _servconfig) {
	if (!ds.queries) throw 'ds.queries{} missing'
	// must validate termdb first
	await validate_termdb(ds)

	// must validate snvindel query before variant2sample
	// as vcf header must be parsed to supply samples for variant2samples
	await validate_query_snvindel(ds, genome)
	await validate_query_svfusion(ds, genome)

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
		// array of terms, directly coded up in js file
		// also need tdb.annotationFile
		await initTermdb_termsAndFile(ds)
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

async function initTermdb_termsAndFile(ds) {
	/* requires ds.termdb.terms[],
	and ds.termdb.annotationFile = 'path to server-side tabular text file of sample annotation for these terms'
	generate termdb api methods at ds.cohort.termdb.q{}

	file:
	sample \t term1 \t term2 \t ...
	aaa    \t v1    \t v2    \t ...
	bbb    \t v3    \t v4    \t ...

	1. first line must be header, each field is term id
	2. first column must be sample id
	*/
	const terms = ds.termdb.terms
	for (const t of terms) {
		if (!t.id) throw 'id missing from a term'
		if (!t.name) t.name = t.id
		if (t.type == 'categorical') {
			if (!t.values) {
				// while reading file, missing categories are filled into values{}
				t.values = {}
			}
		} else if (t.type == 'integer' || t.type == 'float') {
		} else {
			throw 'invalid term type of ' + t.id
		}
	}
	if (!ds.termdb.annotationFile) throw 'termdb.annotationFile missing when .terms[] used'
	const annotationFile = path.join(serverconfig.tpmasterdir, ds.termdb.annotationFile)

	const annotations = await loadAnnotationFile(annotationFile, ds)
	// map{}, k: sample id
	// v: map{}, k: term id, v: value

	// to on-the-fly create sqlite db file at this location
	const dbfile = annotationFile + '.db'
	makeTempSqliteDb({ terms, annotations, dbfile })
	// sqlite db is created

	ds.cohort.db = { file_fullpath: dbfile }
	server_init_db_queries(ds)
	// ds.cohort.termdb.q{} initiated
}

async function loadAnnotationFile(file, ds) {
	const lines = (await fs.promises.readFile(file, { encoding: 'utf8' })).trim().split('\n')
	const hterms = [] // array of term objs by order of file columns
	const headerfields = lines[0].split('\t')
	for (let i = 1; i < headerfields.length; i++) {
		const tid = headerfields[i]
		if (!tid) throw `blank field at column ${i + 1} in file header`
		const t = ds.termdb.terms.find(j => j.id == tid)
		if (!t) throw `header field is not a term id: ${tid}`
		hterms.push(t)
	}

	const annotations = new Map()
	// k: sample id
	// v: map{}, k: term id, v: value

	for (let i = 1; i < lines.length; i++) {
		const l = lines[i].split('\t')
		const sample_id = l[0]
		if (!sample_id) throw `blank sample id at line ${i + 1}`
		if (annotations.has(sample_id)) throw `duplicate sample id: ${sample_id}`
		annotations.set(sample_id, new Map())
		for (const [j, term] of hterms.entries()) {
			const v = l[j + 1]
			if (!v) {
				// blank, no value for this term
				continue
			}
			if (term.type == 'categorical') {
				annotations.get(sample_id).set(term.id, v)
				if (!(v in term.values)) {
					// auto add
					term.values[v] = { label: v }
				}
			} else if (term.type == 'float') {
				const n = Number(v)
				if (Number.isNaN(n)) throw `value=${v} not number for type=float, term=${term.id}, line=${i + 1}`
				annotations.get(sample_id).set(term.id, n)
			} else if (term.type == 'integer') {
				const n = Number(v)
				if (Number.isInteger(n)) throw `value=${v} not integer for type=integer, term=${term.id}, line=${i + 1}`
				annotations.get(sample_id).set(term.id, n)
			} else {
				throw 'unknown term type'
			}
		}
	}
	return annotations
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
			if (!ds.cohort.termdb.q.termjsonByOneid(id))
				throw 'term not found for an id of variant2samples.sunburst_ids: ' + id
		}
	}

	if (vs.gdcapi) {
		gdc.validate_variant2sample(vs.gdcapi)
	} else {
		// look for server-side vcf/bcf/tabix file
		// file header should already been parsed and samples obtain if any
		let hasSamples = false
		if (ds.queries.snvindel) {
			// has snvindel
			if (ds.queries.snvindel.byrange) {
				if (ds.queries.snvindel.byrange._tk) {
					if (ds.queries.snvindel.byrange._tk.samples) {
						// this file has samples
						hasSamples = true
					}
				}
			}
			// expand later
		}
		if (!hasSamples) throw 'cannot find a sample source from ds.queries{}'
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

	if (!q.byisoform && !q.byrange) throw 'byisoform and byrange are both missing on queries.snvindel'
	if (q.byrange) {
		if (q.byrange.gdcapi) {
			gdc.validate_query_snvindel_byrange(ds)
			// q.byrange.get() added
		} else if (q.byrange.bcffile) {
			q.byrange.bcffile = path.join(serverconfig.tpmasterdir, q.byrange.bcffile)
			q.byrange._tk = { file: q.byrange.bcffile }
			q.byrange.get = await snvindelByRangeGetter_bcf(ds, genome)
			console.log(q.byrange._tk.samples.length, 'samples from snvindel.byrange.bcffile of ' + ds.label)
		} else {
			throw 'unknown query method for queries.snvindel.byrange'
		}
	}

	if (q.byisoform) {
		if (q.byisoform.gdcapi) {
			gdc.validate_query_snvindel_byisoform(ds)
			// q.byisoform.get() added
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

called at two places:
1. to initiate official dataset, in this script
2. to make temp ds{} on the fly when querying a custom track, in mds3.load.js

getter input:
.rglst=[ {chr, start, stop} ] (required)
.tid2value = { termid1:v1, termid2:v2, ...} (optional, to restrict samples)

getter returns:
array of variants
if samples are available, attaches array of sample ids to each variant
as .samples=[ {sample_id} ]
TODO change to bcf
*/
export async function snvindelByRangeGetter_bcf(ds, genome) {
	const q = ds.queries.snvindel.byrange
	/* q{}
	._tk={}
		.file= absolute path to bcf file
		.url, .indexURL
		.dir=str
		.nochr=true
		.indexURL
		.info={}
			<ID>: {}
				ID: 'CSQ',
				Number: '.',
				Type: 'String',
				Description: 'Cons
		.format={} // null if no format
			<ID>: {}
				ID: 'dna_assay',
				Number: '1',
				Type: 'String',
				Description: '...'
		.samples=[ {name:str}, ... ] // blank array if vcf has no samples
	.
	*/

	await utils.init_one_vcf(q._tk, genome, true) // "true" to indicate file is bcf but not vcf

	if (q._tk.samples.length > 0 && !q._tk.format) throw 'bcf file has samples but no FORMAT'
	if (q._tk.format && q._tk.samples.length == 0) throw 'bcf file has FORMAT but no samples'
	if (q._tk.format) {
		for (const id in q._tk.format) {
			if (id == 'GT') {
				// may not need with bcftools
				q._tk.format.isGT = true
			}
		}
	}

	return async param => {
		if (!Array.isArray(param.rglst)) throw 'q.rglst[] is not array'
		if (param.rglst.length == 0) throw 'q.rglst[] blank array'

		const bcfArgs = [
			'query',
			q._tk.file || q._tk.url,
			'-r',
			// plus 1 to stop, as rglst pos is 0-based, and bcf is 1-based
			param.rglst
				.map(r => (q._tk.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + (r.stop + 1))
				.join(','),
			'-f',
			'%ID\t%CHROM\t%POS\t%REF\t%ALT\t%INFO\t%FORMAT\n'
		]

		const limitSamples = mayLimitSamples(param, q._tk.samples, ds)
		if (limitSamples) {
			bcfArgs.push('-s', limitSamples.map(i => i.name).join(','))
		}

		const variants = []

		await utils.get_lines_bigfile({
			isbcf: true,
			args: bcfArgs,
			dir: q._tk.dir,
			callback: line => {
				const l = line.split('\t')
				const id = l[0],
					chr = l[1],
					pos = Number(l[2]),
					refallele = l[3],
					altalleles = l[4].split(','),
					infoStr = l[5]
				// [6] is format fields, [7 and on] for samples

				const m0 = {} // temp obj, modified by compute_mclass()
				compute_mclass(q._tk, refallele, altalleles, m0, infoStr, id)
				// make a m{} for every alt allele
				for (const alt in m0.alt2csq) {
					const m = m0.alt2csq[alt]
					m.chr = (q._tk.nochr ? 'chr' : '') + chr
					m.pos = pos - 1 // bcf pos is 1-based, return 0-based
					m.ssm_id = [m.chr, m.pos, m.ref, m.alt].join(ssmIdFieldsSeparator)

					if (q._tk.samples && q._tk.samples.length) {
						/* vcf file has sample, must find out samples harboring this variant
						TODO determine when to set addFormatValues=true
						so to attach format fields to each sample
						*/
						addSamplesFromBcfLine(q, m, l, false, ds, limitSamples)
						if (!m.samples) {
							// no sample found for this variant, when vcf has samples
							// can be due to sample filtering, thus must skip this variant
							continue
						}
					}

					// acceptable variant
					variants.push(m)
				}
			}
		})
		return variants
	}
}

/*
input:
param={}
	.tid2value = { term1id: v1, term2id:v2, ... }
	if present, return list of samples matching the given k/v pairs, assuming AND
	later to replace with filter
allSamples = [ {name}, ... ] array of parsed samples e.g. from a bcf file header
ds={}

output:
array of {name}, same elements from allSamples, null if not filtering
*/
function mayLimitSamples(param, allSamples, ds) {
	if (!allSamples || allSamples.length == 0) return null // no samples from this bcf file
	if (!param.tid2value) return null // no limit, use all samples
	if (typeof param.tid2value != 'object') throw 'q.tid2value{} not object'
	const limitSamples = []
	for (const s of allSamples) {
		let skip = false
		for (const tid in param.tid2value) {
			const v = ds.cohort.termdb.q.getSample2value(tid, s.name)
			if (!v[0] || (v[0] && v[0].value != param.tid2value[tid])) {
				skip = true
				break
			}
		}
		if (skip) continue
		limitSamples.push(s)
	}
	return limitSamples
}

/* 
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
ds={}
	the server-side dataset obj
limitSamples=[ {name} ]
	if bcf query is limiting on this sample set. if so the output is only based on these samples
	otherwise output will have all samples from the bcf file
*/
function addSamplesFromBcfLine(q, m, l, addFormatValues, ds, limitSamples) {
	// l[6] is FORMAT, l[7] is first sample
	const format_idx = 6
	const firstSample_idx = 7

	if (!l[format_idx] || l[format_idx] == '.') {
		// this variant has 0 format fields??
		return
	}
	const formatlst = [] // list of format object from q._tk.format{}, by the order of l[7]
	for (const s of l[format_idx].split(':')) {
		const f = q._tk.format[s]
		if (f) {
			// a valid format field
			formatlst.push(f)
		} else {
			throw 'invalid format field: ' + f
		}
	}
	const samples = []
	for (const [i, sampleHeaderObj] of (limitSamples || q._tk.samples).entries()) {
		const v = l[i + firstSample_idx]
		if (!v || v == '.') {
			// no value for this sample
			continue
		}
		const vlst = v.split(':')
		const sampleObj = vcfFormat2sample(vlst, formatlst, sampleHeaderObj, addFormatValues)
		if (sampleObj) {
			// this sample is annotated with this variant
			samples.push(sampleObj)
		}
	}
	if (samples.length) m.samples = samples
}

/*
parse format value for a sample and decide if the sample harbor the variant
if so, return sample obj
otherwise, return null
*/
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
			if (addFormatValues) {
				sampleObj.GT = fv
			} else {
				// no need to add any format fields, only need to return sample id for counting
				return sampleObj
			}
		} else {
			/* has value for a non-GT field
			indicating the variant is annotated to this sample
			irrespective of what this field is
			later may check by meanings of each format field
			*/
			if (addFormatValues) {
				sampleObj[format.ID] = fv
			} else {
				// no need to add field, just return
				return sampleObj
			}
		}
	}
	if (Object.keys(sampleObj).length == 1) {
		return null
	}
	return sampleObj
}

async function validate_query_svfusion(ds, genome) {
	const q = ds.queries.svfusion
	if (!q) return
	if (!q.byrange) throw 'byrange missing from queries.svfusion'
	if (q.byrange) {
		if (q.byrange.file) {
			q.byrange.file = path.join(serverconfig.tpmasterdir, q.byrange.file)
			q.byrange.get = await svfusionByRangeGetter_file(ds, genome)
			console.log(q.byrange.samples.length, 'samples from svfusion.byrange.file of ' + ds.label)
		} else {
			throw 'unknown query method for svfusion.byrange'
		}
	}
}

/*
getter input:
.rglst=[ { chr, start, stop} ]
.tid2value, same as in bcf

getter returns:
list of svfusion events,
events are partially grouped
represented as { dt, chr, pos, strand, pairlstIdx, mname, samples:[] }
object attributes (except samples) are differentiators, enough to identify events on a gene
*/
export async function svfusionByRangeGetter_file(ds, genome) {
	const q = ds.queries.svfusion.byrange
	if (q.file) {
		await utils.validate_tabixfile(q.file)
	} else if (q.url) {
		q.dir = await utils.cache_index(q.url, q.indexURL)
	} else {
		throw 'file and url both missing on svfusion.byrange{}'
	}
	q.nochr = await utils.tabix_is_nochr(q.file || q.url, null, genome)

	{
		const lines = await utils.get_header_tabix(q.file)
		if (!lines[0]) throw 'header line missing from ' + q.file
		const l = lines[0].split(' ')
		if (l[0] != '#sample') throw 'header line not starting with #sample: ' + q.file
		q.samples = l.slice(1).map(i => {
			return { name: i }
		})
	}

	return async param => {
		if (!Array.isArray(param.rglst)) throw 'q.rglst[] is not array'
		if (param.rglst.length == 0) throw 'q.rglst[] blank array'

		let limitSamples
		{
			const lst = mayLimitSamples(param, q.samples, ds)
			if (lst) {
				limitSamples = new Set(lst.map(i => i.name))
			}
		}

		const key2variants = new Map()
		/*
		key: key fields joined into a string
		value: list of events described by the key
		key fields include:
		- dt sv/fusion
		- chr of current breakpoint
		- pos of current breakpoint
		- strand of current breakpoint
		- array index in pairlst[]
		- partner gene name(s)
		*/

		for (const r of param.rglst) {
			await utils.get_lines_bigfile({
				args: [q.file || q.url, (q.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop],
				dir: q.dir,
				callback: line => {
					const l = line.split('\t')
					const pos = Number(l[1])
					let j
					try {
						j = JSON.parse(l[3])
					} catch (e) {
						//console.log('svfusion json err')
						return
					}
					if (j.dt != dtfusionrna && j.dt != dtsv) {
						// not fusion or sv
						//console.log('svfusion invalid dt')
						return
					}

					if (j.sample && limitSamples) {
						// to filter sample
						if (!limitSamples.has(j.sample)) return
					}

					// collect key fields
					let pairlstIdx, mname, strand
					// later may add pairlstLength to support fusion events with more than 2 genes

					// collect initial pairlst to add to key2variants{}, for showing svgraph
					let pairlst

					/* two types of possible file formats
					1. {chrA, posA, chrB, posB, strandA, strandB}
						legacy format used for mds, hardcoded for 2-gene events
					2. {pairlst:[ {a,b}, {a,b}, ... ]}
						new format that can support events with more than 2 genes
						pairlst.length=1 for 2-gene event
						pairlst.length=2 for 3-gene event, where lst[0].b and lst[1].a are on the same gene
					*/
					if (j.chrA) {
						// chrA given, current chr:pos is on 3'
						pairlstIdx = 1 // as using C-term of this gene
						mname = j.geneA || j.chrA
						strand = j.strandA
						//
						pairlst = [
							{
								a: { chr: j.chrA, pos: j.posA, strand: j.strandA, name: j.geneA },
								b: { chr: r.chr, pos, strand: j.strandB, name: j.geneB }
							}
						]
					} else if (j.chrB) {
						// chrB given, current chr:pos is on 5'
						pairlstIdx = 0 // as using N-term of this gene
						mname = j.geneB || j.chrB
						strand = j.strandB
						//
						pairlst = [
							{
								a: { chr: r.chr, pos, strand: j.strandA, name: j.geneA },
								b: { chr: j.chrB, pos: j.posB, strand: j.strandB, name: j.geneB }
							}
						]
					} else if (j.pairlst) {
						// todo: support pairlst=[{chr,pos}, {chr,pos}, ...]
						pairlst = j.pairlst
						const idx = j.pairlst.findIndex(i => i.chr == chr && i.pos == pos)
						if (idx == -1) throw 'current point missing from pairlst'
						pairlstIdx = idx
						// todo mname as joining names of rest of pairlst points
					} else {
						throw 'missing chrA and chrB'
					}

					const ssm_id = [j.dt, r.chr, pos, strand, pairlstIdx, mname].join(ssmIdFieldsSeparator)

					if (!key2variants.has(ssm_id)) {
						key2variants.set(ssm_id, {
							ssm_id,
							dt: j.dt,
							class: j.dt == dtsv ? mclasssv : mclassfusionrna,
							chr: r.chr,
							pos,
							strand,
							pairlstIdx,
							mname,
							pairlst, // if this key corresponds multiple events, add initial pairlst to allow showing svgraph without additional query to get other breakpoints
							samples: []
						})
					}
					if (j.sample) {
						key2variants.get(ssm_id).samples.push({ sample_id: j.sample })
					}
				}
			})
		}
		return [...key2variants.values()]
	}
}

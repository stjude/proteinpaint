const gdc = require('./mds3.gdc')
const { initGDCdictionary } = require('./termdb.gdc')
const { variant2samples_getresult } = require('./mds3.variant2samples')

/*
********************** EXPORTED
init
client_copy
********************** INTERNAL
*/

export async function init(ds, genome, _servconfig) {
	if (!ds.queries) throw 'ds.queries{} missing'
	await validate_termdb(ds)
	validate_variant2samples(ds)
	validate_query_snvindel(ds)
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
	if (!vs.termidlst) throw '.termidlst[] missing from variant2samples'
	if (!Array.isArray(vs.termidlst)) throw 'variant2samples.termidlst[] is not array'
	if (vs.termidlst.length == 0) throw '.termidlst[] empty array from variant2samples'
	if (!ds.termdb) throw 'ds.termdb missing when variant2samples.termidlst is in use'
	for (const id of vs.termidlst) {
		if (!ds.cohort.termdb.q.termjsonByOneid(id)) throw 'term not found for an id of variant2samples.termidlst: ' + id
	}

	// TODO make it optional. when provided will show sunburst chart
	if (!vs.sunburst_ids) throw '.sunburst_ids[] missing from variant2samples'
	if (!Array.isArray(vs.sunburst_ids)) throw '.sunburst_ids[] not array from variant2samples'
	if (vs.sunburst_ids.length == 0) throw '.sunburst_ids[] empty array from variant2samples'
	for (const id of vs.sunburst_ids) {
		if (!ds.cohort.termdb.q.termjsonByOneid(id)) throw 'term not found for an id of variant2samples.sunburst_ids: ' + id
	}
	if (vs.gdcapi) {
		gdc.validate_variant2sample(vs.gdcapi)
	} else {
		throw 'unknown query method of variant2samples'
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

function validate_query_snvindel(ds) {
	const q = ds.queries.snvindel
	if (!q) return
	if (q.url) {
		if (!q.url.base) throw '.snvindel.url.base missing'
		if (!q.url.key) throw '.snvindel.url.key missing'
	}
	if (!q.byrange) throw '.byrange missing for queries.snvindel'
	if (q.byrange.gdcapi) {
		gdc.validate_query_snvindel_byrange(ds)
	} else {
		throw 'unknown query method for queries.snvindel.byrange'
	}

	if (!q.byisoform) throw '.byisoform missing for queries.snvindel'
	if (q.byisoform.gdcapi) {
		//gdc.validate_query_snvindel_byisoform(ds) // tandem rest apis
		gdc.validate_query_snvindel_byisoform(ds)
	} else {
		throw 'unknown query method for queries.snvindel.byisoform'
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

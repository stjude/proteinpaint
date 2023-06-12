const gdc = require('./mds3.gdc')
const fs = require('fs')
const readline = require('readline')
const path = require('path')
const scaleLinear = require('d3-scale').scaleLinear
const createCanvas = require('canvas').createCanvas
const { initGDCdictionary } = require('./termdb.gdc')
const { validate_variant2samples } = require('./mds3.variant2samples')
const utils = require('./utils')
const compute_mclass = require('./vcf.mclass').compute_mclass
const serverconfig = require('./serverconfig')
const {
	dtsnvindel,
	dtfusionrna,
	dtsv,
	dtcnv,
	mclassfusionrna,
	mclasssv,
	mclasscnvgain,
	mclasscnvloss
} = require('#shared/common')
const { get_samples } = require('./termdb.sql')
const { server_init_db_queries } = require('./termdb.server.init')
const { barchart_data } = require('./termdb.barchart')
const { setDbRefreshRoute } = require('./dsUpdateAttr.js')
const mayInitiateScatterplots = require('./termdb.scatter').mayInitiateScatterplots
const mayInitiateMatrixplots = require('./termdb.matrix').mayInitiateMatrixplots
const { add_bcf_variant_filter } = require('./termdb.snp')

/*
init
client_copy
	copy_queries
validate_termdb
	mayInitiateScatterplots
	mayValidateSelectCohort
	mayValidateRestrictAcestries
	call_barchart_data
		barchart_data
validate_query_snvindel
	gdc.validate_query_snvindel_byisoform
	gdc.validate_query_snvindel_byrange
	snvindelByRangeGetter_bcf
		mayLimitSamples
			param2filter
				tid2value2filter
		mayDropMbyInfoFilter
		addSamplesFromBcfLine
			vcfFormat2sample
	mayValidateSampleHeader
validate_query_svfusion
	svfusionByRangeGetter_file
validate_query_geneCnv
validate_query_cnv
	cnvByRangeGetter_file
validate_query_ld
validate_query_geneExpression
validate_query_singleSampleMutation
validate_query_singleSampleGenomeQuantification
validate_query_singleSampleGbtk
validate_variant2samples
validate_ssm2canonicalisoform
mayAdd_refseq2ensembl
mayAdd_mayGetGeneVariantData
	getSnvindelByTerm
	getSvfusionByTerm
	getCnvByTw
		mayMapGeneName2isoform
		mayMapGeneName2coord
	mayAddDataAvailability
		addDataAvailability
*/

// in case chr name may contain '.', can change to __
export const ssmIdFieldsSeparator = '.'
const pc_termid_prefix = 'Ancestry_PC_' // may define in ds, must avoid conflicting with dictionary term ids
const unannotatedKey = 'Unannotated' // this duplicates the same string in mds3/legend.js

export async function init(ds, genome, _servconfig, app = null, basepath = null) {
	// must validate termdb first
	await validate_termdb(ds)

	if (ds.queries) {
		// must validate snvindel query before variant2sample
		// as vcf header must be parsed to supply samples for variant2samples
		await validate_query_snvindel(ds, genome)
		await validate_query_svfusion(ds, genome)
		await validate_query_geneCnv(ds, genome)
		await validate_query_cnv(ds, genome)
		await validate_query_ld(ds, genome)
		await validate_query_geneExpression(ds, genome)
		await validate_query_singleSampleMutation(ds, genome)
		await validate_query_singleSampleGenomeQuantification(ds, genome)
		await validate_query_singleSampleGbtk(ds, genome)

		validate_variant2samples(ds)
		validate_ssm2canonicalisoform(ds)

		mayAdd_refseq2ensembl(ds, genome)

		mayAdd_mayGetGeneVariantData(ds, genome)
	}

	mayValidateAssayAvailability(ds)

	// the "refresh" attribute on ds.cohort.db should be set in serverconfig.json
	// for a genome dataset, using "updateAttr: [[...]]
	if (ds.cohort?.db?.refresh && app) setDbRefreshRoute(ds, app, basepath)
}

export function client_copy(ds) {
	/* make client copy of the ds
	to be stored at genome.datasets
*/
	const ds2_client = {
		isMds3: true,
		label: ds.label
	}

	copy_queries(ds, ds2_client)
	// .queries{} may be set

	if (ds.cohort?.termdb) {
		ds2_client.termdb = {}
		// if using flat list of terms, do not send terms[] to client
		// as this is official ds, and client will create vocabApi
		// to query /termdb server route with standard methods
		if (ds.cohort.termdb.allowCaseDetails) {
			ds2_client.termdb.allowCaseDetails = {
				sample_id_key: ds.cohort.termdb.allowCaseDetails.sample_id_key // optional key
			}
		}
	}
	if (ds.variant2samples) {
		const v = ds.variant2samples
		ds2_client.variant2samples = {
			sunburst_twLst: v.sunburst_twLst,
			twLst: v.twLst,
			type_samples: v.type_samples,
			type_summary: v.type_summary,
			type_sunburst: v.type_sunburst,
			url: v.url,
			variantkey: v.variantkey
		}
	}
	return ds2_client
}

/*
two formats

ds.termdb = {
	dictionary: {}
}

ds.cohort = {
	db:{}
	termdb: {}
}
*/
export async function validate_termdb(ds) {
	if (ds.cohort) {
		if (!ds.cohort.termdb) throw 'ds.cohort is set but cohort.termdb{} missing'
		if (!ds.cohort.db) throw 'ds.cohort is set but cohort.db{} missing'
		if (!ds.cohort.db.file && !ds.cohort.db.file_fullpath) throw 'ds.cohort.db.file missing'
	} else if (ds.termdb) {
		ds.cohort = {}
		ds.cohort.termdb = ds.termdb
		delete ds.termdb
		// ds.cohort.termdb is required to be compatible with termdb.js
	} else {
		// this dataset is not equipped with termdb
		return
	}

	const tdb = ds.cohort.termdb
	/* points to ds.cohort.termdb{}
	 */

	if (tdb?.dictionary?.gdcapi) {
		await initGDCdictionary(ds)
		/*
		creates ds.cohort.termdb.q={}
		*****************************
		*   clandestine gdc stuff   *
		*****************************
		- apis tested
		- ds.gdcOpenProjects
		- aliquot-submitter cached
		*/
	} else if (tdb?.dictionary?.dbFile) {
		ds.cohort.db = { file: tdb.dictionary.dbFile }
		delete tdb.dictionary.dbFile
		server_init_db_queries(ds)
	} else if (ds.cohort.db) {
		server_init_db_queries(ds)
	} else {
		throw 'unknown method to initiate dictionary'
	}

	if (tdb.termid2totalsize2) {
		if (tdb.termid2totalsize2.gdcapi) {
			// validate gdcapi
		} else {
			// query through termdb methods
			// since termdb.dictionary is a required attribute
		}

		/* add getter
		input:
			twLst=[ tw, ...]
			q={}
				.tid2value={id1:v1, ...}
				.ssm_id_lst=str
			combination={}
				optional, not used for computing
		output:
			a map, key is termid, value is array, each element: [category, total]
		*/
		tdb.termid2totalsize2.get = async (twLst, q = {}, combination = null) => {
			if (tdb.termid2totalsize2.gdcapi) {
				return await gdc.get_termlst2size(twLst, q, combination, ds)
			}
			return await call_barchart_data(twLst, q, combination, ds)
		}
	}

	mayValidateSelectCohort(tdb)

	// must validate selectCohort first, then restrictAncestries, as latter may depend on former
	await mayValidateRestrictAcestries(tdb)

	await mayInitiateScatterplots(ds)

	await mayInitiateMatrixplots(ds)

	if ('minTimeSinceDx' in tdb) {
		if (!Number.isFinite(tdb.minTimeSinceDx)) throw 'termdb.minTimeSinceDx not number'
		if (tdb.minTimeSinceDx <= 0) throw 'termdb.minTimeSinceDx<=0'
	}
	if ('ageEndOffset' in tdb) {
		if (!Number.isFinite(tdb.ageEndOffset)) throw 'termdb.ageEndOffset not number'
		if (tdb.ageEndOffset <= 0) throw 'termdb.ageEndOffset<=0'
	}
	if (tdb.termIds) {
		if (tdb.termIds.ageDxId) {
			const t = tdb.q.termjsonByOneid(tdb.termIds.ageDxId)
			if (!t) throw 'unknown term for termIds.ageDxId'
			if (t.type != 'integer' && t.type != 'float') throw 'termIds.ageDxId not integer/float'
		}
		if (tdb.termIds.ageLastVisitId) {
			const t = tdb.q.termjsonByOneid(tdb.termIds.ageLastVisitId)
			if (!t) throw 'unknown term for termIds.ageLastVisitId'
			if (t.type != 'integer' && t.type != 'float') throw 'termIds.ageLastVisitId not integer/float'
		}
		if (tdb.termIds.ageNdiId) {
			const t = tdb.q.termjsonByOneid(tdb.termIds.ageNdiId)
			if (!t) throw 'unknown term for termIds.ageNdiId'
			if (t.type != 'integer' && t.type != 'float') throw 'termIds.ageNdiId not integer/float'
		}
		if (tdb.termIds.ageDeathId) {
			const t = tdb.q.termjsonByOneid(tdb.termIds.ageDeathId)
			if (!t) throw 'unknown term for termIds.ageDeathId'
			if (t.type != 'integer' && t.type != 'float') throw 'termIds.ageDeathId not integer/float'
		}
	}

	if (ds.cohort.termdb.additionalSampleAttributes) {
		if (!Array.isArray(ds.cohort.termdb.additionalSampleAttributes)) throw 'termdb.additionalSampleAttributes not array'
		for (const k of ds.cohort.termdb.additionalSampleAttributes) {
			if (typeof k != 'string') throw 'non-str key in termdb.additionalSampleAttributes[]'
		}
	}

	//////////////////////////////////////////////////////
	//
	// XXX rest is quick fixes taken from mds2.init.js
	//
	//////////////////////////////////////////////////////

	if (ds.cohort?.db?.connection) {
		// gdc does not use db connection
		ds.sampleName2Id = new Map()
		ds.sampleId2Name = new Map()
		const sql = 'SELECT * FROM sampleidmap'
		const rows = ds.cohort.db.connection.prepare(sql).all()
		for (const r of rows) {
			ds.sampleId2Name.set(r.id, r.name)
			ds.sampleName2Id.set(r.name, r.id)
		}

		ds.getSampleIdMap = samples => {
			const bySampleId = {}
			for (const sampleId in samples) {
				bySampleId[sampleId] = ds.sampleId2Name.get(+sampleId)
			}
			return bySampleId
		}
	}

	if (ds.cohort.mutationset) {
		// !!! TODO !!!
		// handle different sources/formats for gene variant data
		// instead of assumed mutation text files
		const { mayGetGeneVariantData, getTermTypes, mayGetMatchingGeneNames } = require('./bulk.mset')
		ds.mayGetGeneVariantData = mayGetGeneVariantData
		ds.getTermTypes = getTermTypes
		ds.mayGetMatchingGeneNames = mayGetMatchingGeneNames
	}
}

function mayValidateSelectCohort(tdb) {
	const sc = tdb.selectCohort
	if (!sc) return
	if (typeof sc != 'object') throw 'selectCohort{} not object'
	// cohort selection supported
	if (!sc.term) throw 'term{} missing from termdb.selectCohort'
	if (!sc.term.id) throw 'id missing from termdb.selectCohort.term'
	if (typeof sc.term.id != 'string') throw 'termdb.selectCohort.term.id is not string'
	if (sc.term.type != 'categorical') throw 'type is not hardcoded "categorical" from termdb.selectCohort.term'
	{
		const t = tdb.q.termjsonByOneid(sc.term.id)
		if (!t) throw 'termdb.selectCohort.term.id is invalid'
		if (t.type != 'categorical') throw 'termdb.selectCohort.term type is not categorical'
	}
	if (!sc.values) throw 'values[] missing from termdb.selectCohort'
	if (!Array.isArray(sc.values)) throw 'termdb.selectCohort.values is not array'
	if (sc.values.length == 0) throw 'termdb.selectCohort.values[] cannot be empty'
	for (const v of sc.values) {
		if (!v.keys) throw 'keys[] missing from one of selectCohort.values[]'
		if (!Array.isArray(v.keys)) throw 'keys[] is not array from one of selectCohort.values[]'
		if (v.keys.length == 0) throw 'keys[] is empty from one of selectCohort.values[]'
	}
}

async function mayValidateRestrictAcestries(tdb) {
	if (!tdb.restrictAncestries) return
	if (!Array.isArray(tdb.restrictAncestries) || tdb.restrictAncestries.length == 0)
		throw 'termdb.restrictAncestries[] is not non-empty array'
	for (const a of tdb.restrictAncestries) {
		if (!a.name) throw 'name missing from one of restrictAncestries'

		if (typeof a.tvs != 'object') throw '.tvs{} missing from one of restrictAncestries'
		// validate tvs
		if (!a.tvs.term) throw 'tvs.term{} missing from an ancestry'
		if (!a.tvs.term.id) throw 'tvs.term.id missing from an ancestry'
		{
			const t = tdb.q.termjsonByOneid(a.tvs.term.id)
			if (!t) throw 'tvs.term.id is invalid from an ancestry'
			if (t.type != 'categorical') throw 'tvs.term.type is not categorical from an ancestry'
		}

		// file path is from tp/; parse file, store pc values to pcs
		if (!Number.isInteger(a.PCcount)) throw 'PCcount is not integer'

		if (a.PCfile) {
			// a single file for this ancestry, not by cohort
			a.pcs = await read_PC_file(a.PCfile, a.PCcount)
		} else if (a.PCfileBySubcohort) {
			// pc file by subcohort
			if (!tdb.selectCohort) throw 'PCfileBySubcohort is in use but selectCohort is not enabled'
			for (const subcohort in a.PCfileBySubcohort) {
				// subcohort is the identifier of a sub-cohort; verify it matches one in selectCohort
				let missing = true
				for (const v of tdb.selectCohort.values) {
					if (subcohort == v.keys.sort().join(',')) {
						missing = false
						break
					}
				}
				if (missing) throw 'unknown subcohort from PCfileBySubcohort'

				const b = a.PCfileBySubcohort[subcohort]
				if (!b.file) throw '.file missing for a subcohort in PCfileBySubcohort'
				b.pcs = await read_PC_file(b.file, a.PCcount)
			}
		}
	}
}

async function read_PC_file(file, PCcount) {
	const pcs = new Map() // k: pc ID, v: Map(sampleId:value)
	for (let i = 1; i <= PCcount; i++) pcs.set(pc_termid_prefix + i, new Map())

	let samplecount = 0
	for (const line of (await utils.read_file(path.join(serverconfig.tpmasterdir, file))).trim().split('\n')) {
		samplecount++
		// each line: sampleid \t pc1 \t pc2 \t ...
		const l = line.split('\t')
		const sampleid = Number(l[0])
		if (!Number.isInteger(sampleid)) throw 'non-integer sample id from a line of restrictAncestries pc file'
		for (let i = 1; i <= PCcount; i++) {
			const pcid = pc_termid_prefix + i
			const value = Number(l[i])
			if (Number.isNaN(value)) throw 'non-numeric PC value from restrictAncestries file'
			pcs.get(pcid).set(sampleid, value)
		}
	}
	console.log(samplecount, 'samples loaded from ' + file)
	return Object.freeze(pcs)
}

async function call_barchart_data(twLst, q, combination, ds) {
	// makes sense to call barchart function as it adds counting logic over getData output
	const termid2values = new Map()
	// k: term id
	// v: [], element is [category, totalCount]
	for (const tw of twLst) {
		if (!tw.term) continue
		if (tw.term.type == 'categorical') {
			const _q = {
				term1_id: tw.id,
				term1_q: { type: 'values' }
			}
			if (q.tid2value) {
				_q.filter = tid2value2filter(q.tid2value, ds)
			}
			const out = await barchart_data(_q, ds, ds.cohort.termdb)

			if (!out?.data?.charts?.[0]) {
				// no data
				continue
			}

			const lst = []
			for (const s of out.data.charts[0].serieses) {
				lst.push([s.seriesId, s.total])
			}
			termid2values.set(tw.id, lst)
		}
	}
	if (combination) return [termid2values, combination]
	return termid2values
}

function copy_queries(ds, dscopy) {
	if (!ds.queries) return
	const copy = {}

	if (ds.queries.singleSampleMutation) {
		copy.singleSampleMutation = {
			sample_id_key: ds.queries.singleSampleMutation.sample_id_key
		}
	}

	if (ds.queries.singleSampleGenomeQuantification) {
		copy.singleSampleGenomeQuantification = {}
		for (const k in ds.queries.singleSampleGenomeQuantification) {
			copy.singleSampleGenomeQuantification[k] = JSON.parse(
				JSON.stringify(ds.queries.singleSampleGenomeQuantification[k])
			)
			delete copy.singleSampleGenomeQuantification[k].folder
		}
	}

	if (ds.queries.singleSampleGbtk) {
		copy.singleSampleGbtk = {}
		for (const k in ds.queries.singleSampleGbtk) {
			copy.singleSampleGbtk[k] = JSON.parse(JSON.stringify(ds.queries.singleSampleGbtk[k]))
			delete copy.singleSampleGbtk[k].folder
		}
	}

	const qs = ds.queries.snvindel
	if (qs) {
		dscopy.has_skewer = true
		copy.snvindel = {
			forTrack: qs.forTrack,
			vcfid4skewerName: qs.vcfid4skewerName,
			variantUrl: qs.variantUrl,
			skewerRim: qs.skewerRim
		}

		if (qs.m2csq) {
			copy.snvindel.m2csq = { by: qs.m2csq.by }
		}

		// copy over info and format fields
		// TODO may move to dscopy.info{} and dscopy.format{}
		if (qs.info) dscopy.bcf = { info: qs.info }
		if (qs.format) {
			if (!dscopy.bcf) dscopy.bcf = {}
			dscopy.bcf.format = qs.format
		}
	}
	if (ds.queries.ld) {
		copy.ld = JSON.parse(JSON.stringify(ds.queries.ld))
		for (const i of copy.ld.tracks) {
			delete i.file
		}
	}
	dscopy.queries = copy
}

function sort_mclass(set) {
	const lst = []
	for (const [c, s] of set) {
		lst.push([c, s.size])
	}
	lst.sort((i, j) => j[1] - i[1])
	return lst
}

async function validate_query_geneCnv(ds, genome) {
	// gene-level cnv, compared to .cnv{}
	const q = ds.queries.geneCnv
	if (!q) return
	if (q.bygene) {
		if (q.bygene.gdcapi) {
			gdc.validate_query_geneCnv2(ds)
			// q.bygene.get() added
		}
	} else {
		throw 'geneCnv.bygene missing'
	}
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
			if (!q.byrange._tk?.samples.length) {
				// vcf header parsing returns blank array when file has no sample
				delete q.byrange._tk.samples
			}
			mayValidateSampleHeader(ds, q.byrange._tk.samples, 'snvindel.byrange.bcffile')
		} else if (q.byrange.chr2bcffile) {
			q.byrange._tk = { chr2files: {} } // to hold small tk obj from each chr
			for (const chr in q.byrange.chr2bcffile) {
				q.byrange._tk.chr2files[chr] = { file: path.join(serverconfig.tpmasterdir, q.byrange.chr2bcffile[chr]) }
			}
			delete q.byrange.chr2bcffile

			// repeat as above
			q.byrange.get = await snvindelByRangeGetter_bcf(ds, genome)
			if (!q.byrange._tk.samples.length) {
				// vcf header parsing returns blank array when file has no sample
				delete q.byrange._tk.samples
			}
			mayValidateSampleHeader(ds, q.byrange._tk.samples, 'snvindel.byrange.bcffile')
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
		if (q.m2csq.by != 'ssm_id') throw 'unknown value of queries.snvindel.m2csq.by'
		if (q.m2csq.gdcapi) {
			gdc.validate_m2csq(ds)
			// added q.m2csq.get()
		} else {
			throw 'unknown query method for queries.snvindel.m2csq'
		}
	}
}

function mayValidateSampleHeader(ds, samples, where) {
	if (!samples) return
	// samples[] elements: {name:str}
	let useint
	if (ds?.cohort?.termdb) {
		// using sqlite3 db
		// as samples are kept as integer ids in termdb, cast name into integers
		for (const s of samples) {
			const id = Number(s.name)
			if (!Number.isInteger(id)) throw 'non-integer sample id from ' + where
			s.name = id
		}
		useint = ', all integer IDs'
	}
	console.log(samples.length, 'samples from ' + where + ' of ' + ds.label + useint)
}

function validate_ssm2canonicalisoform(ds) {
	// gdc-specific logic
	if (!ds.ssm2canonicalisoform) return
	if (ds.ssm2canonicalisoform.gdcapi) {
		gdc.validate_ssm2canonicalisoform(ds.ssm2canonicalisoform) // add get()
		return
	}
	throw 'ssm2canonicalisoform.gdcapi is false'
}

/* if genome allows converting refseq/ensembl
add a convertor in ds to map refseq to ensembl
this is required for gdc dataset
so that gencode-annotated stuff can show under a refseq name
*/
function mayAdd_refseq2ensembl(ds, genome) {
	if (!genome.genedb.hasTable_refseq2ensembl) return
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
		.chr2files={}
			key: chr
			value: { file, }
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

	if (q._tk.file) {
		await utils.init_one_vcf(q._tk, genome, true) // "true" to indicate file is bcf but not vcf
	} else if (q._tk.chr2files) {
		// record stringified sample json array from first chr
		// same string from other chrs are compared against it to ensure identical list of samples are used in all chr
		let firstChrSampleJson

		for (const chr in q._tk.chr2files) {
			// quick fix to only parse chr17 file, delete when all files are ready
			if (chr != 'chr17') continue

			const tk2 = q._tk.chr2files[chr]
			// practical issue: we only have a subset of files on local computer so will tolerate missing files for now
			try {
				await utils.init_one_vcf(tk2, genome, true) // "true" to indicate file is bcf but not vcf
				const sampleJson = JSON.stringify(tk2.samples)

				if (firstChrSampleJson) {
					// this is not the first chr; compare its sample string against the first one
					if (sampleJson != firstChrSampleJson) throw 'Different samples found in bcf file of ' + chr
				} else {
					// this is the first chr
					firstChrSampleJson = sampleJson
					q._tk.samples = tk2.samples
					q._tk.format = tk2.format
					q._tk.info = tk2.info
					q._tk.nochr = tk2.nochr
				}
			} catch (e) {
				// ignore
				console.log('missing file ignored:', tk2.file)
			}
		}
	}
	// q._tk{} is initiated

	if (q._tk?.samples.length) {
		// has samples
		if (!q._tk.format) throw 'bcf file has samples but no FORMAT'
	} else {
		if (q._tk.format) throw 'bcf file has FORMAT but no samples'
	}
	if (q._tk.format) {
		for (const id in q._tk.format) {
			if (id == 'GT') {
				// may not need with bcftools
				q._tk.format[id].isGT = true
			}
		}
		if (ds.queries.snvindel.format4filters) {
			// array of format keys; allow to be used as filters on client
			// TODO filtering based on numeric format?
			if (!Array.isArray(ds.queries.snvindel.format4filters)) throw 'snvindel.format4filters[] is not array'
			for (const k of ds.queries.snvindel.format4filters) {
				if (q._tk.format[k]) q._tk.format[k].isFilter = true // allow it to work as filter on client
			}
			delete ds.queries.snvindel.format4filters
		}
	}

	if (q._tk.info) {
		if (q.infoFields) {
			/* q._tk.info{} is the raw INFO fields parsed from vcf file
			q.infoFields[] is the list of fields with special configuration
			pass these configurations to q._tk.info{}
			*/
			for (const field of q.infoFields) {
				// field = {name,key,categories}
				if (!field.key) throw '.key missing from one of snvindel.byrange.infoFields[]'
				if (!field.name) field.name = field.key
				const _field = q._tk.info[field.key]
				if (!_field) throw 'invalid key from one of snvindel.byrange.infoFields[]'

				// transfer configurations from field{} to _field{}
				_field.categories = field.categories
				_field.name = field.name
				_field.separator = field.separator
			}
			delete q.infoFields
		}
		if (ds.queries.snvindel.infoUrl) {
			for (const i of ds.queries.snvindel.infoUrl) {
				const _field = q._tk.info[i.key]
				if (!_field) throw 'invalid key from one of snvindel.infoUrl[]'
				_field.urlBase = i.base
			}
			delete ds.queries.snvindel.infoUrl
		}
	}

	// NOTE ds.queries.snvindel{} as a common place to attach info/format
	// as a dataset not using bcf file may also require info/format
	ds.queries.snvindel.info = q._tk.info
	ds.queries.snvindel.format = q._tk.format

	/*
	param{}
		.rglst[]
		.filterObj{}
		.addFormatValues: boolean
			if true, formatK2v{} will be added to sample objects
		.infoFilter{}
		.variantFilter{}
		.hiddenmclass = set
		.skewerRim{}
			{formatKey, hiddenvalues: set}
		.formatFilter{}
			{ <formatKey> : set of hidden values }
	*/
	return async param => {
		if (!Array.isArray(param.rglst)) throw 'q.rglst[] is not array'
		if (param.rglst.length == 0) throw 'q.rglst[] blank array'

		const formatFilter = getFormatFilter(param)

		let bcfpath
		if (q._tk.chr2files) {
			/////////////////////////////
			// FIXME when param.rglst[] has multiple chromosomes, the data are spread in multiple bcf files and must do a loop
			/////////////////////////////
			const tk2 = q._tk.chr2files[param.rglst[0].chr]
			if (!tk2) throw 'unknown chr for chr2files'
			bcfpath = tk2.file
		} else {
			bcfpath = q._tk.file || q._tk.url
		}

		const bcfArgs = [
			'query',
			bcfpath,
			'-r',
			// plus 1 to stop, as rglst pos is 0-based, and bcf is 1-based
			param.rglst
				.map(r => (q._tk.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + (r.stop + 1))
				.join(','),
			'-f',
			'%ID\t%CHROM\t%POS\t%REF\t%ALT\t%INFO\t%FORMAT\n'
		]

		const limitSamples = await mayLimitSamples(param, q._tk.samples, ds)
		if (limitSamples) {
			bcfArgs.push('-s', limitSamples.map(i => i.name).join(','))
		}
		if (param.variantFilter) {
			add_bcf_variant_filter(param.variantFilter, bcfArgs)
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

				const m0 = { pos: pos - 1 } // temp obj, modified by compute_mclass()
				compute_mclass(q._tk, refallele, altalleles, m0, infoStr, id, param.isoform)
				// m0.mlst[] is set; each ele is an m{} per ALT

				// make a m{} for every alt allele
				for (const m of m0.mlst) {
					if (param.hiddenmclass && param.hiddenmclass.has(m.class)) continue

					// m should have .info{}
					if (mayDropMbyInfoFilter(m, param)) continue // m is dropped due to info filter

					/* m0.mlst.length>1 has multiple alt alleles
					even if just one allele passes info filter, bcftools still returns the whole line
					thus must do this manual filter
					*/
					if (m0.mlst.length > 1 && param.variantFilter?.lst && mayDropMbyInfoFilter_2(m, param)) continue

					m.chr = (q._tk.nochr ? 'chr' : '') + chr
					//m.pos = pos - 1 // bcf pos is 1-based, return 0-based
					m.ssm_id = [m.chr, m.pos, m.ref, m.alt].join(ssmIdFieldsSeparator)

					if (q._tk?.samples?.length) {
						// vcf file has sample, must find out samples harboring this variant
						// exclude samples using optional format filters
						addSamplesFromBcfLine(q, m, l, param.addFormatValues, ds, limitSamples, formatFilter)
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
combine these two optional format-based filter (into the same structure as q.formatFilter), and return
the two filters work the same way, to declare format values to exclude samples

.skewerRim{}
	{type,formatKey, hiddenvalues}
.formatFilter{}
	{ <formatKey> : set of hidden values }
*/
function getFormatFilter(q) {
	const f = q.formatFilter || {}
	if (q.skewerRim?.type == 'format' && q.skewerRim.hiddenvalues?.size) {
		f[q.skewerRim.formatKey] = q.skewerRim.hiddenvalues
	}
	return Object.keys(f).length ? f : undefined
}

/*
input:
m{}
	.info{}
param{}
	.infoFilter{}
		e.g. {"CLNSIG":["Benign",...], ... }

output:
true if m has a matching info field and will be dropped

FIXME replace this with variantFilter
*/
function mayDropMbyInfoFilter(m0, param) {
	if (!param.infoFilter) return false
	for (const infoKey in param.infoFilter) {
		// each key corresponds to a value to skip
		const variantValue = m0.info[infoKey]
		if (!variantValue) {
			// no value, don't skip
			continue
		}
		if (Array.isArray(variantValue)) {
			for (const v of param.infoFilter[infoKey]) {
				if (variantValue.includes(v)) return true // skip
			}
		} else {
			// variantValue is single value, not array
			if (param.infoFilter[infoKey].includes(variantValue)) return true // skip
		}
	}
	return false
}

function mayDropMbyInfoFilter_2(m0, param) {
	for (const e of param.variantFilter.lst) {
		const value = m0.info[e.tvs.term.id]
		if (value == undefined) return true
		if (e.tvs.term.type == 'integer' || e.tvs.term.type == 'float') {
			const numValue = Number(value)
			if (Number.isNaN(numValue)) return true
			const range = e.tvs.ranges?.[0]
			if (range) {
				if ('start' in range) {
					// skip numValue < start
					if (range.startinclusive) {
						if (numValue < range.start) return true
					} else {
						if (numValue <= range.start) return true
					}
				}
				if ('stop' in range) {
					// skip numValue > stop
					if (range.stopinclusive) {
						if (numValue > range.stop) return true
					} else {
						if (numValue >= range.stop) return true
					}
				}
			}
		}
	}
	return false
}

/*
input:
param={}
	.tid2value = { term1id: v1, term2id:v2, ... }
		if present, return list of samples matching the given k/v pairs, assuming AND
	.filterObj = pp filter
allSamples=[]
	whole list of samples, each ele: {name: int}
	presumably the set of samples from a bcf file or tabix file
ds={}

output:
array of {name}, same elements from allSamples, null if not filtering
*/
async function mayLimitSamples(param, allSamples, ds) {
	if (!allSamples) return null // no samples from this big file

	// later should be param.filter, no need for conversion
	const filter = param2filter(param, ds)
	if (!filter) {
		// no filtering, use all samples
		return null
	}

	// get_samples() return [{id:int}] with possibly duplicated items, deduplicate and return list of integer ids
	const filterSamples = [...new Set((await get_samples(filter, ds)).map(i => i.id))]

	// filterSamples is the list of samples retrieved from termdb that are matching filter
	// as allSamples (from bcf etc) may be a subset of what's in termdb
	// must only use those from allSamples
	const set = new Set(allSamples.map(i => i.name))
	return filterSamples
		.filter(i => set.has(i))
		.map(i => {
			return { name: i }
		})
}

function param2filter(param, ds) {
	if (param.filterObj) {
		if (!Array.isArray(param.filterObj.lst)) throw 'filterObj.lst is not array'
		if (param.filterObj.lst.length == 0) {
			// blank filter, do not return obj as that will break get_samples()
			return null
		}
		return param.filterObj
	}
	if (param.tid2value) {
		if (typeof param.tid2value != 'object') throw 'q.tid2value{} not object'
		return tid2value2filter(param.tid2value, ds)
	}
}

// temporary function to convert tid2value={} to filter, can delete later when it's replaced by filter
function tid2value2filter(t, ds) {
	const f = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: []
	}
	for (const k in t) {
		const term = ds.cohort.termdb.q.termjsonByOneid(k)
		if (!term) continue
		const v = t[k]
		f.lst.push({
			type: 'tvs',
			tvs: {
				term,
				// assuming only categorical
				values: [{ key: v }]
			}
		})
	}
	return f
}

/* 
usage:
call at snvindel.byrange.get() to assign .samples[] to each m for counting total number of unique samples
call at variant2samples.get() to get list of samples

parameters:
q={}
	._tk{}
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
	if bcf query is limiting on this sample set. if so l[] only contain these samples
	otherwise l[] has all samples from q._tk.samples[]
formatFilter{}
	optional filter to drop samples by format key-value pair
	key: format keys, value: set of values to exclude
*/
function addSamplesFromBcfLine(q, m, l, addFormatValues, ds, limitSamples, formatFilter) {
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
		if (!sampleObj) continue // no valid sample obj returned, this sample does not carry this variant
		if (formatFilter) {
			let drop = false
			for (const formatKey in formatFilter) {
				const formatValue = formatKey in sampleObj.formatK2v ? sampleObj.formatK2v[formatKey] : unannotatedKey
				if (formatFilter[formatKey].has(formatValue)) {
					// sample is dropped by format filter
					drop = true
					break
				}
			}
			if (drop) continue // drop this sample
		}
		samples.push(sampleObj)
	}
	if (samples.length) m.samples = samples
}

/*
parse format value for a sample and decide if the sample harbor the variant
if so, return sample obj
otherwise, return null
*/
function vcfFormat2sample(vlst, formatlst, sampleHeaderObj, addFormatValues) {
	const formatK2v = {} // key: FORMAT ID, value: value in this sample
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
			formatK2v.GT = fv
		} else {
			/* has value for a non-GT field
			indicating the variant is annotated to this sample
			do not parse values here based on Number="R"
			as we don't need to compute on the format values on backend
			client will parse the values for display
			*/
			formatK2v[format.ID] = fv
		}
	}
	if (Object.keys(formatK2v).length == 0) {
		// this sample has no format values for this variant
		// meaning this sample does not harbor this variant. return null as sample object
		return null
	}
	// the sample harbor this variant; return valid sample obj
	const sampleObj = {
		sample_id: sampleHeaderObj.name
	}
	if (addFormatValues) {
		// query asks to return format values (e.g. for sample table display)
		sampleObj.formatK2v = formatK2v
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
			mayValidateSampleHeader(ds, q.byrange.samples, 'svfusion.byrange')
		} else {
			throw 'unknown query method for svfusion.byrange'
		}
	}
}

async function validate_query_cnv(ds, genome) {
	// cnv segments, compared to geneCnv
	const q = ds.queries.cnv
	if (!q) return
	if (!q.byrange) throw 'byrange missing from queries.cnv'
	if (q.byrange) {
		if (q.byrange.file) {
			q.byrange.file = path.join(serverconfig.tpmasterdir, q.byrange.file)
			q.byrange.get = await cnvByRangeGetter_file(ds, genome)
			mayValidateSampleHeader(ds, q.byrange.samples, 'cnv.byrange')
		} else {
			throw 'unknown query method for cnv.byrange'
		}
	}
}

async function validate_query_ld(ds, genome) {
	const q = ds.queries.ld
	if (!q) return
	if (!Array.isArray(q.tracks) || !q.tracks.length) throw 'ld.tracks[] not nonempty array'
	for (const k of q.tracks) {
		if (!k.name) throw 'name missing from one of ld.tracks[]'
		if (!k.file) throw '.file missing from one of ld.tracks[]'
		k.file0 = k.file // keep relative path as its needed on client by the ld tk
		k.file = path.join(serverconfig.tpmasterdir, k.file)
		await utils.validate_tabixfile(k.file)
		k.nochr = await utils.tabix_is_nochr(k.file, null, genome)
	}
	if (!q.overlay) throw 'ld.overlay{} missing'
	if (!q.overlay.color_0) throw 'ld.overlay.color_0 missing'
	if (!q.overlay.color_1) throw 'ld.overlay.color_1 missing'
}

async function validate_query_geneExpression(ds, genome) {
	const q = ds.queries.geneExpression
	if (!q) return

	if (q.gdcapi) {
		gdc.validate_query_geneExpression(ds)
		// .get() added, same behavior as below
		return
	}

	if (!q.file) throw '.file missing from queries.geneExpression'
	q.file = path.join(serverconfig.tpmasterdir, q.file)
	await utils.validate_tabixfile(q.file)
	q.nochr = await utils.tabix_is_nochr(q.file, null, genome)

	/*
	query exp data one gene at a time
	param{}
	.genes[{}]
		.gene=str
		.chr=str
		.start=int
		.stop=int
	.filterObj{}
	*/
	q.get = async param => {
		let limitSamples
		{
			const lst = await mayLimitSamples(param, null, ds)
			if (lst) limitSamples = new Set(lst.map(i => i.name))
		}

		const gene2sample2value = new Map() // k: gene symbol, v: { sampleId : value }

		for (const g of param.genes) {
			// g = {gene/chr/start/stop}
			gene2sample2value.set(g.gene, {})
			await utils.get_lines_bigfile({
				args: [q.file, (q.nochr ? g.chr.replace('chr', '') : g.chr) + ':' + g.start + '-' + g.stop],
				dir: q.dir,
				callback: line => {
					const l = line.split('\t')
					let j
					try {
						j = JSON.parse(l[3])
					} catch (e) {
						//console.log('svfusion json err')
						return
					}
					if (j.gene != g.gene) return
					if (limitSamples && !limitSamples.has(j.sample)) return
					gene2sample2value.get(g.gene)[j.sample] = j.value
				}
			})
		}
		return gene2sample2value
	}
}

async function validate_query_singleSampleMutation(ds, genome) {
	const q = ds.queries.singleSampleMutation
	if (!q) return
	if (q.gdcapi) {
		gdc.validate_query_singleSampleMutation(ds, genome)
		// q.get() added
	} else if (q.folder) {
		// using a folder to store text files for individual samples
		// file names are integer sample id
		q.get = async sampleName => {
			/* as mds3 client may not be using integer sample id for now,
			the argument is string id and has to be mapped to integer id
			*/
			let fileName = sampleName
			if (ds.cohort?.termdb?.q?.sampleName2id) {
				// has name-to-id converter
				fileName = ds.cohort.termdb.q.sampleName2id(sampleName)
				if (fileName == undefined) {
					// unable to convert string id to integer
					return []
				}
			}
			const data = await utils.read_file(path.join(serverconfig.tpmasterdir, q.folder, fileName.toString()))
			return JSON.parse(data)
		}
	} else {
		throw 'unknown query method for singleSampleMutation'
	}
}

async function validate_query_singleSampleGenomeQuantification(ds, genome) {
	const q = ds.queries.singleSampleGenomeQuantification
	if (!q) return
	for (const key in q) {
		// each key is one data type
		if (!Number.isFinite(q[key].min)) throw 'min not a number'
		if (!Number.isFinite(q[key].max)) throw 'max not a number'
		if (q[key].min >= q[key].max) throw 'min>=max'
		if (q[key].folder) {
			// using a folder to store text files for individual samples
			// file names are integer sample id
			q[key].get = async (sampleName, devicePixelRatio) => {
				/* as mds3 client may not be using integer sample id for now,
				the argument is string id and has to be mapped to integer id
				*/
				let fileName = sampleName
				if (ds.cohort?.termdb?.q?.sampleName2id) {
					// has name-to-id converter
					fileName = ds.cohort.termdb.q.sampleName2id(sampleName)
					if (fileName == undefined) {
						// unable to convert string id to integer
						return []
					}
				}
				const result = await plotSampleGenomeQuantification(
					path.join(serverconfig.tpmasterdir, q[key].folder, fileName.toString()),
					genome,
					q[key],
					devicePixelRatio
				)
				return result
			}
		} else {
			throw 'unknown query method for singleSampleGenomeQuantification'
		}
	}
}

function plotSampleGenomeQuantification(file, genome, control, devicePixelRatio = 1) {
	devicePixelRatio = Number(devicePixelRatio)
	const axisHeight = 200,
		ypad = 20,
		xpad = 20,
		plotWidth = 800,
		axisWidth = 50

	let bpTotal = 0
	for (const chr in genome.majorchr) {
		bpTotal += genome.majorchr[chr]
	}
	const wgScale = plotWidth / bpTotal // whole-genome scale
	const chrScale = {} // k: chr, v: scale getter
	let bpCum = 0
	const chrLst = [] // to return to client, for converting image xoffset to {chr,pos}

	for (const chr in genome.majorchr) {
		const chrLen = genome.majorchr[chr]
		chrScale[chr] = scaleLinear()
			.domain([0, chrLen])
			.range([wgScale * bpCum, wgScale * (bpCum + chrLen)])
		bpCum += chrLen
		chrLst.push({
			chr,
			chrLen,
			xStart: wgScale * (bpCum - chrLen),
			xStop: wgScale * bpCum
		})
	}

	const yScale = scaleLinear()
		.domain([control.min, control.max])
		.range([axisHeight, 0])

	const canvasWidth = xpad * 2 + axisWidth + plotWidth
	const canvasHeight = ypad * 2 + axisHeight
	const canvas = createCanvas(canvasWidth * devicePixelRatio, canvasHeight * devicePixelRatio)
	const ctx = canvas.getContext('2d')
	if (devicePixelRatio > 1) ctx.scale(devicePixelRatio, devicePixelRatio)

	plotTick(control.max)
	plotTick(0)
	plotTick(control.min)

	const rl = readline.createInterface({ input: fs.createReadStream(file) })

	return new Promise((resolve, reject) => {
		rl.on('line', line => {
			const tmp = line.split('\t')
			const chr = tmp[0]
			if (!chr) return
			if (!chrScale[chr]) return // first line may be header
			const pos = Number(tmp[1])
			if (!Number.isInteger(pos)) return
			const value = Number(tmp[2])
			if (!Number.isFinite(value)) return
			if (value < control.min || value > control.max) return

			ctx.fillStyle = value > 0 ? control.positiveColor : control.negativeColor

			const x = chrScale[chr](pos)
			const y = ypad + yScale(value)
			ctx.fillRect(xpad + axisWidth + x, y, 1, 1)
		})
		rl.on('close', () => {
			addLines()
			resolve({
				src: canvas.toDataURL(),
				canvasWidth,
				canvasHeight,
				xoff: xpad + axisWidth,
				chrLst
			})
		})
	})

	function plotTick(v) {
		ctx.fillStyle = 'black'
		ctx.font = '12px Arial'
		ctx.textAlign = 'right'
		const y = ypad + yScale(v)
		ctx.fillText(v, xpad + axisWidth - 6, y + 5)
		ctx.strokeStyle = 'black'
		ctx.beginPath()
		ctx.moveTo(xpad + axisWidth - 4, y)
		ctx.lineTo(xpad + axisWidth, y)
		ctx.stroke()
		ctx.closePath()
	}
	function addLines() {
		ctx.strokeStyle = 'black'
		ctx.beginPath()
		{
			// horizontal line at y=0
			const y = ypad + axisHeight - yScale(0)
			ctx.moveTo(xpad + axisWidth, y)
			ctx.lineTo(xpad + axisWidth + plotWidth, y)
			ctx.stroke()
		}

		// vertical lines delineating chrs
		let first = true
		ctx.fillStyle = 'black'
		ctx.font = '12px Arial'
		ctx.textAlign = 'center'
		for (const chr in chrScale) {
			// plot name
			ctx.fillText(
				chr.replace('chr', ''),
				xpad + axisWidth + chrScale[chr](genome.majorchr[chr] / 2),
				ypad + axisHeight + 14
			)

			if (first) {
				first = false
				continue // do not plot separator line for chr1
			}

			const x = Math.floor(xpad + axisWidth + chrScale[chr](0)) + 0.5 // crisp line
			ctx.moveTo(x, ypad)
			ctx.lineTo(x, ypad + axisHeight)
			ctx.stroke()
		}
		ctx.closePath()
	}
}

async function validate_query_singleSampleGbtk(ds, genome) {
	const q = ds.queries.singleSampleGbtk
	if (!q) return
	for (const key in q) {
		// each key is one data type
		if (!Number.isFinite(q[key].min)) throw 'min not a number'
		if (!Number.isFinite(q[key].max)) throw 'max not a number'
		if (q[key].min >= q[key].max) throw 'min>=max'
		if (q[key].folder) {
			// using a folder to store text files for individual samples
			// file names are integer sample id
			q[key].get = async sampleName => {
				// (quick fix) callback returns bedgraph file path for this sample

				/* as mds3 client may not be using integer sample id for now,
				the argument is string id and has to be mapped to integer id
				*/
				let fileName = sampleName
				if (ds.cohort?.termdb?.q?.sampleName2id) {
					// has name-to-id converter
					fileName = ds.cohort.termdb.q.sampleName2id(sampleName)
					if (fileName == undefined) {
						// unable to convert string id to integer
						return {}
					}
				}
				const bedgraphfile = path.join(q[key].folder, fileName + '.gz')
				try {
					await fs.promises.stat(path.join(serverconfig.tpmasterdir, bedgraphfile))
					return { path: bedgraphfile }
				} catch (e) {
					return {}
				}
			}
		} else {
			throw 'unknown query method for singleSampleGbtk'
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

	// same parameter as snvindel.byrange.get()
	return async param => {
		if (!Array.isArray(param.rglst)) throw 'q.rglst[] is not array'
		if (param.rglst.length == 0) throw 'q.rglst[] blank array'

		const formatFilter = getFormatFilter(param)

		let limitSamples
		{
			const lst = await mayLimitSamples(param, q.samples, ds)
			if (lst) limitSamples = new Set(lst.map(i => i.name))
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

					j.class = j.dt == dtsv ? mclasssv : mclassfusionrna

					if (param.hiddenmclass && param.hiddenmclass.has(j.class)) return

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

					// encode mname in case it has comma and will break v2s code when splitting by comma
					const ssm_id = [j.dt, r.chr, pos, strand, pairlstIdx, encodeURIComponent(mname)].join(ssmIdFieldsSeparator)

					let sampleObj // optional sample of this event; if valid, will be inserted into m.samples[]
					if (j.sample) {
						// has sample, prepare the sample obj
						// if the sample is skipped by format, then the event will be skipped

						// for ds with sampleidmap, j.sample value should be integer
						// XXX not guarding against file uses non-integer sample values in such case

						sampleObj = { sample_id: j.sample }
						if (j.mattr) {
							// mattr{} has sample-level attributes on this sv event, equivalent to FORMAT
							if (formatFilter) {
								// will do the same filtering as snvindel
								for (const formatKey in formatFilter) {
									const formatValue = formatKey in j.mattr ? j.mattr[formatKey] : unannotatedKey
									if (formatFilter[formatKey].has(formatValue)) {
										// sample is dropped by format filter
										return
									}
								}
							}
							if (param.addFormatValues) {
								// only attach format values when required
								sampleObj.formatK2v = j.mattr
							}
						}
					}
					if (!key2variants.has(ssm_id)) {
						key2variants.set(ssm_id, {
							ssm_id,
							dt: j.dt,
							class: j.class,
							chr: r.chr,
							pos,
							strand,
							pairlstIdx,
							mname,
							pairlst, // if this key corresponds multiple events, add initial pairlst to allow showing svgraph without additional query to get other breakpoints
							samples: []
						})
					}
					if (sampleObj) key2variants.get(ssm_id).samples.push(sampleObj)
				}
			})
		}
		return [...key2variants.values()]
	}
}

/*
getter input:
.rglst=[ { chr, start, stop} ]
.tid2value, same as in bcf

getter returns:
list of cnv events,
events are partially grouped
represented as { dt, chr, start,stop,value,samples:[],mattr:{} }
*/
export async function cnvByRangeGetter_file(ds, genome) {
	const q = ds.queries.cnv.byrange
	if (q.file) {
		await utils.validate_tabixfile(q.file)
	} else if (q.url) {
		q.dir = await utils.cache_index(q.url, q.indexURL)
	} else {
		throw 'file and url both missing on cnv.byrange{}'
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

	/* extra parameters from snvindel.byrange.get():
	cnvMaxLength: int
	cnvMinAbsValue: float
	*/
	return async param => {
		if (!Array.isArray(param.rglst)) throw 'q.rglst[] is not array'
		if (param.rglst.length == 0) throw 'q.rglst[] blank array'
		if (param.cnvMaxLength && !Number.isInteger(param.cnvMaxLength)) throw 'cnvMaxLength is not integer' // cutoff<=0 is ignored
		if (param.cnvGainCutoff && !Number.isFinite(param.cnvGainCutoff)) throw 'cnvGainCutoff is not finite'
		if (param.cnvLossCutoff && !Number.isFinite(param.cnvLossCutoff)) throw 'cnvLossCutoff is not finite'

		const formatFilter = getFormatFilter(param)

		let limitSamples
		{
			const lst = await mayLimitSamples(param, q.samples, ds)
			if (lst) limitSamples = new Set(lst.map(i => i.name))
		}

		const cnvs = []
		const promises = []
		for (const r of param.rglst) {
			promises.push(
				utils.get_lines_bigfile({
					args: [q.file || q.url, (q.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop],
					dir: q.dir,
					callback: line => {
						const l = line.split('\t')
						const start = Number(l[1]) // must always be numbers
						const stop = Number(l[2])
						if (param.cnvMaxLength && stop - start >= param.cnvMaxLength) return // segment size too big

						let j
						try {
							j = JSON.parse(l[3])
						} catch (e) {
							//console.log('cnv json err')
							return
						}
						if (j.dt != dtcnv) {
							//console.log('cnv invalid dt')
							return
						}

						if (!Number.isFinite(j.value)) return
						if (j.value > 0 && param.cnvGainCutoff && j.value < param.cnvGainCutoff) return
						if (j.value < 0 && param.cnvLossCutoff && j.value > param.cnvLossCutoff) return

						j.start = start
						j.stop = stop

						j.class = j.value > 0 ? mclasscnvgain : mclasscnvloss

						if (param.hiddenmclass && param.hiddenmclass.has(j.class)) return

						if (j.sample && limitSamples) {
							// to filter sample
							if (!limitSamples.has(j.sample)) return
						}

						j.ssm_id = [r.chr, j.start, j.stop, j.value].join(ssmIdFieldsSeparator)

						if (j.sample) {
							// has sample, prepare the sample obj
							// if the sample is skipped by format, then the event will be skipped

							// for ds with sampleidmap, j.sample value should be integer
							// XXX not guarding against file uses non-integer sample values in such case

							const sampleObj = { sample_id: j.sample }
							if (j.mattr) {
								// mattr{} has sample-level attributes on this sv event, equivalent to FORMAT
								if (formatFilter) {
									// will do the same filtering as snvindel
									for (const formatKey in formatFilter) {
										const formatValue = formatKey in j.mattr ? j.mattr[formatKey] : unannotatedKey
										if (formatFilter[formatKey].has(formatValue)) {
											// sample is dropped by format filter
											return
										}
									}
								}
								if (param.addFormatValues) {
									// only attach format values when required
									sampleObj.formatK2v = j.mattr
								}
							}
							delete j.sample
							j.samples = [sampleObj]
						}
						cnvs.push(j)
					}
				})
			)
		}
		await Promise.all(promises)
		return cnvs
	}
}

function mayAdd_mayGetGeneVariantData(ds, genome) {
	if (!ds.queries.snvindel && !ds.queries.svfusion && !ds.queries.geneCnv) {
		// no eligible data types
		return
	}

	/*
	input:
	tw{}
		a termwrapper on a geneVariant term
		for now requires tw.term.name to be gene symbol
		the requirement is reasonable as symbol is essential for matrix display
		isoform and coord are optional; if missing is derived from gene symbol on the fly
	q{}
		.filter
			pp filter obj
		.filter0
			json obj, the read-only gdc cohort filter supplied to gdc api

	output a map:
		k: sample id
		v: {}
			sample: int
			<gene> : {}
				key:<gene>
				label:<gene>
				values: [ {} ]
					gene
					isoform
					chr/pos
					mname/class
					_SAMPLENAME_
					_SAMPLEID_

	this function is diverging from mds3.load, each becoming specialized
	1. it returns sample level data points {class/mname/sample/origin}
	   but the other returns aggregation, with format fields nested inside sample obj
	   {class/mname/samples[ {sample/formatK2v{origin}} ]}
	2. this query hardcodes to load geneCnv for showing in gdc matrix, the other does not need it (gdc tk)
	*/
	ds.mayGetGeneVariantData = async (tw, q) => {
		// validate tw
		if (typeof tw.term != 'object') throw 'tw.term{} is not object'
		if (tw.term.type != 'geneVariant') throw 'tw.term.type is not geneVariant'
		if (typeof tw.term.name != 'string') throw 'tw.term.name is not string'
		if (!tw.term.name) throw 'tw.term.name should be gene symbol but is empty string'

		const mlst = [] // collect raw data points

		// has some code duplication with mds3.load.js query_snvindel() etc
		// primary concern is tw.term may be missing coord/isoform to perform essential query

		if (ds.queries.snvindel) {
			const lst = await getSnvindelByTerm(ds, tw.term, genome, q)
			mlst.push(...lst)
		}

		if (ds.queries.svfusion) {
			const lst = await getSvfusionByTerm(ds, tw.term, genome, q)
			mlst.push(...lst)
		}
		if (ds.queries.cnv) {
			const lst = await getCnvByTw(ds, tw, genome, q)
			mlst.push(...lst)
		}

		if (ds.queries.geneCnv) {
			const lst = await getGenecnvByTerm(ds, tw.term, genome, q)
			mlst.push(...lst)
		}

		const bySampleId = new Map()

		for (const m of mlst) {
			/*
			m={
				dt
				class
				mname
				samples:[
					{
					sample_id: int or string
					...
					},
				]
			}

			for official datasets using a sqlite db that contains integer2string sample mapping, "sample_id" is integer id 
			for gdc dataset not using a sqlite db, no sample integer id is kept on server. "sample_id" is string id
			*/

			if (!Array.isArray(m.samples)) continue

			for (const s of m.samples) {
				if (!bySampleId.has(s.sample_id)) {
					bySampleId.set(s.sample_id, { sample: s.sample_id })
				}

				if (ds.cohort?.termdb?.additionalSampleAttributes) {
					for (const k of ds.cohort.termdb.additionalSampleAttributes) {
						if (k in s) {
							bySampleId.get(s.sample_id)[k] = s[k]
						}
					}
				}

				if (!bySampleId.get(s.sample_id)[tw.term.name]) {
					bySampleId.get(s.sample_id)[tw.term.name] = { key: tw.term.name, label: tw.term.name, values: [] }
				}

				// create new m2{} for each mutation in each sample

				const m2 = {
					gene: tw.term.name,
					isoform: m.isoform,
					dt: m.dt,
					chr: tw.term.chr,
					class: m.class,
					pos: m.pos || (m.start ? m.start + '-' + m.stop : ''),
					mname: m.mname,
					_SAMPLEID_: s.sample_id,
					_SAMPLENAME_: s.sample_id
				}

				if ('value' in m) m2.value = m.value

				if (s.formatK2v) {
					// this sample have format values, flatten those
					for (const k in s.formatK2v) {
						m2[k] = s.formatK2v[k]
					}
				}

				// can supply dt specific attributes
				if (m.dt == dtsnvindel) {
				} else if (m.dt == dtfusionrna || m.dt == dtsv) {
				}

				if (ds.cohort.termdb.q.id2sampleName && Number.isInteger(s.sample_id)) {
					m2._SAMPLENAME_ = ds.cohort.termdb.q.id2sampleName(s.sample_id)
				}

				bySampleId.get(s.sample_id)[tw.term.name].values.push(m2)
			}
		}

		await mayAddDataAvailability(q, ds, bySampleId, tw.term.name)

		return bySampleId
	}
}

async function mayAddDataAvailability(q, ds, bySampleId, tname) {
	if (!ds.assayAvailability?.byDt) return
	// get samples passing filter if filter is in use
	const sampleFilter = q.filter ? new Set((await get_samples(q.filter, ds)).map(i => i.id)) : null
	for (const dtKey in ds.assayAvailability.byDt) {
		const dt = ds.assayAvailability.byDt[dtKey]
		if (dt.byOrigin) {
			for (const origin in dt.byOrigin) {
				const sub_dt = dt.byOrigin[origin]
				addDataAvailability(dtKey, sub_dt, bySampleId, tname, origin, sampleFilter)
			}
		} else addDataAvailability(dtKey, dt, bySampleId, tname, false, sampleFilter)
	}
}

function addDataAvailability(dtKey, dt, bySampleId, tname, origin, sampleFilter) {
	for (const sid of dt.yesSamples) {
		if (sampleFilter && !sampleFilter.has(sid)) continue
		if (!bySampleId.has(sid)) bySampleId.set(sid, { sample: sid })
		const sampleData = bySampleId.get(sid)
		if (!(tname in sampleData)) sampleData[tname] = { key: tname, values: [], label: tname }
		if (origin) {
			if (!sampleData[tname].values.some(val => val.dt == dtKey && val.origin == origin))
				sampleData[tname].values.push({ dt: Number.parseInt(dtKey), class: 'WT', _SAMPLEID_: sid, origin: origin })
		} else {
			if (!sampleData[tname].values.some(val => val.dt == dtKey))
				sampleData[tname].values.push({ dt: Number.parseInt(dtKey), class: 'WT', _SAMPLEID_: sid })
		}
	}
	for (const sid of dt.noSamples) {
		if (sampleFilter && !sampleFilter.has(sid)) continue
		if (!bySampleId.has(sid)) bySampleId.set(sid, { sample: sid })
		const sampleData = bySampleId.get(sid)
		if (!(tname in sampleData)) sampleData[tname] = { key: tname, values: [], label: tname }
		if (origin) {
			if (!sampleData[tname].values.some(val => val.dt == dtKey && val.origin == origin))
				sampleData[tname].values.push({ dt: Number.parseInt(dtKey), class: 'Blank', _SAMPLEID_: sid, origin: origin })
		} else {
			if (!sampleData[tname].values.some(val => val.dt == dtKey))
				sampleData[tname].values.push({ dt: Number.parseInt(dtKey), class: 'Blank', _SAMPLEID_: sid })
		}
	}
}

async function mayMapGeneName2coord(term, genome) {
	if (term.chr && Number.isInteger(term.start) && Number.isInteger(term.stop)) return
	// coord missing, fill in chr/start/stop by querying with name
	if (!term.name) throw 'both term.name and term.chr/start/stop missing'
	// may reuse code from route genelookup?deep=1
	const lst = genome.genedb.getjsonbyname.all(term.name)
	if (lst.length == 0) throw 'unknown gene name'
	const tmp = lst.find(i => i.isdefault) || lst[0]
	const gm = JSON.parse(tmp.genemodel)
	if (!gm.chr || !Number.isInteger(gm.start) || !Number.isInteger(gm.stop))
		throw 'invalid chr/start/stop from returned gm'
	term.chr = gm.chr
	term.start = gm.start
	term.stop = gm.stop
}
async function mayMapGeneName2isoform(term, genome) {
	if (term.isoform && typeof term.isoform == 'string') return
	// isoform missing, query canonical isoform by name
	if (!term.name) throw 'both term.name and term.isoform'
	const lst = genome.genedb.getjsonbyname.all(term.name)
	if (lst.length == 0) return // no match, do not crash

	const tmp = lst.find(i => i.isdefault) || lst[0]
	const gm = JSON.parse(tmp.genemodel)
	if (!gm.isoform) throw 'isoform missing from returned gm'
	term.isoform = gm.isoform
}

async function getSnvindelByTerm(ds, term, genome, q) {
	// to keep cohort/session etc
	const arg = {
		addFormatValues: true,
		filter0: q.filter0, // hidden filter
		filterObj: q.filter // pp filter, must change key name to "filterObj" to be consistent with mds3 client
	}

	if (ds.queries.geneCnv) {
		// FIXME !!!!!!!!
		// may need a boolean flag to specify the geneCnv query is asking for case but not sample id, thus all queries must return data with case id
		arg.useCaseid4sample = true
	}

	if (ds.queries.snvindel.byisoform) {
		await mayMapGeneName2isoform(term, genome)
		if (!term.isoform) {
			// isoform missing, could be unknown gene name
			return []
		}
		// term.isoform is set
		arg.isoform = term.isoform
		return await ds.queries.snvindel.byisoform.get(arg)
	}
	if (ds.queries.snvindel.byrange) {
		await mayMapGeneName2coord(term, genome)
		// tw.term.chr/start/stop are set
		arg.rglst = [term]
		return await ds.queries.snvindel.byrange.get(arg)
	}
	throw 'unknown queries.snvindel method'
}
async function getSvfusionByTerm(ds, term, genome, q) {
	const arg = {
		addFormatValues: true,
		filter0: q.filter0, // hidden filter
		filterObj: q.filter // pp filter, must change key name to "filterObj" to be consistent with mds3 client
	}
	if (ds.queries.svfusion.byrange) {
		await mayMapGeneName2coord(term, genome)
		// tw.term.chr/start/stop are set
		arg.rglst = [term]
		return await ds.queries.svfusion.byrange.get(arg)
	}
	throw 'unknown queries.svfusion method'
}
async function getCnvByTw(ds, tw, genome, q) {
	/* tw.term.type is "geneVariant"
	tw.q{} carries optional cutoffs (max length and min value) to filter cnv segments
	*/
	const arg = {
		addFormatValues: true,
		filter0: q.filter0, // hidden filter
		filterObj: q.filter, // pp filter, must change key name to "filterObj" to be consistent with mds3 client
		cnvMaxLength: tw?.q?.cnvMaxLength,
		cnvGainCutoff: tw?.q?.cnvGainCutoff,
		cnvLossCutoff: tw?.q?.cnvLossCutoff
	}
	if (ds.queries.cnv.byrange) {
		await mayMapGeneName2coord(tw.term, genome)
		// tw.term.chr/start/stop are set
		arg.rglst = [tw.term]
		return await ds.queries.cnv.byrange.get(arg)
	}
	throw 'unknown queries.cnv method'
}
async function getGenecnvByTerm(ds, term, genome, q) {
	const arg = {
		filter0: q.filter0
	}

	if (ds.queries.geneCnv.bygene) {
		// term.name should be gene name
		if (!term.name) {
			// gene name missing
			return []
		}
		arg.gene = term.name
		return await ds.queries.geneCnv.bygene.get(arg)
	}
	throw 'unknown queries.geneCnv method'
}

function mayValidateAssayAvailability(ds) {
	if (!ds.assayAvailability) return
	// has this setting. cache sample list
	if (ds.assayAvailability.byDt) {
		for (const key in ds.assayAvailability.byDt) {
			const dt = ds.assayAvailability.byDt[key]

			if (dt.byOrigin) {
				for (const key in dt.byOrigin) {
					const sub_dt = dt.byOrigin[key]
					// validate structure
					// require .yes{} .no{}
					if (!sub_dt.yes || !sub_dt.no || !sub_dt.term_id)
						throw 'ds.assayAvailability.byDt.*.byOrigin properties require .term_id .yes{} .no{}'
					getAssayAvailablility(ds, sub_dt)
				}
			} else {
				// validate structure
				// require .yes{} .no{}
				if (!dt.yes || !dt.no || !dt.term_id) throw 'ds.assayAvailability.byDt properties require .term_id .yes{} .no{}'
				getAssayAvailablility(ds, dt)
			}
		}
	}
}

function getAssayAvailablility(ds, dt) {
	// cache sample id list for each category, set .yesSamples(), .noSamples()
	dt.yesSamples = new Set()
	dt.noSamples = new Set()

	const sql = `SELECT sample, value
				FROM anno_categorical
				WHERE term_id = '${dt.term_id}'`

	const rows = ds.cohort.db.connection.prepare(sql).all()
	for (const r of rows) {
		if (dt.yes.value.includes(r.value)) dt.yesSamples.add(r.sample)
		else if (dt.no.value.includes(r.value)) dt.noSamples.add(r.sample)
		//else throw `value of term ${dt.term_id} is invalid`
	}
}

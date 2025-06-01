import fs from 'fs'
import readline from 'readline'
import path from 'path'
import { spawnSync } from 'child_process'
import { scaleLinear } from 'd3-scale'
import { createCanvas } from 'canvas'
import * as gdc from './mds3.gdc.js'
import { gdcBuildDictionary } from './gdc.buildDictionary.js'
import { validate_variant2samples } from './mds3.variant2samples.js'
import { ssmIdFieldsSeparator } from '#shared/mds3tk.js'
import * as utils from './utils.js'
import { compute_mclass } from './vcf.mclass.js'
import computePercentile from '#shared/compute.percentile.js'
import { filterJoin } from '#shared/filter.js'
import serverconfig from './serverconfig.js'
import {
	dtsnvindel,
	dtfusionrna,
	dtsv,
	dtcnv,
	mclass,
	mclassfusionrna,
	mclasssv,
	mclasscnvgain,
	mclasscnvloss
} from '#shared/common.js'
import { get_samples, get_active_groupset } from './termdb.sql.js'
import { server_init_db_queries } from './termdb.server.init.ts'
import { barchart_data } from './termdb.barchart.js'
import { mayInitiateScatterplots } from './termdb.scatter.js'
import { mayInitiateMatrixplots, mayInitiateNumericDictionaryTermplots } from './termdb.matrix.js'
import { add_bcf_variant_filter } from './termdb.snp.js'
import { validate_correlationVolcano } from '#routes/correlationVolcano.ts'
import { validate_query_singleCell } from '#routes/termdb.singlecellSamples.ts'
import { validate_query_TopVariablyExpressedGenes } from '#routes/termdb.topVariablyExpressedGenes.ts'
import { validate_query_singleSampleMutation } from '#routes/termdb.singleSampleMutation.ts'
import { validate_query_geneExpression } from '#routes/termdb.cluster.ts'
import { mayLimitSamples, tid2value2filter } from './mds3.filter.js'
import { getResult } from '#src/gene.js'
import { validate_query_getTopTermsByType } from '#routes/termdb.topTermsByType.ts'
import { validate_query_getTopMutatedGenes } from '#routes/termdb.topMutatedGenes.ts'
import { validate_query_getSampleImages } from '#routes/termdb.sampleImages.ts'
import { validate_query_rnaseqGeneCount } from '#routes/termdb.DE.ts'
import { validate_query_getSampleWSImages } from '#routes/samplewsimages.ts'
import { validate_query_getWSISamples } from '#routes/wsisamples.ts'
import { mds3InitNonblocking } from './mds3.init.nonblocking.js'

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
	validate_cumburden
validate_query_snvindel
	gdc.validate_query_snvindel_byisoform
	gdc.validate_query_snvindel_byrange
	snvindelByRangeGetter_bcf
		validateSampleHeader2
		mayLimitSamples
			param2filter
				tid2value2filter
		mayDropMbyInfoFilter
		addSamplesFromBcfLine
			vcfFormat2sample
	snvindelByRangeGetter_bcfMaf
		mayLimitSamples
		mayDropMbyInfoFilter
	mayValidateSampleHeader
validate_query_svfusion
	svfusionByRangeGetter_file
		validateSampleHeader2
validate_query_geneCnv
validate_query_cnv
	addCnvGetter
		validateSampleHeader2
validate_query_probe2cnv
validate_query_ld
validate_query_geneExpression
validate_query_metaboliteIntensity
	validateMetaboliteIntensityNative
validate_query_rnaseqGeneCount
validate_query_singleSampleGenomeQuantification
validate_query_singleSampleGbtk
validate_query_trackLst
validate_variant2samples
validate_ssm2canonicalisoform
mayAdd_refseq2ensembl
mayAdd_mayGetGeneVariantData
	getSnvindelByTerm
	getSvfusionByTerm
	getCnvByTw
		mayMapGeneName2isoform
		mayMapGeneName2coord
	getProbe2cnvByTw
	mayAddDataAvailability
		addDataAvailability


arguments:
	_servconfig // should rename this and not imply serverconfig, also not used in the function
		bootstrap object for this ds
*/

/* used in mds3 tk ui, when a info or format key is not found in a variant, to be able to count the variant by this key in the info/format legend
 this duplicates the same string in mds3/legend.js
*/
const unannotatedKey = 'Unannotated'

export async function init(ds, genome) {
	// optional features/settings supplied by ds, when missing from serverconfig.features{}, are centralized here.
	// overwrite not allowed! to prevent hard-to-trace error that 2nd ds changes value set by 1st ds etc...
	for (const k in ds.serverconfigFeatures || {}) {
		if (k in serverconfig.features) {
			// on init retry, no need to see this message
			if (!ds.init.status) console.log(`!!! NO OVERWRITING SERVERCONFIG.FEATURES.${k} (from ${ds.label}) !!!`)
		} else {
			serverconfig.features[k] = ds.serverconfigFeatures[k]
		}
	}

	if (ds.preInit) {
		const response = await ds.preInit.getStatus(ds).catch(e => {
			throw e
		})
		if (response?.status != 'OK') throw response
	}

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
		await validate_query_metaboliteIntensity(ds, genome)
		await validate_query_getTopTermsByType(ds, genome)
		await validate_query_getTopMutatedGenes(ds, genome)
		await validate_query_getSampleImages(ds, genome)
		await validate_query_getSampleWSImages(ds, genome)
		await validate_query_getWSISamples(ds, genome)
		await validate_query_rnaseqGeneCount(ds, genome)
		await validate_query_singleSampleMutation(ds, genome)
		await validate_query_singleSampleGenomeQuantification(ds, genome)
		await validate_query_singleSampleGbtk(ds, genome)
		//await validate_query_probe2cnv(ds, genome)
		await validate_query_singleCell(ds, genome)
		await validate_query_TopVariablyExpressedGenes(ds, genome)
		await validate_query_trackLst(ds, genome)

		await validate_variant2samples(ds)
		await validate_ssm2canonicalisoform(ds)

		await mayAdd_refseq2ensembl(ds, genome)

		await mayAdd_mayGetGeneVariantData(ds, genome)
	}

	await mayValidateAssayAvailability(ds)
	await mayValidateViewModes(ds)
	if (ds.cohort?.db?.refresh) throw `!!! ds.cohort.db.refresh has been deprecated !!!`

	// invoke non-blocking initialization steps at the end, after validation is complete,
	// otherwise it will be difficult to coordinate the handling of errors from either
	// validation or remaining steps that may include setInterval that runs at the
	// same time as mayRetryInit() in initGenomesDs.js (avoids race condition)
	if (ds.init?.hasNonblockingSteps) mds3InitNonblocking(ds)
}

export function client_copy(ds) {
	/* make client copy of the ds
	to be stored at genome.datasets
*/
	const ds2_client = {
		isMds3: true,
		label: ds.label
	}

	if (ds.viewModes) ds2_client.skewerModes = ds.viewModes

	if (ds.noGenomicMode4lollipopTk) ds2_client.noGenomicMode4lollipopTk = true

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
	if (ds.termdb) {
		// legacy support, reshape deprecated nesting order
		if (!ds.cohort) ds.cohort = {}
		ds.cohort.termdb = ds.termdb
		delete ds.termdb
	}

	if (!ds.cohort) return // this dataset is not equipped with termdb

	const tdb = ds.cohort.termdb
	if (!tdb) throw 'ds.cohort is set but cohort.termdb{} missing'

	///////// TODO FIXME mess!! ds file should use ds.cohort.termdb.dbFile /////////////

	if (tdb.q) {
		// equipped with ds-supplied methods
	} else {
		if (!ds.cohort.termdb.dictionary) {
			if (!ds.cohort.db) throw 'ds.cohort is set but cohort.db{} missing'
			if (!ds.cohort.db.file && !ds.cohort.db.file_fullpath) throw 'ds.cohort.db.file missing'
		}
	}

	/***********************************************************
	 ** new properties created on tdb{} must be duplicated at  **
	 ** server/src/test/load.testds.js load_termjson()         **
	 ************************************************************/

	/* at minimum, an empty holder is needed for all ds (later gdc should populate this to distinguish sample types)
	k: sample type key
	v: {name, plural_name, parent_id}
	*/
	tdb.sampleTypes = {}

	if (tdb.q) {
	} else if (tdb?.dictionary?.gdcapi) {
		await gdcBuildDictionary(ds)
		// ds.cohort.termdb.q={} created
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

	if (tdb.isTermVisible) {
		if (typeof tdb.isTermVisible != 'function') throw 'tdb.isTermVisible not function'
	}

	mayValidateSelectCohort(tdb)

	// must validate selectCohort first, then restrictAncestries, as latter may depend on former
	await mayValidateRestrictAcestries(tdb)
	await mayInitiateScatterplots(ds)
	await mayInitiateMatrixplots(ds)
	await mayInitiateNumericDictionaryTermplots(ds)
	await validate_correlationVolcano(ds)

	if ('minTimeSinceDx' in tdb) {
		if (!Number.isFinite(tdb.minTimeSinceDx)) throw 'termdb.minTimeSinceDx not number'
		if (tdb.minTimeSinceDx <= 0) throw 'termdb.minTimeSinceDx<=0'
	}
	if ('ageEndOffset' in tdb) {
		if (!Number.isFinite(tdb.ageEndOffset)) throw 'termdb.ageEndOffset not number'
		if (tdb.ageEndOffset <= 0) throw 'termdb.ageEndOffset<=0'
	}

	if (tdb.convertSampleId) {
		if (tdb.convertSampleId.gdcapi) {
			gdc.convertSampleId_addGetter(tdb, ds)
			// convertSampleId.get() added
		} else {
			throw 'unknown implementation of tdb.convertSampleId'
		}
	}

	// since burden data is nested under ds.cohort, only validate it when ds.cohort is set
	await validate_cumburden(ds)

	// minimum empty holder required for all datasets (later gdc should populate it)
	// k: sampleid, v: type of that sample
	ds.sampleId2Type = new Map()

	if (ds.cohort?.db?.connection) {
		// gdc does not use db connection
		ds.sampleName2Id = new Map()
		ds.sampleId2Name = new Map()

		const sql = 'SELECT * FROM sampleidmap'
		const rows = ds.cohort.db.connection.prepare(sql).all()
		for (const r of rows) {
			ds.sampleId2Name.set(r.id, r.name)
			ds.sampleName2Id.set(r.name, r.id)
			ds.sampleId2Type.set(r.id, r.sample_type)
		}
		// XXX delete, not a good idea to dump all samples to client
		ds.getSampleIdMap = samples => {
			const d = {}
			for (const i in samples) {
				d[sampleId] = ds.sampleId2Name.get(+sampleId)
			}
			return d
		}
	}

	if (ds.cohort.mutationset) {
		// !!! TODO !!!
		// handle different sources/formats for gene variant data
		// instead of assumed mutation text files
		const { mayGetGeneVariantData, getTermTypes, mayGetMatchingGeneNames } = await import('./bulk.mset')
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
	if (sc.term.type != 'multivalue') throw 'type is not hardcoded "multivalue" from termdb.selectCohort.term'
	{
		const t = tdb.q.termjsonByOneid(sc.term.id)
		if (!t) throw 'termdb.selectCohort.term.id is invalid'
		if (t.type != 'multivalue') throw 'termdb.selectCohort.term type is not multivalue'
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

	//console.log('tdb.restrictAncestries{} PC term and sample counts:')
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
		if (a.PCcount <= 1) throw 'PCcount must be greater than 1'

		if (a.PCTermId) {
			a.pcs = new Map() // k: pc ID, v: Map(sampleId:value)
			for (let i = 1; i <= a.PCcount; i++) {
				const pctid = a.PCTermId + i // pc term id
				const pct = tdb.q.termjsonByOneid(pctid)
				if (!pct) throw 'a PC term is not found in termdb'
				const s2v = tdb.q.getAllValues4term(pctid)
				if (!s2v || !s2v.size) throw 'no sample PC values are retrieved by restrictAncestries term: ' + pctid
				a.pcs.set(pct.name, s2v)
				//console.log(pct.name, s2v.size)
			}
		} else if (a.PCBySubcohort) {
			for (const subcohort in a.PCBySubcohort) {
				// subcohort is the identifier of a sub-cohort; verify it matches one in selectCohort
				let missing = true
				for (const v of tdb.selectCohort.values) {
					if (subcohort == v.keys.sort().join(',')) {
						missing = false
						break
					}
				}
				if (missing) throw 'unknown subcohort from PCBySubcohort'
				const b = a.PCBySubcohort[subcohort]
				if (!b.termId) throw 'termId missing from a subcohort of PCBySubcohort'
				b.pcs = new Map()
				for (let i = 1; i <= a.PCcount; i++) {
					const pctid = b.termId + i // pc term id
					const pct = tdb.q.termjsonByOneid(pctid)
					if (!pct) throw 'a PC term is not found in termdb'
					const s2v = tdb.q.getAllValues4term(pctid)
					if (!s2v || !s2v.size) throw 'no sample PC values are retrieved by restrictAncestries.PCBySubcohort.<>.termId'
					b.pcs.set(pct.name, s2v)
					//console.log(pct.name, s2v.size)
				}
			}
		} else {
			throw 'unknown PC source and configuration for restrictAncestries'
		}
	}
}

async function call_barchart_data(twLst, q, combination, ds) {
	// makes sense to call barchart function as it adds counting logic over getData output

	const filter = combineFilterAndTid2value(q, ds) // optional filter, based on optional parameters

	const termid2values = new Map()
	// k: term id
	// v: [], element is [category, totalCount]
	for (const tw of twLst) {
		if (!tw.term) continue
		if (tw.term.type == 'categorical') {
			const _q = {
				term1_id: tw.term.id,
				term1_q: { type: 'values' },
				filter
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
			termid2values.set(tw.term.id, lst)
		}
	}
	if (combination) return [termid2values, combination]
	return termid2values
}

/*
detect following two optional attributes. if only one present, return the single filter; if both present, return joined filter
q.filterObj
q.tid2value
*/
function combineFilterAndTid2value(q, ds) {
	const lst = []
	if (q.filterObj) lst.push(q.filterObj)
	if (q.tid2value) lst.push(tid2value2filter(q.tid2value, ds))
	if (lst.length == 0) return
	if (lst.length == 1) return lst[0]
	return filterJoin(lst)
}

export async function validate_cumburden(ds) {
	if (!ds.cohort?.cumburden) return
	if (!ds.cohort.cumburden.dir) `missing ds.cohort.cumburden.dir`
	const dir = ds.cohort.cumburden.dir
	// in dev, pp-irt, and other environments with debugmode=true, support updateAttr[] ds overrides
	// to be able to access tp_native_dir or very specific writable container mount,
	// but do not allow when debugmode is false
	if (dir.includes('..') && !serverconfig.debugmode) throw `'..' path segment is not allowed in ds.cohort.cumburden.dir`
	if (!fs.existsSync(path.join(serverconfig.tpmasterdir, dir))) `ds.cohort.cumburden.dir='${dir}' not found`

	if (!ds.cohort.cumburden.files) `missing ds.cohort.cumburden.files`
	const inputFiles = ds.cohort.cumburden.files
	for (const name of ['fit', 'surv', 'sample']) {
		const fname = inputFiles[name]
		if (!fname) throw `missing ds.cohort.burden.files.${name}`
		if (fname.includes('..') && !serverconfig.debugmode)
			throw `'..' path segment is not allowed in ds.cohort.cumburden.files.${name}`
		const f = path.join(serverconfig.tpmasterdir, dir, fname)
		if (!fs.existsSync(f)) throw `ds.cohort.burden.files.${name}='${fname}' not found`
		const out = spawnSync(serverconfig.Rscript, ['-e', `load('${f}')`], {
			encoding: 'utf-8'
		})
		if (out?.status || out?.stderr) {
			console.log(out)
			throw `validation error, R loading of ds.cohort.cumburden.files.${name}`
		}
	}
	const db = ds.cohort.cumburden.db
	if (db) {
		if (!db.file) throw `missing ds.cohort.cumburden.file`
		try {
			console.log('Connecting to cumulative burden db', db.file)
			// must allow write access to cache previously computed estimates
			db.connection = utils.connect_db(db.file, { readonly: false })
			const rows = db.connection.prepare('SELECT count(*) as numrows FROM estimates').all()
			console.log(`Cumulative DB connected for ${ds.label}: ${db.file}, num rows=${rows[0]?.numrows}`)
		} catch (e) {
			throw `Cannot connect or invalid db ${db.file}: ${e.message || e}`
		}
	}
}

function copy_queries(ds, dscopy) {
	if (!ds.queries) return
	const copy = {}

	if (ds.queries.singleSampleMutation) {
		copy.singleSampleMutation = {
			sample_id_key: ds.queries.singleSampleMutation.sample_id_key,
			discoSkipChrM: ds.queries.singleSampleMutation.discoSkipChrM
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

	if (ds.queries.NIdata) {
		copy.NIdata = {}
		for (const k in ds.queries.NIdata) {
			copy.NIdata[k] = JSON.parse(JSON.stringify(ds.queries.NIdata[k]))
		}
	}

	const qs = ds.queries.snvindel
	if (qs) {
		dscopy.has_skewer = true
		copy.snvindel = {
			forTrack: qs.forTrack,
			vcfid4skewerName: qs.vcfid4skewerName,
			skewerRim: qs.skewerRim,
			ssmUrl: qs.ssmUrl
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
			q.byrange.bcffile = q.byrange.bcffile.startsWith(serverconfig.tpmasterdir)
				? q.byrange.bcffile
				: path.join(serverconfig.tpmasterdir, q.byrange.bcffile)
			q.byrange._tk = { file: q.byrange.bcffile }
			q.byrange.get = await snvindelByRangeGetter_bcf(ds, genome)
			if (!q.byrange._tk?.samples.length) {
				// vcf header parsing returns blank array when file has no sample
				delete q.byrange._tk.samples
			}
			mayValidateSampleHeader(ds, q.byrange._tk.samples, 'snvindel.byrange.bcffile')
		} else if (q.byrange.bcfMafFile) {
			q.byrange.bcffile = q.byrange.bcfMafFile.bcffile.startsWith(serverconfig.tpmasterdir)
				? q.byrange.bcfMafFile.bcffile
				: path.join(serverconfig.tpmasterdir, q.byrange.bcfMafFile.bcffile)
			q.byrange.maffile = q.byrange.bcfMafFile.maffile.startsWith(serverconfig.tpmasterdir)
				? q.byrange.bcfMafFile.maffile
				: path.join(serverconfig.tpmasterdir, q.byrange.bcfMafFile.maffile)
			q.byrange._tk = { file: q.byrange.bcffile, maffile: q.byrange.maffile }
			q.byrange.get = await snvindelByRangeGetter_bcfMaf(ds, genome)
			mayValidateSampleHeader(ds, q.byrange._tk.samples, 'snvindel.byrange.bcffile')
		} else if (q.byrange.chr2bcffile) {
			q.byrange._tk = { chr2files: {} } // to hold small tk obj from each chr
			for (const chr in q.byrange.chr2bcffile) {
				q.byrange._tk.chr2files[chr] = { file: path.join(serverconfig.tpmasterdir, q.byrange.chr2bcffile[chr]) }
			}
			delete q.byrange.chr2bcffile

			// repeat as above
			q.byrange.get = await snvindelByRangeGetter_bcf(ds, genome)
			if (!q.byrange._tk.samples?.length) {
				// vcf header parsing returns blank array when file has no sample
				delete q.byrange._tk.samples
			}
			mayValidateSampleHeader(ds, q.byrange._tk.samples, 'snvindel.byrange.bcffile')
		} else {
			throw 'unknown query method for queries.snvindel.byrange'
		}
	}

	if (q.byisoform) {
		if (typeof q.byisoform.get == 'function') {
			// ds supplied getter, don't need anything else
		} else if (q.byisoform.gdcapi) {
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

	if (q.populations) {
		if (!Array.isArray(q.populations)) throw '.populations[] is not array'
		if (q.populations.length == 0) throw 'q.populations[] blank'
		for (const p of q.populations) {
			if (!p.key) throw 'population.key missing'
			if (!p.label) throw 'population.label missing'
			if (!Array.isArray(p.sets)) throw 'population.sets[] is not array'
			if (p.sets.length == 0) throw 'population.sets[] blank'
			if (p.allowto_adjust_race && p.sets.length == 1) throw 'allowto_adjust_race cannot be true: sets[] is length of 1'
			for (const s of p.sets) {
				if (!s.infokey_AC) throw 'set.infokey_AC missing'
				if (!s.infokey_AN) throw 'set.infokey_AN missing'
				//verify info field
				if (q.byrange?._tk?.info) {
					if (!q.byrange._tk.info[s.infokey_AC]) throw 'unknown set.infokey_AC'
					if (!q.byrange._tk.info[s.infokey_AN]) throw 'unknown set.infokey_AN'
				} else {
					throw 'unknown way to access snvindel info fields'
				}
				if (p.sets.length == 1) {
					if (s.key) throw 'population.sets[] has single element, in such case set.key is not allowed'
				} else {
					if (!s.key) throw 'population.sets[] has multiple elements and set.key=termid is required'
					if (!ds.cohort.termdb.q.termjsonByOneid(s.key)) throw 'term not found for populations.sets[].key=' + s.key
				}
			}
		}
	}
}

// this function assumes file header uses integer sample id. TODO when all files are migrated to using string sample name, delete this function
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
// for data files using string sample name in header line, call this function to map each sample name to integer id and return the id array; it replaces mayValidateSampleHeader()
// samples[] elements: {name:str}
// returns new array with same length as samples[], {name:int}
function validateSampleHeader2(ds, samples, where) {
	const sampleIds = []
	// ds?.cohort?.termdb.q.sampleName2id must be present
	const unknownSamples = [] // samples present in big file header but missing from db
	if (ds.cohort?.termdb?.q?.sampleName2id) {
		// has id mapper and is official ds
		for (const s of samples) {
			const id = ds.cohort.termdb.q.sampleName2id(s.name)
			if (!Number.isInteger(id)) {
				unknownSamples.push(s.name)
				// TODO if file with unknown sample should still be usable, slot a mock element in sampleIds[]. downstream query should be able to ignore it
				continue
			}
			s.name = id
			sampleIds.push(s)
		}
		console.log(samples.length, 'samples from ' + where + ' of ' + ds.label)
		if (unknownSamples.length) {
			// unknown samples can be safely reported to server log
			console.log('unknown samples: ' + unknownSamples.join(', '))
			// later attach a sanitized err msg to ds to report to client
			throw 'unknown samples in big file'
		}
	} else {
		// no mapper, should be custom ds from custom bcf file
		for (const s of samples) sampleIds.push(s)
	}
	return sampleIds
}

function validate_ssm2canonicalisoform(ds) {
	// gdc-specific logic
	if (!ds.ssm2canonicalisoform) return
	if (ds.ssm2canonicalisoform.gdcapi) {
		gdc.validate_ssm2canonicalisoform(ds.ssm2canonicalisoform, ds.getHostHeaders) // add get()
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

/* generate getter as ds.queries.snvindel.byrange.get() when both bcffile(no samples) and maffile are provided

Called to initiate official dataset, in this script 

getter input:
.rglst=[ {chr, start, stop} ] (required)
.tid2value = { termid1:v1, termid2:v2, ...} (optional, to restrict samples)

getter returns:
array of variants with array of sample ids attached to each variant
as .samples=[ {sample_id} ]
*/
export async function snvindelByRangeGetter_bcfMaf(ds, genome) {
	const q = ds.queries.snvindel.byrange
	/* q{}
	._tk={}
        	.file= absolute path to bcf file
		.maffile= absolute path to maf file
		.dir=str
		.nochr=true
		.sampleIdx=int // index of sample column in maf file
		.formatIdx=Map()
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
		.samples=[ {name:str}, ... ]
	.
	*/
	await utils.init_one_vcfMaf(q._tk, genome, true) // "true" to indicate file is bcf but not vcf
	// q._tk{} is initiated
	if (q._tk.format) {
		for (const id in q._tk.format) {
			if (id == 'GT') {
				q._tk.format[id].isGT = true
			}
		}
	}
	if (ds.queries.snvindel.format4filters) {
		// array of format keys; allow to be used as filters on client
		if (!Array.isArray(ds.queries.snvindel.format4filters)) throw 'snvindel.format4filters[] is not array'
		for (const k of ds.queries.snvindel.format4filters) {
			if (q._tk.format[k]) q._tk.format[k].isFilter = true // allow it to work as filter on client
		}
		delete ds.queries.snvindel.format4filters
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
		utils.validateRglst(param, genome)
		const formatFilter = getFormatFilter(param)

		let bcfpath = q._tk.file
		const bcfArgs = [
			'query',
			bcfpath,
			'-r',
			// plus 1 to start, as rglst pos is 0-based, and bcf is 1-based
			param.rglst
				.map(r => (q._tk.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + (r.start + 1) + '-' + r.stop)
				.join(','),
			'-f',
			'%ID\t%CHROM\t%POS\t%REF\t%ALT\t%INFO\n'
		]

		const limitSamples = await mayLimitSamples(param, q._tk.samples, ds)
		if (limitSamples && limitSamples.size == 0) {
			// got 0 sample after filtering, return blank array for no data
			return []
		}
		if (param.variantFilter) {
			add_bcf_variant_filter(param.variantFilter, bcfArgs)
		}

		const variantsNoSample = []

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
					if (m0.mlst.length > 1 && mayDropMbyInfoFilter_2(m, param)) continue // remove param.variantFilter?.lst
					m.chr = (q._tk.nochr ? 'chr' : '') + chr
					//m.pos = pos - 1 // bcf pos is 1-based, return 0-based
					m.ssm_id = [m.chr, m.pos, m.ref, m.alt].join(ssmIdFieldsSeparator)

					// acceptable variant
					variantsNoSample.push(m)
				}
			}
		})

		// obtain samples for each of variant from maf file
		let mafpath = q._tk.maffile
		let sampleIdx = q._tk.sampleIdx
		let formatIdx = q._tk.formatIdx
		const mafArgs = [
			mafpath,
			param.rglst
				.map(r => (r.chr.startsWith('chr') ? r.chr : 'chr' + r.chr) + ':' + r.start + '-' + (r.stop + 1))
				.join(',')
		]

		const variantSamples = {} // { ssm_id: [ {sample_id} ]} for adding samples to the variants

		await utils.get_lines_bigfile({
			args: mafArgs,
			dir: q._tk.dir,
			callback: line => {
				const l = line.split('\t')
				const chr = l[0],
					pos = Number(l[1]) - 1,
					refallele = l[2],
					altallele = l[3]
				const sample = l[sampleIdx]
				const sampleInt = ds.sampleName2Id.get(sample)
				if (limitSamples && !limitSamples.has(sampleInt)) return // this sample is filtered out

				// this same passes filter, associate with a ssm_id
				const ssm_id = [chr, pos, refallele, altallele].join(ssmIdFieldsSeparator)
				if (!variantSamples.hasOwnProperty(ssm_id)) variantSamples[ssm_id] = []

				const sampleObj = { sample_id: sampleInt }
				if (param.addFormatValues) {
					const formatK2v = {} // key: FORMAT ID, value: value in this sample
					for (const format of formatIdx.keys()) {
						const fv = l[formatIdx.get(format)]
						if (!fv) continue
						if (q._tk.format[format].isGT) {
							formatK2v.GT = fv
						} else {
							formatK2v[format] = fv
						}
					}
					sampleObj.formatK2v = formatK2v
				}
				variantSamples[ssm_id].push(sampleObj)
			}
		})

		// add samples to variants
		const variants = []
		for (const variant of variantsNoSample) {
			if (variantSamples.hasOwnProperty(variant.ssm_id)) {
				variant.samples = variantSamples[variant.ssm_id]
				variants.push(variant)
			}
		}
		return variants
	}
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

	if (q._tk.file || q._tk.url) {
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
		q._tk.samples = validateSampleHeader2(ds, q._tk.samples, 'snvindel.byrange') // snvindel is using string sample name
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
		utils.validateRglst(param, genome)

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
			// plus 1 to start, as rglst pos is 0-based, and bcf is 1-based
			param.rglst
				.map(r => (q._tk.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + (r.start + 1) + '-' + r.stop)
				.join(','),
			'-f',
			'%ID\t%CHROM\t%POS\t%REF\t%ALT\t%INFO\t%FORMAT\n'
		]

		const limitSamples = await mayLimitSamples(param, q._tk.samples, ds)
		if (limitSamples) {
			// is a valid set, parameter asks to filter samples

			if (limitSamples.size == 0) {
				// got 0 sample after filtering, return blank array for no data
				return []
			}

			const l = []
			for (const s of limitSamples) {
				l.push(ds.cohort.termdb.q.id2sampleName(s))
			}
			bcfArgs.push('-s', l.join(','))
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
			// no value. client displays such values with the hardcoded value. compare if it is to be skipped
			if (param.infoFilter[infoKey].includes(unannotatedKey)) return true // skip unannotated value
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
limitSamples=set of sample integer id
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
	let headerSamples = q._tk.samples // order of samples in l[] to be consistent with headerSamples
	if (limitSamples) {
		// header samples to point to this
		// Not a bug! when sample filter is not applied, l[] contains whole vcf line going by the order of _tk.samples[]
		// if filtering, "bcftools -s" returns only those samples in given order in l[]
		headerSamples = [...limitSamples].map(i => {
			return { name: i }
		})
	}
	for (const [i, sampleHeaderObj] of headerSamples.entries()) {
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
	if (!q.byrange && !q.byname) throw 'both byrange and byname missing from queries.svfusion'
	if (q.byrange) {
		if (q.byrange.file) {
			q.byrange.file = q.byrange.file.startsWith(serverconfig.tpmasterdir)
				? q.byrange.file
				: path.join(serverconfig.tpmasterdir, q.byrange.file)
			q.byrange.get = await svfusionByRangeGetter_file(ds, genome)
			mayValidateSampleHeader(ds, q.byrange.samples, 'svfusion.byrange')
		} else {
			throw 'unknown query method for svfusion.byrange'
		}
	}
	if (q.byname) {
		if (q.byname.file) {
			q.byname.file = q.byname.file.startsWith(serverconfig.tpmasterdir)
				? q.byname.file
				: path.join(serverconfig.tpmasterdir, q.byname.file)
			q.byname.get = await svfusionByNameGetter_file(ds, genome)
			//mayValidateSampleHeader(ds, q.byrange.samples, 'svfusion.byrange')
		} else {
			throw 'unknown query method for svfusion.byname'
		}
	}
}

async function validate_query_cnv(ds, genome) {
	// cnv segments, compared to geneCnv
	const q = ds.queries.cnv
	if (!q) return
	if (!q.densityViewCutoff) q.densityViewCutoff = 1000
	if (!Number.isInteger(q.densityViewCutoff)) throw 'cnv.densityViewCutoff not integer'
	if (!q.maxReturnCutoff) q.maxReturnCutoff = 10000
	if (!Number.isInteger(q.maxReturnCutoff)) throw 'cnv.maxReturnCutoff not integer'

	if (typeof q.get == 'function') return // ds-supplied
	// add built in getter
	if (!q.file) throw 'cnv.file missing'
	// incase the same ds js file is included twice on this pp, the file will already become absolute path
	q.file = q.file.startsWith(serverconfig.tpmasterdir) ? q.file : path.join(serverconfig.tpmasterdir, q.file)
	q.get = await addCnvGetter(ds, genome)
	mayValidateSampleHeader(ds, q.samples, 'cnv')
}

async function validate_query_ld(ds, genome) {
	const q = ds.queries.ld
	if (!q) return
	if (!Array.isArray(q.tracks) || !q.tracks.length) throw 'ld.tracks[] not nonempty array'
	for (const k of q.tracks) {
		if (!k.name) throw 'name missing from one of ld.tracks[]'
		if (!k.file) throw '.file missing from one of ld.tracks[]'
		const f = path.join(serverconfig.tpmasterdir, k.file)
		await utils.validate_tabixfile(f)
		k.nochr = await utils.tabix_is_nochr(f, null, genome)
		k.type = 'ld' // assign hardcoded type and pass to client to use in block
	}
	if (!q.overlay) throw 'ld.overlay{} missing'
	if (!q.overlay.color_0) throw 'ld.overlay.color_0 missing'
	if (!q.overlay.color_1) throw 'ld.overlay.color_1 missing'
}

export async function validate_query_metaboliteIntensity(ds, genome) {
	const q = ds.queries.metaboliteIntensity
	if (!q) return
	q.metaboliteIntensity2bins = {}

	if (q.src == 'native') {
		await validateMetaboliteIntensityNative(q, ds, genome)
		return
	}
	throw 'unknown queries.metaboliteIntensity.src'
}

async function validateMetaboliteIntensityNative(q, ds, genome) {
	if (!q.file.startsWith(serverconfig.tpmasterdir)) q.file = path.join(serverconfig.tpmasterdir, q.file)
	if (!q.samples) q.samples = []
	await utils.validate_txtfile(q.file)
	q.samples = []

	{
		// is a metabolite-by-sample matrix file
		const line = await utils.get_header_txt(q.file)
		const l = line.split('\t')
		for (let i = 1; i < l.length; i++) {
			const id = ds.cohort.termdb.q.sampleName2id(l[i])
			if (id == undefined) throw 'queries.metaboliteIntensity: unknown sample from header: ' + l[i]
			q.samples.push(id)
		}
	}

	q.find = async metabolites => {
		// if !q.metabolites, read all metabolites from file
		if (!q._metabolites) {
			const metabolites = []
			await utils.get_lines_txtfile({
				args: [q.file],
				callback: line => {
					const l = line.split('\t')
					if (l[0].startsWith('#Metabolites')) return
					metabolites.push(l[0])
				}
			})
			q._metabolites = metabolites
		}

		const matches = []
		for (const m of metabolites) {
			if (!m) continue
			for (const metabolite of q._metabolites) {
				if (metabolite.toLowerCase().includes(m.toLowerCase())) {
					matches.push(metabolite)
				}
			}
		}
		return matches
	}

	q.get = async param => {
		const limitSamples = await mayLimitSamples(param, q.samples, ds)
		if (limitSamples?.size == 0) {
			// got 0 sample after filtering, must still return expected structure with no data
			return { term2sample2value: new Set(), byTermId: {}, bySampleId: {} }
		}

		// has at least 1 sample passing filter and with intensity data
		// TODO what if there's just 1 sample not enough for clustering?
		const bySampleId = {}
		const samples = q.samples || []
		if (limitSamples) {
			for (const sid of limitSamples) {
				bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) }
			}
		} else {
			// use all samples with exp data
			for (const sid of samples) {
				bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) }
			}
		}

		const term2sample2value = new Map() // k: metabolite name, v: { sampleId : value }
		for (const m of param.terms) {
			if (!m) continue

			const s2v = {}
			let metabolite = m.name
			await utils.get_lines_txtfile({
				args: [q.file],
				callback: line => {
					const l = line.split('\t')
					if (l[0].toLowerCase() != metabolite.toLowerCase()) return
					metabolite = l[0]
					for (let i = 1; i < l.length; i++) {
						const sampleId = samples[i - 1]
						if (limitSamples && !limitSamples.has(sampleId)) continue // doing filtering and sample of current column is not used
						if (!l[i]) continue // blank string
						const v = Number(l[i])
						if (Number.isNaN(v)) throw 'exp value not number'
						s2v[sampleId] = v
					}
					if (Object.keys(s2v).length) term2sample2value.set(metabolite, s2v) // only add metabolite if it has data
				}
			})
		}
		// pass blank byTermId to match with expected output structure
		const byTermId = {}
		if (term2sample2value.size == 0) throw 'no data available for the input ' + param.terms?.map(g => g.name).join(', ')
		return { term2sample2value, byTermId, bySampleId }
	}
}

// no longer used
async function validate_query_probe2cnv(ds, genome) {
	const q = ds.queries.probe2cnv
	if (!q) return
	if (q.file) {
		q.file = path.join(serverconfig.tpmasterdir, q.file)
		await utils.validate_tabixfile(q.file)
	} else if (q.url) {
		q.dir = await utils.cache_index(q.url, q.indexURL)
	} else {
		throw 'file and url both missing on probe2cnv'
	}
	q.nochr = await utils.tabix_is_nochr(q.file || q.url, null, genome)

	{
		const lines = await utils.get_header_tabix(q.file)
		if (!lines[0]) throw 'header line missing from ' + q.file
		// file is matrix, rows are probes, cols are samples
		// #chr pos sample1 sample2 ...
		const l = lines[0].split('\t')
		if (l.length < 3) throw 'probe2cnv header line less than 3 fields'
		// register sample columns in q.samples[]
		q.samples = l.slice(2).map(n => {
			return { name: ds.cohort.termdb.q.sampleName2id(n) }
		})
	}

	/* same parameter as snvindel.byrange.get()
	.rglst[] - retrieve probes from regions
	.filterObj - for samples passing this filter, compute a cnv call for each, using average/median probe values of the sample
	filter0 is not used as this will not work for gdc
	format attributes are not used since this file does not supply format values for events (unlike cnv segment file in bed-json)
	*/
	q.get = async param => {
		utils.validateRglst(param, genome)
		if (param.cnvGainCutoff && !Number.isFinite(param.cnvGainCutoff)) throw 'cnvGainCutoff is not finite'
		if (param.cnvLossCutoff && !Number.isFinite(param.cnvLossCutoff)) throw 'cnvLossCutoff is not finite'

		// same length as q.samples[]; element is [] to collect probe values from this sample(column); if the sample is filtered out, element is null and won't collect value
		const sampleCollectValues = []
		{
			const limitSamples = await mayLimitSamples(param, q.samples, ds) // optional set of sample integer ids
			if (limitSamples) {
				if (limitSamples.size == 0) return []
				for (const [i, s] of q.samples.entries()) {
					if (limitSamples.has(s.name)) sampleCollectValues.push([])
					else sampleCollectValues.push(null)
				}
			} else {
				for (const i of q.samples) sampleCollectValues.push([])
			}
		}

		for (const r of param.rglst) {
			await utils.get_lines_bigfile({
				args: [q.file, (q.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop],
				dir: q.dir,
				callback: line => {
					const l = line.split('\t')
					for (const [i, s] of sampleCollectValues.entries()) {
						if (!s) continue // element is null and this sample is filtered out
						const v = Number(l[i + 2])
						if (Number.isFinite(v)) s.push(v)
					}
				}
			})
		}
		// sampleCollectValues[] is populated; based on cutoffs, generate CNV calls for each eligible sample
		const cnvs = []
		for (const [i, s] of sampleCollectValues.entries()) {
			if (!s) continue
			// compute median probe value of each sample
			const median = computePercentile(s, 50)
			const cnvEvent = {
				dt: dtcnv,
				value: median,
				samples: [{ sample_id: q.samples[i].name }]
			}
			if (median > 0 && median > (param.cnvGainCutoff || 0.1)) {
				cnvEvent.class = mclasscnvgain
			} else if (median < 0 && median < (param.cnvLossCutoff || -0.1)) {
				cnvEvent.class = mclasscnvloss
			}
			if (cnvEvent.class) cnvs.push(cnvEvent)
		}
		return cnvs
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

				// TODO use string sample name but not id
				const file = path.join(serverconfig.tpmasterdir, q[key].folder, fileName.toString())

				try {
					await fs.promises.stat(file)
				} catch (e) {
					if (e.code == 'EACCES') throw 'cannot read file, permission denied'
					if (e.code == 'ENOENT') throw 'no data for this sample'
					throw 'failed to load data'
				}

				const result = await plotSampleGenomeQuantification(file, genome, q[key], devicePixelRatio)
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
		axisWidth = 10

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

	const yScale = scaleLinear().domain([control.min, control.max]).range([axisHeight, 0])

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

async function validate_query_trackLst(ds, genome) {
	const q = ds.queries.trackLst
	if (!q) return
	q.facets = [] // one or more facet tables
	if (q.jsonFile) {
		const f = path.join(serverconfig.tpmasterdir, q.jsonFile)
		await utils.file_is_readable(f)
		try {
			const json = JSON.parse(fs.readFileSync(f, { encoding: 'utf8' }))
			/*
			document legacy structure
			*/
			if (Array.isArray(json)) {
				for (const i of json) {
					if (i.isfacet) {
						q.facets.push(i)
					} else {
						throw 'unknown element of trackLst json[]'
					}
				}
			} else {
				throw 'unknown structure of json trackLst file'
			}
		} catch (e) {
			throw 'trackLst error: ' + e
		}
		delete q.jsonFile
	} else {
		throw 'unknown config for queries.trackLst{}'
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
		q.samples = validateSampleHeader2(ds, q.samples, 'svfusion.byrange') // svfusion is using string sample names
	}

	// same parameter as snvindel.byrange.get()
	return async param => {
		utils.validateRglst(param, genome)

		const formatFilter = getFormatFilter(param)

		const limitSamples = await mayLimitSamples(param, q.samples, ds)
		if (limitSamples?.size == 0) {
			// got 0 sample after filtering, return blank array for no data
			return []
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

					if (j.sample) {
						j.sample = ds.cohort.termdb.q.sampleName2id(j.sample)
						if (limitSamples) {
							// to filter sample
							if (!limitSamples.has(j.sample)) return
						}
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

						sampleObj = {
							sample_id: j.sample,
							/* ssm_id of a fusion can only identify one breakend. 
							position of the other breakend is missing from ssm_id
							must attach pairlst at a sample so it's available to downstream
							_pairlst is not required for skewer summary view, but required for sample table view
							where sample._pairlst must be used instead of m.pairlst for displaying actual breakpoints in each sample

							known issue!
							on clicking a fusion disk that covers multiple fusion m objects,
							it still displays a single breakpoint for each m object, dispite samples from a m can have different breakpoints
							this is due to practical design issue that sample-level breakpoint info is not known at the aggregated skewer view
							*/
							_pairlst: pairlst
						}

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

// this getter processes svfusion file with data that are lacking breakpoint positions, and will return events without coordinates
export async function svfusionByNameGetter_file(ds, genome) {
	const q = ds.queries.svfusion.byname
	return async param => {
		utils.validateRglst(param, genome)

		const formatFilter = getFormatFilter(param)

		const limitSamples = await mayLimitSamples(param, q.samples, ds)
		if (limitSamples?.size == 0) {
			// got 0 sample after filtering, return blank array for no data
			return []
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

		const headerLine = await utils.get_header_txt(q.file)
		const header = headerLine.toLowerCase().split('\t')
		if (header.length <= 1) return 'invalid file header for fusions'

		await utils.get_lines_txtfile({
			args: [q.file],
			callback: line => {
				const l = line.split('\t')
				const m = {}
				for (let i = 0; i < header.length; i++) {
					m[header[i]] = l[i]
				}

				for (const r of param.rglst) {
					if (!r) continue
					let rName = r.name
					if (m['gene_a'].toLowerCase() != rName.toLowerCase() && m['gene_b'].toLowerCase() != rName.toLowerCase())
						continue

					const pos =
						m['gene_a'].toLowerCase() == rName.toLowerCase()
							? Number(m['position_a'])
							: m['gene_b'].toLowerCase() == rName.toLowerCase()
							? Number(m['position_b'])
							: undefined

					const eventType = m['event_type']
					const dt = eventType == 'fusion' ? dtfusionrna : eventType == 'sv' ? dtsv : undefined
					if (!dt) throw `unsupported event type: ${eventType}`
					const j = { dt, class: dt == dtsv ? mclasssv : mclassfusionrna, mattr: { origin: m['origin'] } }

					// FIXME file should use sample name but not integer id
					j.sample = ds.cohort.termdb.q.sampleName2id(m['sample_name'])

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
					if (m['gene_a'].toLowerCase() == rName.toLowerCase()) {
						pairlstIdx = 0
						mname = m['gene_b'] || m['chr_b']
						strand = m['strand_b']
						//
						pairlst = [
							{
								a: { chr: m['chr_a'], pos: m['position_a'], strand: m['strand_a'], name: m['gene_a'] },
								b: { chr: m['chr_b'], pos: m['position_b'], strand, name: m['gene_b'] }
							}
						]
					} else if (m['gene_b'].toLowerCase() == rName.toLowerCase()) {
						pairlstIdx = 1
						mname = m['gene_a'] || m['chr_a']
						strand = m['strand_a']
						pairlst = [
							{
								a: { chr: m['chr_a'], pos: m['position_a'], strand, name: m['gene_a'] },
								b: { chr: m['chr_b'], pos: m['position_b'], strand: m['strand_b'], name: m['gene_b'] }
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
						throw 'missing geneA and geneB'
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
			}
		})
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
async function addCnvGetter(ds, genome) {
	const q = ds.queries.cnv
	if (q.file) {
		await utils.validate_tabixfile(q.file)
	} else if (q.url) {
		q.dir = await utils.cache_index(q.url, q.indexURL)
	} else {
		throw 'file and url both missing on cnv{}'
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
		q.samples = validateSampleHeader2(ds, q.samples, 'cnv') // cnv is using string sample names
	}

	/* extra parameters from snvindel.get():
	cnvMaxLength: int
	cnvGainCutoff: float
	cnvLossCutoff: float
	*/
	return async param => {
		utils.validateRglst(param, genome)
		if (param.cnvMaxLength && !Number.isInteger(param.cnvMaxLength)) throw 'cnvMaxLength is not integer' // cutoff<=0 is ignored
		if (param.cnvGainCutoff && !Number.isFinite(param.cnvGainCutoff)) throw 'cnvGainCutoff is not finite'
		if (param.cnvLossCutoff && !Number.isFinite(param.cnvLossCutoff)) throw 'cnvLossCutoff is not finite'

		const formatFilter = getFormatFilter(param)

		const limitSamples = await mayLimitSamples(param, q.samples, ds)
		if (limitSamples?.size == 0) {
			// got 0 sample after filtering, return blank array for no data
			return []
		}

		const cnvs = []
		for (const r of param.rglst) {
			await utils.get_lines_bigfile({
				args: [q.file || q.url, (q.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop],
				dir: q.dir,
				callback: (line, ps) => {
					if (cnvs.length > ds.queries.cnv.maxReturnCutoff) {
						/* exceeds max allowed limit. do not accept new data anymore
						do this before parsing new cnv and inserting to array
						*/
						ps.kill()
						return
						// lacks a way to message downstream
					}

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

					j.chr = r.chr
					j.start = start
					j.stop = stop

					/*

					TODO need queries.cnv.type=cat/lr/cn

						if value=number is present, it's a quantitative call, j.class will be computed dynamically
							TODO distinguish segmean vs integer copy number; what class to assign when value is copy number?
						if value is missing, it should be a qualitative call, with j.class=mclasscnvgain/mclasscnvloss 
						*/
					if (Number.isFinite(j.value)) {
						// quantitative
						if (j.value > 0 && param.cnvGainCutoff && j.value < param.cnvGainCutoff) return
						if (j.value < 0 && param.cnvLossCutoff && j.value > param.cnvLossCutoff) return
						j.class = j.value > 0 ? mclasscnvgain : mclasscnvloss
					} else {
						// should be qualitative, valid class is required
						if (j.class != mclasscnvgain && j.class != mclasscnvloss) return // no valid class
					}

					if (param.hiddenmclass && param.hiddenmclass.has(j.class)) return

					if (j.sample) {
						j.sample = ds.cohort.termdb.q.sampleName2id(j.sample)
						if (limitSamples) {
							// to filter sample
							if (!limitSamples.has(j.sample)) return
						}
					}

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

						j.ssm_id = [r.chr, j.start, j.stop, j.class, j.value, j.sample].join(ssmIdFieldsSeparator)

						delete j.sample
						j.samples = [sampleObj]
						j.occurrence = 1 // each cnv seg is hardcoded to only have 1 sample
					} else {
						// cnv without sample
						j.ssm_id = [r.chr, j.start, j.stop, j.class, j.value].join(ssmIdFieldsSeparator)
					}
					cnvs.push(j)
				}
			})
		}
		return cnvs
	}
}

function mayAdd_mayGetGeneVariantData(ds, genome) {
	if (!ds.queries.snvindel && !ds.queries.svfusion && !ds.queries.geneCnv && !ds.queries.cnv) {
		// no eligible data types
		return
	}

	/*
	input:
	tw{}
		a termwrapper on a geneVariant term
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
		if (!tw.term.gene && !(tw.term.chr && Number.isInteger(tw.term.start) && Number.isInteger(tw.term.stop)))
			throw 'no gene or position specified'
		if (tw.q.type == 'predefined-groupset' || tw.q.type == 'custom-groupset') {
			if (tw.q.type == 'predefined-groupset' && !Number.isInteger(tw.q.predefined_groupset_idx))
				throw 'predefined_groupset_idx is not an integer value'
			if (tw.q.type == 'custom-groupset' && !tw.q.customset) throw 'invalid customset'
		}

		// NOTE: the following has some code duplication with
		// mds3.load.js query_snvindel() etc
		// primary concern is tw.term may be missing coord/isoform
		// to perform essential query

		// query all dts specified in dataset
		const sample2mlst = new Map()
		const dts = []
		if (ds.queries.snvindel) dts.push(dtsnvindel)
		if (ds.queries.svfusion) dts.push(dtfusionrna)
		if (ds.queries.cnv) dts.push(dtcnv)
		if (ds.queries.geneCnv) dts.push('geneCnv')

		// retrieve mutation data for each dt
		const termdbmclass = q.ds?.cohort?.termdb?.mclass // custom mclass labels from dataset
		for (const dt of dts) {
			const mlst =
				dt == dtsnvindel
					? await getSnvindelByTerm(ds, tw.term, genome, q)
					: dt == dtfusionrna || dt == dtsv
					? await getSvfusionByTerm(ds, tw.term, genome, q)
					: dt == dtcnv
					? await getCnvByTw(ds, tw, genome, q)
					: dt == 'geneCnv'
					? await getGenecnvByTerm(ds, tw.term, genome, q)
					: []

			if (!mlst) continue // cnv seg query now may return undefined

			//////////////////////////////////////
			// MUST NOT QUIT when mlst.length==0!
			//////////////////////////////////////
			// if ds has assayAvailability, on empty mlst, it should proceed to add wt status to all assayed samples

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
					// create new m2{} for each mutation in each sample
					const m2 = {
						gene: tw.term.name,
						isoform: m.isoform,
						dt: m.dt,
						chr: tw.term.chr,
						class: m.class,
						mname: m.mname,
						label: termdbmclass?.[m.class]?.label || mclass[m.class].label
					}
					if (m.start) m2.start = m.start
					if (m.stop) m2.stop = m.stop
					if (m.pos) m2.pos = m.pos

					if ('value' in m) {
						// for what?
						m2.value = m.value
					}

					if (s.formatK2v) {
						// flatten the format values
						for (const k in s.formatK2v) {
							if (k == 'origin' && !ds.assayAvailability?.byDt?.[dt]?.byOrigin) {
								// possible that a dt can have origin
								// annotations in data file, but not
								// in ds.assayAvailability{}, because
								// some data files use fake origin
								// annotations for compatibility
								// purposes (see mbmeta CNV data file)
								continue
							}
							m2[k] = s.formatK2v[k]
						}
					}

					// can supply dt specific attributes
					if (m.dt == dtsnvindel) {
						if (s.GT) {
							// is sample genotype from snp query
							m2.value = s.GT
							m2.key = s.GT
						}
					} else if (m.dt == dtfusionrna || m.dt == dtsv) {
						m2.pairlst = m.pairlst
					}

					if (!sample2mlst.has(s.sample_id)) sample2mlst.set(s.sample_id, [])
					const lst = sample2mlst.get(s.sample_id)
					lst.push(m2)
					sample2mlst.set(s.sample_id, lst)
				}
			}

			await mayAddDataAvailability(sample2mlst, dt, ds, tw.q.origin, q.filter)
		}

		const groupset = get_active_groupset(tw.term, tw.q)

		const data = new Map() // to return
		for (const [sample, mlst] of sample2mlst) {
			if (groupset) {
				// groupsetting is active
				// get the first group of groupset that the sample can be assigned to
				// for example: if groups[0] is SNV=M and groups[1] is
				// CNV=Loss and a sample has both SNV=M and CNV=Loss, then
				// the sample will be assigned to groups[0]
				const group = groupset.groups.find(group => {
					if (group.type != 'filter') throw 'unexpected group.type'
					const filter = group.filter
					const [pass, tested] = filterByTvsLst(filter, mlst)
					return pass
				})

				if (!group || group.uncomputable) continue

				// store sample data
				// key will be the name of the assigned group
				data.set(sample, {
					sample,
					[tw.$id]: { key: group.name, label: group.name, value: group.name, values: mlst }
				})
			} else {
				// groupsetting is not active
				data.set(sample, {
					sample,
					[tw.$id]: { key: tw.term.name, label: tw.term.name, values: mlst }
				})
			}
		}

		return data
	}
}

async function mayAddDataAvailability(sample2mlst, dtKey, ds, origin, filter) {
	if (!ds.assayAvailability?.byDt) return // this ds is not equipped with assay availability by dt
	const _dt = structuredClone(ds.assayAvailability.byDt[dtKey])
	if (!_dt) return // this ds has assay availability but lacks setting for this dt. this is allowed e.g. we only specify availability for cnv but not snvindel.
	const sampleFilter = filter ? new Set((await get_samples(filter, ds)).map(i => i.id)) : null
	const dts = []
	if (_dt.byOrigin) {
		for (const o in _dt.byOrigin) {
			if (origin && origin != o) continue // if specific origin is requested then restrict to that origin
			const dt = _dt.byOrigin[o]
			dt.origin = o
			dts.push(dt)
		}
	} else {
		dts.push(_dt)
	}
	for (const dt of dts) {
		for (const sid of dt.yesSamples) {
			// sample has been assayed
			// if sample does not have annotated mutation for dt
			// then it will be annotated as wildtype
			addDataAvailability(sid, sample2mlst, dtKey, 'WT', dt.origin, sampleFilter)
		}
		for (const sid of dt.noSamples) {
			// sample has not been assayed
			// annotate the sample as not tested
			addDataAvailability(sid, sample2mlst, dtKey, 'Blank', dt.origin, sampleFilter)
		}
	}
}

function addDataAvailability(sid, sample2mlst, dtKey, mclass, origin, sampleFilter) {
	if (sampleFilter && !sampleFilter.has(sid)) return
	if (!sample2mlst.has(sid)) sample2mlst.set(sid, [])
	const mlst = sample2mlst.get(sid)
	if (origin) {
		if (!mlst.some(m => m.dt == dtKey && m.origin == origin)) {
			// sample does not have a mutation with this origin for this dt
			// sample will be annotated with the given mclass for the given origin
			mlst.push({ dt: Number(dtKey), class: mclass, origin, _SAMPLEID_: sid })
		}
	} else {
		if (!mlst.some(m => m.dt == dtKey)) {
			// sample does not have a mutation for this dt
			// sample will be annotated with the given mclass
			mlst.push({ dt: Number(dtKey), class: mclass, _SAMPLEID_: sid })
		}
	}
	sample2mlst.set(sid, mlst)
}

// function to filter a sample based on its mlst and a tvslst
function filterByTvsLst(filter, mlst) {
	if (filter.type != 'tvslst') throw 'unexpected filter.type'
	const passLst = []
	const testedLst = []
	for (const item of filter.lst) {
		const [pass, tested] = filterByItem(item, mlst)
		passLst.push(pass)
		testedLst.push(tested)
	}
	const passFilterLst = filter.join == 'and' ? passLst.every(pass => pass) : passLst.some(pass => pass)
	const allTested = testedLst.every(tested => tested)
	if (!passFilterLst && !allTested) {
		// sample does not pass the filter list and
		// is not tested for all of the dts
		// so sample cannot not pass the filter
		return [false, false]
	}
	const passFilter = filter.in ? passFilterLst : !passFilterLst
	return [passFilter, allTested]
}

// function to filter a sample based on its mlst and a filter item
export function filterByItem(filter, mlst) {
	if (filter.type == 'tvslst') return filterByTvsLst(filter, mlst)
	if (filter.type != 'tvs') throw 'unexpected filter.type'
	const tvs = filter.tvs
	// get all tested mutations for the dt (and origin) of the filter
	const mlst_tested = mlst.filter(m => {
		if (tvs.term.dt != m.dt) return false
		if (tvs.term.origin && tvs.term.origin != m.origin) return false
		if (m.class == mclass['Blank'].key) return false
		return true
	})
	let pass, tested
	if (mlst_tested.length) {
		// sample is tested for the dt of the filter
		tested = true
		// determine if sample has any mutations specified in the filter
		const sampleHasMutation =
			tvs.cnvMode == 'continuous'
				? // continuous cnv data
				  mlst_tested.some(m => {
						if (!m.value) return false // will also consider value=0 as not mutated
						if (m.value > 0 && tvs.cnvGainCutoff && m.value < tvs.cnvGainCutoff) return false
						if (m.value < 0 && tvs.cnvLossCutoff && m.value > tvs.cnvLossCutoff) return false
						if (tvs.cnvMaxLength && m.stop - m.start > tvs.cnvMaxLength) return false
						return true
				  })
				: // categorical mutation data
				  mlst_tested.some(m => tvs.values.some(v => v.key == m.class))
		// for wildtype cnv genotype, negate the sampleHasMutation boolean
		const sampleHasGenotype = tvs.cnvWT ? !sampleHasMutation : sampleHasMutation
		// for tvs.isnot=true, negate the sampleHasGenotype boolean
		pass = tvs.isnot ? !sampleHasGenotype : sampleHasGenotype
	} else {
		// sample does not have tested mutations for the dt
		// so sample does not pass the filter
		tested = false
		pass = false
	}
	return [pass, tested]
}

/*
also returns isoform accession of the model that's used
if the model is canonical, the isoform will be usable for screening csq annotation for mutations
*/
async function mayMapGeneName2coord(term, genome) {
	if (term.name.startsWith('chr') && term.name.includes(':') && term.name.includes('-')) {
		// FIXME TODO haphazard guessing if name is coord or gene symbol!! should change to passing whole term obj
		const [chr, pos] = term.name.split(':')
		const [start, stop] = pos.split('-').map(Number)
		term.chr = chr
		term.start = start
		term.stop = stop
	}
	if (term.chr && Number.isInteger(term.start) && Number.isInteger(term.stop)) return

	// coord missing, fill in chr/start/stop by querying with gene
	if (!term.gene) throw 'both term.gene and term.chr/start/stop missing'
	const result = getResult(genome, { input: term.gene, deep: 1 })
	if (!result.gmlst || result.gmlst.length == 0) throw 'unknown gene name'
	const gm = result.gmlst.find(i => i.isdefault) || result.gmlst[0]
	term.chr = gm.chr
	term.start = gm.start
	term.stop = gm.stop
	return gm.isoform
}
async function mayMapGeneName2isoform(term, genome) {
	if (term.isoform && typeof term.isoform == 'string') return
	// isoform missing, query canonical isoform by name
	if (!term.gene) throw 'term.gene missing'
	const result = getResult(genome, { input: term.gene, deep: 1 })
	if (!result.gmlst || result.gmlst.length == 0) throw 'unknown gene name'
	const gm = result.gmlst.find(i => i.isdefault) || result.gmlst[0]
	term.isoform = gm.isoform
}

async function getSnvindelByTerm(ds, term, genome, q) {
	// to keep cohort/session etc
	const arg = {
		addFormatValues: true,
		filter0: q.filter0, // hidden filter
		filterObj: q.filter, // pp filter, must change key name to "filterObj" to be consistent with mds3 client
		sessionid: q.sessionid,
		// !! gdc specific parameter !!
		// instructs byisoform.get() to return case uuid as sample.sample_id; more or less harmless as it's ignored by non-gdc ds
		gdcUseCaseuuid: true
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
		// returns canonical isoform (if any). assign to arg{} so byrange.get() will be able to return csq by canonical isoform
		arg.isoform = await mayMapGeneName2coord(term, genome)
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
		filterObj: q.filter, // pp filter, must change key name to "filterObj" to be consistent with mds3 client
		sessionid: q.sessionid
	}
	if (ds.queries.svfusion.byrange && ds.queries.svfusion.byname) {
		await mayMapGeneName2coord(term, genome)
		// tw.term.chr/start/stop are set
		arg.rglst = [term]
		const byrangeResult = await ds.queries.svfusion.byrange.get(arg)
		const bynameResult = await ds.queries.svfusion.byname.get(arg)

		return [...byrangeResult, ...bynameResult]
	}
	if (ds.queries.svfusion.byrange) {
		await mayMapGeneName2coord(term, genome)
		// tw.term.chr/start/stop are set
		arg.rglst = [term]
		return await ds.queries.svfusion.byrange.get(arg)
	}
	if (ds.queries.svfusion.byname) {
		// tw.term.chr/start/stop are set
		arg.rglst = [term]
		return await ds.queries.svfusion.byname.get(arg)
	}
	throw 'unknown queries.svfusion method'
}
async function getCnvByTw(ds, tw, genome, q) {
	/* tw.term.type is "geneVariant"
	tw.q{} carries optional cutoffs (max length and min value) to filter cnv segments
	*/

	if (ds.queries.cnv.requiresHardcodeCnvOnlyFlag && !q.hardcodeCnvOnly) {
		// in gdc, the cnv segment datatype can only work for "cnv tool" but not any other case; this allow it to be disabled in oncomatrix and summary tool; these tools will use geneCnv instead
		// later if ever cnv seg must be used for such in gdc, need a different solution
		return
	}

	const arg = {
		addFormatValues: true,
		filter0: q.filter0, // hidden filter
		filterObj: q.filter, // pp filter, must change key name to "filterObj" to be consistent with mds3 client
		cnvMaxLength: tw?.q?.cnvMaxLength,
		cnvGainCutoff: tw?.q?.cnvGainCutoff,
		cnvLossCutoff: tw?.q?.cnvLossCutoff,
		sessionid: q.sessionid
	}
	await mayMapGeneName2coord(tw.term, genome)
	// tw.term.chr/start/stop are set
	arg.rglst = [tw.term]
	return await ds.queries.cnv.get(arg)
}
async function getProbe2cnvByTw(ds, tw, genome, q) {
	/* tw.term.type is "geneVariant"
	tw.q{} carries optional cutoffs (max length and min value)
	*/
	const arg = {
		filter0: q.filter0, // hidden filter
		filterObj: q.filter, // pp filter, must change key name to "filterObj" to be consistent with mds3 client
		cnvGainCutoff: tw?.q?.cnvGainCutoff,
		cnvLossCutoff: tw?.q?.cnvLossCutoff
	}
	await mayMapGeneName2coord(tw.term, genome)
	arg.rglst = [tw.term]
	return await ds.queries.probe2cnv.get(arg)
}
async function getGenecnvByTerm(ds, term, genome, q) {
	const arg = {
		filter0: q.filter0,
		sessionid: q.sessionid
	}

	if (ds.queries.geneCnv.bygene) {
		if (!term.gene) return []
		arg.gene = term.gene
		return await ds.queries.geneCnv.bygene.get(arg)
	}
	throw 'unknown queries.geneCnv method'
}

function mayValidateViewModes(ds) {
	if (!ds.viewModes) return
	if (!Array.isArray(ds.viewModes)) throw 'ds.viewModes[] not array'
	for (const v of ds.viewModes) {
		if (v.byInfo) {
			if (!ds?.queries?.snvindel?.info) throw 'view mode byInfo but queries.snvindel.info missing'
			const i = ds.queries.snvindel.info[v.byInfo]
			if (!i) throw 'unknown INFO field for viewmode byInfo'
			// set view mode type based on info Type
			if (i.Type == 'Float' || i.Type == 'Integer') {
				v.type = 'numeric'
			} else {
				throw 'viewmode byInfo Type is not numeric'
			}

			v.label = v.byInfo
		} else if (v.byAttribute) {
			// TODO
		} else {
			throw 'view mode not byInfo or byAttribute'
		}
	}
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

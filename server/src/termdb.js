import path from 'path'
import * as termdbsql from './termdb.sql.js'
import * as phewas from './termdb.phewas.js'
import { get_incidence } from './termdb.cuminc.js'
import { get_survival } from './termdb.survival.js'
import { get_regression } from './termdb.regression.js'
import { validate as snpValidate } from './termdb.snp.js'
import { isUsableTerm } from '#shared/termdb.usecase.js'
import { trigger_getSampleScatter } from './termdb.scatter.js'
import { trigger_getLowessCurve } from './termdb.scatter.js'
import { getData, getSamplesPerFilterResponse } from './termdb.matrix.js'
import { get_mds3variantData } from './mds3.variant.js'
import { get_lines_bigfile, mayCopyFromCookie } from './utils.js'
import { authApi } from './auth.js'
import { getResult as geneSearch } from './gene.js'
import { searchSNP } from '../routes/snp.ts'
import { get_samples_ancestry, get_samples } from './termdb.sql.js'
import { TermTypeGroups } from '#shared/terms.js'
import { trigger_getDefaultBins } from './termdb.getDefaultBins.js'
import serverconfig from './serverconfig.js'
import { filterTerms } from './termdb.server.init.js'
/*
********************** EXPORTED
handle_request_closure
copy_term
********************** INTERNAL
trigger_*
*/

export function handle_request_closure(genomes) {
	/*
	 */

	return async (req, res) => {
		const q = req.query

		mayCopyFromCookie(q, req.cookies)

		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'

			const [ds, tdb] = get_ds_tdb(genome, q)
			// process triggers
			if (q.findterm) return await trigger_findterm(q, req, res, tdb, ds, genome)
			if (q.getterminfo) return trigger_getterminfo(q, res, tdb)
			if (q.phewas) {
				if (q.update) return await phewas.update_image(q, res)
				if (q.getgroup) return await phewas.getgroup(q, res)
				return await phewas.trigger(q, res, ds)
			}
			//if (q.gettermdbconfig) return termdbConfig.make(q, res, ds, genome)
			//if (q.getcohortsamplecount) return res.send({ count: ds.cohort.termdb.q.getcohortsamplecount(q.cohort) })
			if (q.getsamplecount) return res.send(await termdbsql.get_samplecount(q, ds))
			if (q.getsamplelist) return res.send(await getSampleList(req, q, ds))

			if (q.getsamples) return await trigger_getsamples(q, res, ds)
			if (q.getcuminc) return await trigger_getincidence(q, res, ds)
			if (q.getsurvival) return await trigger_getsurvival(q, res, ds)
			if (q.getregression) return await trigger_getregression(q, res, ds, genome)
			if (q.validateSnps) return res.send(await snpValidate(q, tdb, ds, genome))
			if (q.getvariantfilter) return res.send(ds?.queries?.snvindel?.variant_filter || {})
			if (q.getLDdata) return await LDoverlay(q, ds, res)
			if (q.genesetByTermId) return trigger_genesetByTermId(q, res, tdb)
			if (q.getSampleScatter) q.for = 'scatter'
			if (q.for == 'scatter') return await trigger_getSampleScatter(req, q, res, ds, genome)
			if (q.getLowessCurve) return await trigger_getLowessCurve(req, q, res)

			if (q.getCohortsData) return await trigger_getCohortsData(q, res, ds)
			if (q.for == 'termTypes') return res.send(await ds.getTermTypes(q))
			if (q.for == 'matrix') return await get_matrix(q, req, res, ds, genome)
			if (q.for == 'numericDictTermCluster') return await get_numericDictTermCluster(q, req, res, ds, genome)
			if (q.for == 'getSamplesPerFilter') return await getSamplesPerFilterResponse(q, ds, res)
			if (q.for == 'mds3variantData') return await get_mds3variantData(q, res, ds, genome)
			if (q.for == 'getMultivalueTWs') return res.send(tdb.q.get_multivalue_tws(q.parent_id))
			if (q.for == 'validateToken') {
			}
			if (q.for == 'convertSampleId') return get_convertSampleId(q, res, tdb)
			if (q.for == 'singleSampleData') return get_singleSampleData(q, req, res, ds, tdb)
			if (q.for == 'getProfileFacilities') return get_ProfileFacilities(q, req, res, ds, tdb)
			if (q.for == 'getAllSamples') return get_AllSamples(q, req, res, ds)
			if (q.for == 'getSamplesByName') return get_AllSamplesByName(q, req, res, ds)
			if (q.for == 'getDefaultBins') return trigger_getDefaultBins(q, ds, res)

			throw "termdb: doesn't know what to do"
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
			else console.log(e)
		}
	}
}

/*
supports both dataset-based and genome-based sources
1. genome.datasets[ q.dslabel ]
2. genome.termdbs[ q.dslabel ]

given q.dslabel, try to find a match in both places
it's curator's responsibility to ensure not to use the same dslabel in these two places
*/
export function get_ds_tdb(genome, q) {
	{
		const ds = genome.datasets[q.dslabel]
		if (ds) {
			// matches with dataset
			if (ds?.cohort?.termdb) return [ds, ds.cohort.termdb]
			throw '.cohort.termdb not found on this dataset'
		}
	}
	// not matching with dataset
	if (!genome.termdbs) {
		throw 'invalid dslabel'
	}
	const ds = genome.termdbs[q.dslabel]
	if (!ds) {
		// no match found in either places for this dslabel
		throw 'invalid dslabel'
	}
	// still maintains ds.cohort.termdb to be fully compatible with dataset-level design
	if (!ds.cohort) throw 'ds.cohort missing for genome-level termdb'
	if (!ds.cohort.termdb) throw 'ds.cohort.termdb{} missing for a genome-level termdb'
	return [ds, ds.cohort.termdb]
}

function get_convertSampleId(q, res, tdb) {
	if (!tdb.convertSampleId) throw 'not supported on this ds'
	if (!Array.isArray(q.inputs)) throw 'q.inputs[] not array'
	res.send({ mapping: tdb.convertSampleId.get(q.inputs) })
}

async function trigger_getsamples(q, res, ds) {
	// this may be potentially limited?
	// ds may allow it as a whole
	// individual term may allow getting from it
	const lst = await termdbsql.get_samples(q.filter, ds)
	const samples = lst.map(i => ds.cohort.termdb.q.id2sampleName(i))
	res.send({ samples })
}

async function getSampleList(req, q, ds) {
	const canDisplay = authApi.canDisplaySampleIds(req, ds)
	const samples = await termdbsql.get_samples(q, ds, canDisplay)
	return samples
}

export function copy_term(t) {
	/*
t is jsondata from terms table

do not directly hand over the term object to client; many attr to be kept on server
*/
	const t2 = JSON.parse(JSON.stringify(t))

	// delete things not to be revealed to client

	return t2
}

/*
q.targetType
	"snp"
	"category" TODO
*/
async function trigger_findterm(q, req, res, termdb, ds, genome) {
	const matches = { equals: [], startsWith: [], startsWord: [], includes: [] }

	// to allow search to work, must unescape special char, e.g. %20 to space
	const str = decodeURIComponent(q.findterm).toUpperCase()

	let terms = []

	try {
		if (q.targetType == TermTypeGroups.DICTIONARY_VARIABLES) {
			const _terms = await termdb.q.findTermByName(str, q.cohortStr, q.usecase, q.treeFilter)

			terms.push(..._terms.map(copy_term))
		} else if (q.targetType == TermTypeGroups.METABOLITE_INTENSITY) {
			const matches = await ds.queries.metaboliteIntensity.find([q.findterm])
			const foundTerms = []
			for (const metabolite of matches) {
				foundTerms.push({ name: metabolite, type: 'metaboliteIntensity' })
			}
			terms.push(...foundTerms)
		}
		terms = filterTerms(req, ds, terms)
		const id2ancestors = {}
		terms.forEach(term => {
			term.__ancestors = termdb.q.getAncestorIDs(term.id)
			term.__ancestorNames = termdb.q.getAncestorNames(term.id)
		})
		res.send({ lst: terms })
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}

/*
Input:

q.filter = {}
	optional filter to limit samples
q.tid = str
	term id, dictionary term
q.term1_q = {}
	optional q object
q.currentGeneNames = str
	optional stringified array of gene names, to pull samples mutated on given genes for this term (gdc only)

Returns:
{
	lst:[]
		{
			samplecount:int
			label:str
			key:str
		}
	orderedLabels:[]
		list of string names
}
*/

function trigger_getterminfo(q, res, tdb) {
	/* get terminfo the the term
rightnow only few conditional terms have grade info
*/
	if (!q.tid) throw 'no term id'
	res.send({ terminfo: tdb.q.getTermInfo(q.tid) })
}

async function trigger_getincidence(q, res, ds) {
	const data = await get_incidence(q, ds)
	res.send(data)
}

async function trigger_getsurvival(q, res, ds) {
	const data = await get_survival(q, ds)
	res.send(data)
}

async function trigger_getregression(q, res, ds, genome) {
	const data = await get_regression(q, ds, genome)
	res.send(data)
}

function trigger_genesetByTermId(q, res, tdb) {
	if (!tdb.termMatch2geneSet) throw 'this feature is not enabled'
	if (typeof q.genesetByTermId != 'string' || q.genesetByTermId.length == 0) throw 'invalid query term id'
	const geneset = tdb.q.getGenesetByTermId(q.genesetByTermId)
	res.send(geneset)
}

async function get_matrix(q, req, res, ds, genome) {
	if (q.getPlotDataByName) {
		// send back the config for premade matrix plot
		if (!ds.cohort?.matrixplots?.plots) throw 'ds.cohort.matrixplots.plots missing for the dataset'
		const plot = ds.cohort.matrixplots.plots.find(p => p.name === q.getPlotDataByName)
		if (!plot) throw 'invalid name of premade matrix plot' // invalid name could be attack string, avoid returning it so it won't be printed in html
		res.send(plot.matrixConfig)
		return
	}
	const data = await getData(q, ds, genome, true)
	if (authApi.canDisplaySampleIds(req, ds)) {
		if (data.samples)
			for (const sample of Object.values(data.samples)) {
				sample.sampleName = data.refs.bySampleId?.[sample.sample]?.label || sample.sample
			}
	}
	res.send(data)
}

async function get_numericDictTermCluster(q, req, res, ds, genome) {
	if (q.getPlotDataByName) {
		// send back the config for premade numericDictTermCluster plot
		if (!ds.cohort?.termdb?.numericDictTermCluster?.plots)
			throw 'ds.cohort.termdb.numericDictTermCluster.plots missing for the dataset'
		const plot = ds.cohort.termdb.numericDictTermCluster.plots.find(p => p.name === q.getPlotDataByName)
		if (!plot) throw 'invalid name of premade numericDictTermCluster plot' // invalid name could be attack string, avoid returning it so it won't be printed in html
		res.send(plot.numericDictTermClusterConfig)
		return
	}
}

async function get_ProfileFacilities(q, req, res, ds, tdb) {
	const canDisplay = authApi.canDisplaySampleIds(req, ds)
	let result = []
	if (canDisplay) {
		try {
			result = tdb.q.getProfileFacilities()
			res.send(result)
		} catch (e) {
			res.send({ error: e.message || e })
		}
	} else res.send({ error: 'Requires sign in to access the sample data' })
}

async function get_singleSampleData(q, req, res, ds, tdb) {
	const canDisplay = authApi.canDisplaySampleIds(req, ds)
	let result = []
	if (canDisplay) {
		try {
			result = tdb.q.getSingleSampleData(q.sampleId, q.term_ids)
			res.send(result)
		} catch (e) {
			res.send({ error: e.message || e })
		}
	} else res.send({ error: 'Requires sign in to access the sample data' })
}

async function get_AllSamples(q, req, res, ds) {
	const canDisplay = authApi.canDisplaySampleIds(req, ds)
	let result = []
	if (canDisplay) result = Object.fromEntries(ds.sampleId2Name)
	res.send(result)
}

async function get_AllSamplesByName(q, req, res, ds) {
	// return {}, k: sample name, v: id

	if (!authApi.canDisplaySampleIds(req, ds)) return res.send({})

	let sampleName2Id = new Map()

	if (q.filter) {
		q.ds = ds
		const filteredSamples = ds.cohort.termdb.hasSampleAncestry
			? await get_samples_ancestry(q.filter, q.ds, true)
			: await get_samples(q, q.ds, true)
		for (const sample of filteredSamples) {
			const name = ds.sampleId2Name.get(sample.id)
			const sample_type = ds.sampleId2Type.get(sample.id)
			sampleName2Id.set(name, {
				id: sample.id,
				name,
				ancestor_id: sample.ancestor_id,
				ancestor_name: ds.sampleId2Name.get(sample.ancestor_id),
				sample_type
			})
		}
	} else {
		for (const [key, value] of ds.sampleName2Id) sampleName2Id.set(key, { id: value })
	}
	res.send(Object.fromEntries(sampleName2Id))
}

async function LDoverlay(q, ds, res) {
	if (!q.ldtkname) throw '.ldtkname missing'
	if (!ds.queries?.ld?.tracks) throw 'no ld tk'
	const tk = ds.queries.ld.tracks.find(i => i.name == q.ldtkname)
	if (!tk) throw 'unknown ld tk'
	if (typeof q.m != 'object') throw 'q.m{} not object'
	if (!q.m.chr) throw 'q.m.chr missing'
	if (!Number.isInteger(q.m.pos)) throw 'q.m.pos not integer'
	if (!q.m.ref || !q.m.alt) throw 'q.m{} invalid alleles'
	const thisalleles = q.m.ref + '.' + q.m.alt
	const coord = (tk.nochr ? q.m.chr.replace('chr', '') : q.m.chr) + ':' + q.m.pos + '-' + (q.m.pos + 1)
	const lst = []
	await get_lines_bigfile({
		args: [path.join(serverconfig.tpmasterdir, tk.file), coord],
		callback: line => {
			const l = line.split('\t')
			const start = Number.parseInt(l[1])
			const stop = Number.parseInt(l[2])
			const alleles1 = l[3]
			const alleles2 = l[4]
			const r2 = Number.parseFloat(l[5])
			if (start == q.m.pos && alleles1 == thisalleles) {
				lst.push({
					pos: stop,
					alleles: alleles2,
					r2
				})
			} else if (stop == q.m.pos && alleles2 == thisalleles) {
				lst.push({
					pos: start,
					alleles: alleles1,
					r2
				})
			}
		}
	})
	res.send({ lst })
}

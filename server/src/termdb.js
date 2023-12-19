import * as termdbConfig from './termdb.config'
import * as termdbsql from './termdb.sql'
import * as phewas from './termdb.phewas'
import { get_incidence } from './termdb.cuminc'
import { get_survival } from './termdb.survival'
import { get_regression } from './termdb.regression'
import { validate as snpValidate } from './termdb.snp'
import { isUsableTerm } from '#shared/termdb.usecase'
import { trigger_getSampleScatter } from './termdb.scatter'
import { trigger_getLowessCurve } from './termdb.scatter'
import { getData, getSamplesPerFilter } from './termdb.matrix'
import { trigger_getCohortsData } from './termdb.cohort'
import { get_mds3variantData } from './mds3.variant'
import { get_lines_bigfile, mayCopyFromCookie } from './utils'
import { authApi } from './auth'
import { getResult as geneSearch } from './gene'
import { searchSNP } from './app'
import { get_samples } from './termdb.sql'

/*
********************** EXPORTED
handle_request_closure
copy_term
********************** INTERNAL
trigger_*
*/

const limitSearchTermTo = 10

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
			if (q.getnumericcategories) return await trigger_getnumericcategories(q, res, tdb, ds)
			if (q.default_rootterm) return await trigger_rootterm(q, res, tdb)
			if (q.get_children) return await trigger_children(q, res, tdb)
			if (q.findterm) return await trigger_findterm(q, res, tdb, ds, genome)
			if (q.getterminfo) return trigger_getterminfo(q, res, tdb)
			if (q.phewas) {
				if (q.update) return await phewas.update_image(q, res)
				if (q.getgroup) return await phewas.getgroup(q, res)
				return await phewas.trigger(q, res, ds)
			}
			if (q.gettermdbconfig) return termdbConfig.make(q, res, ds, genome)
			if (q.getcohortsamplecount) return res.send({ count: ds.cohort.termdb.q.getcohortsamplecount(q.cohort) })
			if (q.getsamplecount) return res.send(await getSampleCount(req, q, ds))
			if (q.getsamples) return await trigger_getsamples(q, res, ds)
			if (q.getcuminc) return await trigger_getincidence(q, res, ds)
			if (q.getsurvival) return await trigger_getsurvival(q, res, ds)
			if (q.getregression) return await trigger_getregression(q, res, ds)
			if (q.validateSnps) return res.send(await snpValidate(q, tdb, ds, genome))
			if (q.getvariantfilter) return getvariantfilter(res, ds)
			if (q.getLDdata) return await LDoverlay(q, ds, res)
			if (q.genesetByTermId) return trigger_genesetByTermId(q, res, tdb)
			if (q.getSampleScatter) q.for = 'scatter'
			if (q.for == 'scatter') return await trigger_getSampleScatter(req, q, res, ds, genome)
			if (q.getLowessCurve) return await trigger_getLowessCurve(req, q, res)
			if (q.getCohortsData) return await trigger_getCohortsData(q, res, ds)
			if (q.for == 'mds3queryDetails') return get_mds3queryDetails(res, ds)
			if (q.for == 'termTypes') return res.send(await ds.getTermTypes(q))
			if (q.for == 'matrix') return await get_matrix(q, req, res, ds, genome)
			if (q.for == 'getSamplesPerFilter') return await getSamplesPerFilter(q, ds, res)
			if (q.for == 'mds3variantData') return await get_mds3variantData(q, res, ds, genome)
			if (q.for == 'validateToken') {
			}
			if (q.for == 'convertSampleId') return get_convertSampleId(q, res, tdb)
			if (q.for == 'singleSampleData') return get_singleSampleData(q, req, res, ds, tdb)
			if (q.for == 'getProfileFacilities') return get_ProfileFacilities(q, req, res, ds, tdb)
			if (q.for == 'getAllSamples') return get_AllSamples(q, req, res, ds)
			if (q.for == 'getAllSamplesByName') return get_AllSamplesByName(q, req, res, ds)
			if (q.for == 'DEanalysis') return await get_DEanalysis(q, res, ds)

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
		throw 'genome-level termdb not available'
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

async function getSampleCount(req, q, ds) {
	const canDisplay = authApi.canDisplaySampleIds(req, ds)
	if (q.getsamplecount == 'list') {
		const samples = await termdbsql.get_samples(q.filter, ds, canDisplay)
		return samples
	}
	return await termdbsql.get_samplecount(q, ds)
}

async function trigger_rootterm(q, res, tdb) {
	const cohortValues = q.cohortValues ? q.cohortValues : ''
	const treeFilter = q.treeFilter ? q.treeFilter : ''
	res.send({ lst: await tdb.q.getRootTerms(cohortValues, treeFilter) })
}

async function trigger_children(q, res, tdb) {
	/* get children terms
may apply ssid: a premade sample set
*/
	if (!q.tid) throw 'no parent term id'
	const cohortValues = q.cohortValues ? q.cohortValues : ''
	const treeFilter = q.treeFilter ? q.treeFilter : ''
	const terms = await tdb.q.getTermChildren(q.tid, cohortValues, treeFilter)
	res.send({ lst: terms.map(copy_term) })
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
async function trigger_findterm(q, res, termdb, ds, genome) {
	// TODO improve logic

	const matches = { equals: [], startsWith: [], startsWord: [], includes: [] }

	// to allow search to work, must unescape special char, e.g. %20 to space
	const str = decodeURIComponent(q.findterm).toUpperCase()

	const terms = []

	try {
		if (q.targetType == 'snp') {
			if (!ds.queries?.snvindel?.allowSNPs) throw 'this dataset does not support snp search'
			// must convert to lowercase e.g. "rs" but not "RS" for bigbed file search to work
			const lst = await searchSNP({ byName: true, lst: [str.toLowerCase()] }, genome)
			for (const s of lst) {
				terms.push({
					type: 'geneVariant',
					name: s.name,
					subtype: 'snp',
					chr: s.chrom,
					start: s.chromStart,
					stop: s.chromEnd,
					alleles: s.alleles
				})
			}
		} else {
			const mayUseGeneVariant = isUsableTerm({ type: 'geneVariant' }, q.usecase).has('plot')

			if (ds.mayGetMatchingGeneNames && mayUseGeneVariant) {
				////////////////////////////
				// TODO
				// if to remove bulk support on backend and use client vocab, then this should be deleted
				//
				// still, may keep this method to support dataset with data on limit gene set
				// so that term search only return genes from this set, rather than any gene in genome, allow it to be user friendly
				//
				////////////////////////////

				// presence of this getter indicates dataset uses text file to supply mutation data
				// only allow searching for gene names present in the text files
				// check this first before dict terms is convenient as to showing matching genes for a text-file based dataset that's usually small

				// harcoded gene name length limit to exclude fusion/comma-separated gene names
				await ds.mayGetMatchingGeneNames(matches, str, q)
			}

			if (ds.queries?.defaultBlock2GeneMode && mayUseGeneVariant) {
				/*
				has queries for genomic data types, search gene from whole genome
				not checking on presence of queries.snvindel{} as it's used for both wgs/germline and somatic data,
				for now do not show gene search for wgs data
				checking on this flag as it's enabled for ds with somatic data
				same logic applied in termdb.config.js

				must enclose in try/catch as term match allows characters including space, that are prohibited in gene search
				when exception is thrown because of that, ignore and continue term match
				*/
				try {
					const re = geneSearch(genome, { input: str })
					if (Array.isArray(re.hits)) {
						for (let i = 0; i < 7; i++) {
							if (!re.hits[i]) break
							terms.push({ name: re.hits[i], type: 'geneVariant' })
						}
					}
				} catch (e) {
					// err is likely "invalid character in gene name". ignore and continue
				}
			}
		}

		const _terms = await termdb.q.findTermByName(str, limitSearchTermTo, q.cohortStr, q.treeFilter, q.usecase, matches)

		terms.push(..._terms.map(copy_term))

		const id2ancestors = {}
		terms.forEach(term => {
			if (term.type == 'geneVariant') return
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

async function trigger_getnumericcategories(q, res, tdb, ds) {
	if (!q.tid) throw '.tid missing'
	const term = tdb.q.termjsonByOneid(q.tid)
	const arg = {
		ds,
		term_id: q.tid
		//filter
	}
	if (q.filter) arg.filter = q.filter
	const lst = await termdbsql.get_summary_numericcategories(arg)
	res.send({ lst })
}

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

async function trigger_getregression(q, res, ds) {
	const data = await get_regression(q, ds)
	res.send(data)
}

function getvariantfilter(res, ds) {
	if (ds.track) {
		/////////////////////////
		// !! mds2 !!
		// mds2delete
		/////////////////////////

		// variant_filter is always an object, can be empty
		res.send(ds.track.variant_filter)
		return
	}

	res.send(ds?.queries?.snvindel?.variant_filter || {})
}

function trigger_genesetByTermId(q, res, tdb) {
	if (!tdb.termMatch2geneSet) throw 'this feature is not enabled'
	if (typeof q.genesetByTermId != 'string' || q.genesetByTermId.length == 0) throw 'invalid query term id'
	const geneset = tdb.q.getGenesetByTermId(q.genesetByTermId)
	res.send(geneset)
}

async function get_matrix(q, req, res, ds, genome) {
	if (q.getPlotDataByName) {
		// send back the config for pre-built matrix plot
		if (!ds.cohort.matrixplots) throw 'ds.cohort.matrixplots missing for the dataset'
		if (!ds.cohort.matrixplots.plots) throw 'ds.cohort.matrixplots.plots missing for the dataset'
		const plot = ds.cohort.matrixplots.plots.find(p => p.name === q.getPlotDataByName)
		if (!plot) throw `plot name: q.getPlotDataByName=${getPlotDataByName} missing in ds.cohort.matrixplots.plots`
		res.send(plot.matrixConfig)
		return
	}
	const data = await getData(q, ds, genome)
	if (authApi.canDisplaySampleIds(req, ds)) {
		for (const sample of Object.values(data.samples)) {
			sample.sampleName = ds.sampleId2Name.get(sample.sample)
		}
	}
	res.send(data)
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

	/* FIXME
	for a dataset with only subset of samples having sc data, sample view plot should list all samples (not cells)
	and sc view should only list samples with sc
	still need work
	*/
	if (ds.queries?.singleCell?.samples?.get) {
		/*
		this dataset has single cell data, only return samples with sc data
		this avoid issue of returning cells which are in sampleidmap table

		!!this logic should only be used in sc-specific view on client!!
		more fixes pending
		*/
		const lst = await ds.queries.singleCell.samples.get()
		const result = {}
		for (const s of lst) {
			result[s.sample] = ds.cohort.termdb.q.sampleName2id(s.sample)
		}
		res.send(result)
		return
	} else {
		let sampleName2Id = ds.sampleName2Id
		if (q.filter) {
			q.ds = ds
			const filteredSamples = await get_samples(q.filter, q.ds, true)
			sampleName2Id = new Map()
			for (const sample of filteredSamples) {
				sampleName2Id.set(sample.name, sample.id)
			}
		}

		res.send(Object.fromEntries(sampleName2Id))
	}
}

async function get_DEanalysis(q, res, ds) {
	if (!ds.queries?.rnaseqGeneCount) throw 'not enabled by this dataset'
	const result = await ds.queries.rnaseqGeneCount.get(q)
	res.send(result)
}

function get_mds3queryDetails(res, ds) {
	const config = {}
	const qs = ds.queries || {}
	if (qs.snvindel) {
		config.snvindel = {}
		// details{} lists default method for computing variants, can be modified and is part of state
		// some of the stuff here are to provide user-selectable choices
		// e.g. computing methods, info fields, populations. TODO move them out of state, as they are read-only
		if (qs.snvindel.details) config.snvindel.details = qs.snvindel.details
		if (qs.snvindel.populations) config.snvindel.populations = qs.snvindel.populations
	}
	if (qs.trackLst) {
		config.trackLst = qs.trackLst
	}
	if (qs.ld) {
		config.ld = JSON.parse(JSON.stringify(qs.ld))
		for (const i of config.ld.tracks) {
			delete i.file
		}
	}
	res.send(config)
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
		args: [tk.file, coord],
		dir: tk.dir,
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

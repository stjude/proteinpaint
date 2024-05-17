import * as termdbsql from './termdb.sql.js'
import * as phewas from './termdb.phewas.js'
import { get_incidence } from './termdb.cuminc.js'
import { get_survival } from './termdb.survival.js'
import { get_regression } from './termdb.regression.js'
import { validate as snpValidate } from './termdb.snp.js'
import { isUsableTerm } from '#shared/termdb.usecase.js'
import { trigger_getSampleScatter } from './termdb.scatter.js'
import { trigger_getLowessCurve } from './termdb.scatter.js'
import { getData, getSamplesPerFilter } from './termdb.matrix.js'
import { get_mds3variantData } from './mds3.variant.js'
import { get_lines_bigfile, mayCopyFromCookie } from './utils.js'
import { authApi } from './auth.js'
import { getResult as geneSearch } from './gene.js'
import { searchSNP } from '../routes/snp.ts'
import { get_samples_ancestry, get_samples } from './termdb.sql.js'
import { dtmetaboliteintensity, dtgeneexpression } from '#shared/common.js'
import { TermTypeGroups, TermTypes } from '#shared/terms.js'
import initBinConfig from '#shared/termdb.initbinconfig'
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
			if (q.findterm) return await trigger_findterm(q, res, tdb, ds, genome)
			if (q.getterminfo) return trigger_getterminfo(q, res, tdb)
			if (q.phewas) {
				if (q.update) return await phewas.update_image(q, res)
				if (q.getgroup) return await phewas.getgroup(q, res)
				return await phewas.trigger(q, res, ds)
			}
			//if (q.gettermdbconfig) return termdbConfig.make(q, res, ds, genome)
			//if (q.getcohortsamplecount) return res.send({ count: ds.cohort.termdb.q.getcohortsamplecount(q.cohort) })
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
			if (q.for == 'getSamplesByName') return get_AllSamplesByName(q, req, res, ds)
			if (q.for == 'DEanalysis') return await get_DEanalysis(q, res, ds)
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

async function getSampleCount(req, q, ds) {
	const canDisplay = authApi.canDisplaySampleIds(req, ds)
	if (q.getsamplecount == 'list') {
		const samples = await termdbsql.get_samples(q.filter, ds, canDisplay)
		return samples
	}
	return await termdbsql.get_samplecount(q, ds)
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
		//Snp list and Snp locus will have their own UI
		if (q.targetType == TermTypeGroups.MUTATION_CNV_FUSION) {
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
		} else if (q.targetType == TermTypeGroups.DICTIONARY_VARIABLES) {
			const _terms = await termdb.q.findTermByName(str, q.cohortStr, q.treeFilter, q.usecase)

			terms.push(..._terms.map(copy_term))
		} else if (q.targetType == TermTypeGroups.METABOLITE_INTENSITY) {
			const args = {
				genome: q.genome,
				dslabel: q.dslabel,
				clusterMethod: 'hierarchical',
				/** distance method */
				distanceMethod: 'euclidean',
				/** Data type */
				dataType: dtmetaboliteintensity, //metabolite intensity type defined for the dataset???
				metabolites: [q.findterm]
			}
			const data = await ds.queries.metaboliteIntensity.get(args)
			const foundTerms = []
			for (const metabolite of data.metabolite2sample2value) {
				foundTerms.push({ name: metabolite[0], type: 'metaboliteIntensity' })
			}
			terms.push(...foundTerms)
		}
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
		// send back the config for premade matrix plot
		if (!ds.cohort?.matrixplots?.plots) throw 'ds.cohort.matrixplots.plots missing for the dataset'
		const plot = ds.cohort.matrixplots.plots.find(p => p.name === q.getPlotDataByName)
		if (!plot) throw 'invalid name of premade matrix plot' // invalid name could be attack string, avoid returning it so it won't be printed in html
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

	let sampleName2Id = new Map()

	if (q.filter) {
		q.ds = ds
		const filteredSamples = ds.cohort.termdb.hasAncestry
			? await get_samples_ancestry(q.filter, q.ds, true)
			: await get_samples(q.filter, q.ds, true)
		for (const sample of filteredSamples) {
			sampleName2Id.set(sample.name, {
				id: sample.id,
				name: sample.name,
				ancestor_id: sample.ancestor_id,
				ancestor_name: ds.sampleId2Name.get(sample.ancestor_id),
				type: sample.type
			})
		}
	} else {
		for (const [key, value] of ds.sampleName2Id) sampleName2Id.set(key, { id: value })
	}
	res.send(Object.fromEntries(sampleName2Id))
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

async function trigger_getDefaultBins(q, ds, res) {
	const tw = q.tw
	const lst = []
	let min = Infinity
	let max = -Infinity
	if (tw.term.type == TermTypes.GENE_EXPRESSION) {
		if (ds.queries.geneExpression.gene2bins[tw.term.gene])
			return { default: ds.queries.geneExpression.gene2bins[tw.term.gene] }

		const args = {
			genome: q.genome,
			dslabel: q.dslabel,
			clusterMethod: 'hierarchical',
			/** distance method */
			distanceMethod: 'euclidean',
			/** Data type */
			dataType: dtgeneexpression,
			genes: [{ gene: tw.term.gene }]
		}
		const data = await ds.queries.geneExpression.get(args)

		for (const sampleId in data.gene2sample2value.get(tw.term.gene)) {
			const values = data.gene2sample2value.get(tw.term.gene)
			const value = Number(values[sampleId])
			if (value < min) min = value
			if (value > max) max = value
			lst.push(value)
		}
	} else if (tw.term.type == TermTypes.METABOLITE_INTENSITY) {
		const args = {
			genome: q.genome,
			dslabel: q.dslabel,
			clusterMethod: 'hierarchical',
			/** distance method */
			distanceMethod: 'euclidean',
			/** Data type */
			dataType: dtmetaboliteintensity, //metabolite intensity type defined for the dataset???
			metabolites: [tw.term.name]
		}
		const data = await ds.queries.metaboliteIntensity.get(args)
		const termData = data.metabolite2sample2value.get(tw.term.name)
		for (const sample in termData) {
			const value = termData[sample]
			if (value < min) min = value
			if (value > max) max = value
			lst.push(value)
		}
	}
	console.log('lst', lst)
	let binconfig = initBinConfig(lst)

	res.send({ default: binconfig, min, max })
}

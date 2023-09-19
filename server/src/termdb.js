const termdbConfig = require('./termdb.config')
const termdbsql = require('./termdb.sql')
const phewas = require('./termdb.phewas')
const cuminc = require('./termdb.cuminc')
const survival = require('./termdb.survival')
const regression = require('./termdb.regression')
const termdbsnp = require('./termdb.snp')
const getOrderedLabels = require('./termdb.barchart').getOrderedLabels
const isUsableTerm = require('#shared/termdb.usecase').isUsableTerm
const trigger_getSampleScatter = require('./termdb.scatter').trigger_getSampleScatter
const trigger_getLowessCurve = require('./termdb.scatter').trigger_getLowessCurve
const trigger_getViolinPlotData = require('./termdb.violin').trigger_getViolinPlotData
const getData = require('./termdb.matrix').getData
const trigger_getCohortsData = require('./termdb.cohort').trigger_getCohortsData
const get_mds3variantData = require('./mds3.variant').get_mds3variantData
import roundValue from '#shared/roundValue'
import computePercentile from '../shared/compute.percentile.js'
import { get_lines_bigfile, mayCopyFromCookie } from './utils'
import authApi from './auth'
import { getResult as geneSearch } from './gene'
import { searchSNP } from './app'

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
			if (q.gettermbyid) return trigger_gettermbyid(q, res, tdb)
			if (q.getcategories) return await trigger_getcategories(q, res, tdb, ds, genome)
			if (q.getpercentile) return trigger_getpercentile(q, res, ds)
			if (q.getdescrstats) return trigger_getdescrstats(q, res, ds)
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
			if (q.validateSnps) return res.send(await termdbsnp.validate(q, tdb, ds, genome))
			if (q.getvariantfilter) return getvariantfilter(res, ds)
			if (q.getLDdata) return await LDoverlay(q, ds, res)
			if (q.genesetByTermId) return trigger_genesetByTermId(q, res, tdb)
			if (q.getSampleScatter) return await trigger_getSampleScatter(req, q, res, ds, genome)
			if (q.getLowessCurve) return await trigger_getLowessCurve(req, q, res)

			if (q.getCohortsData) return await trigger_getCohortsData(q, res, ds)
			if (q.getViolinPlotData) return await trigger_getViolinPlotData(q, res, ds, genome)

			if (q.for == 'mds3queryDetails') return get_mds3queryDetails(res, ds)
			if (q.for == 'termTypes') return res.send(await ds.getTermTypes(q))
			if (q.for == 'matrix') return await get_matrix(q, req, res, ds, genome)
			if (q.for == 'mds3variantData') return await get_mds3variantData(q, res, ds, genome)
			if (q.for == 'validateToken') {
			}
			if (q.for == 'convertSampleId') return get_convertSampleId(q, res, tdb)
			if (q.for == 'singleSampleData') return get_singleSampleData(q, req, res, ds, tdb)
			if (q.for == 'getAllSamples') return get_AllSamples(q, req, res, ds)
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
function get_ds_tdb(genome, q) {
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

function trigger_gettermbyid(q, res, tdb) {
	const t = tdb.q.termjsonByOneid(q.gettermbyid)
	res.send({
		term: t ? copy_term(t) : undefined
	})
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
				/* has queries for genomic data types, search gene from whole genome
				not checking on presence of queries.snvindel{} as it's used for both wgs/germline and somatic data,
				for now do not show gene search for wgs data
				checking on this flag as it's enabled for ds with somatic data
				same logic applied in termdb.config.js
				*/
				const re = geneSearch(genome, { input: str })
				if (Array.isArray(re.hits)) {
					for (let i = 0; i < 7; i++) {
						if (!re.hits[i]) break
						terms.push({ name: re.hits[i], type: 'geneVariant' })
					}
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
async function trigger_getcategories(q, res, tdb, ds, genome) {
	// thin wrapper of get_summary
	// works for all types of terms
	if (!q.tid) throw '.tid missing'
	const term =
		q.type == 'geneVariant' ? { name: q.tid, type: 'geneVariant', isleaf: true } : tdb.q.termjsonByOneid(q.tid)
	const arg = {
		filter: q.filter,
		terms:
			q.type == 'geneVariant'
				? [{ term: term, q: { isAtomic: true } }]
				: [{ id: q.tid, term, q: q.term1_q || getDefaultQ(term, q) }],
		currentGeneNames: q.currentGeneNames
	}

	const data = await getData(arg, ds, genome)
	if (data.error) throw data.error

	const lst = []
	if (q.type == 'geneVariant') {
		const samples = data.samples
		const dtClassMap = new Map()
		if (ds.assayAvailability?.byDt) {
			for (const [dtType, dtValue] of Object.entries(ds.assayAvailability.byDt)) {
				if (dtValue.byOrigin) {
					dtClassMap.set(parseInt(dtType), { byOrigin: { germline: {}, somatic: {} } })
				}
			}
		}
		const sampleCountedFor = new Set() // if the sample is conunted for the
		for (const [sampleId, sampleData] of Object.entries(samples)) {
			const values = sampleData[q.tid].values
			sampleCountedFor.clear()
			/* values here is an array of result entires, one or more entries for each dt. e.g.
			[
				{ dt: 1, class: 'Blank', _SAMPLEID_: 1, origin: 'germline' },
				{ dt: 1, class: 'WT', _SAMPLEID_: 1, origin: 'somatic' },
				{ dt: 2, class: 'Blank', _SAMPLEID_: 1 },
				{ dt: 4, class: 'WT', _SAMPLEID_: 1 }
			]
			*/
			for (const value of values) {
				if (!dtClassMap.has(value.dt)) {
					dtClassMap.set(value.dt, {})
				}
				const dtClasses = dtClassMap.get(value.dt)
				if (dtClasses.byOrigin) {
					if (!dtClasses.byOrigin[value.origin][value.class]) {
						dtClasses.byOrigin[value.origin][value.class] = 1
						sampleCountedFor.add(`${value.dt} ${value.origin} ${value.class}`)
					}
					if (!sampleCountedFor.has(`${value.dt} ${value.origin} ${value.class}`)) {
						sampleCountedFor.add(`${value.dt} ${value.origin} ${value.class}`)
						dtClasses.byOrigin[value.origin][value.class] += 1
					}
				} else {
					if (!dtClasses[value.class]) {
						sampleCountedFor.add(`${value.dt} ${value.class}`)
						dtClasses[value.class] = 1
					}
					if (!sampleCountedFor.has(`${value.dt} ${value.class}`)) {
						sampleCountedFor.add(`${value.dt} ${value.class}`)
						dtClasses[value.class] += 1
					}
				}
			}
		}
		for (const [dt, classes] of dtClassMap) {
			lst.push({
				dt,
				classes
			})
		}
	} else {
		const key2count = new Map()
		// k: category key
		// v: number of samples
		for (const sid in data.samples) {
			const v = data.samples[sid][q.tid]
			if (!v) continue
			if (!('key' in v)) continue
			key2count.set(v.key, 1 + (key2count.get(v.key) || 0))
		}
		for (const [key, count] of key2count) {
			lst.push({
				samplecount: count,
				key,
				label:
					data.refs?.byTermId?.[q.tid]?.events?.find(e => e.event === key).label || term?.values?.[key]?.label || key
			})
		}
	}

	const orderedLabels = getOrderedLabels(
		term,
		data.refs?.byTermId?.[q.tid]?.bins || [],
		data.refs?.byTermId?.[q.tid]?.events,
		q.term1_q
	)
	if (orderedLabels.length) {
		lst.sort((a, b) => orderedLabels.indexOf(a.label) - orderedLabels.indexOf(b.label))
	}

	res.send({
		lst,
		orderedLabels
	})
}

// may reuse or already done elsewhere?
function getDefaultQ(term, q) {
	if (term.type == 'categorical') return {}
	if (term.type == 'survival') return {}
	if (term.type == 'integer' || term.type == 'float') return term.bins.default
	if (term.type == 'condition') {
		return {
			mode: q.mode,
			breaks: q.breaks,
			bar_by_grade: q.bar_by_grade,
			/*Leave this here until bug with term1_q not passing to getCategories is figured out.
			Commented out b/c tvs condition tests fail.*/
			//bar_by_children: term.subconditions || q.bar_by_children,
			bar_by_children: q.bar_by_children,
			value_by_max_grade: q.value_by_max_grade,
			value_by_most_recent: q.value_by_most_recent,
			//value_by_computable_grade: term.subconditions || q.value_by_computable_grade
			value_by_computable_grade: q.value_by_computable_grade
		}
	}
	if (term.type == 'geneVariant') return {}
	throw 'unknown term type'
}

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
	const data = await cuminc.get_incidence(q, ds)
	res.send(data)
}

async function trigger_getsurvival(q, res, ds) {
	const data = await survival.get_survival(q, ds)
	res.send(data)
}

async function trigger_getregression(q, res, ds) {
	const data = await regression.get_regression(q, ds)
	res.send(data)
}

async function trigger_getpercentile(q, res, ds) {
	const term = ds.cohort.termdb.q.termjsonByOneid(q.tid)
	if (!term) throw 'invalid termid'
	if (term.type != 'float' && term.type != 'integer') throw 'not numerical term'
	const percentile_lst = q.getpercentile
	const perc_values = []
	const values = []
	const rows = await termdbsql.get_rows_by_one_key({
		ds,
		key: q.tid,
		filter: q.filter ? (typeof q.filter == 'string' ? JSON.parse(q.filter) : q.filter) : null
	})
	for (const { value } of rows) {
		if (term.values && term.values[value] && term.values[value].uncomputable) {
			// skip uncomputable values
			continue
		}

		if (term.skip0forPercentile && value == 0) {
			// quick fix: when the flag is true, will exclude 0 values from percentile computing
			// to address an issue with computing knots
			continue
		}

		values.push(Number(value))
	}

	// compute percentiles
	for (const percentile of percentile_lst) {
		const perc_value = computePercentile(values, percentile)
		perc_values.push(perc_value)
	}
	res.send({ values: perc_values })
}

async function trigger_getdescrstats(q, res, ds) {
	const term = ds.cohort.termdb.q.termjsonByOneid(q.tid)
	if (!term) throw 'invalid termid'
	if (term.type != 'float' && term.type != 'integer') throw 'not numerical term'
	const rows = await termdbsql.get_rows_by_one_key({
		ds,
		key: q.tid,
		filter: q.filter ? (typeof q.filter == 'string' ? JSON.parse(q.filter) : q.filter) : null
	})
	const values = []
	for (const { value } of rows) {
		if (term.values && term.values[value] && term.values[value].uncomputable) {
			// skip uncomputable values
			continue
		}
		//skip computing for zeros if scale is log.
		if (q.settings?.violin?.unit === 'log') {
			if (value === 0) {
				continue
			}
		}
		values.push(Number(value))
	}

	// compute statistics
	// total
	const total = values.length

	// mean
	const sum = values.reduce((a, b) => a + b, 0)
	const mean = sum / total

	// percentiles
	const p25 = computePercentile(values, 25)
	const median = computePercentile(values, 50)
	const p75 = computePercentile(values, 75)

	// standard deviation
	// get sum of squared differences from mean
	const sumSqDiff = values.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0)
	// get variance
	const variance = sumSqDiff / (values.length - 1)
	// get standard deviation
	const sd = Math.sqrt(variance)

	// min/max
	const min = Math.min(...values)
	const max = Math.max(...values)

	res.send({
		values: [
			{ id: 'total', label: 'n', value: total },
			{ id: 'min', label: 'Minimum', value: roundValue(min, 2) },
			{ id: 'p25', label: '1st quartile', value: roundValue(p25, 2) },
			{ id: 'median', label: 'Median', value: roundValue(median, 2) },
			{ id: 'mean', label: 'Mean', value: roundValue(mean, 2) },
			{ id: 'p75', label: '3rd quartile', value: roundValue(p75, 2) },
			{ id: 'max', label: 'Maximum', value: roundValue(max, 2) },
			{ id: 'sd', label: 'Standard deviation', value: roundValue(sd, 2) }
		]
	})
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

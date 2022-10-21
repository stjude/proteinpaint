const serverconfig = require('./serverconfig.js')
const termdbConfig = require('./termdb.config')
const termdbsql = require('./termdb.sql')
const phewas = require('./termdb.phewas')
const density_plot = require('./termdb.densityPlot')
const cuminc = require('./termdb.cuminc')
const survival = require('./termdb.survival')
const regression = require('./termdb.regression')
const termdbsnp = require('./termdb.snp')
const LDoverlay = require('./mds2.load.ld').overlay
const getOrderedLabels = require('./termdb.barsql').getOrderedLabels
const isUsableTerm = require('#shared/termdb.usecase').isUsableTerm
const trigger_getSampleScatter = require('./termdb.scatter').trigger_getSampleScatter
import * as d3 from 'd3'

/*
********************** EXPORTED
handle_request_closure
copy_term
********************** INTERNAL
trigger_*
*/
//temporary solution to make some requests to correctly decode parameters
const encodedParams = [
	'filter',
	'tvslst',
	'term1_q',
	'term2_q',
	'usecase',
	'variant_filter',
	'info_fields',
	'outcome',
	'independent',
	'terms',
	'colorTW',
	'shapeTW'
]

const limitSearchTermTo = 10

export function handle_request_closure(genomes) {
	/*
	 */

	return async (req, res) => {
		const q = req.query

		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'

			const [ds, tdb] = get_ds_tdb(genome, q)

			for (const param of encodedParams) {
				if (typeof q[param] == 'string') {
					const strvalue = q[param].startsWith('%') ? decodeURIComponent(q[param]) : q[param]
					q[param] = JSON.parse(strvalue)
				}
			}

			// process triggers
			if (q.gettermbyid) return trigger_gettermbyid(q, res, tdb)
			if (q.getcategories) return trigger_getcategories(q, res, tdb, ds)
			if (q.getpercentile) return trigger_getpercentile(q, res, ds)
			if (q.getnumericcategories) return trigger_getnumericcategories(q, res, tdb, ds)
			if (q.default_rootterm) return await trigger_rootterm(q, res, tdb)
			if (q.get_children) return await trigger_children(q, res, tdb)
			if (q.findterm) return await trigger_findterm(q, res, tdb, ds)
			if (q.scatter) return trigger_scatter(q, res, tdb, ds)
			if (q.getterminfo) return trigger_getterminfo(q, res, tdb)
			if (q.phewas) {
				if (q.update) return await phewas.update_image(q, res)
				if (q.getgroup) return await phewas.getgroup(q, res)
				return await phewas.trigger(q, res, ds)
			}
			if (q.density) return await density_plot(q, res, ds)
			if (q.gettermdbconfig) return termdbConfig.make(q, res, ds)
			if (q.getcohortsamplecount) return trigger_getcohortsamplecount(q, res, ds)
			if (q.getsamplecount) return trigger_getsamplecount(q, res, ds)
			if (q.getsamples) return trigger_getsamples(q, res, ds)
			if (q.getcuminc) return await trigger_getincidence(q, res, ds)
			if (q.getsurvival) return await trigger_getsurvival(q, res, ds)
			if (q.getregression) return await trigger_getregression(q, res, ds)
			if (q.validateSnps) return res.send(await termdbsnp.validate(q, tdb, ds, genome))
			if (q.getvariantfilter) return trigger_getvariantfilter(res, ds)
			if (q.getLDdata) return trigger_getLDdata(q, res, ds)
			if (q.genesetByTermId) return trigger_genesetByTermId(q, res, tdb)
			if (q.getSampleScatter) return await trigger_getSampleScatter(q, res, ds)
			if (q.getViolinPlotData) return await trigger_getViolinPlotData(q, res, ds)

			// TODO: use trigger flags like above?
			if (q.for == 'termTypes') {
				res.send(await ds.getTermTypes(q))
				return
			} else if (q.for == 'matrix') {
				const data = await require(`./termdb.matrix.js`).getData(q, ds)
				res.send(data)
				return
			} else if (q.for == 'validateToken') {
			}

			throw "termdb: don't know what to do"
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
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

function trigger_getsamples(q, res, ds) {
	// this may be potentially limited?
	// ds may allow it as a whole
	// individual term may allow getting from it
	const lst = termdbsql.get_samples(q.filter, ds)
	const samples = lst.map(i => ds.cohort.termdb.q.id2sampleName(i))
	res.send({ samples })
}

function trigger_gettermbyid(q, res, tdb) {
	const t = tdb.q.termjsonByOneid(q.gettermbyid)
	res.send({
		term: t ? copy_term(t) : undefined
	})
}

function trigger_getcohortsamplecount(q, res, ds) {
	res.send(termdbsql.get_cohortsamplecount(q, ds))
}

function trigger_getsamplecount(q, res, ds) {
	res.send(termdbsql.get_samplecount(q, ds))
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

async function trigger_findterm(q, res, termdb, ds) {
	// TODO also search categories
	const matches = { equals: [], startsWith: [], startsWord: [], includes: [] }
	const str = q.findterm.toUpperCase()

	if (ds.mayGetMatchingGeneNames) {
		// harcoded gene name length limit to exclude fusion/comma-separated gene names
		/* TODO: improve the logic for excluding concatenated gene names */
		if (isUsableTerm({ type: 'geneVariant' }, q.usecase).has('plot')) {
			await ds.mayGetMatchingGeneNames(matches, str, q)
		}
	}

	if (typeof q.cohortStr !== 'string') q.cohortStr = ''
	const terms_ = await termdb.q.findTermByName(
		q.findterm,
		limitSearchTermTo,
		q.cohortStr,
		q.treeFilter,
		q.usecase,
		matches
	)
	const terms = terms_.map(copy_term)
	const id2ancestors = {}
	terms.forEach(term => {
		if (term.type == 'geneVariant') return
		term.__ancestors = termdb.q.getAncestorIDs(term.id)
		term.__ancestorNames = termdb.q.getAncestorNames(term.id)
	})
	res.send({ lst: terms })
}

function trigger_getcategories(q, res, tdb, ds) {
	// thin wrapper of get_summary
	// works for all types of terms
	if (!q.tid) throw '.tid missing'
	const term = tdb.q.termjsonByOneid(q.tid)
	const arg = {
		ds,
		term1_id: q.tid
	}
	if (q.term1_q) arg.term1_q = q.term1_q
	switch (term.type) {
		case 'categorical':
			break
		case 'integer':
		case 'float':
			if (q.term1_q == undefined) arg.term1_q = term.bins.default
			break
		case 'condition':
			if (q.term1_q == undefined) {
				arg.term1_q = {
					mode: q.mode,
					breaks: q.breaks,
					bar_by_grade: q.bar_by_grade,
					bar_by_children: q.bar_by_children,
					value_by_max_grade: q.value_by_max_grade,
					value_by_most_recent: q.value_by_most_recent,
					value_by_computable_grade: q.value_by_computable_grade
				}
			}
			break
		default:
			throw 'unknown term type'
	}
	if (q.filter) arg.filter = q.filter

	const result = termdbsql.get_summary(arg)
	const bins = result.CTE1.bins ? result.CTE1.bins : []

	res.send({
		lst: result.lst,
		orderedLabels: getOrderedLabels(term, bins)
	})
}
function trigger_getnumericcategories(q, res, tdb, ds) {
	if (!q.tid) throw '.tid missing'
	const term = tdb.q.termjsonByOneid(q.tid)
	const arg = {
		ds,
		term_id: q.tid
		//filter
	}
	if (q.filter) arg.filter = q.filter
	const lst = termdbsql.get_summary_numericcategories(arg)
	res.send({ lst })
}

function trigger_getViolinPlotData(q, res, ds) {
	/*
	q={}
	q.termid=str
	q.filter={}
	q.term2={} termwrapper
	*/

	const term = ds.cohort.termdb.q.termjsonByOneid(q.termid)

	const getRowsParam = {
		ds,
		filter: q.filter,
		term1_id: q.termid,
		term1_q: { mode: 'continuous' } // hardcode to retrieve numeric values for violin/boxplot computing on this term
	}

	if (q.term2) {
		if (typeof q.term2 == 'string') q.term2 = JSON.parse(q.term2) // look into why term2 is not parsed beforehand

		getRowsParam.term2_id = q.term2.id
		getRowsParam.term2_q = q.term2.q
	}

	const result = termdbsql.get_rows(getRowsParam)
	/*
	result = {
	  lst: [
	  	{
			sample=int
			key0,val0,
			key1,val1, // key1 and val1 are the same, with numeric values from term1
			key2,val2
				// if q.term2 is given, key2 is the group/bin label based on term2, using which the samples will be divided
				// if q.term2 is missing, key2 is empty string and won't divide into groups
		}, ...x
	  ]
	}
	*/

	result.lst.sort((a, b) => a.val2 - b.val2)

	// some values may be negative float values so filter those out.
	const updatedResult = []
	for (const [i, v] of result.lst.entries()) {
		/*
		if (Math.sign(v.key1) != -1) {
			updatedResult.push(v)
		}
		*/
		if (term.values && term.values[v.key1]) {
			// skip this value
		} else {
			// keep
			updatedResult.push(v)
		}
	}

	const valueSeries = []

	if (q.term2) {
		const key2_to_values = new Map() // k: key2 value, v: list of term1 values

		for (const i of updatedResult) {
			if (i.key2 == undefined || i.key2 == null) {
				// missing key2
				throw 'key2 missing'
			}
			if (!key2_to_values.has(i.key2)) key2_to_values.set(i.key2, [])
			key2_to_values.get(i.key2).push(i.key1)
		}

		for (const [label, values] of key2_to_values) {
			valueSeries.push({ label, values })
		}
	} else {
		// all numeric values go into one array
		const values = updatedResult.map(i => i.key1)
		valueSeries.push({
			values,
			label: 'All samples'
		})
	}

	for (const item of valueSeries) {
		// item: { label=str, values=[v1,v2,...] }

		const bins0 = computeViolinData(item.values)

		const bins = []
		for (const b of bins0) {
			const b2 = {
				x0: b.x0,
				x1: b.x1
			}
			delete b.x0
			delete b.x1
			b2.lst = b
			bins.push(b2)
		}
		const yScaleValues = []
		for (const k of bins) {
			if (k.lst.length >= 1) {
				yScaleValues.push(...k.lst)
			}
		}
		const biggestBin = Math.max(...bins0.map(b => b.length))

		item.bins = bins

		item.biggestBin = biggestBin
		item.yScaleValues = yScaleValues

		delete item.values
	}

	res.send(valueSeries)
}

// compute bins using d3
export function computeViolinData(values) {
	let min = Math.min(...values),
		max = Math.max(...values)

	const yScale = d3.scaleLinear().domain([min, max])

	let ticksCompute
	if (values.length < 50) {
		ticksCompute = 5
	} else {
		ticksCompute = 12
	}

	const binBuilder = d3
		.bin()
		.domain([min, max]) /* extent of the data that is lowest to highest*/
		.thresholds(yScale.ticks(ticksCompute)) /* buckets are created which are separated by the threshold*/
		.value(d => d) /* bin the data points into this bucket*/

	return binBuilder(values)
}

function trigger_scatter(q, res, tdb, ds) {
	q.ds = ds
	const startTime = +new Date()
	const t1 = tdb.q.termjsonByOneid(q.term1_id)
	if (!t1) throw `Invalid term1_id="${q.term1_id}"`
	if (t1.type != 'float' && t1.type != 'integer') throw `term is not integer/float for scatter data`

	const t2 = tdb.q.termjsonByOneid(q.term2_id)
	if (!t2) throw `Invalid term1_id="${q.term2_id}"`
	if (t2.type != 'float' && t2.type != 'integer') throw `term2 is not integer/float for scatter data`

	const rows = termdbsql.get_rows_by_two_keys(q, t1, t2)
	const result = {
		rows
		//time: +(new Date()) - startTime
	}
	res.send(result)
}

function trigger_getterminfo(q, res, tdb) {
	/* get terminfo the the term
rightnow only few conditional terms have grade info
*/
	if (!q.tid) throw 'no term id'
	res.send({ terminfo: tdb.q.getTermInfo(q.tid) })
}

async function trigger_getincidence(q, res, ds) {
	if (!q.minSampleSize) throw 'missing minSampleSize'
	q.minSampleSize = Number(q.minSampleSize)
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
	const percentile_lst = q.getpercentile.split(',').map(p => parseInt(p))
	const perc_values = []
	const values = []
	const rows = termdbsql.get_rows_by_one_key({
		ds,
		key: q.tid,
		filter: q.filter ? (typeof q.filter == 'string' ? JSON.parse(q.filter) : q.filter) : null
	})
	for (const { value } of rows) {
		if (term.values && term.values[value]) {
			// is a special category
			continue
		}

		if (term.skip0forPercentile && value == 0) {
			// quick fix: when the flag is true, will exclude 0 values from percentile computing
			// to address an issue with computing knots
			continue
		}

		values.push(Number(value))
	}
	values.sort((a, b) => a - b)
	for (const p of percentile_lst) {
		if (!Number.isInteger(p) || p < 1 || p > 99) throw 'percentile is not 1-99 integer'
		const value = values[Math.floor((values.length * p) / 100)]
		perc_values.push(value)
	}
	res.send({ values: perc_values })
}

function trigger_getvariantfilter(res, ds) {
	if (!ds.track) throw 'unknown dataset version'
	// variant_filter is always an object, can be empty
	res.send(ds.track.variant_filter)
}

async function trigger_getLDdata(q, res, ds) {
	q.m = JSON.parse(q.m)
	if (ds.track && ds.track.ld && ds.track.ld.tracks.find(i => i.name == q.ldtkname)) return await LDoverlay(q, ds, res)
	res.send({ nodata: 1 })
}

function trigger_genesetByTermId(q, res, tdb) {
	if (!tdb.termMatch2geneSet) throw 'this feature is not enabled'
	if (typeof q.genesetByTermId != 'string' || q.genesetByTermId.length == 0) throw 'invalid query term id'
	const geneset = tdb.q.getGenesetByTermId(q.genesetByTermId)
	res.send(geneset)
}

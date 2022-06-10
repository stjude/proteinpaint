const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const termdbsql = require('./termdb.sql')
const phewas = require('./termdb.phewas')
const density_plot = require('./termdb.densityPlot')
const cuminc = require('./termdb.cuminc')
const survival = require('./termdb.survival')
const regression = require('./termdb.regression')
const termdbsnp = require('./termdb.snp')
const LDoverlay = require('./mds2.load.ld').overlay
const getOrderedLabels = require('./termdb.barsql').getOrderedLabels
const get_flagset = require('./bulk.mset').get_flagset
const isUsableTerm = require('../shared/termdb.usecase').isUsableTerm

/*
********************** EXPORTED
handle_request_closure
copy_term
********************** INTERNAL
trigger_*
*/

const encodedParams = [
	'filter',
	'tvslst',
	'term1_q',
	'usecase',
	'variant_filter',
	'info_fields',
	'outcome',
	'independent',
	'terms'
]

export function handle_request_closure(genomes) {
	/*
	 */

	return async (req, res) => {
		const q = req.query

		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.cohort) throw 'ds.cohort missing'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'no termdb for this dataset'

			//
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
			if (q.gettermdbconfig) return trigger_gettermdbconfig(res, tdb)
			if (q.getcohortsamplecount) return trigger_getcohortsamplecount(q, res, ds)
			if (q.getsamplecount) return trigger_getsamplecount(q, res, ds)
			if (q.getsamples) return trigger_getsamples(q, res, ds)
			if (q.getcuminc) return await trigger_getincidence(q, res, ds)
			if (q.getsurvival) return await trigger_getsurvival(q, res, ds)
			if (q.getregression) return await trigger_getregression(q, res, ds)
			if (q.validateSnps) return res.send(await termdbsnp.validate(q, tdb, ds, genome))
			if (q.getvariantfilter) return trigger_getvariantfilter(res, ds)
			if (q.getLDdata) return trigger_getLDdata(q, res, ds)

			// generic data getter, instead of using flags
			if (q.for) {
				const data = await require(`./termdb.${q.for}.js`).getData(q, ds)
				res.send(data)
				return
			}

			throw "termdb: don't know what to do"
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

function trigger_getsamples(q, res, ds) {
	// this may be potentially limited?
	// ds may allow it as a whole
	// individual term may allow getting from it
	const lst = termdbsql.get_samples(q.filter, ds)
	let samples = lst
	if (ds.sampleidmap) {
		samples = lst.map(i => ds.sampleidmap.get(i))
	}
	res.send({ samples })
}

function trigger_gettermdbconfig(res, tdb) {
	// add attributes to this object for revealing to client
	const c = {
		selectCohort: tdb.selectCohort, // optional
		supportedChartTypes: tdb.q.getSupportedChartTypes(),
		allowedTermTypes: tdb.allowedTermTypes || []
	}
	if (tdb.restrictAncestries) {
		c.restrictAncestries = []
		for (const i of tdb.restrictAncestries) {
			c.restrictAncestries.push({ name: i.name, tvs: i.tvs })
		}
	}
	res.send({ termdbConfig: c })
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
	const flagset = await get_flagset(ds.cohort, q.genome) //console.log(flagset)
	const matches = { equals: [], startsWith: [], startsWord: [], includes: [] }
	const str = q.findterm.toUpperCase()

	if (isUsableTerm({ type: 'geneVariant' }, q.usecase).has('plot')) {
		for (const flagname in flagset) {
			const flag = flagset[flagname]
			for (const gene in flag.data) {
				if (!flag.data[gene]?.length) continue
				const d = { name: gene, type: 'geneVariant' }
				if (gene === str) matches.equals.push(d)
				else if (gene.startsWith(str)) matches.startsWith.push(d)
				else if (gene.includes(' ' + str)) matches.startsWord.push(d)
				else if (gene.includes(str)) matches.includes.push(d)
			}
		}
	}

	if (typeof q.cohortStr !== 'string') q.cohortStr = ''
	const terms_ = await termdb.q.findTermByName(q.findterm, 10, q.cohortStr, q.treeFilter, q.usecase, matches)
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
	if (!q.minEventCnt) throw 'missing minEventCnt'
	q.minSampleSize = Number(q.minSampleSize)
	q.minEventCnt = Number(q.minEventCnt)
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

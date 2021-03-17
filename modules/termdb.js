const app = require('../app')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const termdbsql = require('./termdb.sql')
const phewas = require('./termdb.phewas')
const density_plot = require('./termdb.densityPlot')

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
		app.log(req)

		const q = req.query

		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.cohort) throw 'ds.cohort missing'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'no termdb for this dataset'

			// process triggers
			if (q.gettermbyid) return trigger_gettermbyid(q, res, tdb)
			if (q.getcategories) return trigger_getcategories(q, res, tdb, ds)
			if (q.getnumericcategories) return trigger_getnumericcategories(q, res, tdb, ds)
			if (q.default_rootterm) return trigger_rootterm(q, res, tdb)
			if (q.get_children) return trigger_children(q, res, tdb)
			if (q.findterm) return trigger_findterm(q, res, tdb)
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
	const lst = termdbsql.get_samples(JSON.parse(decodeURIComponent(q.filter)), ds)
	let samples = lst
	if (ds.sampleidmap) {
		samples = lst.map(i => ds.sampleidmap.get(i))
	}
	res.send({ samples })
}

function trigger_gettermdbconfig(res, tdb) {
	res.send({
		termdbConfig: {
			// add attributes here to reveal to client
			selectCohort: tdb.selectCohort // optional
		}
	})
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

function trigger_rootterm(q, res, tdb) {
	const cohortValues = q.cohortValues ? q.cohortValues : ''
	res.send({ lst: tdb.q.getRootTerms(cohortValues) })
}

function trigger_children(q, res, tdb) {
	/* get children terms
may apply ssid: a premade sample set
*/
	if (!q.tid) throw 'no parent term id'
	const cohortValues = q.cohortValues ? q.cohortValues : ''
	res.send({ lst: tdb.q.getTermChildren(q.tid, cohortValues).map(copy_term) })
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

function trigger_findterm(q, res, termdb) {
	// TODO also search categories
	if (typeof q.cohortStr !== 'string') q.cohortStr = ''
	const terms = termdb.q.findTermByName(q.findterm, 10, q.cohortStr).map(copy_term)
	const id2ancestors = {}
	terms.forEach(term => {
		term.__ancestors = termdb.q.getAncestorIDs(term.id)
	})
	res.send({ lst: terms })
}

function trigger_getcategories(q, res, tdb, ds) {
	// thin wrapper of get_summary
	// works for all types of terms, not just categorical
	if (!q.tid) throw '.tid missing'
	const term = tdb.q.termjsonByOneid(q.tid)
	const arg = {
		ds,
		term1_id: q.tid
	}
	switch (term.type) {
		case 'categorical':
			arg.term1_q = q.term1_q
			break
		case 'integer':
		case 'float':
			arg.term1_q = term.bins.default
			break
		case 'condition':
			arg.term1_q = {
				bar_by_grade: q.bar_by_grade,
				bar_by_children: q.bar_by_children,
				value_by_max_grade: q.value_by_max_grade,
				value_by_most_recent: q.value_by_most_recent,
				value_by_computable_grade: q.value_by_computable_grade
			}
			break
		default:
			throw 'unknown term type'
	}
	if (q.filter) arg.filter = JSON.parse(decodeURIComponent(q.filter))
	const lst = termdbsql.get_summary(arg)
	res.send({ lst })
}
function trigger_getnumericcategories(q, res, tdb, ds) {
	if (!q.tid) throw '.tid missing'
	const term = tdb.q.termjsonByOneid(q.tid)
	const arg = {
		ds,
		term_id: q.tid
		//filter
	}
	if (q.filter) arg.filter = JSON.parse(decodeURIComponent(q.filter))
	const lst = termdbsql.get_summary_numericcategories(arg)
	res.send({ lst })
}

function trigger_scatter(q, res, tdb, ds) {
	q.ds = ds
	if (q.tvslst) q.tvslst = JSON.parse(decodeURIComponent(q.tvslst))
	if (q.filter) q.filter = JSON.parse(decodeURIComponent(q.filter))
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

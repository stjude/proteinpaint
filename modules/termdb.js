const app = require('../app')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const termdbsql = require('./termdb.sql')
const phewas = require('./termdb.phewas')


const serverconfig = __non_webpack_require__('./serverconfig.json')


/*
********************** EXPORTED
handle_request_closure
copy_term
********************** INTERNAL
trigger_rootterm
trigger_getcategories
trigger_children
trigger_findterm
trigger_treeto
*/



export function handle_request_closure ( genomes ) {
/*
*/

return async (req, res) => {

	app.log( req )

	const q = req.query

	try {

		const genome = genomes[ q.genome ]
		if(!genome) throw 'invalid genome'
		const ds = genome.datasets[ q.dslabel ]
		if(!ds) throw 'invalid dslabel'
		if(!ds.cohort) throw 'ds.cohort missing'
		const tdb = ds.cohort.termdb
		if(!tdb) throw 'no termdb for this dataset'

		// process triggers

		if( q.getcategories ) return trigger_getcategories( q, res, tdb, ds )
		if( q.default_rootterm ) return trigger_rootterm( res, tdb )
		if( q.get_children ) return trigger_children( q, res, tdb )
		if( q.findterm ) return trigger_findterm( q, res, tdb )
		if( q.treeto ) return trigger_treeto( q, res, tdb )
		if( q.testplot ) return trigger_testplot( q, res, tdb, ds ) // this is required for running test cases!!
		if( q.phewas ) return await phewas.trigger( q, res, tdb, ds )
		if( q.updatephewas ) return await phewas.update_image( q, res )

		throw 'termdb: don\'t know what to do'

	} catch(e) {
		res.send({error: (e.message || e)})
		if(e.stack) console.log(e.stack)
	}
}
}




function trigger_testplot ( q, res, tdb, ds ) {
	q.ds = ds
	const startTime = +(new Date())
	const lst = termdbsql.get_summary( q )
	const result = { lst }
	const t1 = tdb.q.termjsonByOneid( q.term1_id )
	if( t1.isinteger || t1.isfloat ) {
		result.summary_term1 = termdbsql.get_numericsummary( q, t1, ds, q.tvslst )
	}
	if( q.term2_id ) {
		const t2 = tdb.q.termjsonByOneid( q.term2_id )
		if( t2.isinteger || t2.isfloat ) {
			result.summary_term2 = {}
			for(const item of result.lst) {
				if (!(item.key1 in result.summary_term2)) {
					const t1q = {
						term: t1,
						values: t1.iscategorical || t1.iscondition ? [{key:item.key1, label: item.label}] : null,
						ranges: t1.isinteger || t1.isfloat ? [item.range1] : null
					}
					if (q.term1_q) {
						Object.assign(t1q, q.term1_q)
					}
					const tvslst = (q.tvslst ? q.tvslst : []).concat(t1q)
					result.summary_term2[item.key1] = termdbsql.get_numericsummary( q, t2, ds, tvslst )
				}
			}
		}
	}
	result.time = +(new Date()) - startTime
	res.send( result )
}



function trigger_rootterm ( res, tdb ) {
	res.send({lst: tdb.q.getRootTerms() })
}



function trigger_children ( q, res, tdb ) {
/* get children terms
may apply ssid: a premade sample set
*/
	if(!q.tid) throw 'no parent term id'
	res.send({lst: tdb.q.getTermChildren( q.tid ).map( copy_term ) })
}



export function copy_term ( t ) {
/*
t is jsondata from terms table

do not directly hand over the term object to client; many attr to be kept on server
*/
	const t2 = JSON.parse(JSON.stringify( t ))

	// delete things not to be revealed to client

	return t2
}








function trigger_findterm ( q, res, termdb ) {
	res.send({
		lst: termdb.q.findTermByName( q.findterm, 10 ).map( copy_term )
	})
}



function trigger_treeto ( q, res, termdb ) {
	const term = termdb.q.termjsonByOneid( q.treeto )
	if(!term) throw 'unknown term id'
	const levels = [{
		focusid: q.treeto,
	}]
	let thisid = q.treeto
	while( termdb.q.termHasParent( thisid ) ) {
		const parentid = termdb.q.getTermParentId( thisid )
		levels[0].terms = termdb.q.getTermChildren( parentid ).map( copy_term )
		const ele = { // new element for the lst
			focusid: parentid,
		}
		levels.unshift( ele )
		thisid = parentid
	}
	levels[0].terms = termdb.q.getRootTerms()
	res.send({levels})
}







function trigger_getcategories ( q, res, tdb, ds ) {
// thin wrapper of get_summary
// works for all types of terms, not just categorical
	if( !q.tid ) throw '.tid missing'
	const arg = {
		ds,
		term1_id: q.tid,
		term1_q:{
			bar_by_grade: q.bar_by_grade,
			bar_by_children: q.bar_by_children,
			value_by_max_grade: q.value_by_max_grade,
			value_by_most_recent: q.value_by_most_recent
		}
	}
	if( q.tvslst ) arg.tvslst = JSON.parse(decodeURIComponent(q.tvslst))
	const lst = termdbsql.get_summary( arg )
	res.send({lst})
}

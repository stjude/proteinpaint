const app = require('../app')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const sample_match_termvaluesetting = require('./mds2.load.vcf').sample_match_termvaluesetting
const termdbsql = require('./termdb.sql')



const serverconfig = __non_webpack_require__('./serverconfig.json')


/*
********************** EXPORTED
handle_request_closure
server_init
********************** INTERNAL
copy_term
trigger_rootterm
trigger_getcategories
trigger_children
trigger_findterm
trigger_treeto
server_init_db_queries
*/



exports.handle_request_closure = ( genomes ) => {
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
		if( q.testplot ) return trigger_testplot( q, res, tdb, ds )

		throw 'termdb: don\'t know what to do'

	} catch(e) {
		res.send({error: (e.message || e)})
		if(e.stack) console.log(e.stack)
	}
}
}




function trigger_testplot ( q, res, tdb, ds ) {
	q.ds = ds
	const lst = termdbsql.get_samplesummary_by_term( q )
	res.send({lst})
}



function trigger_rootterm ( res, tdb ) {
	res.send({lst: tdb.q.getRootTerms() })
}



async function trigger_children ( q, res, tdb ) {
/* get children terms
may apply ssid: a premade sample set
*/
	if(!q.tid) throw 'no parent term id'
	res.send({lst: tdb.q.getTermChildren( q.tid ).map( copy_term ) })
}



function copy_term ( t ) {
/*
t is jsondata from terms table

do not directly hand over the term object to client; many attr to be kept on server
*/
	const t2 = JSON.parse(JSON.stringify( t ))

	// delete things not to be revealed to client

	return t2
}








function trigger_findterm ( q, res, termdb ) {
	res.send({lst: termdb.q.findTermByName( q.findterm, 10 ) })
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
// thin wrapper of get_samplesummary_by_term
	if( !q.tid ) throw '.tid missing'
	const arg = {
		ds,
		term1_id: q.tid,
		term1q:{
			bar_by_grade: q.bar_by_grade,
			bar_by_children: q.bar_by_children,
			value_by_max_grade: q.value_by_max_grade,
			value_by_most_recent: q.value_by_most_recent
		}
	}
	if( q.tvslst ) arg.tvslst = JSON.parse(decodeURIComponent(q.tvslst))
	const lst = termdbsql.get_samplesummary_by_term( arg )
	res.send({lst})
}







///////////// server init


exports.server_init = ( ds ) => {
/* to initiate termdb for a mds dataset
*/
	const termdb = ds.cohort.termdb

	if(!termdb.term2term) throw '.term2term{} missing'
	server_init_parse_term2term( termdb )

	if(!termdb.termjson) throw '.termjson{} missing'
	server_init_parse_termjson( termdb )

	server_init_mayparse_patientcondition( ds )

	server_init_db_queries( ds )
}




function server_init_db_queries ( ds ) {
// produce function wrappers to each db query
	const q = ds.cohort.db.q
	ds.cohort.termdb.q = {}
	const q2 = ds.cohort.termdb.q
	if(!q.termjsonByOneid) throw 'db query missing: termjsonByOneid'
	q2.termjsonByOneid = (id)=>{
		const t = q.termjsonByOneid.get( id )
		if(t) {
			const j = JSON.parse(t.jsondata)
			j.id = id
			return j
		}
		return undefined
	}
	if(!q.termIsLeaf) throw 'db query missing: termIsLeaf'
	q2.termIsLeaf = (id)=>{
		const t = q.termIsLeaf.get(id)
		if(t && t.id) return false
		return true
	}
	/* as long as the termdb table and logic is universal
	probably fine to hardcode such query strings here
	and no need to define them in each dataset
	thus less things to worry about...
	*/
	{
		const s = ds.cohort.db.connection.prepare('SELECT id,jsondata FROM terms WHERE parent_id is null')
		q2.getRootTerms = ()=>{
			return s.all().map(i=>{
				const t = JSON.parse(i.jsondata)
				t.id = i.id
				return t
			})
		}
	}
	{
		const s = ds.cohort.db.connection.prepare('SELECT parent_id FROM terms WHERE id=?')
		q2.termHasParent = (id)=>{
			const t = s.get(id)
			if(t && t.parent_id) return true
			return false
		}
		q2.getTermParentId = (id)=>{
			const t = s.get(id)
			if(t && t.parent_id) return t.parent_id
			return undefined
		}
		q2.getTermParent = (id)=>{
			const c = q2.getTermParentId(id)
			if(!c) return undefined
			return q2.termjsonByOneid( c )
		}
	}
	{
		const s = ds.cohort.db.connection.prepare('SELECT id,jsondata FROM terms WHERE id IN (SELECT id FROM terms WHERE parent_id=?)')
		q2.getTermChildren = (id)=>{
			const tmp = s.all(id)
			if(tmp) return tmp.map( i=> {
				const j = JSON.parse(i.jsondata)
				j.id = i.id
				return j
			})
			return undefined
		}
	}
	{
		const s = ds.cohort.db.connection.prepare('SELECT id,jsondata FROM terms WHERE name LIKE ?')
		q2.findTermByName = (n, limit)=>{
			const tmp = s.all('%'+n+'%')
			if(tmp) {
				const lst = []
				for(const i of tmp) {
					const j = JSON.parse(i.jsondata)
					j.id = i.id
					lst.push( copy_term(j) )
					if(lst.length==10) break
				}
				return lst
			}
			return undefined
		}
	}
	{
		const s1 = ds.cohort.db.connection.prepare('SELECT MAX(CAST(value AS INT))  AS v FROM annotations WHERE term_id=?')
		const s2 = ds.cohort.db.connection.prepare('SELECT MAX(CAST(value AS REAL)) AS v FROM annotations WHERE term_id=?')
		const cache = new Map()
		q2.findTermMaxvalue = (id, isint) =>{
			if( cache.has(id) ) return cache.get(id)
			const tmp = (isint ? s1 : s2).get(id)
			if( tmp ) {
				cache.set( id, tmp.v )
				return tmp.v
			}
			return undefined
		}
	}
}



function server_init_parse_term2term ( termdb ) {

	if(termdb.term2term.file) {
		// one single text file

		termdb.parent2children = new Map()
		// k: id, v: list of children id
		termdb.child2parent = new Map()
		// k: id, v: parent id

		for(const line of fs.readFileSync(path.join(serverconfig.tpmasterdir,termdb.term2term.file),{encoding:'utf8'}).trim().split('\n') ) {
			if(line[0]=='#') continue
			const [pa,child] = line.split('\t')
			termdb.child2parent.set( child, pa )
			if(!termdb.parent2children.has( pa )) termdb.parent2children.set( pa, [] )
			termdb.parent2children.get( pa ).push( child )
		}
		return
	}
	// maybe sqlitedb
	throw 'term2term: unknown data source'
}



function server_init_parse_termjson ( termdb ) {
	if(termdb.termjson.file) {
		termdb.termjson.map = new Map()
		// k: term
		// v: {}
		let currTerm = -1
		let currLineage = []
		for(const line of fs.readFileSync(path.join(serverconfig.tpmasterdir,termdb.termjson.file),{encoding:'utf8'}).trim().split('\n') ) {
			if(line[0]=='#') continue
			const l = line.split('\t')
			const term = JSON.parse( l[1] )
			term.id = l[0]
			termdb.termjson.map.set( l[0], term )
			if (term.iscondition && term.isleaf) {
				term.conditionlineage = get_term_lineage([term.id], term.id, termdb.child2parent)
			}
		}
		return
	}
	throw 'termjson: unknown data source'
}

function get_term_lineage (lineage, termid, child2parent) {
	const pa = child2parent.get( termid )
	if ( pa ) {
		lineage.push( pa )
		return get_term_lineage(lineage, pa , child2parent)
	} else {
		return lineage
	}
}


function server_init_mayparse_patientcondition ( ds ) {
	if(!ds.cohort.termdb.patient_condition) return
	if(!ds.cohort.termdb.patient_condition.file) throw 'file missing from termdb.patient_condition'
	let count=0
	for(const line of fs.readFileSync(path.join(serverconfig.tpmasterdir,ds.cohort.termdb.patient_condition.file),{encoding:'utf8'}).trim().split('\n')) {
		const l = line.split('\t')
		ds.cohort.annotation[ l[0] ] = JSON.parse(l[1])
		count++
	}
	console.log(ds.label+': '+count+' samples loaded with condition data from '+ds.cohort.termdb.patient_condition.file)
}

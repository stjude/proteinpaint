const app = require('../app')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const termdbsql = require('./termdb.sql')



const serverconfig = __non_webpack_require__('./serverconfig.json')


/*
********************** EXPORTED
handle_request_closure
server_init
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
		if( q.testall ) return trigger_testall( q, res, tdb, ds )

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



async function trigger_children ( q, res, tdb ) {
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







///////////// server init


export function server_init ( ds ) {
/* to initiate termdb for a mds dataset
*/
	const termdb = ds.cohort.termdb

	if(!termdb.term2term) throw '.term2term{} missing'
	server_init_parse_term2term( termdb )

	if(!termdb.termjson) throw '.termjson{} missing'
	server_init_parse_termjson( termdb )

	server_init_mayparse_patientcondition( ds )

	termdbsql.server_init_db_queries( ds )

	server_init_may_load_precomputed(termdb)
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

async function server_init_may_load_precomputed(tdb) {
  if (!tdb || tdb.precomputed || !tdb.precomputed_file) return
  const filename = path.join(serverconfig.tpmasterdir,tdb.precomputed_file)
  try {
    const file = fs.existsSync(filename) ? await utils.read_file(filename, {encoding:'utf8'}) : ''
    tdb.precomputed = JSON.parse(file.trim())
    console.log("Loaded the precomputed values from "+ filename)
  } catch(e) {
    const message = 'Warning: Unable to load the precomputed file ' + filename
    console.log(message, e.message || e)
  }
}






const minimum_total_sample = 50

async function trigger_testall ( q, res, tdb, ds ) {
/*
q{}
.ssid
*/
	if(!q.ssid) throw 'ssid missing'
	const [sample2gt, genotype2sample] = await utils.loadfile_ssid( q.ssid )

	// total number of samples with each genotype
	const het0 = genotype2sample.has( utils.genotype_types.het ) ? genotype2sample.get(utils.genotype_types.het).size : 0
	const href0 = genotype2sample.has( utils.genotype_types.href ) ? genotype2sample.get(utils.genotype_types.href).size : 0
	const halt0 = genotype2sample.has( utils.genotype_types.halt ) ? genotype2sample.get(utils.genotype_types.halt).size : 0


	// collect tests across all terms, one for each category
	const tests = []


	for(const t of ds.cohort.termdb.q.getallterms()) {
		const term = JSON.parse(t.jsondata)
		if(!term.graph) continue

		//////////// prep query for this term
		const qlst = []
		if( term.iscategorical ) {
			qlst.push( { term1_id: t.id, ds } )
		} else if( term.isfloat || term.isinteger ) {
			qlst.push( { term1_id: t.id, ds } )
		} else if( term.iscondition ) {
			// may test other configs
			qlst.push({
				term1_id: t.id,
				ds,
				term1_q: {bar_by_grade:true,value_by_max_grade:true}
			})
		} else {
			throw 'unknown term type'
		}

		for(const q of qlst) {
			////////////// run query
			const re = termdbsql.get_rows( q )
			const category2gt2samples = new Map()
			// k: category (key1)
			// v: map{}
			//    k: gt
			//    v: sample set
			for(const i of re.lst) {
				const genotype = sample2gt[ i.sample ]
				if(!genotype) continue
				const category = i.key1
				if(!category2gt2samples.has(category)) category2gt2samples.set(category, new Map())
				if(!category2gt2samples.get(category).has( genotype )) category2gt2samples.get(category).set( genotype, new Set())
				category2gt2samples.get(category).get(genotype).add( i.sample )
			}

			for(const [category,o] of category2gt2samples) {
				/////////////// each category as a case
				const gt2size = new Map()
				let thiscatnumber = 0
				for(const [gt,s] of o) {
					gt2size.set(gt, s.size)
					thiscatnumber += s.size
				}
				if(thiscatnumber < minimum_total_sample) {
					console.log('skip', category, thiscatnumber)
					continue
				}
				const het  = gt2size.get(utils.genotype_types.het) || 0
				const halt = gt2size.get(utils.genotype_types.halt) || 0
				const href = gt2size.get(utils.genotype_types.href) || 0
				const het2 = het0-het
				const halt2 = halt0-halt
				const href2 = href0-href

				tests.push({
					term: copy_term( term ),
					category,
					q: q.q,
					table: [ 
						het + 2* halt, // case alt
						het + 2* href, // case ref
						het2 + 2* halt2, // ctrl alt
						het2 + 2* href2, // ctrl ref
					]
				})
			}
		}
	}


	///////// fisher
	{
		const lines = []
		for(let i=0; i<tests.length; i++) {
			lines.push( i +'\t'+ tests[i].table.join('\t'))
		}
		const tmpfile = path.join(serverconfig.cachedir,Math.random().toString())
		await utils.write_file( tmpfile, lines.join('\n') )
		const pfile = await utils.run_fishertest( tmpfile )
		const text = await utils.read_file( pfile )
		const pvalues = []
		for(const line of text.trim().split('\n')) {
			const l = line.split('\t')
			const p = Number.parseFloat(l[5])
			pvalues.push(p)
		}
		fs.unlink(tmpfile,()=>{})
		fs.unlink(pfile,()=>{})

		// fdr
		const fdr = await utils.run_fdr( pvalues )
		for(const [i,p] of fdr.entries()) {
			tests[i].pvalue = p
		}
	}


	/////////////// fdr


	const cutoff = 0.05
	const results = tests.filter( i=> i.pvalue <= cutoff )
	results.sort( (i,j)=> i.pvalue-j.pvalue )

	res.send({results})
}

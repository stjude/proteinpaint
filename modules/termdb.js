const app = require('../app')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const sample_match_termvaluesetting = require('./mds2.load.vcf').sample_match_termvaluesetting



const serverconfig = __non_webpack_require__('./serverconfig.json')


/*
********************** EXPORTED
handle_request_closure
server_init
********************** INTERNAL
copy_term
trigger_rootterm
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

		// maybe no need to apply filter here
		//const ds_filtered = may_apply_termfilter( q, ds )

		// process triggers

		if( q.getcategories ) return trigger_getcategories( q, res, tdb, ds )

		if( trigger_rootterm( q, res, tdb ) ) return

		if( q.get_children ) {
			await trigger_children( q, res, tdb )
			return
		}
		if( q.findterm ) {
			trigger_findterm( q, res, tdb )
			return
		}

		throw 'termdb: don\'t know what to do'

	} catch(e) {
		res.send({error: (e.message || e)})
		if(e.stack) console.log(e.stack)
	}
}
}




function may_apply_termfilter ( q, ds ) {
	if(!q.termfilter) return ds

	// for categorical terms, must convert values to valueset
	for(const t of q.termfilter) {
		if(t.term.iscategorical) {
			t.valueset = new Set( t.values.map(i=>i.key) )
		}
	}

	/*
	if needs filter, ds_filtered to point to a copy of ds with modified cohort.annotation{} with those samples passing filter
	filter by keeping only samples annotated to certain term (e.g. wgs)
	*/
	let all=0, use=0
	const new_annotation = {}
	for(const sample in ds.cohort.annotation) {
		const sa = ds.cohort.annotation[ sample ]
		if( sample_match_termvaluesetting( sa, q.termfilter ) ) {
			new_annotation[ sample ] = sa
		}
	}
	return {
		cohort:{annotation: new_annotation}
	}
}


function trigger_rootterm ( q, res, tdb ) {

	if( !q.default_rootterm) return false

	if(!tdb.default_rootterm) throw 'no default_rootterm for termdb'
	const lst = []
	for(const i of tdb.default_rootterm) {
		const t = tdb.termjson.map.get( i.id )
		if(t) {
			lst.push( copy_term( t ) )
		}
	}
	res.send({lst: lst})
	return true
}



async function trigger_children ( q, res, tdb ) {
/* get children terms
may apply ssid: a premade sample set
*/
	if(!q.tid) throw 'no parent term id'
	// list of children id
	const cidlst = tdb.parent2children.get( q.tid )
	// list of children terms
	const lst = []
	if(cidlst) {
		for(const cid of cidlst) {
			const t = tdb.termjson.map.get( cid )
			if(t) {
				lst.push( copy_term( t ) )
			}
		}
	}

	/* not dealing with ssid
	if( 0 && q.get_children.ssid ) {
		// based on premade sample sets, count how many samples from each set are annotated to each term
		const samplesets = await load_ssid( q.get_children.ssid )
		for(const term of lst) {
			term.ss2count = {}
			for(const sampleset of samplesets) {
				term.ss2count[ sampleset.name ] = term_getcount_4sampleset( term, sampleset.samples )
			}
		}
	}
	*/

	res.send({lst: lst})
}



function copy_term ( t ) {
/*
t is the {} from termjson

do not directly hand over the term object to client; many attr to be kept on server
*/
	const t2 = JSON.parse(JSON.stringify( t ))

	// delete things not to be revealed to client

	return t2
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






function trigger_findterm ( q, res, termdb ) {
	const str = q.findterm.toLowerCase()
	const lst = []
	for(const term of termdb.termjson.map.values()) {
		if(term.name.toLowerCase().indexOf( str ) != -1) {
			lst.push( copy_term( term ) )
			if(lst.length>=10) {
				break
			}
		}
	}
	res.send({lst:lst})
}



async function load_ssid ( ssid ) {
/* ssid is the file name under cache/ssid/
*/
	const text = await utils.read_file( path.join( serverconfig.cachedir, 'ssid', ssid ) )
	const samplesets = []
	for(const line of text.split('\n')) {
		const l = line.split('\t')
		samplesets.push({
			name: l[0],
			samples: l[1].split(',')
		})
	}
	return samplesets
}


function term_getcount_4sampleset ( term, samples ) {
/*
term
samples[] array of sample names
*/
}



function trigger_getcategories ( q, res, tdb, ds ) {
/*
to get the list of categories for a categorical term
supply sample count annotated to each category
if q.samplecountbyvcf, will count from vcf samples
otherwise, count from all samples
*/
	const t = tdb.termjson.map.get( q.termid )
	if(!t) throw 'unknown term id'
	if(!t.iscategorical) throw 'term not categorical'
	const category2count = new Map()

	if( q.samplecountbyvcf ) {
		if(!ds.track || !ds.track.vcf || !ds.track.vcf.samples ) throw 'cannot use vcf samples, necessary parts missing'
		for(const s of ds.track.vcf.samples) {
			const a = ds.cohort.annotation[s.name]
			if(!a) continue
			const v = a[ q.termid ]
			if(!v) continue
			category2count.set( v, 1 + (category2count.get(v)||0) )
		}
	} else {
		for(const n in ds.cohort.annotation) {
			const a = ds.cohort.annotation[n]
			const v = a[ q.termid ]
			if(!v) continue
			category2count.set( v, 1 + (category2count.get(v)||0) )
		}
	}
	const lst = [...category2count].sort((i,j)=>j[1]-i[1])
	res.send({lst: lst.map(i=>{
			let label
			if( t.values && t.values[i[0]] ) {
				label = t.values[i[0]].label
			}
			return {
				key: i[0],
				label: (label || i[0]),
				samplecount: i[1]
			}
		})
	})
}

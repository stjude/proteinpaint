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

	if( app.reqbodyisinvalidjson(req,res) ) return

	const q = req.query

	try {

		const genome = genomes[ q.genome ]
		if(!genome) throw 'invalid genome'
		const ds = genome.datasets[ q.dslabel ]
		if(!ds) throw 'invalid dslabel'
		if(!ds.cohort) throw 'ds.cohort missing'
		const tdb = ds.cohort.termdb
		if(!tdb) throw 'no termdb for this dataset'

		const ds_filtered = may_apply_termfilter( q, ds )

		// process triggers

		if( trigger_rootterm( q, res, tdb ) ) return

		if( q.getcategories ) return trigger_getcategories( q, res, tdb, ds_filtered )
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




function trigger_crosstab2term_boxplot ( q, res, tdb, ds ) {
/*
code replication

trigger_crosstab2term already complicated, don't want to add any more
*/
	if(!q.term1) throw 'term1 missing'
	if(!q.term1.id) throw 'term1.id missing'
	const term1 = tdb.termjson.map.get( q.term1.id )
	if(!term1) throw 'term1.id invalid'
	if(!q.term2) throw 'term2 missing'
	if(!q.term2.id) throw 'term2.id missing'
	const term2 = tdb.termjson.map.get( q.term2.id )
	if(!term2) throw 'term2.id invalid'
	if(!ds.cohort) throw 'ds.cohort missing'
	if(!ds.cohort.annotation) throw 'ds.cohort.annotation missing'


	// for now, require these terms to have barcharts, and use that to tell if the term is categorical/numeric
	// later switch to term type
	if(!term1.graph) throw 'term1.graph missing'
	if(!term1.graph.barchart) throw 'term1.graph.barchart missing'
	if(!term2.graph) throw 'term2.graph missing'
	if(!term2.graph.barchart) throw 'term2.graph.barchart missing'

	if(!(term2.isinteger || term2.isfloat)) throw 'boxplot: term2 is not numerical'


	// if term1 is categorical, use to store crosstab data in each category
	// k: category value, v: {}
	let t1categories
	// if term1 is numerical, use to store crosstab data in each bin
	let t1binconfig

	// premake numeric bins for t1 and t2
	if( term1.isinteger || term1.isfloat ) {

		/* when a barchart has been created for numeric term1,
		it will be based on either auto bin or fixed bins
		but not by the special crosstab bins
		so do not apply the special bin when it is term1
		*/
		const [ bc, values ] = termdb_get_numericbins( q.term1.id, term1, ds )
		t1binconfig = bc
	} else if( term1.iscategorical ) {
		t1categories = new Map()
		// k: t1 category value
		// v: {}
	} else {
		throw 'unknown term1 value type'
	}



	for(const s in ds.cohort.annotation) {
		const sampleobj = ds.cohort.annotation[ s ]

		// test term2 value first
		const v2 = sampleobj[ q.term2.id ]
		if( !Number.isFinite( v2 )) continue

		if(term2.graph.barchart.numeric_bin.unannotated) {
			if( v2 == term2.graph.barchart.numeric_bin.unannotated.value ) {
				// exclude unannotated value for term2
				continue
			}
		}

		// slot v2 into term1 bin
		const v1 = sampleobj[ q.term1.id ]

		if( t1categories ) {

			if( v1 == undefined) continue

			if(!t1categories.has( v1 )) {
				t1categories.set( v1, { values: [] } )
			}
			t1categories.get(v1).values.push( {value:v2} )

		} else {

			// t1 is numerical
			if( !Number.isFinite( v1 )) continue
			// get the bin for this sample
			const bin = termdb_value2bin( v1, t1binconfig )
			if(!bin) {
				// somehow this sample does not fit to a bin
				continue
			}
			bin.value--
			if(!bin.values) {
				bin.values = []
			}
			bin.values.push( {value:v2} )
		}
	}

	// return result

	let lst = [] // list of t1 categories/bins
	let binmax = 0 // max number of samples for each bin

	if(t1categories) {
		for(const [ v1, o ] of t1categories) {

			o.values.sort((i,j)=>i.value-j.value)

			binmax = Math.max( binmax, o.values[ o.values.length-1 ].value )

			const group = {
				vvalue: v1,
				label: q.term1.values ? q.term1.values[v1].label : v1,
				boxplot: app.boxplot_getvalue( o.values )
			}

			lst.push(group)
		}

		if( term1.graph.barchart.order ) {
			// term1 has predefined order
			const lst2 = []
			for(const i of term1.graph.barchart.order) {
				const j = lst.find( m=> m.vvalue == i )
				if( j ) {
					lst2.push( j )
				}
			}
			lst = lst2
		} else {
			// no predefined order, sort to descending order
			lst.sort((i,j)=>j.value-i.value)
		}

	} else {

		// term1 is numeric; merge unannotated bin into regular bins
		if( t1binconfig.unannotated ) {
			t1binconfig.bins.push( t1binconfig.unannotated )
		}

		for(const b of t1binconfig.bins ) {

			b.values.sort((i,j)=>i.value-j.value)

			binmax = Math.max( binmax, b.values[ b.values.length-1 ].value )

			const group = {
				label: b.label,
				boxplot: app.boxplot_getvalue( b.values )
			}

			lst.push( group )
		}
		// term1 is numeric bin and is naturally ordered, so do not sort them to decending order
	}

	res.send( {
		lst: lst,
		binmax: binmax,
		} )
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
	// list of children id
	const cidlst = tdb.term2term.map.get( q.get_children.id )
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

	if( 0 && q.get_children.ssid ) {
		/*
		may not do this
		but to apply this to barchart
		*/
		// based on premade sample sets, count how many samples from each set are annotated to each term
		const samplesets = await load_ssid( q.get_children.ssid )
		for(const term of lst) {
			term.ss2count = {}
			for(const sampleset of samplesets) {
				term.ss2count[ sampleset.name ] = term_getcount_4sampleset( term, sampleset.samples )
			}
		}
	}

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
		termdb.term2term.map = new Map()
		// k: parent
		// v: [] children
		for(const line of fs.readFileSync(path.join(serverconfig.tpmasterdir,termdb.term2term.file),{encoding:'utf8'}).trim().split('\n') ) {
			if(line[0]=='#') continue
			const l = line.split('\t')
			if(!termdb.term2term.map.has( l[0] )) termdb.term2term.map.set( l[0], [] )
			termdb.term2term.map.get( l[0] ).push( l[1] )
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
		for(const line of fs.readFileSync(path.join(serverconfig.tpmasterdir,termdb.termjson.file),{encoding:'utf8'}).trim().split('\n') ) {
			if(line[0]=='#') continue
			const l = line.split('\t')
			const term = JSON.parse( l[1] )
			term.id = l[0]
			termdb.termjson.map.set( l[0], term )
		}
		return
	}
	throw 'termjson: unknown data source'
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
	const str = q.findterm.str.toLowerCase()
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

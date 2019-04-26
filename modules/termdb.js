const app = require('../app')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')



const serverconfig = __non_webpack_require__('./serverconfig.json')


/*
********************** EXPORTED
handle_request_closure
server_init
********************** INTERNAL
copy_term
trigger_rootterm
trigger_barchart
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

		const ds_filtered = may_filter_samples( q, tdb, ds )

		// process triggers

		if( trigger_rootterm( q, res, tdb ) ) return

		if( q.getcategories ) return trigger_getcategories( q, res, tdb, ds_filtered )
		if( q.get_children ) {
			await trigger_children( q, res, tdb )
			return
		}
		if( q.barchart ) {
			await trigger_barchart( q, res, tdb, ds_filtered )
			return
		}
		if( q.crosstab2term ) {
			if( q.boxplot ) {
				trigger_crosstab2term_boxplot( q, res, tdb, ds_filtered )
			} else {
				trigger_crosstab2term( q, res, tdb, ds_filtered )
			}
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




function may_filter_samples ( q, tdb, ds ) {
/*
if needs filter, ds_filtered to point to a copy of ds with modified cohort.annotation{} with those samples passing filter
filter by keeping only samples annotated to certain term (e.g. wgs)
filter by genotype of a variant
*/
	return ds
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
				label: b1.label,
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




function trigger_crosstab2term ( q, res, tdb, ds ) {
/*
cross tabulate two terms

numeric term may have custom binning

for each category/bin of term1, divide its samples by category/bin of term2
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


	// if term1 is categorical, use to store crosstab data in each category
	// k: category value, v: {}
	let t1categories
	// if term1 is numerical, use to store crosstab data in each bin
	let t1binconfig
	// if term2 is numerical, for temp use while iterating over term1
	let t2binconfig

	// premake numeric bins for t1 and t2
	if( term1.isinteger || term1.isfloat ) {

		/* when a barchart has been created for numeric term1,
		it will be based on either auto bin or fixed bins
		but not by the special crosstab bins
		so do not apply the special bin when it is term1
		*/
		const [ bc, values ] = termdb_get_numericbins( q.term1.id, term1, ds )
		t1binconfig = bc
	}

	if( term2.isinteger || term2.isfloat ) {

		// when term2 is numeric, may apply its fixed bins special for crosstab

		if( term2.graph.barchart.numeric_bin.crosstab_fixed_bins ) {
			const tempterm = JSON.parse(JSON.stringify(term2))
			tempterm.graph.barchart.numeric_bin.fixed_bins = term2.graph.barchart.numeric_bin.crosstab_fixed_bins
			const [ bc, values ] = termdb_get_numericbins( q.term2.id, tempterm, ds )
			t2binconfig = bc
		} else {
			const [ bc, values ] = termdb_get_numericbins( q.term2.id, term2, ds )
			t2binconfig = bc
		}
	}


	/* below deal with each sample based on conditions of term1/2
	*/

	if( term1.iscategorical ) {

		//// term1 categorical

		t1categories = new Map()
		// k: t1 category value
		// v: {}
		for(const s in ds.cohort.annotation) {
			const sampleobj = ds.cohort.annotation[ s ]
			const v1 = sampleobj[ q.term1.id ]
			if( v1 == undefined) continue

			if(!t1categories.has( v1 )) {
				t1categories.set( v1, {} )
			}

			if( term2.iscategorical ) {

				// both term1/2 categorical

				if( !t1categories.get( v1 ).categories ) {
					t1categories.get( v1 ).categories = new Map()
					// k: t2 category value
					// v: int
				}

				const v2 = sampleobj[ q.term2.id ]
				if( v2 == undefined ) continue

				t1categories.get(v1).categories.set( v2,
					( t1categories.get(v1).categories.get(v2) || 0 ) + 1
				)

			} else if( term2.isinteger || term2.isfloat ) {
			
				// term1 categorical, term2 numerical

				if( !t1categories.get( v1 ).binconfig ) {
					// make a copy of term2 bins
					t1categories.get(v1).binconfig = JSON.parse(JSON.stringify(t2binconfig))
				}

				const v2 = sampleobj[ q.term2.id ]
				if(!Number.isFinite(v2)) continue
				termdb_value2bin( v2, t1categories.get( v1 ).binconfig )

			} else {

				throw 'term2 uknown type'
			}
		}

	} else if( term1.isinteger || term1.isfloat ) {

		// term1 bins already made

		for(const s in ds.cohort.annotation) {

			const sampleobj = ds.cohort.annotation[ s ]
			const v1 = sampleobj[ q.term1.id ]
			if( !Number.isFinite( v1 )) continue

			// get the bin for this sample
			const bin = termdb_value2bin( v1, t1binconfig )

			if(!bin) {
				// somehow this sample does not fit to a bin
				continue
			}
			bin.value--

			if( term2.iscategorical ) {

				// term1 numerical, term2 categorical

				if( !bin.categories ) {
					bin.categories = new Map()
					// k: t2 category value
					// v: int
				}

				const v2 = sampleobj[ q.term2.id ]
				if( v2 == undefined ) continue

				bin.categories.set( v2,
					( bin.categories.get(v2) || 0 ) + 1
				)

			} else if( term2.isinteger || term2.isfloat ) {

				// both term1/2 numerical

				if( !bin.binconfig ) {
					// make a copy of term2 bins
					bin.binconfig = JSON.parse(JSON.stringify(t2binconfig))
				}

				const v2 = sampleobj[ q.term2.id ]
				if(!Number.isFinite(v2)) continue
				termdb_value2bin( v2, bin.binconfig )

			} else {
				throw 'term2 uknown type'
			}
		}

	} else {
		throw 'term1 unknown type'
	}

	// return result

	let lst = [] // list of t1 categories/bins

	if(t1categories) {
		for(const [ v1, o ] of t1categories) {
			const group = {
				vvalue: v1,
				label: term1.values ? term1.values[v1].label : v1,
				lst: [],
				value: 0 // v2s
			}

			if( o.categories ) {
				for(const [v2,c] of o.categories) {
					group.lst.push({
						vvalue: v2,
						label: term2.values ? term2.values[v2].label : v2,
						value: c // v2s
					})
					group.value += c // v2s
				}
			} else if( o.binconfig ) {
				for(const b of o.binconfig.bins) {
					if(b.value>0) {
						group.lst.push({
							label: b.label,
							value: b.value // v2s
						})
						group.value += b.value // v2s
					}
				}
				if( o.binconfig.unannotated) {
					group.lst.push( o.binconfig.unannotated )
					group.value += o.binconfig.unannotated.value // v2s
				}
			} else {
				// this term1 category has no value
				continue
			}

			group.lst.sort((i,j)=>j.value-i.value) // v2s

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

		for(const b1 of t1binconfig.bins ) {

			const group = {
				label: b1.label,
				lst: [],
				value: 0,
			}

			if( b1.categories) {

				for(const [k, v] of b1.categories) {
					group.lst.push({
						vvalue: k,
						label: term2.values ? term2.values[k].label: k,
						value: v
					})
					group.value += v
				}

			} else if( b1.binconfig) {

				for(const b2 of b1.binconfig.bins) {
					group.lst.push({
						label: b2.label,
						value: b2.value,
					})
					group.value += b2.value
				}
				if(b1.binconfig.unannotated) {
					group.lst.push( b1.binconfig.unannotated )
					group.value += b1.binconfig.unannotated.value
				}

			} else {
				// means this term1 bin has no value
				continue
			}

			lst.push( group )
		}
		// term1 is numeric bin and is naturally ordered, so do not sort them to decending order
	}


	const result = {
		lst: lst
	}

	/* return order of term2 values
	this can come from two places:
	.barchart.order[] for categorical terms
	.barchart.numeric_bin.fixed_bins[] for numeric terms with fixed bins
	*/
	if( term2.graph.barchart.order ) {
		result.term2_order = term2.graph.barchart.order
	} else if(term2.graph.barchart.numeric_bin && term2.graph.barchart.numeric_bin.fixed_bins) {
		result.term2_order = term2.graph.barchart.numeric_bin.fixed_bins.map( i=> i.label )
	}

	res.send( result )
}





async function trigger_barchart ( q, res, tdb, ds ) {
/*
summarize numbers to create barchar based on server config

if is a numeric term, also get distribution

*/
	// validate
	if(!q.barchart.id) throw 'barchart.id missing'
	const term = tdb.termjson.map.get( q.barchart.id )
	if(!term) throw 'barchart.id is invalid'
	if(!term.graph) throw 'graph is not available for said term'
	if(!term.graph.barchart) throw 'graph.barchart is not available for said term'
	if(!ds.cohort) throw 'cohort missing from ds'
	if(!ds.cohort.annotation) throw 'cohort.annotation missing'

	if( q.ssid ) {
		await barchart_byssid( q, term, ds, res )
		return
	}


	// different types of barcharts

	if(term.iscategorical) {

		// each bar is a singular categorical value, string
		const value2count = new Map()
		// k: value
		// v: number of samples

		for(const s in ds.cohort.annotation) {
			const v = ds.cohort.annotation[ s ][ q.barchart.id ]
			if(v!=undefined) {
				if(!value2count.has(v)) {
					value2count.set(v, 0)
				}
				value2count.set(v, value2count.get(v)+1 )
			}
		}

		// format to {} to return to client
		let lst = []
		for(const [n,v] of [ ...value2count].sort((i,j)=>j[1]-i[1]) ) {
			lst.push({
				label: term.values ? term.values[n].label : n,
				value: v, // v2s
				vvalue: n // use as "value" after changing into samplecount
			})
		}

		if( term.graph.barchart.order ) {
			// has predefined order
			const lst2 = []
			for(const v of term.graph.barchart.order) {
				const i = lst.find( i=> i.vvalue == v )
				if( i ) {
					lst2.push(i)
				}
			}
			lst = lst2
		}

		res.send({ lst: lst })
		return
	}


	if( term.isinteger || term.isfloat ) {
		// numeric value: each bar is one bin

		const [ binconfig, values ] = termdb_get_numericbins( q.barchart.id, term, ds )

		for(const v of values) {
			termdb_value2bin( v, binconfig )
		}

		const result = {
			lst: binconfig.bins.map( i => {return {label: i.label, value: i.value}} ),
			unannotated: binconfig.unannotated
		}

		{
			/* get the value distribution
			values[] has value for all samples
			if the term has value for unannotated, need to exclude them from stat
			*/
			let values2 = []
			if( term.graph.barchart.numeric_bin.unannotated ) {
				// exclude unannotated
				for(const v of values) {
					if(v != term.graph.barchart.numeric_bin.unannotated.value) {
						values2.push(v)
					}
				}
			} else {
				values2 = values
			}

			// values to be sorted to ascending order for boxplot
			values2.sort((i,j)=> i-j )
			result.boxplot = app.boxplot_getvalue( values2.map( i=>{return {value:i}} ) )
			// get mean value
			result.boxplot.mean = values2.reduce((i,j)=>j+i, 0) / values2.length
			// get sd
			let s = 0
			for(const v of values2) {
				s += Math.pow( v - result.boxplot.mean, 2 )
			}
			result.boxplot.sd = Math.sqrt( s / (values2.length-1) )
		}

		res.send( result )
		return true
	}

	throw 'unknown barchart type'
}



async function barchart_byssid ( q, term, ds, res ) {
/* only iterate through samples used in sets,
not the complete set in ds.cohort
*/
	const samplesets = await load_ssid( q.ssid )

	if(term.iscategorical) {

		const category2set = new Map()
		// k: category, v: {samplecount,sets:{}}

		for(const sampleset of samplesets) {
			for(const sample of sampleset.samples) {
				const o = ds.cohort.annotation[ sample ]
				if(!o) continue

				const category = o[ term.id ]
				if(!category) continue

				if(!category2set.has(category)) category2set.set( category, {value:0, sets:{}})
				category2set.get(category).value++
				category2set.get(category).sets[ sampleset.name ] = (category2set.get(category).sets[ sampleset.name ] || 0) + 1
			}
		}
		// replace sets{} with lst[]
		const lst = []
		for(const [k,v] of category2set) {
			v.label = term.values ? term.values[ k ].label : k
			v.lst = []
			for(const k in v.sets) {
				v.lst.push({
					label: k,
					value: v.sets[ k ]
				})
			}
			delete v.sets
			lst.push(v)
		}
		if( term.graph.barchart.order ) {
			res.send({ lst : term.graph.barchart.order.map( i=> lst.find(j=>j.label==i) ) })
			return
		}

		res.send({ lst: lst.sort((i,j)=> j.value - i.value ) })
		return
	}

	if( term.isfloat || term.isinteger ) {

		const [ binconfig, values ] = termdb_get_numericbins( term.id, term, ds )

		for(const sampleset of samplesets) {
			for(const sample of sampleset.samples) {
				const o = ds.cohort.annotation[ sample ]
				if(!o) continue

				const v = o[ term.id ]
				if(!Number.isFinite(v)) continue
				const bin = termdb_value2bin( v, binconfig )

				if(!bin.sets) bin.sets = {}
				bin.sets[ sampleset.name ] = (bin.sets[sampleset.name] || 0) + 1
			}
		}
		const result = {
			lst: [],
			unannotated: binconfig.unannotated
		}
		// replace sets with lst
		for(const b of binconfig.bins) {
			b.lst = []
			for(const k in b.sets) {
				b.lst.push({
					label: k,
					value: b.sets[k]
				})
			}
			delete b.sets
			result.lst.push(b)
		}

		{
			/* get the value distribution
			values[] has value for all samples
			if the term has value for unannotated, need to exclude them from stat
			*/
			let values2 = []
			if( term.graph.barchart.numeric_bin.unannotated ) {
				// exclude unannotated
				for(const v of values) {
					if(v != term.graph.barchart.numeric_bin.unannotated.value) {
						values2.push(v)
					}
				}
			} else {
				values2 = values
			}

			// values to be sorted to ascending order for boxplot
			values2.sort((i,j)=> i-j )
			result.boxplot = app.boxplot_getvalue( values2.map( i=>{return {value:i}} ) )
			// get mean value
			result.boxplot.mean = values2.reduce((i,j)=>j+i, 0) / values2.length
			// get sd
			let s = 0
			for(const v of values2) {
				s += Math.pow( v - result.boxplot.mean, 2 )
			}
			result.boxplot.sd = Math.sqrt( s / (values2.length-1) )
		}

		res.send( result )
	}
}



function termdb_value2bin ( v, binconfig ) {
/* bins returned by termdb_get_numericbins
given one single value
find its residing bin and increment bin.value
this value is from one sample

if found a matching bin, return for use in crosstab
*/
	if( binconfig.unannotated ) {

		if( v == binconfig.unannotated._value ) {
			// this value/sample is unannotated
			binconfig.unannotated.value++ // v2s
			return binconfig.unannotated
		}

		// this value/sample is annotated, still increment the annotated counter but do not return the bin
		// find the bin that contains this value below and return that
		binconfig.unannotated.value_annotated++ // v2s
	}

	for(const b of binconfig.bins) {
		if( b.startunbound ) {
			if( b.stopinclusive && v <= b.stop  ) {
				b.value++ // v2s
				return b
			}
			if( !b.stopinclusive && v < b.stop ) {
				b.value++ // v2s
				return b
			}
		}
		if( b.stopunbound ) {
			if( b.startinclusive && v >= b.start  ) {
				b.value++ // v2s
				return b
			}
			if( !b.stopinclusive && v > b.start ) {
				b.value++ // v2s
				return b
			}
		}
		if( b.startinclusive  && v <  b.start ) continue
		if( !b.startinclusive && v <= b.start ) continue
		if( b.stopinclusive   && v >  b.stop  ) continue
		if( !b.stopinclusive  && v >= b.stop  ) continue
		b.value++ // v2s
		return b
	}

	// no matching bin found
	return null
}



function termdb_get_numericbins ( id, term, ds ) {
/*
must return values from all samples, not to exclude unannotated values

do not count sample for any bin here, including annotated/unannotated
only initiate the bins without count
barchart or crosstab will do the counting in different ways

return an object for binning setting {}
rather than a list of bins
this is to accommondate settings where a valid value e.g. 0 is used for unannotated samples, and need to collect this count

.bins[]
	each element is one bin
	.start
	.stop
	etc
.unannotated{}
	.value
	.samplecount
	for counting unannotated samples if unannotated{} is set on server
*/

	// step 1, get values from all samples
	const values = []
	for(const s in ds.cohort.annotation) {
		const v = ds.cohort.annotation[ s ][ id ]

		if( Number.isFinite( v ) ) {
			values.push(v)
		}
	}
	if(values.length==0) {
		throw 'No numeric values found for any sample'
	}

	// step 2, decide bins
	const nb = term.graph.barchart.numeric_bin

	const bins = []

	if( nb.fixed_bins ) {
		// server predefined
		// return copy of the bin, not direct obj, as bins will be modified later

		for(const i of nb.fixed_bins) {
			const copy = {
				value: 0 // v2s
			}
			for(const k in i) {
				copy[ k ] = i[ k ]
			}
			bins.push( copy )
		}

	} else if( nb.auto_bins ) {

		/* auto bins
		given start and bin size, use max from value to decide how many bins there are

		if bin size is integer,
		to make nicer labels
		*/

		const max = Math.max( ...values )
		let v = nb.auto_bins.start_value
		while( v < max ) {
			const v2 = v + nb.auto_bins.bin_size

			const bin = {
				start: v,
				stop: v2,
				value: 0, // v2s
				startinclusive:1,
			}

			if( Number.isInteger( nb.auto_bins.bin_size ) ) {
				// bin size is integer, make nicer label

				if( nb.auto_bins.bin_size == 1 ) {
					// bin size is 1; use just start value as label, not a range
					bin.label = v
				} else {
					// bin size bigger than 1, reduce right bound by 1, in label only!
					bin.label = v + ' to ' + (v2-1)
				}
			} else {
				
				// bin size is not integer
				bin.label = v+' to '+v2
			}

			bins.push( bin )

			v += nb.auto_bins.bin_size
		}
	} else {
		throw 'unknown ways to decide bins'
	}

	const binconfig = {
		bins: bins
	}

	if( nb.unannotated ) {
		// in case of using this numeric term as term2 in crosstab, this object can also work as a bin, to be put into the bins array
		binconfig.unannotated = {
			_value: nb.unannotated.value,
			label: nb.unannotated.label,
			label_annotated: nb.unannotated.label_annotated,
			// for unannotated samples
			value: 0, // v2s
			// for annotated samples
			value_annotated: 0, // v2s
		}
	}

	return [ binconfig, values ]
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
// to get the list of categories for a categorical term
	const t = tdb.termjson.map.get( q.termid )
	if(!t) throw 'unknown term id'
	if(!t.iscategorical) throw 'term not categorical'
	const category2count = new Map()
	for(const n in ds.cohort.annotation) {
		const a = ds.cohort.annotation[n]
		const v = a[ q.termid ]
		if(!v) continue
		category2count.set( v, 1 + (category2count.get(v)||0) )
	}
	const lst = [...category2count].sort((i,j)=>j[1]-i[1])
	res.send({lst: lst.map(i=>{
			let label
			if( t.values && t.values[i[0]] ) {
				label = t.values[i[0]].label
			}
			return {
				label: (label || i[0]),
				value: i[0],
				samplecount: i[1]
			}
		})
	})
}

const app = require('../app')
const fs = require('fs')
const readline = require('readline')
const path = require('path')
const d3scale = require('d3-scale')
const d3color = require('d3-color')
const d3interpolate = require('d3-interpolate')
const utils = require('./utils')
//const common = require('../src/common')




/*
********************** EXPORTED
handle_singlecell_closure
********************** INTERNAL
get_pcd
slice_file_add_color
get_geneboxplot
*/





exports.handle_singlecell_closure = ( genomes ) => {

	return async (req, res) => {

		if( app.reqbodyisinvalidjson(req,res) ) return

		try {

			const q = req.query
			const gn = genomes[ q.genome ]
			if(!gn) throw 'invalid genome'

			if( q.getpcd ) {
				await get_pcd( q, gn, res )
				return
			}
			if( q.getgeneboxplot ) {
				await get_geneboxplot( q, gn, res )
				return
			}


		} catch(e) {
			res.send({error: (e.message || e)})
			if(e.stack) console.log(e.stack)
		}
	}
}







async function get_pcd ( q, gn, res ) {
/* hardcoded to 3d
TODO 2d, svg
*/

	const result = {}

	const lines = await slice_file_add_color( q, gn, result )

	const header = `# .PCD v.7 - Point Cloud Data file format
VERSION .7
FIELDS x y z rgb
SIZE 4 4 4 4
TYPE F F F F
COUNT 20 20 20 20
WIDTH 1200
HEIGHT 800
VIEWPOINT 0 0 0 1 0 0 0
POINTS 960000
DATA ascii
`

	result.pcddata = header + lines.join('\n')
	res.send( result )
}









async function slice_file_add_color ( q, gn, result ) {
/*
to slice the csv/tab file of all cells
for each cell, assign color based on desired method
return pcd format data
may attach coloring scheme to result{} for returning to client
*/

	if( !q.textfile ) throw '.textfile missing'
	{
		const [e,file,isurl] = app.fileurl( {query:{file:q.textfile}} )
		if(e) throw '.textfile error: '+e
		q.textfile = file
	}

	// set up coloring scheme
	let categorical_color_function
	let cell2color_byexp  // color by gene expression values 
	let collect_category2color
	// if color scheme is automatic, collect colors here for returning to client

	if( q.getpcd.category_autocolor ) {

		// using a category with automatic color
		categorical_color_function = d3scale.scaleOrdinal( d3scale.schemeCategory20 )
		collect_category2color = {}
		// k: category, v: color

	} else if( q.getpcd.gene_expression ) {

		const ge = q.getpcd.gene_expression
		if(!ge.file) throw 'gene_expression.file missing'
		{
			const [e,file,isurl] = app.fileurl( {query:{file:ge.file}} )
			if(e) throw e
			ge.file = file
		}
		if(!Number.isInteger( ge.barcodecolumnidx )) throw 'gene_expression.barcodecolumnidx missing'
		if(!ge.chr) throw 'gene_expression.chr missing'
		if(!ge.start) throw 'gene_expression.start missing'
		if(!ge.stop)  throw 'gene_expression.stop missing'
		if(!ge.genename) throw 'gene_expression.genename missing'
		if(ge.autoscale) {
			if(!ge.color_min) throw 'gene_expression.color_min missing at autoscale'
			if(!ge.color_max) throw 'gene_expression.color_max missing at autoscale'
		} else {
			throw 'gene_expression: unknown scaling method'
		}

		const coord = (ge.nochr ? ge.chr.replace('chr','') : ge.chr)+':'+ge.start+'-'+ge.stop
		const cell2value = new Map()
		cell2color_byexp = new Map()

		let minexpvalue = 0,
			maxexpvalue = 0

		// collect number of cells
		result.numbercellwithgeneexp = 0
		result.numbercelltotal = 0

		await utils.get_lines_tabix( [ge.file,coord], null, line=>{
			const j = JSON.parse( line.split('\t')[3] )
			if(j.gene != ge.genename) return
			if(!Number.isFinite( j.value )) return
			result.numbercellwithgeneexp++

			if( ge.autoscale ) {
				minexpvalue = Math.min( minexpvalue, j.value )
				maxexpvalue = Math.max( maxexpvalue, j.value )
			}

			cell2value.set( j.sample, j.value )
		})

		// record scaling to return to client
		if( ge.autoscale ) {
			result.minexpvalue = minexpvalue
			result.maxexpvalue = maxexpvalue
			const interpolate = d3interpolate.interpolateRgb( ge.color_min, ge.color_max )
			for(const [k,v] of cell2value ) {
				const c = d3color.color( interpolate( (v-minexpvalue)/(maxexpvalue-minexpvalue) ) )

				cell2color_byexp.set(
					k,
					Number.parseInt( rgbToHex( c.r, c.g, c.b ), 16 )
				)
			}
		}
	}


	return new Promise((resolve,reject)=>{

	const lines = []
	const rl = readline.createInterface({input: fs.createReadStream( q.textfile )})
	let firstline = true

	rl.on('line',line=>{

		if(firstline) {
			firstline=false
			return
		}

		const l = line.split( q.delimiter )

		const newl = []

		for(const i of q.getpcd.coord) {
			newl.push( l[i] )
		}

		if(q.getpcd.coord.length == 2){
			newl.push( '0' )
		}

		if( categorical_color_function ) {

			const ca = l[ q.getpcd.category_index ]
			const co = categorical_color_function( ca )
			newl.push( Number.parseInt( co.slice(1) , 16 ) )
			if( collect_category2color ) {
				collect_category2color[ ca ] = co
			}

		} else if( cell2color_byexp ) {

			result.numbercelltotal++

			const barcode = l[ q.getpcd.gene_expression.barcodecolumnidx ]
			const color = cell2color_byexp.get(barcode)
			if(!color) return
			newl.push(color)
		}

		lines.push( newl.join(' ') )

	})
	rl.on('close',()=>{

		if( collect_category2color ) {
			result.category2color = collect_category2color
		}

		resolve( lines )
	})

	})
}




function componentToHex(c) {
    const hex = c.toString(16)
    return hex.length == 1 ? "0" + hex : hex
}

function rgbToHex(r, g, b) {
    return componentToHex(r) + componentToHex(g) + componentToHex(b)
}




async function get_geneboxplot ( q, gn, res ) {
// also get kernel density for violin plot

	const ge = q.getgeneboxplot

	if(!ge.expfile) throw 'getgeneboxplot.expfile missing'
	{
		const [e,file,isurl] = app.fileurl({query:{file:ge.expfile}})
		if(e) throw 'getgeneboxplot.expfile error: '+e
		ge.expfile = file
	}
	if(!ge.chr) throw 'getgeneboxplot.chr missing'
	if(!ge.start) throw 'getgeneboxplot.start missing'
	if(!ge.stop)  throw 'getgeneboxplot.stop missing'
	if(!ge.genename) throw 'getgeneboxplot.genename missing'

	const barcode2catvalue = await cellfile_get_barcode2category( ge )
	// k: barcode, v: {category, expvalue}

	const coord = (ge.nochr ? ge.chr.replace('chr','') : ge.chr)+':'+ge.start+'-'+ge.stop

	let minexpvalue = 0,
		maxexpvalue = 0

	await utils.get_lines_tabix( [ge.expfile,coord], null, line=>{

		const j = JSON.parse( line.split('\t')[3] )
		if(j.gene != ge.genename) return
		if(!j.sample) return
		if(!Number.isFinite( j.value )) return

		const c = barcode2catvalue.get( j.sample )
		if(!c) return
		c.expvalue = j.value

		minexpvalue = Math.min( minexpvalue, j.value )
		maxexpvalue = Math.max( maxexpvalue, j.value )
	})

	const category2values = new Map()
	// k: category, v: array of exp values, from all cells of that category

	// divide cells to categories
	for(const [barcode,v] of barcode2catvalue) {
		if(!category2values.has(v.category)) category2values.set( v.category, [] )
		category2values.get( v.category ).push( { value: v.expvalue } )
	}

	const boxplots = []
	// each element is one category

	const scaleticks = d3scale.scaleLinear().domain([minexpvalue,maxexpvalue]).ticks(20)

	// kde doesn't work -- using the wrong kernel??
	//const kde = kernelDensityEstimator( kernelEpanechnikov(7), scaleticks )

	const histofunc = get_histogram( scaleticks )

	for(const [category, values] of category2values ) {

		values.sort((i,j)=> i.value-j.value )

		const b = app.boxplot_getvalue( values )
		delete b.out // remove outliers

		b.category = category

		b.numberofcells = values.length // now is just the total number of cells


  		//b.density =  kde( values.map( i=> i.value ) )
		b.density = histofunc( values )

		boxplots.push( b )
	}

	res.send({ boxplots, minexpvalue, maxexpvalue })
}





function get_histogram ( ticks ) {
	return (values) => {
		// array of {value}
		const bins = []
		for(let i=1; i<ticks.length; i++) bins.push(0)
		for(const v of values) {
			for(let i=1; i<ticks.length; i++) {
				if( v.value <= ticks[i] ) {
					bins[i-1]++
					break
				}
			}
		}
		return bins
	}
}





function cellfile_get_barcode2category ( p ) {
/*
.cellfile
.barcodecolumnidx
.categorycolumnidx
.delimiter

returns map, note the value is an object!!
k: barcode
v: { category, expvalue }
*/
	if(!p.cellfile) throw 'cellfile missing'
	{
		const [e,file,isurl] = app.fileurl({query:{file:p.cellfile}})
		if(e) throw 'cellfile error: '+e
		p.cellfile = file
	}
	if(!p.delimiter) throw 'delimiter missing'
	if(!Number.isInteger( p.barcodecolumnidx ) ) throw 'barcodecolumnidx missing'
	if(!Number.isInteger( p.categorycolumnidx) ) throw 'categorycolumnidx missing'

	return new Promise((resolve,reject)=>{

		const barcode2category = new Map()

		const rl = readline.createInterface({ input: fs.createReadStream( p.cellfile ) })
		let first=true
		rl.on('line',line=>{
			if(first) {
				first=false
				return
			}
			const l = line.split( p.delimiter )
			//barcode2category.set( l[ p.barcodecolumnidx ], l[ p.categorycolumnidx ] )
			barcode2category.set( l[ p.barcodecolumnidx ], 
				{
					category: l[ p.categorycolumnidx ],
					expvalue: 0 // FIXME hardcoded baseline value (e.g. the gene is not expressed in this sample)
				}
			)
		})
		rl.on('close',()=>{
			resolve( barcode2category )
		})

	})
}

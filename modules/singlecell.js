const app = require('../app')
const fs = require('fs')
const readline = require('readline')
const path = require('path')
const d3scale = require('d3-scale')
const d3color = require('d3-color')
const d3interpolate = require('d3-interpolate')
const utils = require('./utils')



const serverconfig = __non_webpack_require__('./serverconfig.json')





exports.handle_singlecell_closure = ( genomes ) => {

	return async (req, res) => {

		if( app.reqbodyisinvalidjson(req,res) ) return

		try {

			const q = req.query
			const gn = genomes[ q.genome ]
			if(!gn) throw 'invalid genome'

			if( q.getpcd ) {
				//await get_pcd( q, gn, res )
				await get_pcd_tempfile( q, gn, res )
				return
			}

			// other triggers

		} catch(e) {
			res.send({error: (e.message || e)})
			if(e.stack) console.log(e.stack)
		}
	}
}




async function get_pcd ( q, gn, res ) {
/*
not in use
*/

	const lines = await slice_file( q, gn, res )
	// one line per cell


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
X Y Z
`
	res.send({pcd: header + lines.join('\n')})
}




async function get_pcd_tempfile ( q, gn, res ) {
/* hardcoded to 3d
TODO 2d
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

	const filename = 'tmp/'+Math.random()+'.pcd'
	await utils.write_file( './public/'+filename, header+lines.join('\n') )
	result.pcdfile = filename
	res.send( result )
}









async function slice_file_add_color ( q, gn, result ) {
/*
to slice the csv/tab file of all cells
for each cell, assign color based on desired method
return pcd format data
may attach coloring scheme to result{} for returning to client
*/

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
		ge.file = path.join( serverconfig.tpmasterdir, ge.file )
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
		const cell2color_byexp = new Map()

		let minexpvalue = 0,
			maxexpvalue = 0

		await utils.get_lines_tabix( [ge.file,coord], null, line=>{
			const j = JSON.parse( line.split('\t')[3] )
			if(j.gene != ge.genename) return
			if(!Number.isFinite( j.value )) return

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
	const file = path.join( serverconfig.tpmasterdir, q.textfile )
	const rl = readline.createInterface({input: fs.createReadStream(file)})
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

		if( categorical_color_function ) {
			const ca = l[ q.getpcd.category_index ]
			const co = categorical_color_function( ca )
			newl.push( Number.parseInt( co.slice(1) , 16 ) )
			if( collect_category2color ) {
				collect_category2color[ ca ] = co
			}
		} else if( cell2color_byexp ) {
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

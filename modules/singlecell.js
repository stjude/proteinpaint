const app = require('../app')
const fs = require('fs')
const readline = require('readline')
const path = require('path')
const d3scale =  require('d3-scale')



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
	await write_file( header+lines.join('\n'), './public/'+filename)
	result.pcdfile = filename
	res.send( result )
}





function write_file ( text, filepath ) {
// this func should go to module/utils.js
	return new Promise((resolve, reject)=>{
		fs.writeFile( filepath, text, (err)=>{
			if(err) reject('cannot write')
			resolve()
		})
	})
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
	let numeric_color
	let collect_category2color
	// if color scheme is automatic, collect colors here for returning to client

	if( q.getpcd.category_autocolor ) {

		// using a category with automatic color
		categorical_color_function = d3scale.scaleOrdinal( d3scale.schemeCategory20 )
		collect_category2color = {}
		// k: category, v: color

	} else if( q.getpcd.gene_expression ) {
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

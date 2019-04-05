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

/* hardcoded to 3d
TODO 2d
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
`

	const filename = 'tmp/'+Math.random()+'.pcd'
	await write_file( header+lines.join('\n'), './public/'+filename)
	res.send({pcdfile:filename})
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




function slice_file ( q, gn, res ) {

	// set up coloring scheme
	let categorical_color
	let numeric_color

	if( q.getpcd.category_autocolor ) {
		categorical_color = d3scale.scaleOrdinal( d3scale.schemeCategory20 )
	}
	// TODO gene expression


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

		if( categorical_color ) {
			newl.push( Number.parseInt( categorical_color( l[ q.getpcd.category_index ] ).slice(1), 16 ) )
		}

		lines.push( newl.join(' ') )

	})
	rl.on('close',()=>{
		resolve( lines )
	})

	})
}

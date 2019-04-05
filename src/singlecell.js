import * as client from './client'
import * as common from './common'
import {axisTop} from 'd3-axis'
import {scaleLinear,scaleOrdinal,schemeCategory20} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'



export async function init ( arg, holder ) {

	const obj = await load_json( arg )
	validate_obj( obj )

	obj.genome = arg.genome
	obj.holder = holder

	const pcddata = await load_cell_pcd( obj )
	console.log(pcddata.split('\n').slice(0,50))

	point_cloud()
}


async function load_json ( arg ) {
	if(!arg.jsonfile) throw '.jsonfile missing'
	const tmp = await client.dofetch('textfile',{file:arg.jsonfile})
	if( tmp.error ) throw tmp.error
	return JSON.parse(tmp.text)
}



function validate_obj ( obj ) {
	if( !obj.cells ) throw '.cells{} missing'
	if( !obj.cells.file ) throw '.cells.file missing'
	if( !obj.cells.axis2columnidx) throw '.cells.axis2columnidx missing'
	if(obj.cells.categories) {
		if(!Array.isArray(obj.cells.categories)) throw '.cells.categories should be an array'
		for(const c of obj.cells.categories) {
			if(!c.columnidx) throw 'columnidx missing from category '+c
			if(c.autocolor) {
				c.autocolor = scaleOrdinal( schemeCategory20 )
			}
		}
	}
}




async function load_cell_pcd ( obj ) {
/*
to load a new pcd file
call this when using a new category,
or selected a gene for overlaying
*/

	const wait = obj.holder.append('div')
		.text('Loading data...')

	const arg = {
		genome: obj.genome.name,
		textfile: obj.cells.file,
		delimiter: obj.cells.delimiter || '\t',
		getpcd: {
			coord: obj.cells.axis2columnidx
		}
	}

	if( Number.isInteger(obj.use_category_index) ) {
		/*
		this is the array index of obj.categories[]
		to use this category for coloring cells
		*/
		if(!obj.cells.categories) throw 'using category index but cells.categories[] missing'
		const cat = obj.cells.categories[ obj.use_category_index ]
		if(!cat) throw 'category array index out of bound'
		arg.getpcd.category_index = cat.columnidx
		if( cat.autocolor ) {
			arg.getpcd.category_autocolor = true
		} else {
			throw 'unknow coloring scheme for category '+cat.name
		}

	} else {
		// TODO gene expression
		throw 'unknown method to color the cells'
	}

	return client.dofetch('singlecell',arg)
	.then(data=>{
		if(data.error) throw data.error

		wait.remove()
		return data.pcd
	})
}





function point_cloud(){
	if ( WEBGL.isWebGLAvailable() === false ) {

		document.body.appendChild( WEBGL.getWebGLErrorMessage() )
	
	}

	let container, stats
	let camera, controls, scene, renderer


	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x000000 )

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000 )

	camera.position.x = 20
	camera.position.y = -10
	camera.position.z = 20
	camera.up.set( 0, 0, 1 )

	controls = new THREE.TrackballControls( camera )

	controls.rotateSpeed = 2.0
	controls.zoomSpeed = 0.7
	controls.panSpeed = 0.7

	controls.noZoom = false
	controls.noPan = false

	controls.staticMoving = true
	controls.dynamicDampingFactor = 0.3

	controls.minDistance = 0.3
	controls.maxDistance = 0.3 * 200

	scene.add( camera )

	renderer = new THREE.WebGLRenderer( { antialias: true } )
	renderer.setPixelRatio( window.devicePixelRatio )
	renderer.setSize( window.innerWidth, window.innerHeight )
	document.body.appendChild( renderer.domElement )
}

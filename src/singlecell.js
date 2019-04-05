import * as client from './client'
import * as common from './common'
import {axisTop} from 'd3-axis'
import {scaleLinear,scaleOrdinal,schemeCategory20} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'



export async function init ( arg, holder ) {

	const obj = await load_json( arg )
	validate_obj( obj )

	obj.cells = await load_cell_list( obj )
	console.log('number of cells: ', obj.cells.length, ' first cell: ', obj.cells[0])

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
		for(const c of obj.cells.categories) {
			if(!c.columnidx) throw 'columnidx missing from category '+c
			if(c.autocolor) {
				c.autocolor = scaleOrdinal( schemeCategory20 )
			}
		}
	}
}



async function load_cell_list ( obj ) {
	
	const delimiter = obj.cells.delimiter || '\t'

	const tmp = await client.dofetch('textfile',{file:obj.cells.file})

	const lines = tmp.text.split('\n')

	// if to use a column (cell type) to color the cells
	let use_category
	if( obj.cells.categories ) {
		use_category = obj.cells.categories.find( i=> i.in_use )
		if( !use_category ) {
			// just use the first
			use_category = obj.cells.categories[0]
		}
	}

	const cells = []

	for(let i=1; i<lines.length; i++) {
		const l = lines[i].split( delimiter )
		const j = {}
		for(const k in obj.cells.axis2columnidx) {
			j[k] = Number.parseFloat(l[ obj.cells.axis2columnidx[ k ] ])
		}
		if( use_category ) {
			const v = l[ use_category.columnidx ]
			j.c = use_category.autocolor ? use_category.autocolor(v) : use_category.values[v]
		}
		cells.push(j)
	}
	return cells
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
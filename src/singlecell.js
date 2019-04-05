import * as client from './client'
import * as common from './common'
import {axisTop} from 'd3-axis'
import {scaleLinear,scaleOrdinal,schemeCategory20} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'

var container, stats
var camera, controls, scene, renderer

export async function init ( arg, holder ) {

	const obj = await load_json( arg )
	validate_obj( obj )

	obj.genome = arg.genome
	obj.holder = holder

/*
	const pcddata = ( await load_cell_pcd( obj ) ).pcd
	console.log(pcddata.split('\n').slice(0,50))
	*/

	const filename = ( await load_cell_pcd(obj) ).pcdfile
	// console.log('http://localhost:3001/'+filename)

	point_cloud(filename)
	animate()
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
		return data
	})
}





function point_cloud(filename){
	if ( WEBGL.isWebGLAvailable() === false ) {
		document.body.appendChild( WEBGL.getWebGLErrorMessage() )
	}


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

	// const pcd_ab = str2ab(pcddata)

	var loader = new THREE.PCDLoader();
	// loader.parse( pcd_ab, 'scRNA.pcd', function ( points ) {
		loader.load( filename, function ( points ) {
		
		points.material.size = 0.05
		scene.add( points )
		var center = points.geometry.boundingSphere.center
		controls.target.set( center.x, center.y, center.z )
		controls.update()
	
	} )

	container = document.createElement( 'div' )
	document.body.appendChild( container )
	container.appendChild( renderer.domElement )

	// stats = new Stats()
	// container.appendChild( stats.dom )

	window.addEventListener( 'resize', onWindowResize, false )

	// window.addEventListener( 'keypress', keyboard )
}

function str2ab(str) {
    const array = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        array[i] = str.charCodeAt(i);
	}
    return array.buffer;
}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
	controls.handleResize();

}

function keyboard( ev ) {

	var points = scene.getObjectByName( 'scRNA.pcd' );

	switch ( ev.key || String.fromCharCode( ev.keyCode || ev.charCode ) ) {

		case '+':
			points.material.size *= 1.2;
			points.material.needsUpdate = true;
			break;

		case '-':
			points.material.size /= 1.2;
			points.material.needsUpdate = true;
			break;

		case 'c':
			points.material.color.setHex( Math.random() * 0xffffff );
			points.material.needsUpdate = true;
			break;

	}

}

function animate() {

	requestAnimationFrame( animate );
	controls.update();
	renderer.render( scene, camera );
	// stats.update();

}

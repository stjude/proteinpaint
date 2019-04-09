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

	init_view( obj )
	init_controlpanel( obj )

	const data = await load_cell_pcd( obj )
	render_cloud( obj, data.pcdfile )
	update_controlpanel( obj, data )

	animate()

	function animate() {
		requestAnimationFrame( animate )
		obj.controls.update()
		obj.renderer.render( obj.scene, obj.camera )
	}
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
		if(obj.cells.categories.length==0) throw '.cells.categories[] is empty array'
		for(const c of obj.cells.categories) {
			if(!c.columnidx) throw 'columnidx missing from category '+c
			if(c.autocolor) {
				c.autocolor = scaleOrdinal( schemeCategory20 )
			}
		}
		if(!Number.isInteger( obj.use_category_index )) {
			obj.use_category_index = 0
		}
		if( !obj.cells.categories[ obj.use_category_index ] ) throw 'use_category_index out of bound'
	}
	if( obj.gene_expression ) {
		if(!obj.gene_expression.file) throw '.gene_expression.file missing'
		if(!Number.isInteger(obj.cells.barcodecolumnidx)) throw '.gene_expression in use but .cells.barcodecolumnidx is missing'
	}
	if(!obj.width) obj.width = window.innerWidth*.9
	if(!obj.height) obj.height = window.innerHeight*.9
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
		// update menu_button here
		// obj.menu_button.html( cat.name + '&nbsp;&nbsp;&#9660;')
		obj.use_category_index = cat.columnidx

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





function init_view ( obj ) {

	if ( WEBGL.isWebGLAvailable() === false ) {
		obj.holder.node().appendChild( WEBGL.getWebGLErrorMessage() )
		return
	}


	obj.scene = new THREE.Scene()
	obj.scene.background = new THREE.Color( 0x000000 )


	obj.camera = new THREE.PerspectiveCamera( 45, obj.width/obj.height, 0.1, 1000 )

	obj.camera.position.x = 20
	obj.camera.position.y = -10
	obj.camera.position.z = 20
	obj.camera.up.set( 0, 0, 1 )

	obj.controls = new THREE.TrackballControls( obj.camera )

	obj.controls.rotateSpeed = 2.0
	obj.controls.zoomSpeed = 0.7
	obj.controls.panSpeed = 0.7

	obj.controls.noZoom = false
	obj.controls.noPan = false

	obj.controls.staticMoving = true
	obj.controls.dynamicDampingFactor = 0.3

	obj.controls.minDistance = 0.3
	obj.controls.maxDistance = 0.3 * 200

	obj.scene.add( obj.camera )

	obj.renderer = new THREE.WebGLRenderer( { antialias: true } )
	obj.renderer.setPixelRatio( window.devicePixelRatio )
	obj.renderer.setSize( obj.width, obj.height )

	obj.holder
		.style('display','inline-block')
		.style('position','relative')
		.node().appendChild( obj.renderer.domElement )

	// window.addEventListener( 'resize', onWindowResize(obj), false )
	// window.addEventListener( 'keypress', keyboard )
}



function render_cloud( obj, pcdfilename ){
	const loader = new THREE.PCDLoader()
	loader.load( pcdfilename, function ( points ) {

		points.material.size = 0.05
		obj.scene.add( points )
		const center = points.geometry.boundingSphere.center
		obj.controls.target.set( center.x, center.y, center.z )
		obj.controls.update()

	} )

}


function onWindowResize( obj ) {

	return ()=>{
		const brect = obj.holder.node().getBoundingClientRect()
		obj.camera.aspect = (brect.width-40) / (brect.height-40)
		obj.camera.updateProjectionMatrix()
		obj.renderer.setSize( brect.width-40, brect.height-40 )
		obj.controls.handleResize()
	}
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





function init_controlpanel( obj ) {

	obj.menu = new client.Menu()

	const panel = obj.holder
		.append('div')
		.style('padding','10px')
		.style('position','absolute')
		.style('border-radius','5px')
		.style('top','20px')
		.style('right','20px')
		.style('background-color','#dddddd')

	obj.menu_button = panel.append('select')
		.style('display','inline-block')
		.on('change',()=> update_plot( obj))
	
		if( obj.cells.categories ) {
			for (var key in obj.cells.categories){
				var cat = obj.cells.categories[key]
				// show this category as an option in menu
				obj.menu_button.append('option')
					.attr('value',cat.columnidx)
					.text(cat.name)
				// when choosing this category
				// hide menu, update use_category_index, and redo load_cell_pcd
			}
		}
	
	obj.minimize_btn = panel.append('button')
		.attr('class','collapsible')
		.style('margin-left','10px')
		.style('display','inline-block')
		.style('float','right')
		.text('-')
		.on('click',()=>{
			obj.minimize_btn.classed("active", obj.minimize_btn.classed("active") ? false : true)
			if(obj.minimize_btn.classed("active")){
				obj.minimize_btn.text('+')
			}else{
				obj.minimize_btn.text('-')
			}
			obj.menu_output.style("display", obj.menu_output.display = (obj.menu_output.display == "none" ? "block" : "none"));
		})

	obj.menu_output = panel.append('div')
		.style('margin-top','10px')

}


function update_controlpanel ( obj, data ) {

	obj.menu_output.selectAll('*').remove()

	if( data.category2color ) {
		/*
		showing the color legend for the current category
		TODO
			predefined colors
			at each type, show checkbox for filtering cells
		*/
		for (const type in data.category2color){

			// div for each label
			const row = obj.menu_output
				.append('div')
				.style('margin', '2px')
			
			// square color for the label	
			row.append('div')
				.style('display','inline-block')
				.style('height', '15px')
				.style('width', '15px')
				.style('background-color', data.category2color[type])
				.style('margin-right', '10px')

			//label text
			row.append('span')
				.text(type)
				.attr('font-family',client.font)
		}
	}
}




// function show_menu ( obj ) {
// 	// obj.menu
// 	// 	.clear()
// 	// 	.showunder( obj.menu_button.node())

// 	if( obj.cells.categories ) {
// 		// display categories as options; skip the one currently in use
// 		// console.log(obj.cells.categories)
// 		for (var key in obj.cells.categories){
// 			var cat = obj.cells.categories[key]
// 			if( cat.columnidx == obj.use_category_index ) {
// 				// this category is in use, do not show in menu
// 				continue
// 			}else{
// 				// show this category as an option in menu
// 				obj.menu_button.append('option')
// 					.attr('value',cat.name)
// 					.text(cat.name)
// 			}
// 			// when choosing this category
// 			// hide menu, update use_category_index, and redo load_cell_pcd
// 		}
// 		// for( let i=0; i<obj.cells.categories.length; i++ ) {}
// 	}

// 	if( obj.gene_expression ) {
// 		// show option for gene expression, if it's not in use currently
// 	}
// }

function update_plot( obj){
	
	const arg = {
		genome: obj.genome.name,
		textfile: obj.cells.file,
		delimiter: obj.cells.delimiter,
		getpcd: {
			coord: obj.cells.axis2columnidx,
			category_index: obj.menu_button.node().value,
			category_autocolor: true
		}
	}

	client.dofetch( 'singlecell', arg )
	.then(data=>{
		if(data.error) throw data.error
		obj.use_category_index = obj.menu_button.node().value
		render_cloud( obj, data.pcdfile )
		update_controlpanel( obj, data )

		animate()

		function animate() {
			requestAnimationFrame( animate )
			obj.controls.update()
			obj.renderer.render( obj.scene, obj.camera )
		}
	})
	
}
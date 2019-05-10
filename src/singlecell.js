import * as client from './client'
import * as common from './common'
import * as d3 from 'd3'
import {axisTop, axisRight, axisBottom} from 'd3-axis'
import {scaleLinear,scaleOrdinal,schemeCategory20} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import {gene_searchbox, findgenemodel_bysymbol} from './gene'






export async function init ( arg, holder ) {

	try {

		const obj = await load_json( arg )
		validate_obj( obj )

		obj.genome = arg.genome
		obj.holder = holder

		init_view( obj )
		init_controlpanel( obj )

		await pcd_pipeline(obj)

	} catch(e) {
		client.sayerror(holder, e.message||e)
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

async function pcd_pipeline (obj) {

	const data = await load_cell_pcd( obj )

	// get sphere radius from max of x, y and z coordinates and assign it to camera and controls
	obj.data_sphere_r = data.data_sphere_r
	if(!obj.camera.position.z){
		obj.camera.position.z = obj.data_sphere_r * 3
		obj.controls.maxDistance = obj.data_sphere_r * 4
		obj.controls.minDistance = obj.data_sphere_r / 10
	}
	const enc = new TextEncoder()
	const pcd_buffer = enc.encode(data.pcddata).buffer
	render_cloud( obj, pcd_buffer )
	update_controlpanel( obj, data )

	animate()

	function animate() {
		requestAnimationFrame( animate )
		obj.controls.update()
		obj.renderer.render( obj.scene, obj.camera )
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
		// update menu_button here
		obj.menu_button.html( cat.name + '&nbsp;&nbsp;&#9660;')


	} else if( Number.isInteger( obj.use_gene_index ) ) {
		const gene = obj.gene_expression.genes[ obj.use_gene_index ]
		obj.menu_button.html( 'Gene : ' + gene.gene + '&nbsp;&nbsp;&#9660;')
		arg.getpcd.gene_expression = {
			file: obj.gene_expression.file,
			barcodecolumnidx: obj.cells.barcodecolumnidx,
			chr: gene.chr,
			start: gene.start,
			stop: gene.stop,
			autoscale: true,
			genename: gene.gene, 
			color_min: obj.gene_expression.color_min,
			color_max: obj.gene_expression.color_max
		}
		if(obj.gene_expression.color_no_exp) arg.getpcd.gene_expression.color_no_exp = obj.gene_expression.color_no_exp
	} else {
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
	if(obj.background_color){
		obj.scene.background = new THREE.Color( obj.background_color )
	}else{
		obj.scene.background = new THREE.Color( 0xffffff )
	}


	obj.camera = new THREE.PerspectiveCamera( 45, obj.width/obj.height, 0.1, 1000 )

	obj.camera.position.x = obj.canvas_2d ? 0 : 20
	obj.camera.position.y = obj.canvas_2d ? 0 : -10

	if(obj.canvas_2d){
		obj.camera.up.set( 0, 1, 0 )
	}else{
		obj.camera.up.set( 0, 0, 1 )
	}

	obj.controls = new THREE.TrackballControls( obj.camera )

	obj.controls.rotateSpeed = obj.canvas_2d ? 0 : 2.0
	obj.controls.zoomSpeed = obj.canvas_2d ? 3.0 : 0.7
	obj.controls.panSpeed = obj.canvas_2d ? 3.0 : 0.7

	obj.controls.noZoom = true
	obj.controls.noPan = false

	obj.controls.staticMoving = true
	obj.controls.dynamicDampingFactor = 0.3

	obj.scene.add( obj.camera )

	obj.renderer = new THREE.WebGLRenderer( { antialias: true } )
	obj.renderer.setPixelRatio( window.devicePixelRatio )
	obj.renderer.setSize( obj.width, obj.height )
	obj.renderer.domElement.style.backgroundColor = "#ffffff"
	obj.renderer.domElement.style.border = 'solid #dddddd 2px'

	obj.holder
		.style('display','inline-block')
		.style('position','relative')
		.node().appendChild( obj.renderer.domElement )
	
	obj.renderer.render( obj.scene, obj.camera )

	// window.addEventListener( 'resize', onWindowResize(obj), false )
	// window.addEventListener( 'keypress', keyboard )
}



function render_cloud( obj, pcd_buffer ){

	// remove old points before adding new
	obj.scene.children.forEach(function(v,i) {
		if(v.material){
			v.material.dispose()
			v.geometry.dispose()
			obj.scene.remove(v)
		}
	})

	// add new points using loader
	const loader = new THREE.PCDLoader()
	const points = loader.parse(pcd_buffer,'')
	// loader.load( pcdfilename, function ( points ) {

	if(obj.point_size){
		points.material.size = obj.point_size
	}else{
		points.material.size = obj.canvas_2d ? 0.3 : 0.05
	}
	
	obj.scene.add(points)
	const center = points.geometry.boundingSphere.center
	obj.controls.target.set( center.x, center.y, center.z )
	obj.controls.update()

	// } )

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
	obj.menu.d.style('padding','3px')

	obj.settings = new client.Menu()
	obj.settings.d.style('padding','3px')

	const panel = obj.holder
		.append('div')
		.style('padding','10px')
		.style('position','absolute')
		.style('border-radius','5px')
		.style('top','20px')
		.style('right','20px')
		.style('background-color','#dddddd')

	obj.menu_button = panel.append('button')
		.style('display','inline-block')
		.style('padding','4px')
		.on('click',()=> make_menu( obj ))
	
	 obj.minimize_btn = panel.append('button')
        .style('margin-left','10px')
        .style('display','inline-block')
        .style('padding-left','0px')
		.style('padding-right','2px')
        .style('float','right')
        .html(' &#65293;')
        .on('click',()=>{
            obj.minimize_btn.classed("active", obj.minimize_btn.classed("active") ? false : true)
            if(obj.minimize_btn.classed("active")){
                obj.minimize_btn
                    .html(' &#65291;')
            }else{
                obj.minimize_btn
                .html(' &#65293;')
            }
            obj.menu_output.style("display", obj.menu_output.display = (obj.menu_output.display == "none" ? "block" : "none"));
        })

	obj.use_background_color = 0

	obj.settings_btn = panel.append('button')
        .style('margin-left','10px')
        .style('display','inline-block')
        .style('padding-left','3px')
		.style('padding-right','3px')
        .style('float','right')
        .html('&#9187;')
        .on('click',()=> make_settings( obj))
		
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
	} else if(data.maxexpvalue){

		// for gene expression data show gradient scale with unit

		const scale_height = 30
		const scale_width = 120

		const scale_div = obj.menu_output
			.append('div')
			.style('margin', '10px')
			.style('width','120px')
			.style('height','100px')
			
		scale_div.append('div')
			.text('Gene Expression ' + obj.gene_expression.datatype)
			.style('text-align','center')
			.style('width','150px')
			.style('margin-bottom','20px')

		const svg = scale_div.append('svg').append('g')

		const colorRange = [obj.gene_expression.color_max, obj.gene_expression.color_min]

		const colorScale = scaleLinear()
			.range(colorRange)
			.domain([data.minexpvalue, data.maxexpvalue])

		const defs = svg.append('defs')

		const linearGradient = defs.append("linearGradient")
			.attr("id", "linear-gradient")
			// .attr('gradientTransform', 'rotate(90)')
			
		linearGradient.append("stop")
            .attr("offset", "0%")
			.attr("stop-color", colorScale(data.maxexpvalue))
			
		linearGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", colorScale(data.minexpvalue))

		svg.append('rect')
			.attr('x', 0)
			.attr('y', 0 )
			.attr('width',scale_width)
			.attr('height', scale_height )
			.attr("transform", 'translate(12, 0)')
			.style('fill', "url(#linear-gradient)")

		const y = scaleLinear()
			.range([0, scale_width])
			.domain([data.minexpvalue, data.maxexpvalue])

		const legendAxis = axisBottom()
			.scale(y)
			.ticks(5)

		svg.append("g")
			.attr("class", "legend axis")
			.attr("transform", 'translate(12,'+ scale_height+')')
			.call(legendAxis)

		const stats_div = obj.menu_output.append('div')
			.style('padding-bottom','20px')
			.style('text-align','center')

		stats_div.append('p')
			.style('font-size','13px')
			.style('margin','2px 0')
			.html('<b>Cells with Expression Data</b> ')

		stats_div.append('p')
			.style('font-size','13px')
			.style('margin','2px 0')
			.html(data.numbercellwithgeneexp + ' / ' + data.numbercelltotal)

		const no_exp_div = stats_div.append('div')
			.style('display','block')
			.style('margin-top', '10px')
		
		no_exp_div.append('div')
			.style('display','inline-block')
			.style('height', '15px')
			.style('width', '15px')
			.style('background-color', (obj.gene_expression.color_no_exp) ? obj.gene_expression.color_no_exp : '#2C2C2C')
			.style('margin-right', '10px')

		no_exp_div.append('div')
			.style('display','inline-block')
			.style('font-size','13px')
			.html(' Cells without Expression')
			

		// Show option for Boxplot for Gene Expression by catagories
		const boxplot_div = obj.menu_output.append('div')
			
		boxplot_div.append('div')
			.style('display','block')
			.style('padding-bottom','5px')
			.text('Boxplot of Expression by')
			
		const boxplot_cat_select = boxplot_div.append('select')
		.style('display','block')

		boxplot_cat_select.append('option')
		.attr('value','none')
		.text('-- Select--')

		if( obj.cells.categories ) {
			obj.cells.categories.forEach( (category,i) => {
				boxplot_cat_select.append('option')
				.attr('value',category.columnidx)
				.text(category.name)
			})
		}
		boxplot_cat_select.on('change',()=>{
			const gene = obj.gene_expression.genes[ obj.use_gene_index ]
			const arg = {
				genome: obj.genome.name,
				getgeneboxplot: {
					expfile: obj.gene_expression.file,
					chr: gene.chr,
					start: gene.start,
					stop: gene.stop,
					genename: gene.gene,
					cellfile: obj.cells.file,
					barcodecolumnidx: obj.cells.barcodecolumnidx,
					categorycolumnidx: parseInt(boxplot_cat_select.node().value),
					delimiter: obj.cells.delimiter || '\t'
				}
			}
			client.dofetch( 'singlecell', arg )
			.then(data=>{
				if(data.error) throw data.error
				obj.box_plot = new client.Menu()
				make_boxplot(data, obj, boxplot_cat_select.node().value)
			})

		})
	}
}

function make_menu ( obj ) {
	obj.menu.clear()
		.showunder( obj.menu_button.node() )
	

	if( obj.cells.categories ) {
		obj.cells.categories.forEach( (category, i) => {
			if( i != obj.use_category_index ) {
				// add option
				obj.menu.d
				.append('div')
				.text(category.name)
				.attr('class','sja_menuoption')
				.on('click',async ()=>{
					obj.menu.hide()

					obj.use_category_index = i
					pcd_pipeline(obj)
				
				})
			}
		})
	}

	if( obj.gene_expression) {
		// add option
		obj.menu.d
			.append('div')
			.text('Gene expression')
			.attr('class','sja_menuoption')
			.on('click',()=>{
				obj.menu.clear()

				const gene_search_div = obj.menu.d.append('div')
					.style('padding','10px')

				gene_searchbox({
					div: gene_search_div.append('div'),
					resultdiv: gene_search_div.append('div'),
					genome: obj.genome.name,
					callback: async (genename)=>{
						const gmlst = await findgenemodel_bysymbol( obj.genome.name, genename )
						if( gmlst && gmlst[0] ) {
							const gm = gmlst[0]
							if(!obj.gene_expression.genes) obj.gene_expression.genes = []
							const geneidx = obj.gene_expression.genes.findIndex( i=> i.gene == genename )
							if( geneidx == -1 ) {
								obj.gene_expression.genes.push({
									gene: genename,
									chr: gm.chr,
									start: gm.start,
									stop: gm.stop
								})
								obj.use_gene_index = obj.gene_expression.genes.length - 1
							} else {
								obj.use_gene_index = geneidx
							}
						}
						obj.use_category_index = null
						obj.menu.hide()

						pcd_pipeline(obj)
					}
				})

			})
	}

	// menu option for multi-gene heatmap

	obj.menu.d.append('div')
	.text('Multi-Gene Heatmap')
	.attr('class','sja_menuoption')
	.on('click', ()=>{
		heatmap_menu(obj)
	})

	if(obj.gene_expression.genes){
		
		if(obj.gene_expression.genes.length >1){
		obj.menu.d.append('div')
			.style('padding','5px 10px')
			.text('Previously Selected')
		}

		obj.gene_expression.genes.forEach( (gene, i) => {
			if( i != obj.use_gene_index ) {
				// add option
				obj.menu.d
				.append('div')
				.text('Gene : ' + gene.gene)
				.attr('class','sja_menuoption')
				.on('click',async ()=>{
					obj.menu.hide()

					obj.use_category_index = null
					obj.use_gene_index = i
					
					pcd_pipeline(obj)
				
				})
			}
		})
	}
}

function make_settings(obj){
	obj.settings.clear()
		.showunder( obj.settings_btn.node() )

	// Background Color change option
	const back_color_div = obj.settings.d.append('div')
	.style('display','block')
	.text('Background Color')
	.style('margin','5px')

	const black_div = back_color_div.append('div')
		.style('margin','5px')
		.style('display','block')

	const name = Math.random(),
		idblack = Math.random(),
		idwhite = Math.random()

	const inputblack = black_div.append('input')
		.attr('type','radio')
		.style('display','inline-block')
		.attr('name',name)
		.attr('id',idblack)
		.on('change', toggle_background )

	black_div.append('label')
		.style('display','inline-block')
		.style('font-size','.8em')
		.text('Black')
		.style('padding-left','10px')
		.attr('for',idblack)

	const white_div = back_color_div.append('div')
		.style('margin','5px')
		.style('display','block')

	const inputwhite = white_div.append('input')
		.attr('type','radio')
		.style('display','inline-block')
		.attr('name',name)
		.attr('id',idwhite)
		.on('change', toggle_background )

	white_div.append('label')
		.style('display','inline-block')
		.style('font-size','.8em')
		.text('White')
		.style('padding-left','10px')
		.attr('for',idwhite)

	if(obj.use_background_color == 0){
		inputwhite.property('checked',1)
	} else {
		inputblack.property('checked',1)
	}
	
	function toggle_background () {
		const isblack = inputblack.property('checked')
		const iswhite = inputwhite.property('checked')
		obj.scene.background = new THREE.Color( isblack ? 0x000000 : 0xffffff )
		obj.use_background_color = isblack ? 0 : 1
	}
	// point size change 
	const point_size_div = obj.settings.d.append('div')
		.style('display','block')
		.text('Point Size')
		.style('margin','20px 5px')

	const point_size_slider = point_size_div.append('input')
		.style('display','block')
		.style('padding','5px')
		.attr('type','range')
		.attr('min', 1)
		.attr('max', 50)
		.attr('value',obj.point_size? (obj.point_size*100) : obj.canvas_2d ? 30 : 5)
		.on('change', ()=>{
			obj.scene.children[1].material.size = (point_size_slider.node().value/100)
		})

	// zoom in / zoom out
	const zoom_div = obj.settings.d.append('div')
		.style('display','block')
		.text('Zoom In / Out')
		.style('margin','20px 5px')

	const cam_pos_z = obj.data_sphere_r * 3

	const zoom_slider = zoom_div.append('input')
		.style('display','block')
		.style('padding','5px')
		.attr('type','range')
		.attr('min', cam_pos_z/5)
		.attr('max', cam_pos_z*1.5)
		.attr('value',obj.camera.position.z)
		.style('direction','rtl')
		.on('change', ()=>{
			obj.camera.position.z = zoom_slider.node().value
		})
	
	// info for panning
	obj.settings.d.append('div')
		.style('margin','5px')
		.text('Panning')

	obj.settings.d.append('div')
		.style('font-size','.8em')
		.style('text-align','center')
		.style('margin-bottom','10px')
		.html('<p style="margin:3px;">Right mouse click </br>+ Mouse move</p>')

	// reset button
	obj.settings.d.append('div')
		.attr('class','sja_menuoption')
		.text('Reset view')
		.style('width','80px')
		.style('margin','auto')
		.style('margin-top','15px')
		.style('margin-bottom','15px')
		.on('click', ()=>{
			// reset background checkbox
			inputwhite.property('checked',1)
			obj.scene.background = new THREE.Color( obj.background_color ? obj.background_color : 0xffffff )

			// reset point size
			point_size_slider.node().value = obj.point_size? (obj.point_size*100) : obj.canvas_2d ? 30 : 5
			obj.scene.children[1].material.size = obj.point_size ? obj.point_size : obj.canvas_2d ? 0.3 : 0.05

			//reset zoom
			obj.camera.position.z = cam_pos_z
			zoom_slider.node().value = obj.camera.position.z

			//reset panning
			console.log(obj.controls)
			obj.controls.target.x = 0
			obj.controls.target.y = 0
			obj.controls.target.z = 0

		})
}

function heatmap_menu(obj){
	obj.menu.clear()
	obj.gene_expression.heatmap_genes = []
	obj.use_heatmap_category_index = null

	const heatmap_menu_div = obj.menu.d.append('div')
		.style('display', 'block')
		.style('padding','10px')

	const genes_div = heatmap_menu_div.append('div')
	.style('display', 'block')

	const gene_search_div = genes_div.append('div')
		.style('display', 'inline-block')
		.style('vertical-align','top')
		.style('padding','10px')

	gene_search_div.append('div')
		.style('display','block')
		.style('padding-bottom','5px')
		.text('Add Genes')

	gene_search_div.append('textarea')
		.attr('rows','4')
		.attr('cols','20')
		.attr('placeholder','Type gene names seperated by space')	

	// Show option for Boxplot for Gene Expression by catagories
	const catagory_div = heatmap_menu_div.append('div')
		
	catagory_div.append('div')
		.style('display','block')
		.style('padding-bottom','5px')
		.style('padding-left','10px')
		.text('Heatmap by')
		
	const cat_select = catagory_div.append('select')
	.style('display','block')
	.style('margin-left','10px')

	cat_select.append('option')
	.attr('value','none')
	.text('-- Select--')

	if( obj.cells.categories ) {
		obj.cells.categories.forEach( (category,i) => {
			cat_select.append('option')
			.attr('value',category.columnidx)
			.text(category.name)
		})
	}

	cat_select.on('change',()=>{
		obj.use_heatmap_category_index = parseInt(cat_select.node().value)
	})

	// button to generate heatmap
	heatmap_menu_div.append('button')
		.text('Heatmap')
		.style('display', 'block')
		.style('float','right')
		.style('margin','5px')
		.on('click', async ()=>{
			const input_genelist = gene_search_div.select('textarea').node().value
			const genelist = input_genelist.split(' ')
			for(const gene of genelist){
				const gmlst = await findgenemodel_bysymbol( obj.genome.name, gene )
				if( gmlst && gmlst[0] ) {
					const gm = gmlst[0]
					if(!obj.gene_expression.heatmap_genes) obj.gene_expression.heatmap_genes = []
					const geneidx = obj.gene_expression.heatmap_genes.findIndex( i=> i.gene == gene )
					if( geneidx == -1 ) {
						obj.gene_expression.heatmap_genes.push({
							gene: gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase(),
							chr: gm.chr,
							start: gm.start,
							stop: gm.stop
						})
					}
				}
			}
			const arg = {
				genome: obj.genome.name,
				getheatmap: {
					expfile: obj.gene_expression.file,
					gene_list : obj.gene_expression.heatmap_genes,
					cellfile: obj.cells.file,
					barcodecolumnidx: obj.cells.barcodecolumnidx,
					categorycolumnidx: parseInt(cat_select.node().value),
					delimiter: obj.cells.delimiter || '\t'
				}
			}
			client.dofetch( 'singlecell', arg )
			.then(data=>{
				if(data.error) throw data.error
				obj.menu.hide()
				make_heatmap(data, obj, cat_select.node().value)
			})
	})
}

function make_boxplot(data, obj, colidx){

	const gene = obj.gene_expression.genes[ obj.use_gene_index ]
	const pane = client.newpane({x:600, y:400})
	const cat = obj.cells.categories.find(x => x.columnidx == colidx)
	pane.header.text( 'Boxplot for ' + gene.gene + ' Expression by ' +  cat.name)
	const svg = pane.pane.append('svg')
		.style('margin','10px')

	let box_height = 50,
	box_width = 200,
	barspace = 2,
	axis_height = 30

	const label_width = get_max_labelwidth(data.boxplots, svg)
	
	const x_scale = scaleLinear()
		.range([0, box_width])
		.domain([data.minexpvalue, data.maxexpvalue])

	const y_scale = scaleLinear()
		.range([box_height, 0])
		.domain([0, 1])

	const svg_height = data.boxplots.length * (box_height + barspace) + axis_height
	const svg_width = box_width + label_width + 20

	svg.transition()
		.attr('width', svg_width)
		.attr('height', svg_height)
		

	if(data.boxplots){
		data.boxplots.forEach( (boxplot, i) => {

			const g = svg.append('g')
				.attr('transform','translate('+ label_width +',' + (i*(box_height + barspace) + axis_height) + ')')

			const xlabel = g.append('text')
				.text(boxplot.category + ' (' + boxplot.numberofcells + ')')
				.attr("transform", "translate(-4,"+ box_height/2 +")")
				.attr('text-anchor','end')
				.attr('font-size',15)
				.attr('font-family',client.font)
				.attr('dominant-baseline','central')

			if(boxplot.density){

				const density_max = Math.max(...boxplot.density)
				const line = d3.line()
					.x(function(d, j) { return x_scale(j*data.maxexpvalue/boxplot.density.length) }) // set the x values for the line generator
					.y(function(d) { return (y_scale(d / density_max)/2) }) // set the y values for the line generator 
					.curve(d3.curveMonotoneX) // apply smoothing to the line

				const area = d3.area()
					.x(function(d,j) { return x_scale(j*data.maxexpvalue/boxplot.density.length) })
					.y0(function(d) { 
						const temp =  y_scale(d / density_max)/2 
						return box_height - temp
					})
					.y1(function(d) { return (y_scale(d / density_max)/2) })
					.curve(d3.curveMonotoneX)

				g.append('path')
					.datum(boxplot.density)
					.attr('class', 'area')
					.attr('d', area)
					.style('fill','lightsteelblue')
					.style('stroke','black')
					.style('stroke-width',0.5)

				// g.append('path')
				// 	.datum(boxplot.density) // Binds data to the line 
				// 	.attr('class', 'line') // Assign a class for styling 
				// 	.attr('d', line) // Calls the line generator 
				// 	.style('fill','none')
				// 	.style('stroke','black')
				// 	.style('stroke-width',1)
			}

			// if(boxplot.w1){

				// g.append("line")
				// 	.attr("x1", y_scale(boxplot.w1))
				// 	.attr("y1", box_height/2)
				// 	.attr("x2", y_scale(boxplot.p25))
				// 	.attr("y2", box_height/2)
				// 	.attr("stroke-width", 2)
				// 	.attr("stroke", "black")

				// g.append("line")
				// 	.attr("x1", y_scale(boxplot.p75))
				// 	.attr("y1", box_height/2)
				// 	.attr("x2", y_scale(boxplot.w2))
				// 	.attr("y2", box_height/2)
				// 	.attr("stroke-width", 2)
				// 	.attr("stroke", "black")

				// clip_def.append("rect")
				// 	.attr('x', y_scale(boxplot.p25) + label_width)
				// 	.attr('y', (i*(box_height + barspace) + axis_height))
				// 	.attr('width', y_scale(boxplot.p75 - boxplot.p25))
				// 	.attr('height', box_height)

				// g.append("line")
				// 	.attr("x1", y_scale(boxplot.w1))
				// 	.attr("y1", 0)
				// 	.attr("x2", y_scale(boxplot.w1))
				// 	.attr("y2",box_height)
				// 	.attr("stroke-width", 2)
				// 	.attr("stroke", "black")

				// g.append("line")
				// 	.attr("x1", y_scale(boxplot.p50))
				// 	.attr("y1", 0)
				// 	.attr("x2", y_scale(boxplot.p50))
				// 	.attr("y2",box_height)
				// 	.attr("stroke-width", 2)
				// 	.attr("stroke", "white")

				// g.append("line")
				// 	.attr("x1", y_scale(boxplot.w2))
				// 	.attr("y1", 0)
				// 	.attr("x2", y_scale(boxplot.w2))
				// 	.attr("y2",box_height)
				// 	.attr("stroke-width", 2)
				// 	.attr("stroke", "black")
			// }

			// for(const outlier of boxplot.out){
			// 	clip_def.append("circle")
			// 		.attr('cx', y_scale(outlier.value)+ label_width)
			// 		.attr('cy', (i*(box_height + barspace) + axis_height + (box_height/2)))
			// 		.attr('r', 2)
			// 		.attr('fill','#901739')
			// }	
		})
		
		const legendAxis = axisTop()
			.scale(x_scale)
			.ticks(5)

		svg.append("g")
			.attr("class", "legend axis")
			.attr("transform", 'translate('+ label_width +','+ (axis_height -10) +')')
			.call(legendAxis)
	}

}

function make_heatmap(data, obj, colidx){
	
	const pane = client.newpane({x:600, y:400})
	const cat = obj.cells.categories.find(x => x.columnidx == colidx)
	pane.header.text( 'Heatmap for Gene Expression by ' +  cat.name)
	const svg = pane.pane.append('svg')
		.style('margin','10px')
	
	// labels of x and y axis
	let gene_list = []
	for(const gene of data.gene_heatmap) gene_list.push(gene.genename)

	//find max value for heatmap
	let means = []
	data.gene_heatmap.forEach( (gene, i) => {
		data.gene_heatmap[i].heatmap.forEach((category) =>{
			means.push(category.mean)
		})
	})
	const max_mean = Math.max(...means)

	let categories = []
	for(const category of data.gene_heatmap[0].heatmap) categories.push(category.category + ' (' + category.numberofcells+ ')')
	
	let box_height = 20,
	box_width = 80,
	barspace = 2, 
	gene_lable_height = 30,
	legend_width = 60

	const label_width = get_max_labelwidth(data.gene_heatmap[0].heatmap, svg)

	const svg_height = ((box_height + barspace) * categories.length) + gene_lable_height
	const svg_width = ((box_width + barspace) * gene_list.length) + label_width + legend_width + 20

	svg.transition()
		.attr('width', svg_width)
		.attr('height', svg_height)

	// Build X scales and axis:
	const x_scale = d3.scaleBand()
		.range([ 0, ((box_width+ barspace) * gene_list.length) ])
		.domain(gene_list)
		.padding(0.05)
	
	svg.append('g')
		.style('font-size', 15)
		.attr('transform', 'translate('+ label_width +',0)')
		.call(d3.axisBottom(x_scale).tickSize(0))
		.select(".domain").remove()

  	// Build Y scales and axis:
  	const y_scale = d3.scaleBand()
		.range([ ((box_height + barspace) * categories.length), 0 ])
		.domain(categories)
		.padding(0.05)

	svg.append("g")
		.style("font-size", 15)
		.attr('transform', 'translate('+ label_width + ',' + gene_lable_height +')')
		.call(d3.axisLeft(y_scale).tickSize(0))
		.select(".domain").remove()

	// Build color scale
	var myColor = d3.scaleSequential()
		.interpolator(d3.interpolatePlasma)
		.domain([0,max_mean])

	const div = pane.pane.append("div") 
		.style('position','absolute')  
		.attr("class", "tooltip")
		.style("background-color", "white")
		.style("border", "solid")
		.style("border-width", "2px")
		.style("border-radius", "5px")
		.style("padding", "5px")               
		.style("opacity", 0)

	data.gene_heatmap.forEach( (gene, i) => {

		data.gene_heatmap[i].heatmap.forEach((category, j) =>{

			const g = svg.append('g')
				.attr('transform','translate('+ label_width +',' + gene_lable_height + ')')
			
			g.append('rect')
				.attr("x", x_scale(gene.genename))
				.attr("y", y_scale(category.category + ' (' + category.numberofcells+ ')'))
				.attr("width", x_scale.bandwidth() )
				.attr("height", y_scale.bandwidth() )
				.style("fill", myColor(category.mean))
				.style("stroke-width", 4)
				.style("stroke", "none")
				.style("opacity", 0.8)
				//tooltip
				.on("mouseover", function(d) {   
	
					div.transition()        
						.duration(200)      
						.style("opacity", .9)

					div.html("Mean Expression: "+category.mean)  
						.style("left", (d3.mouse(this)[0]+70) + "px")
						.style("top", (d3.mouse(this)[1]+20) + "px")
					})                  
				.on("mouseout", function(d) {  

					div.transition()        
						.duration(500)      
						.style("opacity", 0)
				}) 

		})
	})
	const legend_data = myColor.ticks(10).reverse()
	legend_data.unshift(max_mean.toFixed(2))

	// Add a legend for the color values
	const legend = svg.selectAll('.legend')
		.data(legend_data)
   	.enter().append('g')
		.attr('class', 'legend')
		.attr('transform', function(d, i) { return 'translate(' + (svg_width - legend_width) + ',' + (30 + i * 20) + ')' })

	legend.append('rect')
		.attr('width', 20)
		.attr('height', 20)
		.style('fill', myColor)
		.style("opacity", 0.8)

	legend.append('text')
		.attr('x', 26)
		.attr('y', 10)
		.attr('dy', '.35em')
		.text(String)
		
}

function get_max_labelwidth ( items, svg ) {

	let textwidth = 0

	for(const i of items) {
		svg.append('text')
			.text( i.category+ ' (' + i.numberofcells + ')')
			.attr('font-family', client.font)
			.attr('font-size', 15)
			.each( function() {
				textwidth = Math.max( textwidth, this.getBBox().width )
			})
			.remove()
	}
	return (textwidth+4)
}

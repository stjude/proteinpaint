import * as client from './client'
import * as common from './common'
import {axisTop, axisRight, axisBottom} from 'd3-axis'
import {scaleLinear,scaleOrdinal,schemeCategory20} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import {gene_searchbox, findgenemodel_bysymbol} from './gene'






export async function init ( arg, holder ) {

	const obj = await load_json( arg )
	validate_obj( obj )

	obj.genome = arg.genome
	obj.holder = holder

	init_view( obj )
	init_controlpanel( obj )

	pcd_pipeline(obj)
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

	points.material.size = 0.05
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
		.on('click',()=> make_menu( obj ))
	
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

	// Background Color change option
	const back_color_div = obj.menu_output.append('div')
	.style('display','block')
	.text('Background Color')
	.style('margin-top','20px')

	const black_div = back_color_div.append('div')
		.style('margin','3px')
		.style('display','block')

	black_div.append('input')
		.attr('type','radio')
		.style('display','inline-block')
		.attr('checked','checked')
		.attr('name','color')
		.attr('value','black')
		.on('click',()=>{
			if(d3select('input[name="color"]:checked').node().value == 'black'){
				obj.scene.background = new THREE.Color( 0x000000 )
			}
		})

	black_div.append('label')
		.style('display','inline-block')
		.text('Black')
		.style('padding-left','10px')

	const white_div = back_color_div.append('div')
		.style('margin','3px')
		.style('display','block')

	white_div.append('input')
		.attr('type','radio')
		.style('display','inline-block')
		.attr('name','color')
		.attr('value','white')
		.on('click',()=>{
			if(d3select('input[name="color"]:checked').node().value == 'white'){
				obj.scene.background = new THREE.Color( 0xffffff )
			}
		})

	white_div.append('label')
		.style('display','inline-block')
		.text('White')
		.style('padding-left','10px')
}




async function menu_option_changed( obj ) {
/*
perform action depending on what type of option is chosen
*/

	const cat = obj.cells.categories[parseInt(obj.menu_button.node().value)]
	if (obj.cells.categories.includes(cat)){
		obj.use_category_index = parseInt(obj.menu_button.node().value)
	}

	const data = await load_cell_pcd(obj)
	render_cloud( obj, data.pcdfile )
	update_controlpanel( obj, data )

	animate()

	function animate() {
		requestAnimationFrame( animate )
		obj.controls.update()
		obj.renderer.render( obj.scene, obj.camera )
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

function make_boxplot(data, obj, colidx){

	const gene = obj.gene_expression.genes[ obj.use_gene_index ]
	const pane = client.newpane({x:600, y:400})
	const cat = obj.cells.categories.find(x => x.columnidx == colidx)
	pane.header.text( 'Boxplot for ' + gene.gene + ' Expression by ' +  cat.name)
	const svg = pane.pane.append('svg')
		.style('margin','10px')

	let box_height = 20,
	box_width = 200,
	barspace = 2,
	axis_height = 30

	const label_width = get_max_labelwidth(data.boxplots, svg)
	
	const y_scale = scaleLinear()
		.range([0, box_width])
		.domain([data.minexpvalue, data.maxexpvalue])

	const colorRange = [obj.gene_expression.color_max, obj.gene_expression.color_min]

	const colorScale = scaleLinear()
		.range(colorRange)
		.domain([data.minexpvalue, data.maxexpvalue])

	const defs = svg.append('defs')

	const linearGradient = defs.append("linearGradient")
		.attr("id", "linear-gradient" + colidx)
		// .attr('gradientTransform', 'rotate(90)')
		
	linearGradient.append("stop")
		.attr("offset", "0%")
		.attr("stop-color", colorScale(data.maxexpvalue))
		
	linearGradient.append("stop")
		.attr("offset", "100%")
		.attr("stop-color", colorScale(data.minexpvalue))

	const clip_def = defs
		.append('clipPath')
		.attr('id', 'clip-bar-rects'+ colidx)

	const svg_height = data.boxplots.length * (box_height + barspace) + axis_height
	const svg_width = box_width + label_width + 20

	svg.transition()
		.attr('width', svg_width)
		.attr('height', svg_height)

	const clipPath = svg.append('g')
		.attr('clip-path', 'url(#clip-bar-rects'+ colidx +')')

	clipPath
		.append('rect')
		.attr('x', label_width)
		.attr('y', axis_height)
		.attr('width', box_width)
		.attr('height', svg_height)
		.style('fill', 'url(#linear-gradient' + colidx + ')')


	if(data.boxplots){
		data.boxplots.forEach( (boxplot, i) => {

			const g = svg.append('g')
				.attr('transform','translate('+ label_width +',' + (i*(box_height + barspace) + axis_height) + ')')

			const xlabel = g.append('text')
				.text(boxplot.category + ' (' + boxplot.numberofcells + ')')
				.attr("transform", "translate(0,"+ box_height/2 +")")
				.attr('text-anchor','end')
				.attr('font-size',15)
				.attr('font-family',client.font)
				.attr('dominant-baseline','central')

			if(boxplot.w1){
				g.append("line")
					.attr("x1", y_scale(boxplot.w1))
					.attr("y1", box_height/2)
					.attr("x2", y_scale(boxplot.p25))
					.attr("y2", box_height/2)
					.attr("stroke-width", 2)
					.attr("stroke", "black")

				g.append("line")
					.attr("x1", y_scale(boxplot.p75))
					.attr("y1", box_height/2)
					.attr("x2", y_scale(boxplot.w2))
					.attr("y2", box_height/2)
					.attr("stroke-width", 2)
					.attr("stroke", "black")

				clip_def.append("rect")
					.attr('x', y_scale(boxplot.p25) + label_width)
					.attr('y', (i*(box_height + barspace) + axis_height))
					.attr('width', y_scale(boxplot.p75 - boxplot.p25))
					.attr('height', box_height)

				g.append("line")
					.attr("x1", y_scale(boxplot.w1))
					.attr("y1", 0)
					.attr("x2", y_scale(boxplot.w1))
					.attr("y2",box_height)
					.attr("stroke-width", 2)
					.attr("stroke", "black")

				g.append("line")
					.attr("x1", y_scale(boxplot.p50))
					.attr("y1", 0)
					.attr("x2", y_scale(boxplot.p50))
					.attr("y2",box_height)
					.attr("stroke-width", 2)
					.attr("stroke", "white")

				g.append("line")
					.attr("x1", y_scale(boxplot.w2))
					.attr("y1", 0)
					.attr("x2", y_scale(boxplot.w2))
					.attr("y2",box_height)
					.attr("stroke-width", 2)
					.attr("stroke", "black")
			}

			for(const outlier of boxplot.out){
				clip_def.append("circle")
					.attr('cx', y_scale(outlier.value)+ label_width)
					.attr('cy', (i*(box_height + barspace) + axis_height + (box_height/2)))
					.attr('r', 2)
					.attr('fill','#901739')
			}	
		})
		
		const legendAxis = axisTop()
			.scale(y_scale)
			.ticks(5)

		svg.append("g")
			.attr("class", "legend axis")
			.attr("transform", 'translate('+ label_width +','+ (axis_height -10) +')')
			.call(legendAxis)
	}

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
	return textwidth
}

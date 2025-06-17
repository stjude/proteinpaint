import * as client from './client'
import * as d3 from 'd3'
import { interpolatePlasma } from 'd3-scale-chromatic'
import { axisTop, axisBottom } from 'd3-axis'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { gene_searchbox, findgenemodel_bysymbol } from './gene'
import { legend_newrow } from './block.legend'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'
import * as THREE from 'three'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js'
import * as WEBGL from '../../server/public/static/js/WebGL.js'

/*
********************** EXPORTED
init()
********************** INTERNAL
sequence of calls by init()
	load_json()
	validate_obj()
	init_view() // init three.js scene, camera and renderer
		add_scriptTag() // add three.js scripts
	init_controlpanel()
	pcd_pipeline() // query data from csv file and create pcd file to be rendered
		load_cell_pcd() // query data for category with color as auto/custom or gene expression
		render_cloud() // remove old points and create point cloud using PCDLoader() 
		render_controlpanel() // render control panel for category or gene expression
	make_legend() // make legend if predefined in json file as image file

make_zoom_panel() // change camera.fov when zoom in / out 
make_menu() // menu when clicked on category or gene button at top of config
make_settings() //settings panel to change background, pointsize, reset, screenshot and zoom
heatmap_menu() // menu to enter multiple genes and select category
	make_heatmap() // make heatmap for multiple genes and category
make_plot() // for single gene
	make_violin_plot() // make violin plot for single gene expression vs category
	make_box_plot() // make box plot for single gene expression vs category
*/

export async function init(arg, holder) {
	try {
		const obj = await load_json(arg)
		validate_obj(obj)

		obj.genome = arg.genome
		obj.holder = holder.style('position', 'relative')
		await init_view(obj)
		init_controlpanel(obj)
		await pcd_pipeline(obj)
		make_legend(arg, obj)
	} catch (e) {
		client.sayerror(holder, e.message || e)
	}
}

async function load_json(arg) {
	if (!arg.jsonfile) throw '.jsonfile missing'
	const tmp = await client.dofetch('textfile', { file: arg.jsonfile })
	if (tmp.error) throw tmp.error
	return JSON.parse(tmp.text)
}

function validate_obj(obj) {
	if (!obj.cells) throw '.cells{} missing'
	if (!obj.cells.file) throw '.cells.file missing'
	if (!obj.cells.axis2columnidx) throw '.cells.axis2columnidx missing'
	if (obj.cells.categories) {
		if (!Array.isArray(obj.cells.categories)) throw '.cells.categories should be an array'
		if (obj.cells.categories.length == 0) throw '.cells.categories[] is empty array'
		for (const c of obj.cells.categories) {
			if (!Number.isInteger(c.columnidx)) throw 'columnidx missing from category ' + c
			if (c.autocolor) {
				c.autocolor = scaleOrdinal(schemeCategory20)
			}
		}
		if (!Number.isInteger(obj.use_category_index)) {
			obj.use_category_index = 0
		}
		if (!obj.cells.categories[obj.use_category_index]) throw 'use_category_index out of bound'
		if (!obj.cells.categories[obj.use_category_index].hidden_types)
			obj.cells.categories[obj.use_category_index].hidden_types = []
	}
	if (obj.gene_expression) {
		if (!obj.gene_expression.file) throw '.gene_expression.file missing'
		if (!Number.isInteger(obj.cells.barcodecolumnidx))
			throw '.gene_expression in use but .cells.barcodecolumnidx is missing'
	}
	if (!obj.width) obj.width = window.innerWidth * 0.9
	if (!obj.height) obj.height = window.innerHeight * 0.9
}

async function pcd_pipeline(obj) {
	if (Number.isInteger(obj.use_category_index)) {
		if (!obj.cells.categories[obj.use_category_index].hidden_types)
			obj.cells.categories[obj.use_category_index].hidden_types = []
	}
	const data = await load_cell_pcd(obj)

	// get sphere radius from max of x, y and z coordinates and assign it to camera and controls
	obj.data_sphere_r = data.data_sphere_r
	if (!obj.camera.position.z) {
		obj.camera.position.z = obj.data_sphere_r * 3
		obj.controls.maxDistance = obj.data_sphere_r * 4
		obj.controls.minDistance = obj.data_sphere_r / 10
	}
	const enc = new TextEncoder()
	const pcd_buffer = enc.encode(data.pcddata).buffer
	render_cloud(obj, pcd_buffer)
	render_controlpanel(obj, data)

	animate()

	function animate() {
		requestAnimationFrame(animate)
		obj.controls.update()
		obj.renderer.render(obj.scene, obj.camera)
	}
}

async function load_cell_pcd(obj) {
	/*
to load a new pcd file
call this when using a new category,
or selected a gene for overlaying
*/
	const wait = obj.holder
		.append('div')
		.style('position', 'absolute')
		.style('top', 0)
		.style('left', 0)
		.style('padding', '10px')
		.style('font-size', '1.5rem')
		.text('Loading data...')

	const arg = {
		genome: obj.genome.name,
		textfile: obj.cells.file,
		delimiter: obj.cells.delimiter || '\t',
		getpcd: {
			coord: obj.cells.axis2columnidx
		}
	}

	if (Number.isInteger(obj.use_category_index)) {
		/*
		this is the array index of obj.categories[]
		to use this category for coloring cells
		*/
		if (!obj.cells.categories) throw 'using category index but cells.categories[] missing'
		const cat = obj.cells.categories[obj.use_category_index]
		if (!cat) throw 'category array index out of bound'
		arg.getpcd.category_index = cat.columnidx

		if (cat.autocolor) {
			// if categories are autocolored and not defined in config
			arg.getpcd.category_autocolor = true
			if (cat.values_count) arg.getpcd.values_count = cat.values_count
		} else if (cat.values) {
			//if colors are defined in config
			arg.getpcd.category_customcolor = true
			arg.getpcd.cat_values = cat.values
		} else {
			if (!cat.autocolor && !cat.values) throw 'categories.values[] are not defined'
			throw 'unknow coloring scheme for category ' + cat.name
		}
		if (cat.hidden_types) {
			arg.hidden_types = cat.hidden_types
		}
		if (obj.background_color) {
			arg.background_color = obj.background_color
		}
		//set flags for ordering legend
		if (!cat.customorder) {
			// if categories are autoordered and not defined in config
			arg.getpcd.category_autoorder = true
		} else if (cat.customorder && cat.values) {
			//if order are defined in config
			arg.getpcd.category_customorder = true
			arg.getpcd.cat_values = cat.values
		} else {
			if (cat.customorder && !cat.values) throw 'categories.values[] are not defined'
			throw 'unknow ordering scheme for category ' + cat.name
		}
		// update menu_button here
		obj.menu_button.html(cat.name + '&nbsp;&nbsp;&#9660;')
	} else if (Number.isInteger(obj.use_gene_index)) {
		const gene = obj.gene_expression.genes[obj.use_gene_index]
		obj.menu_button.html('Gene : ' + gene.gene + '&nbsp;&nbsp;&#9660;')
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
		if (obj.gene_expression.color_no_exp) arg.getpcd.gene_expression.color_no_exp = obj.gene_expression.color_no_exp
	} else {
		throw 'unknown method to color the cells'
	}

	return client.dofetch('singlecell', arg).then(data => {
		if (data.error) throw data.error

		wait.remove()
		return data
	})
}

async function init_view(obj) {
	// TODO only load below if to do 3d
	if (WEBGL.isWebGLAvailable() === false) {
		obj.holder.node().appendChild(WEBGL.getWebGLErrorMessage())
		return
	}

	obj.scene = new THREE.Scene()
	if (obj.background_color) {
		obj.scene.background = new THREE.Color(obj.background_color)
	} else {
		obj.scene.background = new THREE.Color(0xffffff)
	}

	const default_zoom = obj.default_zoom ? 100 - obj.default_zoom : 45
	// camera parameters explaination: https://observablehq.com/@grantcuster/understanding-scale-and-the-three-js-perspective-camera
	obj.camera = new THREE.PerspectiveCamera(default_zoom, obj.width / obj.height, 0.1, 1000)

	obj.camera.position.x = obj.canvas_2d ? 0 : 20
	obj.camera.position.y = obj.canvas_2d ? 0 : -10

	if (obj.canvas_2d) {
		obj.camera.up.set(0, 1, 0)
	} else {
		obj.camera.up.set(0, 0, 1)
	}

	obj.controls = new TrackballControls(obj.camera, obj.holder.node())

	obj.controls.rotateSpeed = obj.canvas_2d ? 0 : 2.0
	obj.controls.zoomSpeed = obj.canvas_2d ? 3.0 : 0.7
	obj.controls.panSpeed = obj.canvas_2d ? 3.0 : 0.7

	obj.controls.noZoom = true
	obj.controls.noPan = false

	obj.controls.staticMoving = true
	obj.controls.dynamicDampingFactor = 0.3

	obj.scene.add(obj.camera)

	obj.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
	obj.renderer.setPixelRatio(window.devicePixelRatio)
	obj.renderer.setSize(obj.width, obj.height)
	obj.renderer.domElement.style.backgroundColor = '#ffffff'
	obj.renderer.domElement.style.border = 'solid #dddddd 2px'

	obj.holder.style('display', 'inline-block').style('position', 'relative').node().appendChild(obj.renderer.domElement)

	obj.renderer.render(obj.scene, obj.camera)
}

function render_cloud(obj, pcd_buffer) {
	// remove old points before adding new
	obj.scene.children.forEach(function (v, i) {
		if (v.material) {
			v.material.dispose()
			v.geometry.dispose()
			obj.scene.remove(v)
		}
	})

	// add new points using loader
	const loader = new PCDLoader()
	const points = loader.parse(pcd_buffer, '')

	if (obj.point_size) {
		points.material.size = obj.point_size
	} else {
		points.material.size = obj.canvas_2d ? 0.3 : 0.05
	}

	obj.scene.add(points)
	obj.center = points.geometry.boundingSphere.center
	obj.controls.target.set(obj.center.x, obj.center.y, obj.center.z)
	obj.controls.update()
}

function init_controlpanel(obj) {
	obj.menu = new client.Menu()
	obj.menu.d.style('padding', '3px')

	obj.settings = new client.Menu()
	obj.settings.d.style('padding', '3px')

	const panel = obj.holder
		.append('div')
		.style('padding', '10px')
		.style('position', 'absolute')
		.style('border-radius', '5px')
		.style('top', '20px')
		.style('right', '20px')
		.style('background-color', '#dddddd')

	obj.menu_button = panel
		.append('button')
		.style('display', 'inline-block')
		.style('padding', '4px')
		.on('click', () => make_menu(obj))

	const minimize_btn = (obj.minimize_btn = panel
		.append('div')
		.style('margin-left', '10px')
		.style('display', 'inline-block')
		.style('padding-left', '0px')
		.style('padding-right', '2px')
		.style('float', 'right')
		.style('font-size', '.6em')
		.classed('active', obj.menu_minimized ? true : false)
		.text(obj.menu_minimized ? ' SHOW' : ' HIDE')
		.on('click', () => {
			obj.minimize_btn.classed('active', obj.minimize_btn.classed('active') ? false : true)
			if (obj.minimize_btn.classed('active')) {
				obj.minimize_btn.text(' SHOW')
				obj.menu_output.style('display', 'none')
			} else {
				obj.minimize_btn.text(' HIDE')
				obj.menu_output.style('display', 'block')
			}
		})
		.on('mouseover', () => {
			minimize_btn.style('text-decoration', 'underline')
		})
		.on('mouseout', () => {
			minimize_btn.style('text-decoration', 'none')
		}))

	obj.use_background_color = 0

	const config_btn = (obj.settings_btn = panel
		.append('div')
		.style('margin-left', '10px')
		.style('display', 'inline-block')
		.style('padding-left', '3px')
		.style('padding-right', '3px')
		.style('float', 'right')
		.style('font-size', '.6em')
		.text('CONFIG')
		.on('click', () => make_settings(obj))
		.on('mouseover', () => {
			config_btn.style('text-decoration', 'underline')
		})
		.on('mouseout', () => {
			config_btn.style('text-decoration', 'none')
		}))

	obj.menu_output = panel
		.append('div')
		.style('margin-top', '10px')
		.style('display', obj.menu_minimized ? 'none' : 'block')

	obj.show_zoom = true //flag to show zoom div under legend div
}

function render_controlpanel(obj, data) {
	obj.menu_output.selectAll('*').remove()

	if (data.category2color) {
		/*
		showing the color legend for the current category
		TODO
			predefined colors
			at each type, show checkbox for filtering cells
		*/
		const top_row = obj.menu_output.append('div').style('margin', '2px')

		const select_all_checkbox = top_row
			.append('input')
			.attr('type', 'checkbox')
			.style('margin-right', '10px')
			.style('vertical-align', 'top')
			.style('display', 'inline-block')
			.on('change', () => {
				if (select_all_checkbox.node().checked) {
					obj.cells.categories[obj.use_category_index].hidden_types = []
					pcd_pipeline(obj)
				} else {
					for (const type in data.category2color) {
						obj.cells.categories[obj.use_category_index].hidden_types.push(type)
					}
					pcd_pipeline(obj)
				}
			})

		if (obj.cells.categories[obj.use_category_index].hidden_types.length == 0) {
			select_all_checkbox.property('checked', 1)
		}

		top_row.append('span').text('Select All').style('font-size', '.8em').attr('font-family', client.font)

		for (const type in data.category2color) {
			// div for each label
			const row = obj.menu_output.append('div').style('margin', '2px')

			const checkbox = row
				.append('input')
				.attr('type', 'checkbox')
				.property('checked', 1)
				.style('margin-right', '10px')
				.style('vertical-align', 'top')
				.style('display', 'inline-block')
				.on('change', () => {
					if (obj.cells.categories[obj.use_category_index].hidden_types.includes(type)) {
						const index = obj.cells.categories[obj.use_category_index].hidden_types.indexOf(type)
						if (index !== -1) obj.cells.categories[obj.use_category_index].hidden_types.splice(index, 1)
						checkbox.property('checked', 1)
					} else {
						obj.cells.categories[obj.use_category_index].hidden_types.push(type)
					}
					pcd_pipeline(obj)
				})

			if (obj.cells.categories[obj.use_category_index].hidden_types.includes(type)) {
				checkbox.property('checked', 0)
			}

			// square color for the label
			row
				.append('div')
				.style('display', 'inline-block')
				.style('height', '15px')
				.style('width', '15px')
				.style('background-color', data.category2color[type])
				.style('margin-right', '10px')

			//label text
			row.append('span').text(type).attr('font-family', client.font)

			row
				.append('span')
				.html('&nbsp;n=' + data.categorycount[type])
				.attr('font-family', client.font)
				.style('font-size', '.8em')
				.style('float', 'right')
				.style('color', '#777')
		}
	} else if (data.maxexpvalue) {
		// for gene expression data show gradient scale with unit

		const scale_height = 30
		const scale_width = 150

		const scale_div = obj.menu_output
			.append('div')
			.style('margin', '10px')
			.style('width', '120px')
			.style('height', '100px')

		scale_div
			.append('div')
			.text('Gene Expression ' + obj.gene_expression.datatype)
			.style('text-align', 'center')
			.style('width', '150px')
			.style('margin-bottom', '20px')

		const svg = scale_div.append('svg').append('g')

		const colorRange = [obj.gene_expression.color_max, obj.gene_expression.color_min]

		const colorScale = scaleLinear().range(colorRange).domain([data.minexpvalue, data.maxexpvalue])

		const defs = svg.append('defs')

		const linearGradient = defs.append('linearGradient').attr('id', 'linear-gradient')
		// .attr('gradientTransform', 'rotate(90)')

		linearGradient.append('stop').attr('offset', '0%').attr('stop-color', colorScale(data.maxexpvalue))

		linearGradient.append('stop').attr('offset', '100%').attr('stop-color', colorScale(data.minexpvalue))

		svg
			.append('rect')
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', scale_width)
			.attr('height', scale_height)
			.attr('transform', 'translate(12, 0)')
			.style('fill', 'url(#linear-gradient)')

		const y = scaleLinear().range([0, scale_width]).domain([data.minexpvalue, data.maxexpvalue])

		const legendAxis = axisBottom().scale(y).ticks(5)

		svg
			.append('g')
			.attr('class', 'legend axis')
			.attr('transform', 'translate(12,' + scale_height + ')')
			.call(legendAxis)

		const stats_div = obj.menu_output.append('div').style('padding-bottom', '20px').style('text-align', 'center')

		stats_div.append('p').style('font-size', '13px').style('margin', '2px 0').html('<b>Cells with Expression Data</b> ')

		stats_div
			.append('p')
			.style('font-size', '13px')
			.style('margin', '2px 0')
			.html(data.numbercellwithgeneexp + ' / ' + data.numbercelltotal)

		const no_exp_div = stats_div.append('div').style('display', 'block').style('margin-top', '10px')

		no_exp_div
			.append('div')
			.style('display', 'inline-block')
			.style('height', '15px')
			.style('width', '15px')
			.style('background-color', obj.gene_expression.color_no_exp ? obj.gene_expression.color_no_exp : '#2C2C2C')
			.style('margin-right', '10px')

		no_exp_div
			.append('div')
			.style('display', 'inline-block')
			.style('font-size', '13px')
			.html(' Cells without Expression')

		// Show option for Boxplot for Gene Expression by catagories
		const boxplot_div = obj.menu_output.append('div')

		boxplot_div
			.append('div')
			.style('display', 'block')
			.style('padding', '5px')
			.html('Violinplot / Boxplot of </br> Expression by')

		const boxplot_cat_select = boxplot_div.append('select').style('display', 'block')

		boxplot_cat_select.append('option').attr('value', 'none').text('-- Select--')

		if (obj.cells.categories) {
			obj.cells.categories.forEach((category, i) => {
				boxplot_cat_select.append('option').attr('value', category.columnidx).text(category.name)
			})
		}
		boxplot_cat_select.on('change', () => {
			const gene = obj.gene_expression.genes[obj.use_gene_index]
			const cat = obj.cells.categories[parseInt(boxplot_cat_select.node().selectedIndex) - 1]
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
					delimiter: obj.cells.delimiter || '\t',
					category_customorder: cat.customorder && cat.values ? true : false,
					category_autoorder: !cat.customorder ? true : false,
					cat_values: cat.values,
					values_count: cat.values_count
				}
			}
			client.dofetch('singlecell', arg).then(data => {
				if (data.error) throw data.error
				obj.box_plot = new client.Menu()
				make_plot(data, obj, boxplot_cat_select.node().value)
			})
		})
	}

	make_zoom_panel(obj)
}

function make_zoom_panel(obj) {
	if (obj.show_zoom) {
		// zoom in / zoom out
		const zoom_div = obj.menu_output
			.append('div')
			.style('display', 'block')
			.text('Zoom')
			.style('margin', '10px 5px 5px 5px')
			.style('padding-top', '10px')
			.style('border-top', '1px solid #929292')

		const zoom_hide_btn = zoom_div
			.append('div')
			.style('margin-left', '10px')
			.style('display', 'inline-block')
			.style('padding-left', '0px')
			.style('padding-right', '2px')
			.style('float', 'right')
			.style('font-size', '.6em')
			.text('MOVE TO CONFIG')
			.on('click', () => {
				zoom_div.node().remove()
				obj.show_zoom = false
			})
			.on('mouseover', () => {
				zoom_hide_btn.style('text-decoration', 'underline')
			})
			.on('mouseout', () => {
				zoom_hide_btn.style('text-decoration', 'none')
			})

		obj.zoom_slider = zoom_div
			.append('input')
			.style('display', 'block')
			.style('padding', '5px')
			.attr('type', 'range')
			.attr('min', 1)
			.attr('max', 100)
			.attr('value', obj.camera.fov)
			.style('direction', 'rtl')
			.on('change', () => {
				obj.camera.fov = parseInt(obj.zoom_slider.node().value)
				obj.camera.updateProjectionMatrix()
			})
			.on('mousedown', event => {
				event.stopPropagation()
			})
	}
}

function make_menu(obj) {
	obj.menu.clear().showunder(obj.menu_button.node())

	if (obj.cells.categories) {
		obj.cells.categories.forEach((category, i) => {
			if (i != obj.use_category_index) {
				// add option
				obj.menu.d
					.append('div')
					.text(category.name)
					.attr('class', 'sja_menuoption')
					.on('click', async () => {
						obj.menu.hide()

						obj.use_category_index = i
						pcd_pipeline(obj)
					})
					.append('span')
					.attr('font-family', client.font)
					.style('display', category.values_count ? 'inline-block' : 'none')
					.style('font-size', '.8em')
					.style('float', 'right')
					.style('color', '#777')
					.style('padding', '3px 5px')
					.html(category.values_count ? '&nbsp;n=' + category.values_count : '')
			}
		})
	}

	if (obj.gene_expression) {
		// add option
		obj.menu.d
			.append('div')
			.text('Gene expression')
			.attr('class', 'sja_menuoption')
			.on('click', () => {
				obj.menu.clear()

				const gene_search_div = obj.menu.d.append('div').style('padding', '10px')

				gene_searchbox({
					div: gene_search_div.append('div'),
					resultdiv: gene_search_div.append('div'),
					genome: obj.genome.name,
					callback: async genename => {
						const gmlst = await findgenemodel_bysymbol(obj.genome.name, genename)
						if (gmlst && gmlst[0]) {
							const gm = gmlst[0]
							if (!obj.gene_expression.genes) obj.gene_expression.genes = []
							const geneidx = obj.gene_expression.genes.findIndex(i => i.gene == genename)
							if (geneidx == -1) {
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

		// menu option for multi-gene heatmap
		obj.menu.d
			.append('div')
			.text('Multi-Gene Heatmap')
			.attr('class', 'sja_menuoption')
			.on('click', () => {
				heatmap_menu(obj)
			})

		if (obj.gene_expression.genes) {
			if (obj.gene_expression.genes.length > 1) {
				obj.menu.d.append('div').style('padding', '5px 10px').text('Previously Selected')
			}

			obj.gene_expression.genes.forEach((gene, i) => {
				if (i != obj.use_gene_index) {
					// add option
					obj.menu.d
						.append('div')
						.text('Gene : ' + gene.gene)
						.attr('class', 'sja_menuoption')
						.on('click', async () => {
							obj.menu.hide()

							obj.use_category_index = null
							obj.use_gene_index = i

							pcd_pipeline(obj)
						})
				}
			})
		}
	}
}

function make_settings(obj) {
	obj.settings.clear().showunder(obj.settings_btn.node())

	// Background Color change option
	const back_color_div = obj.settings.d
		.append('div')
		.style('display', 'block')
		.text('Background Color')
		.style('margin', '5px')

	const black_div = back_color_div.append('div').style('margin', '5px').style('display', 'block')

	const name = Math.random(),
		idblack = Math.random(),
		idwhite = Math.random()

	const inputblack = black_div
		.append('input')
		.attr('type', 'radio')
		.style('display', 'inline-block')
		.attr('name', name)
		.attr('id', idblack)
		.on('change', toggle_background)

	black_div
		.append('label')
		.style('display', 'inline-block')
		.style('font-size', '.8em')
		.text('Black')
		.style('padding-left', '10px')
		.attr('for', idblack)

	const white_div = back_color_div.append('div').style('margin', '5px').style('display', 'block')

	const inputwhite = white_div
		.append('input')
		.attr('type', 'radio')
		.style('display', 'inline-block')
		.attr('name', name)
		.attr('id', idwhite)
		.on('change', toggle_background)

	white_div
		.append('label')
		.style('display', 'inline-block')
		.style('font-size', '.8em')
		.text('White')
		.style('padding-left', '10px')
		.attr('for', idwhite)

	if (obj.use_background_color == 0) {
		inputwhite.property('checked', 1)
	} else {
		inputblack.property('checked', 1)
	}

	function toggle_background() {
		const isblack = obj.background_color == 'black'
		obj.scene.background = new THREE.Color(isblack ? 0xffffff : 0x000000)
		obj.use_background_color = isblack ? 0 : 1
		obj.background_color = isblack ? 'white' : 'black'
	}
	// point size change
	const point_size_div = obj.settings.d
		.append('div')
		.style('display', 'block')
		.text('Point Size')
		.style('margin', '20px 5px')

	const point_size_slider = point_size_div
		.append('input')
		.style('display', 'block')
		.style('padding', '5px')
		.attr('type', 'range')
		.attr('min', 1)
		.attr('max', 70)
		.attr('value', obj.scene.children[1].material.size * 100)
		.on('change', () => {
			obj.scene.children[1].material.size = point_size_slider.node().value / 100
		})

	if (obj.show_zoom == false) {
		// zoom in / zoom out
		const zoom_div = obj.settings.d.append('div').style('display', 'block').text('Zoom').style('margin', '20px 5px')

		const zoom_hide_btn = zoom_div
			.append('div')
			.style('margin-left', '10px')
			.style('display', 'inline-block')
			.style('padding-left', '0px')
			.style('padding-right', '2px')
			.style('float', 'right')
			.style('font-size', '.6em')
			.html('MOVE TO </br>LEGEND PANEL')
			.on('click', () => {
				zoom_div.node().remove()
				obj.show_zoom = true
				make_zoom_panel(obj)
			})
			.on('mouseover', () => {
				zoom_hide_btn.style('text-decoration', 'underline')
			})
			.on('mouseout', () => {
				zoom_hide_btn.style('text-decoration', 'none')
			})

		obj.zoom_slider = zoom_div
			.append('input')
			.style('display', 'block')
			.style('padding', '5px')
			.attr('type', 'range')
			.attr('min', 5)
			.attr('max', 70)
			.attr('value', obj.camera.fov)
			.style('direction', 'rtl')
			.on('change', () => {
				obj.camera.fov = parseInt(obj.zoom_slider.node().value)
				obj.camera.updateProjectionMatrix()
			})
	}

	// info for panning
	obj.settings.d.append('div').style('margin', '5px').text('Panning')

	obj.settings.d
		.append('div')
		.style('font-size', '.8em')
		.style('text-align', 'center')
		.style('margin-bottom', '10px')
		.html('<p style="margin:3px;">Right mouse click </br>+ Mouse move</p>')

	if (!obj.canvas_2d) {
		// info for roatation
		obj.settings.d.append('div').style('margin', '5px').text('Rotate')

		obj.settings.d
			.append('div')
			.style('font-size', '.8em')
			.style('text-align', 'center')
			.style('margin-bottom', '10px')
			.html('<p style="margin:3px;">Left mouse click </br>+ Mouse move</p>')
	}

	// reset button
	obj.settings.d
		.append('div')
		.attr('class', 'sja_menuoption')
		.text('Reset view')
		.style('width', '80px')
		.style('margin', 'auto')
		.style('margin-top', '15px')
		.style('margin-bottom', '15px')
		.on('click', () => {
			// reset background checkbox
			inputwhite.property('checked', 1)
			obj.scene.background = new THREE.Color(obj.background_color ? obj.background_color : 0xffffff)

			// reset point size
			point_size_slider.node().value = obj.point_size ? obj.point_size * 100 : obj.canvas_2d ? 30 : 5
			obj.scene.children[1].material.size = obj.point_size ? obj.point_size : obj.canvas_2d ? 0.3 : 0.05

			//reset zoom and camera
			obj.camera.position.z = obj.data_sphere_r * 3
			obj.camera.position.x = obj.canvas_2d ? 0 : 20
			obj.camera.position.y = obj.canvas_2d ? 0 : -10

			const cam_fov_default = 45
			obj.camera.fov = parseInt(cam_fov_default)
			obj.camera.updateProjectionMatrix()
			obj.zoom_slider.node().value = cam_fov_default

			if (obj.canvas_2d) {
				obj.camera.up.set(0, 1, 0)
			} else {
				obj.camera.up.set(0, 0, 1)
			}

			//reset panning
			obj.controls.target.set(obj.center.x, obj.center.y, obj.center.z)
		})

	// screenshot button
	const screenshot_btn = obj.settings.d
		.append('div')
		.attr('class', 'sja_menuoption')
		.style('padding', '5px')
		.style('width', '80px')
		.style('margin', 'auto')
		.style('margin-top', '15px')
		.style('margin-bottom', '15px')
		.html('<b>&#10697;</b> Capture')
		.on('mousedown', () => {
			const imgData = obj.renderer.domElement.toDataURL()

			let imgNode = document.createElement('img')
			imgNode.src = imgData
			// document.body.appendChild(imgNode)
			screenshot_btn
				.append('span')
				.style('display', 'none')
				.html(
					'<a download="scRNA_' +
						new Date().toLocaleString() +
						'.png" href="' +
						imgNode.src +
						'" title="ImageName">Camera</a>'
				)
			// download_btn.node().click()
		})
		.on('mouseup', () => {
			screenshot_btn.select('a').node().click()
			screenshot_btn.selectAll('span').remove()
		})
}

function heatmap_menu(obj) {
	obj.menu.clear()
	obj.gene_expression.heatmap_genes = []
	obj.use_heatmap_category_index = null

	const heatmap_menu_div = obj.menu.d.append('div').style('display', 'block').style('padding', '10px')

	const genes_div = heatmap_menu_div.append('div').style('display', 'block')

	const gene_search_div = genes_div
		.append('div')
		.style('display', 'inline-block')
		.style('vertical-align', 'top')
		.style('padding', '10px')

	gene_search_div.append('div').style('display', 'block').style('padding-bottom', '5px').text('Add Genes')

	gene_search_div
		.append('textarea')
		.attr('rows', '4')
		.attr('cols', '20')
		.attr('placeholder', 'Type gene names seperated by space')

	// Show option for Boxplot for Gene Expression by catagories
	const catagory_div = heatmap_menu_div.append('div')

	catagory_div
		.append('div')
		.style('display', 'block')
		.style('padding-bottom', '5px')
		.style('padding-left', '10px')
		.text('Heatmap by')

	const cat_select = catagory_div.append('select').style('display', 'block').style('margin-left', '10px')

	cat_select.append('option').attr('value', 'none').text('-- Select--')

	if (obj.cells.categories) {
		obj.cells.categories.forEach((category, i) => {
			cat_select.append('option').attr('value', category.columnidx).text(category.name)
		})
	}

	cat_select.on('change', () => {
		obj.use_heatmap_category_index = parseInt(cat_select.node().value)
	})

	// button to generate heatmap
	heatmap_menu_div
		.append('button')
		.text('Heatmap')
		.style('display', 'block')
		.style('float', 'right')
		.style('margin', '5px')
		.on('click', async () => {
			const input_genelist = gene_search_div.select('textarea').node().value
			const genelist = input_genelist.split(' ')
			for (const gene of genelist) {
				const gmlst = await findgenemodel_bysymbol(obj.genome.name, gene)
				if (gmlst && gmlst[0]) {
					const gm = gmlst[0]
					if (!obj.gene_expression.heatmap_genes) obj.gene_expression.heatmap_genes = []
					const geneidx = obj.gene_expression.heatmap_genes.findIndex(i => i.gene == gene)
					if (geneidx == -1) {
						obj.gene_expression.heatmap_genes.push({
							gene: gene,
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
					gene_list: obj.gene_expression.heatmap_genes,
					cellfile: obj.cells.file,
					barcodecolumnidx: obj.cells.barcodecolumnidx,
					categorycolumnidx: parseInt(cat_select.node().value),
					delimiter: obj.cells.delimiter || '\t'
				}
			}
			client.dofetch('singlecell', arg).then(data => {
				if (data.error) throw data.error
				obj.menu.hide()
				make_heatmap(data, obj, cat_select.node().value)
			})
		})
}

function make_plot(data, obj, colidx) {
	const gene = obj.gene_expression.genes[obj.use_gene_index]
	const pane = client.newpane({ x: 600, y: 400 })
	const cat = obj.cells.categories.find(x => x.columnidx == colidx)
	pane.header.text('Violinplot/Boxplot for ' + gene.gene + ' Expression by ' + cat.name)

	const control_panel = pane.pane.append('div').style('margin', '10px 10px 10px 15px')

	const svg = pane.pane.append('svg').style('margin', '10px')

	//toggle between violin and Boxplot
	const plot_select = control_panel.append('select').style('display', 'inline-block')

	plot_select.append('option').attr('value', 'violin').text('Violin Plot')

	plot_select.append('option').attr('value', 'box').text('Box Plot')

	plot_select.on('change', () => {
		apply()
	})

	//toggle between cells with/without expression to be included in plot
	const cell_select_div = control_panel
		.append('div')
		.style('display', 'inline-block')
		.style('padding-left', '15px')
		.text('Cells without expression')

	const cell_select = cell_select_div.append('select').style('display', 'inline-block').style('margin-left', '5px')

	cell_select.append('option').attr('value', 'include').text('Include')

	cell_select.append('option').attr('value', 'exclude').text('Exclude')

	cell_select.on('change', () => {
		apply()
	})

	make_violin_plot(data, svg)

	function apply() {
		const gene = obj.gene_expression.genes[obj.use_gene_index]
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
				categorycolumnidx: parseInt(colidx),
				delimiter: obj.cells.delimiter || '\t',
				category_customorder: cat.customorder && cat.values ? true : false,
				category_autoorder: !cat.customorder ? true : false,
				cat_values: cat.values,
				values_count: cat.values_count
			}
		}

		if (cell_select.node().value == 'exclude') {
			arg.getgeneboxplot.exclude_cells = true
		}
		client.dofetch('singlecell', arg).then(data => {
			if (data.error) throw data.error
			if (plot_select.node().value == 'box') make_box_plot(data, svg)
			else if (plot_select.node().value == 'violin') make_violin_plot(data, svg)
		})
	}
}

function make_violin_plot(data, svg) {
	svg.selectAll('*').remove()

	let box_height = 50,
		box_width = 200,
		barspace = 2,
		axis_height = 30

	const label_width = get_max_labelwidth(data.boxplots, svg)

	const x_scale = scaleLinear().range([0, box_width]).domain([data.minexpvalue, data.maxexpvalue])

	const y_scale = scaleLinear().range([box_height, 0]).domain([0, 1])

	const svg_height = data.boxplots.length * (box_height + barspace) + axis_height
	const svg_width = box_width + label_width + 20

	svg.transition().attr('width', svg_width).attr('height', svg_height)

	if (data.boxplots) {
		data.boxplots.forEach((boxplot, i) => {
			const g = svg
				.append('g')
				.attr('transform', 'translate(' + label_width + ',' + (i * (box_height + barspace) + axis_height) + ')')

			const xlabel = g
				.append('text')
				.text(boxplot.category + ' (' + boxplot.numberofcells + ')')
				.attr('transform', 'translate(-4,' + box_height / 2 + ')')
				.attr('text-anchor', 'end')
				.attr('font-size', 15)
				.attr('font-family', client.font)
				.attr('dominant-baseline', 'central')

			if (boxplot.density) {
				const density_max = Math.max(...boxplot.density)

				const line = d3
					.line()
					.x(function (d, j) {
						return x_scale((j * data.maxexpvalue) / boxplot.density.length)
					}) // set the x values for the line generator
					.y(function (d) {
						return y_scale(d / density_max) / 2
					}) // set the y values for the line generator
					.curve(d3.curveMonotoneX) // apply smoothing to the line

				const area = d3
					.area()
					.x(function (d, j) {
						return x_scale((j * data.maxexpvalue) / boxplot.density.length)
					})
					.y0(function (d) {
						const temp = y_scale(d / density_max) / 2
						return box_height - temp
					})
					.y1(function (d) {
						return y_scale(d / density_max) / 2
					})
					.curve(d3.curveMonotoneX)

				g.append('path')
					.datum(boxplot.density)
					.attr('class', 'area')
					.attr('d', area)
					// .style('fill','lightsteelblue')
					.style('fill', boxplot.color)
					.style('stroke', 'black')
					.style('stroke-width', 0.5)
			}
		})

		const legendAxis = axisTop().scale(x_scale).ticks(5)

		svg
			.append('g')
			.attr('class', 'legend axis')
			.attr('transform', 'translate(' + label_width + ',' + (axis_height - 10) + ')')
			.call(legendAxis)
	}
}

function make_box_plot(data, svg) {
	svg.selectAll('*').remove()

	let box_height = 36,
		box_width = 200,
		barspace = 16,
		axis_height = 30

	const label_width = get_max_labelwidth(data.boxplots, svg)

	const x_scale = scaleLinear().range([0, box_width]).domain([data.minexpvalue, data.maxexpvalue])

	const y_scale = scaleLinear().range([box_height, 0]).domain([0, 1])

	const svg_height = data.boxplots.length * (box_height + barspace) + axis_height
	const svg_width = box_width + label_width + 20

	svg.transition().attr('width', svg_width).attr('height', svg_height)

	if (data.boxplots) {
		data.boxplots.forEach((boxplot, i) => {
			const g = svg
				.append('g')
				.attr('transform', 'translate(' + label_width + ',' + (i * (box_height + barspace) + axis_height) + ')')

			const xlabel = g
				.append('text')
				.text(boxplot.category + ' (' + boxplot.numberofcells + ')')
				.attr('transform', 'translate(-4,' + box_height / 2 + ')')
				.attr('text-anchor', 'end')
				.attr('font-size', 15)
				.attr('font-family', client.font)
				.attr('dominant-baseline', 'central')

			if (boxplot.p75) {
				g.append('line')
					.attr('x1', x_scale(boxplot.w1))
					.attr('y1', box_height / 2)
					.attr('x2', x_scale(boxplot.w2))
					.attr('y2', box_height / 2)
					.attr('stroke-width', 2)
					.attr('stroke', 'black')

				g.append('rect')
					.attr('x', x_scale(boxplot.p25))
					.attr('y', 0)
					.attr('width', x_scale(boxplot.p75 - boxplot.p25))
					.attr('height', box_height)
					// .attr('fill','#901739')
					.attr('fill', boxplot.color)

				g.append('line')
					.attr('x1', x_scale(boxplot.w1))
					.attr('y1', 0)
					.attr('x2', x_scale(boxplot.w1))
					.attr('y2', box_height)
					.attr('stroke-width', 2)
					.attr('stroke', 'black')

				g.append('line')
					.attr('x1', x_scale(boxplot.p50))
					.attr('y1', 0)
					.attr('x2', x_scale(boxplot.p50))
					.attr('y2', box_height)
					.attr('stroke-width', 2)
					.attr('stroke', 'white')

				g.append('line')
					.attr('x1', x_scale(boxplot.w2))
					.attr('y1', 0)
					.attr('x2', x_scale(boxplot.w2))
					.attr('y2', box_height)
					.attr('stroke-width', 2)
					.attr('stroke', 'black')

				if (boxplot.out) {
					for (const outlier of boxplot.out) {
						g.append('circle')
							.attr('cx', x_scale(outlier.value))
							.attr('cy', box_height / 2)
							.attr('r', 2)
							.attr('fill', '#901739')
					}
				}
			}
		})

		const legendAxis = axisTop().scale(x_scale).ticks(5)

		svg
			.append('g')
			.attr('class', 'legend axis')
			.attr('transform', 'translate(' + label_width + ',' + (axis_height - 10) + ')')
			.call(legendAxis)
	}
}

function make_heatmap(data, obj, colidx) {
	const pane = client.newpane({ x: 600, y: 400 })
	const cat = obj.cells.categories.find(x => x.columnidx == colidx)
	pane.header.text('Heatmap for Gene Expression by ' + cat.name)
	const svg = pane.pane.append('svg').style('margin', '10px')

	// labels of x and y axis
	let gene_list = []
	for (const gene of data.gene_heatmap) gene_list.push(gene.genename)

	//find max value for heatmap
	let means = []
	data.gene_heatmap.forEach((gene, i) => {
		data.gene_heatmap[i].heatmap.forEach(category => {
			means.push(category.mean)
		})
	})
	const max_mean = Math.max(...means)

	let categories = []
	for (const category of data.gene_heatmap[0].heatmap)
		categories.push(category.category + ' (' + category.numberofcells + ')')

	let box_height = 20,
		box_width = 80,
		barspace = 2,
		gene_lable_height = 30,
		legend_width = 60

	const label_width = get_max_labelwidth(data.gene_heatmap[0].heatmap, svg)

	const svg_height = (box_height + barspace) * categories.length + gene_lable_height
	const svg_width = (box_width + barspace) * gene_list.length + label_width + legend_width + 20

	svg.transition().attr('width', svg_width).attr('height', svg_height)

	// Build X scales and axis:
	const x_scale = d3
		.scaleBand()
		.range([0, (box_width + barspace) * gene_list.length])
		.domain(gene_list)
		.padding(0.05)

	svg
		.append('g')
		.style('font-size', 15)
		.attr('transform', 'translate(' + label_width + ',0)')
		.call(d3.axisBottom(x_scale).tickSize(0))
		.select('.domain')
		.remove()

	// Build Y scales and axis:
	const y_scale = d3
		.scaleBand()
		.range([(box_height + barspace) * categories.length, 0])
		.domain(categories)
		.padding(0.05)

	svg
		.append('g')
		.style('font-size', 15)
		.attr('transform', 'translate(' + label_width + ',' + gene_lable_height + ')')
		.call(d3.axisLeft(y_scale).tickSize(0))
		.select('.domain')
		.remove()

	// Build color scale
	var myColor = d3.scaleSequential().interpolator(interpolatePlasma).domain([0, max_mean])

	const div = pane.pane
		.append('div')
		.style('position', 'absolute')
		.attr('class', 'tooltip')
		.style('background-color', 'white')
		.style('border', 'solid')
		.style('border-width', '2px')
		.style('border-radius', '5px')
		.style('padding', '5px')
		.style('opacity', 0)

	data.gene_heatmap.forEach((gene, i) => {
		data.gene_heatmap[i].heatmap.forEach((category, j) => {
			const g = svg.append('g').attr('transform', 'translate(' + label_width + ',' + gene_lable_height + ')')

			g.append('rect')
				.attr('x', x_scale(gene.genename))
				.attr('y', y_scale(category.category + ' (' + category.numberofcells + ')'))
				.attr('width', x_scale.bandwidth())
				.attr('height', y_scale.bandwidth())
				.style('fill', myColor(category.mean))
				.style('stroke-width', 4)
				.style('stroke', 'none')
				.style('opacity', 0.8)
				//tooltip
				.on('mouseover', function (event) {
					div.transition().duration(200).style('opacity', 0.9)

					div
						.html('Mean Expression: ' + category.mean)
						.style('left', d3.pointer(event, this)[0] + 70 + 'px')
						.style('top', d3.pointer(event, this)[1] + 20 + 'px')
				})
				.on('mouseout', function () {
					div.transition().duration(500).style('opacity', 0)
				})
		})
	})
	const legend_data = myColor.ticks(10).reverse()
	legend_data.unshift(max_mean.toFixed(2))

	// Add a legend for the color values
	const legend = svg
		.selectAll('.legend')
		.data(legend_data)
		.enter()
		.append('g')
		.attr('class', 'legend')
		.attr('transform', function (d, i) {
			return 'translate(' + (svg_width - legend_width) + ',' + (30 + i * 20) + ')'
		})

	legend.append('rect').attr('width', 20).attr('height', 20).style('fill', myColor).style('opacity', 0.8)

	legend.append('text').attr('x', 26).attr('y', 10).attr('dy', '.35em').text(String)
}

function get_max_labelwidth(items, svg) {
	let textwidth = 0

	for (const i of items) {
		svg
			.append('text')
			.text(i.category + ' (' + i.numberofcells + ')')
			.attr('font-family', client.font)
			.attr('font-size', 15)
			.each(function () {
				textwidth = Math.max(textwidth, this.getBBox().width)
			})
			.remove()
	}
	return textwidth + 4
}

function add_scriptTag(path) {
	// path like /static/js/three.js, must begin with /
	return new Promise((resolve, reject) => {
		const script = document.createElement('script')
		script.setAttribute('src', sessionStorage.getItem('hostURL') + path)
		document.head.appendChild(script)
		script.onload = resolve
	})
}

async function make_legend(arg, obj) {
	if (!arg.legendimg) return

	const img_div = obj.holder.append('div').style('margin-top', '5px')
	obj.legendimg = arg.legendimg
	obj.legend = {
		holder: img_div,
		legendcolor: '#7D6836'
	}
	let shown = !arg.foldlegend

	img_div
		.append('div')
		.text('LEGEND')
		.attr('class', 'sja_clb')
		.style('display', 'inline-block')
		.style('font-size', '.7em')
		.style('color', obj.legend.legendcolor)
		.style('font-family', client.font)
		.on('click', () => {
			if (shown) {
				shown = false
				client.disappear(div2)
			} else {
				shown = true
				client.appear(div2)
			}
		})

	const div2 = obj.holder
		.append('div')
		.style('border-top', 'solid 1px ' + obj.legend.legendcolor)
		.style('background-color', '#FCFBF7')

	obj.legend.holder = div2.append('table').style('border-spacing', '15px').style('border-collapse', 'separate')

	const [tr, td] = legend_newrow(obj, obj.legendimg.name || '')
	const data = await client.dofetch2('img?file=' + obj.legendimg.file)
	if (data.error) {
		td.text(data.error)
		return
	}
	let fold = true
	const img = td.append('img').attr('class', 'sja_clbb').attr('src', data.src).style('height', '80px')
	img.on('click', () => {
		if (fold) {
			fold = false
			img.transition().style('height', obj.legendimg.height ? obj.legendimg.height + 'px' : 'auto')
		} else {
			fold = true
			img.transition().style('height', '80px')
		}
	})
}

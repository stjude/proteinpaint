import * as client from './client'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'
import { select as d3select } from 'd3-selection'
import blocklazyload from './block.lazyload'
import { d3lasso } from '../common/lasso'
import { zoom as d3zoom, zoomIdentity } from 'd3'
import { filterInit } from '#filter'
import { getFilteredSamples } from '#shared/filter.js'
import { getVocabFromSamplesArray } from '../termdb/vocabulary'
import { getsjcharts } from './getsjcharts'
import { uncollide } from '../common/uncollide'

/*
obj:
.holder
.legendtable

.analysisdata{}
	// full custom data
	.level1/2/3
	.samples[]
		.x/y/sample_name
	.colorby
	.key2color{}
	.tabular_data

// available for official datasets
.mds{}

.genome {}
.dslabel
.dots [ {} ]
	.x
	.y
	.sample // hardcoded!!
	.s {}

.dots_user[]
	x/y/sample

.dotselection
.sample2dot MAP

.sample_attributes{}

.attr_levels[]

.scattersvg SVG
.colorbyattributes [ {} ]
	.key
	.label
	.__inuse
	.labelhandle
	.colorfunc()
	.values MAP
		k: value name
		v: {}
			.color
			.name
			.count INT
			.cell <div>
.colorbygeneexpression{}
	.querykey
	.labelhandle
	.__inuse
.tracks[]
	tracks to be shown in single sample by clicking dots


********************** EXPORTED
init()
********************** INTERNAL
get_data() // get data from server side official dataset or client side JSON or tabular file
	update_dotcolor_legend() // update legend table by filter
finish_setup() // setup for colorbyattributes and attr_levels
init_dotcolor_legend() // create legend as flat list of colorbyattributes or by attr_levels (gene expression, todo) 
	legend_attr_levels() // hardcoded 2 levels, level 1 not colored, level 2 colored
	legend_flatlist() // flat legend by colorbyattributes
init_plot() // create dot plot for samples
	assign_color4dots()
	click_dot() //clicking dot will launch browser view or disco plot
		click_dot_disco()
		click_dot_mdsview()
	resize() // drag to resize
	makeConfigPanel() // config pabel with pan/zoom and lasso
		lasso_select() // allow to select dots using lasso
			scatterplot_lasso_start()
			scatterplot_lasso_draw()
			scatterplot_lasso_end()
			show_lasso_menu()
printData() // get list of samples with meta data
click_mutated_genes() // init menu pane with reccurently mulated genes
	init_mutation_type_control() // recurrently mutated genes panel with config 
	get_mutation_count_data() // get mutation count from 'mdsgenecount' query
	make_sample_matrix() // make sample matrix from samplematrix.js
launch_singlesample()
*/

const radius = 3
const radius_tiny = 0.7
const userdotcolor = 'black'

export async function init(obj, holder, debugmode) {
	/*
	holder
	genome
	dslabel

	*/

	if (debugmode) {
		window.obj = obj
	}
	// default lasso options
	if (!obj.lasso)
		obj.lasso = {
			postSelectMenuOptions: [
				/*{
         label: 'Do something', 
         callback({samples, sample_attributes, sample2dot}) {....}
      },*/
				{
					label: 'List samples',
					callback: 'listSamples' // will indicate to use the default callback of listing the samples
				}
			]
		}

	obj.menu = new client.Menu({ padding: '2px' })
	obj.menu2 = new client.Menu({ padding: '10px' })
	obj.tip = new client.Menu({ padding: '5px' })

	obj.errordiv = holder.append('div').style('margin', '10px')

	obj.sayerror = e => {
		client.sayerror(obj.errordiv, typeof e == 'string' ? e : e.message)
		if (e.stack) console.log(e.stack)
	}

	const _table = holder.append('table').style('border-spacing', '20px')

	const tr1 = _table.append('tr') // row has two <td>

	const tr1td1 = tr1.append('td').style('vertical-align', 'top')
	const tr1td2 = tr1.append('td').style('vertical-align', 'top')

	{
		// sample search may be configurable
		const row = tr1td2.append('div').style('margin-bottom', '5px')
		row
			.append('input')
			.attr('type', 'text')
			.attr('placeholder', 'Search sample')
			.style('width', '200px')
			.on('keyup', event => {
				const str0 = event.target.value
				if (!str0) {
					// reset
					obj.dotselection.transition().attr('r', radius)
					return
				}
				const str = str0.toLowerCase()
				obj.dotselection
					.filter(d => searchStr(d, str))
					.transition()
					.attr('r', radius * 2)
				obj.dotselection
					.filter(d => !searchStr(d, str))
					.transition()
					.attr('r', 1)
			})

		function searchStr(data, str) {
			let found_flag = false
			let vals = Object.values(data).filter(a => a != null && typeof a != 'number')
			let new_vals = vals.filter(a => typeof a != 'object').map(x => x.toLowerCase())
			new_vals.forEach(v => {
				if (v.toLowerCase().includes(str)) return (found_flag = true)
			})
			// if any value is of type 'object', search for all values of the object
			if (!found_flag) {
				vals.forEach(v => {
					if (v && typeof v == 'object') {
						const obj_vals = Object.values(v)
							.filter(a => a != null && typeof a != 'number')
							.map(x => x.toLowerCase())
						obj_vals.forEach(ov => {
							if (ov.toLowerCase().includes(str)) return (found_flag = true)
						})
					}
				})
			}
			return found_flag
		}
	}
	const legend_div = tr1td2
		.append('div')
		.style('overflow-x', 'hidden')
		.style('overflow-y', 'auto')
		.style('height', '100vh')
	obj.legendtable = legend_div.append('table').style('border-spacing', '5px')
	obj.filterDiv = tr1td1.append('div').style('position', 'relative')

	const scatterdiv = tr1td1.append('div').style('position', 'relative')
	obj.scattersvg = scatterdiv.append('svg')
	obj.scattersvg_resizehandle = scatterdiv.append('div')
	obj.scattersvg_buttons = scatterdiv.append('div')

	try {
		await get_data(obj)
		/* added:
		obj.sample2dot
		obj.dots
		obj.colorbyattributes
		obj.colorbygeneexpression
		obj.tracks
		*/

		finish_setup(obj)

		init_dotcolor_legend(obj)

		init_plot(obj)
	} catch (e) {
		if (e.stack) console.log(e.stack)
		obj.sayerror(e.message || e)
	}
}

async function get_data(obj) {
	if (obj.dslabel) {
		// server data from official dataset
		const lst = ['genome=' + obj.genome.name, 'dslabel=' + obj.dslabel]
		if (obj.analysisdata) {
			if (obj.analysisdata.subset) {
				// pass subset attr to server to filter samples
				if (!obj.analysisdata.subset.key) throw '.subset.key missing'
				if (!obj.analysisdata.subset.value) throw '.subset.value missing'
				lst.push('subsetkey=' + obj.analysisdata.subset.key)
				lst.push('subsetvalue=' + obj.analysisdata.subset.value)
			}
		}
		const data = await client.dofetch2('mdssamplescatterplot?' + lst.join('&'))
		if (data.error) throw data.error
		if (!data.dots) throw 'server error'
		obj.sample2dot = new Map()
		for (const dot of data.dots) {
			obj.sample2dot.set(dot.sample, dot)
		}
		combine_clientserverdata(obj, data)
		// TODO generic attributes for legend, specify some categorical ones for coloring
		obj.colorbyattributes = data.colorbyattributes
		obj.colorbygeneexpression = data.colorbygeneexpression
		// optional stuff
		obj.tracks = data.tracks
		obj.querykey = data.querykey // for the moment it should always be set

		obj.sample_attributes = obj.mds.sampleAttribute.attributes
		return
	}
	///////////////////// client data /////////////////////
	const ad = obj.analysisdata
	if (obj.disco || ad.disco) {
		// some old external mdsjson files have analysisdata.disco
		// convert obj.disco to obj.mds for backward compatibity
		const disco = obj.disco || ad.disco
		obj.mds = obj.genome.datasets[disco.dslabel]
	} else if (obj.mds) {
		obj.mds = obj.genome.datasets[obj.mds.dslabel]
	}
	if (!ad) throw 'both .analysisdata{} and .dslabel are missing'
	if (ad.samples) {
		// list
		if (!Array.isArray(ad.samples)) throw '.analysisdata.samples is not array'
		obj.dots = ad.samples
	} else if (ad.tabular_data) {
		// load from tabular data
		// tabular data foramting instructions:
		// - tabular_data must have at least 3 columns, representing X, Y and sample_name
		// - headers for X and Y are case insensitive. (e.g. 'x' or 'X')
		// - header for 3rd column can be anything, it will be used as sample_name by default
		// - Metadata can be added as columns to tabular_data
		// - if tabular_data has metadata, 4th column is used to create legend and for coloring dots
		let lines = ad.tabular_data.split('\n')
		if (lines.length < 2) throw 'at least 2 rows, header row + at least 1 sample data must be supplied'
		ad.samples = []
		const headers = lines.shift().split('\t')
		if (headers.length < 3) throw 'at least 3 columns are required with X, Y and sample name'
		// assign 3rd column header as 'samplekey'
		ad.samplekey = headers[2]
		let xi = headers.indexOf('x')
		if (xi == -1) xi = headers.indexOf('X')
		if (xi == -1) throw '"X" or "x" column missing from tabular data'
		let yi = headers.indexOf('y')
		if (yi == -1) yi = headers.indexOf('Y')
		if (yi == -1) throw '"Y" or "y" column missing from tabular data'
		for (const line of lines) {
			const values = line.split('\t')
			const sample = {}
			for (const [i, v] of values.entries()) {
				if (i == xi) sample.x = Number.parseFloat(v)
				else if (i == yi) sample.y = Number.parseFloat(v)
				else sample[headers[i]] = v
			}
			ad.samples.push(sample)
		}
		obj.dots = ad.samples
		// create sample_attributes if not defined
		if (ad.sample_attributes == undefined) {
			ad.sample_attributes = {}
			for (const [i, key] of headers.entries()) {
				if (i <= 2) continue
				ad.sample_attributes[key] = { label: key }
			}
		}
		// For tabular data, first 3 columns should be X, Y and sample_name
		// 4th column will be used for color dots and legend by default
		if (!ad.colorbyattributes && headers.length > 3) ad.colorbyattributes = [{ key: headers[3] }]
	} else {
		throw 'unknown data encoding in .analysisdata{}'
	}
	obj.sample2dot = new Map()
	// reformat each sample
	for (const d of obj.dots) {
		if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) throw 'non-numeric x/y for a sample'
		if (ad.samplekey) {
			d.sample = d[ad.samplekey]
			delete d[ad.samplekey]
		}
		if (ad.sample_attributes) {
			d.s = {}
			for (const k in ad.sample_attributes) {
				d.s[k] = d[k]
				delete d[k]
			}
		}
		obj.sample2dot.set(d.sample, d)
	}
	obj.sample_attributes = ad.sample_attributes
	obj.colorbyattributes = ad.colorbyattributes
	obj.attr_levels = ad.attr_levels
	if (ad.user_samples) {
		if (!Array.isArray(ad.user_samples)) throw '.user_samples[] is not array'
		obj.dots_user = []
		for (const d of ad.user_samples) {
			if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) throw 'non-numeric x/y for a USER sample'
			if (ad.samplekey) {
				d.sample = d[ad.samplekey]
				delete d[ad.samplekey]
			}
			if (!d.color) d.color = userdotcolor
			obj.dots_user.push(d)
		}
	}

	if (!obj.filterApi) {
		obj.filterApi = filterInit({
			btn: obj.filterDiv.append('div'),
			btnLabel: 'Filter',
			emptyLabel: '+New Filter',
			holder: obj.filterDiv.append('div'),
			vocab: getVocabFromSamplesArray(ad),
			//termdbConfig: opts.termdbConfig,
			debug: true,
			callback(filter) {
				obj.filteredSamples = getFilteredSamples(ad.samples, filter)
				// re-render scatterplot
				if (obj.dotselection._groups[0].length != obj.filteredSamples.size) {
					obj.dotselection
						.transition()
						.attr('r', d => (obj.filteredSamples.has(d.sample) ? radius : 0))
						.style('opacity', d => (obj.filteredSamples.has(d.sample) ? 1 : 0))
				} else {
					obj.dotselection.transition().attr('r', radius).style('opacity', 1)
				}
				update_dotcolor_legend(obj)
			}
		})
		obj.filterApi.main({ type: 'tvslst', join: '', lst: [] })
		obj.filteredSamples = [] // may be seeded from the initial render
	}
}

function combine_clientserverdata(obj, data) {
	// data is returned by server
	if (!obj.analysisdata) {
		obj.dots = data.dots
		return
	}
	if (!obj.analysisdata.str) throw '.analysisdata.str missing while trying to combine client/server data'

	const analysis = new Map() // only for server-hosted samples
	// k: sample id, v: {x,y}
	obj.dots_user = [] // for user samples
	for (const line of obj.analysisdata.str.trim().split('\n')) {
		const l = line.split('\t')
		if (l.length < 3) {
			// to report
			continue
		}
		const sample = l[2]
		if (!sample) continue
		const j = {
			x: Number(l[0]),
			y: Number(l[1])
		}
		if (Number.isNaN(j.x) || Number.isNaN(j.y)) continue
		if (l[3]) {
			j.sample = sample
			j.color = userdotcolor
			obj.dots_user.push(j)
			continue
		}
		analysis.set(sample, j)
	}
	obj.dots = []
	for (const i of data.dots) {
		const j = analysis.get(i.sample)
		if (!j) continue
		i.x = j.x
		i.y = j.y
		obj.dots.push(i)
	}
}

function finish_setup(obj) {
	if (obj.colorbyattributes) {
		if (!Array.isArray(obj.colorbyattributes)) throw '.colorbyattributes[] is not array'
		if (!obj.sample_attributes) throw '.sample_attributes{} missing when .colorbyattributes is defined'
		for (const a of obj.colorbyattributes) {
			if (typeof a != 'object') throw 'one of .colorbyattributes[] is not array'
			if (!a.key) throw '.key missing from one of .colorbyattributes[]'
			const a2 = obj.sample_attributes[a.key]
			if (!a2) throw 'unknown key from .colorbyattributes: ' + a.key
			a.label = a2.label
			a.values = a2.values
			if (!a.values) {
				a.values = {}
				for (const d of obj.dots) {
					const v = d.s[a.key]
					if (v == undefined || v == null) continue
					a.values[v] = {}
				}
			}
			const cf = scaleOrdinal(schemeCategory20)
			for (const k in a.values) {
				if (!a.values[k].color) a.values[k].color = cf(k)
			}

			if (obj.analysisdata) {
				// add color to obj.analysisdata.sample_attributes[key].values
				// for tabular data where colors are not defined for each category
				const ad = obj.analysisdata.sample_attributes
				if (ad[a.key].values == undefined) ad[a.key].values = a.values
			}
		}
	}
	if (obj.attr_levels) {
		if (!Array.isArray(obj.attr_levels)) throw '.attr_levels[] is not array'
		if (obj.attr_levels.length < 2) throw '.attr_levels[] array has less than 2 items'
		if (!obj.sample_attributes) throw '.sample_attributes is missing when .attr_levels is defined'
		for (const l of obj.attr_levels) {
			if (!l.key) throw '.key missing from one of attr_levels[]'
			const register = obj.sample_attributes[l.key]
			if (!register) throw '.attr_levels key missing from sample_attributes{}: ' + l.key
			if (!register.values) {
				// no predefined list of values given, add them
				register.values = {}
				for (const d of obj.dots) {
					const v = d.s[l.key]
					if (v == undefined || v == null || register.values[v]) continue
					register.values[v] = {}
				}
				const cf = scaleOrdinal(schemeCategory20)
				for (const k in register.values) {
					if (!register.values[k].color) register.values[k].color = cf(k)
				}
				// as the values are automatically summed up, let them show in descending order
				register.orderByCount = true
			}
			if (l.label) {
				// do not require label of a level to be registered in sample_attributes
				// as no color will be associated with a label value
			}
		}
	}
}

function init_plot(obj) {
	const rootholder = obj.scattersvg.node().closest('.sja_root_holder')
	let minx = obj.dots[0].x,
		maxx = minx,
		miny = obj.dots[0].y,
		maxy = miny
	for (const d of [...obj.dots, ...(obj.dots_user || [])]) {
		minx = Math.min(minx, d.x)
		maxx = Math.max(maxx, d.x)
		miny = Math.min(miny, d.y)
		maxy = Math.max(maxy, d.y)
	}

	let xscale = (obj.xscale = scaleLinear().domain([minx, maxx]))
	let yscale = (obj.yscale = scaleLinear().domain([miny, maxy]))

	if (!obj.dimensions) obj.dimensions = {}
	if (!('autoResize' in obj.dimensions)) obj.dimensions.autoResize = true
	if (!('minWidth' in obj.dimensions)) obj.dimensions.minWidth = 300
	if (!('minHeight' in obj.dimensions)) obj.dimensions.minHeight = 300

	let currBbox // to be used for maintaining chart height:width ratio when resizing based on div size
	const estlegendwidth = 250 // estimated legend width to the right side of the chart
	const bbox = rootholder.getBoundingClientRect()
	let toppad = 30,
		bottompad = 50,
		leftpad = 100,
		rightpad = 30,
		vpad = 20,
		width = obj.dimensions.width
			? obj.dimensions.width
			: Math.max(obj.dimensions.minWidth, 0.75 * (bbox.width - estlegendwidth)),
		height = obj.dimensions.height
			? obj.dimensions.height
			: Math.max(obj.dimensions.minHeight, Math.min(1.2 * width, 0.5 * bbox.height)),
		fontsize = 18

	const svg = obj.scattersvg

	//const xaxisg = svg.append('g')
	//const yaxisg = svg.append('g')
	const dotg = (obj.dotg = svg.append('g').attr('transform', 'translate(' + (leftpad + vpad) + ',' + toppad + ')'))

	const dots = dotg.selectAll().data(obj.dots).enter().append('g').attr('class', 'sample_dot')

	const circles = dots
		.append('circle')
		.attr('stroke', 'none')
		.attr('r', radius)
		.on('mouseover', (event, d) => {
			event.target.setAttribute('stroke', 'white')
			const lst = [{ k: 'Sample', v: d.sample }]
			if (obj.sample_attributes) {
				for (const attrkey in obj.sample_attributes) {
					const attr = obj.sample_attributes[attrkey]
					const v = d.s[attrkey]
					lst.push({
						k: attr.label,
						v: d.s[attrkey]
					})
				}
			}

			client.make_table_2col(obj.tip.clear().d, lst)
			obj.tip.show(event.clientX, event.clientY)
		})
		.on('mouseout', (event, d) => {
			event.target.setAttribute('stroke', 'none')
			obj.tip.hide()
		})
		.on('click', (event, d) => {
			click_dot(d, obj, event)
		})

	obj.dotselection = circles

	let userdots, usercircles, userlabelg, userlabels, userlabel_borders
	const userlabel_grp = (obj.userlabel_grp = { userlabels, userlabel_borders })
	if (obj.dots_user) {
		userdots = dotg.selectAll().data(obj.dots_user).enter().append('g').attr('class', 'sample_dot')
		usercircles = userdots
			.append('circle')
			.attr('stroke', 'none')
			.attr('fill', d => d.color)
			.attr('r', radius)
			.on('mouseover', (event, d) => {
				const lst = [{ k: 'Sample', v: d.sample }]
				if (obj.sample_attributes) {
					for (const attrkey in obj.sample_attributes) {
						const attr = obj.sample_attributes[attrkey]
						if (d[attrkey])
							lst.push({
								k: attr.label,
								v: d[attrkey]
							})
					}
				}
				client.make_table_2col(obj.tip.clear().d, lst)
				obj.tip.show(event.clientX, event.clientY)
				Object.values(userlabel_grp).forEach(labels =>
					labels.filter(i => i.sample == d.sample).attr('font-weight', 'bold')
				)
			})
			.on('mouseout', (event, d) => {
				obj.tip.hide()
				Object.values(userlabel_grp).forEach(labels =>
					labels.filter(i => i.sample == d.sample).attr('font-weight', 'normal')
				)
			})
		userlabelg = dotg.selectAll().data(obj.dots_user).enter().append('g').attr('class', 'userlabelg')

		userlabel_grp.userlabel_borders = userlabelg
			.append('text')
			.attr('fill', '#fff')
			.attr('font-size', fontsize)
			.attr('stroke', 'white')
			.attr('stroke-width', '3px')
			.text(d => d.sample)
			.attr('text-anchor', 'end')

		userlabel_grp.userlabels = userlabelg
			.append('text')
			.attr('fill', d => d.color)
			.attr('font-size', fontsize)
			.text(d => d.sample)
			.on('mouseover', (event, d) => {
				usercircles.filter(i => i.sample == d.sample).attr('r', radius * 2)
				svg.style('cursor', 'move')
				const lst = [{ k: 'Sample', v: d.sample }]
				if (obj.sample_attributes) {
					for (const attrkey in obj.sample_attributes) {
						const attr = obj.sample_attributes[attrkey]
						if (d[attrkey])
							lst.push({
								k: attr.label,
								v: d[attrkey]
							})
					}
				}
				client.make_table_2col(obj.tip.clear().d, lst)
				obj.tip.show(event.clientX, event.clientY)
			})
			.on('mouseout', (event, d) => {
				usercircles.filter(i => i.sample == d.sample).attr('r', radius)
				svg.style('cursor', 'auto')
				obj.tip.hide()
			})
			.on('mousedown', (event, d) => {
				event.preventDefault()
				event.stopPropagation()
				const b = d3select(document.body)
				const x = event.clientX
				const y = event.clientY
				xscale = obj.zoomed_scale && obj.zoomed_scale > 1 ? obj.new_xscale : obj.xscale
				yscale = obj.zoomed_scale && obj.zoomed_scale > 1 ? obj.new_yscale : obj.yscale
				// <g> is movable
				const g = userlabelg.filter(i => i.sample == d.sample)
				const [x1, y1] = g
					.attr('transform')
					.match(/[\d\.]+/g)
					.map(Number)
				b.on('mousemove', event => {
					g.attr('transform', 'translate(' + (x1 + event.clientX - x) + ',' + (y1 + event.clientY - y) + ')')
				})
				b.on('mouseup', event => {
					b.on('mousemove', null).on('mouseup', null)
					d.x_ = xscale.invert(x1 + event.clientX - x)
					d.y_ = yscale.invert(y1 + event.clientY - y)
				})
			})
			.on('dblclick', (event, d) => {
				obj.menu2.clear().show(event.clientX - 90, event.clientY)
				obj.menu2.d
					.append('input')
					.attr('type', 'text')
					.property('value', d.sample)
					.style('display', 'block')
					.style('margin-bottom', '5px')
					.on('keyup', event => {
						if (!client.keyupEnter(event)) return
						const v = event.target.value
						Object.values(userlabel_grp).forEach(labels => labels.filter(i => i.sample == d.sample).text(v))
						d.sample = v
						obj.menu2.hide()
					})
				obj.menu2.d
					.append('input')
					.attr('type', 'color')
					.property('value', d.color)
					.on('change', event => {
						const v = event.target.value
						Object.values(userlabel_grp).forEach(labels => labels.filter(i => i.sample == d.sample).attr('fill', v))
						usercircles.filter(i => i.sample == d.sample).attr('fill', v)
						d.color = v
					})
			})
		userlabel_grp.userlabels.append('title').text('Double-click to edit')
	}

	assign_color4dots(obj)

	function resize() {
		bottompad = width / 20 + 20
		svg.attr('width', leftpad + vpad + width + rightpad).attr('height', toppad + height + vpad + bottompad)
		//dotg
		const new_xscale = obj.zoomed_scale && obj.zoomed_scale > 1 ? obj.new_xscale : xscale
		const new_yscale = obj.zoomed_scale && obj.zoomed_scale > 1 ? obj.new_yscale : yscale
		new_xscale.range([0, width])
		new_yscale.range([height, 0])
		dots.attr('transform', d => 'translate(' + new_xscale(d.x) + ',' + new_yscale(d.y) + ')')
		if (userdots) {
			userdots.attr('transform', d => 'translate(' + new_xscale(d.x) + ',' + new_yscale(d.y) + ')')
			userlabelg
				//.transition() // smooth motion of the text label
				.attr('transform', d => {
					const x = d.x_ ? new_xscale(d.x_) : new_xscale(d.x),
						y = d.y_ ? new_yscale(d.y_) : new_yscale(d.y)
					// check label width
					let lw
					Object.values(userlabel_grp).forEach(labels =>
						labels
							.filter(i => i.sample == d.sample)
							.each(function () {
								lw = this.getBBox().width
							})
							.attr('text-anchor', x + lw >= width ? 'end' : 'start')
					)
					return 'translate(' + x + ',' + y + ')'
				})
		}
		//circles.attr('r',radius)
		currBbox = rootholder.getBoundingClientRect()
		if (obj.userlabel_grp && userlabelg && userlabelg.size()) {
			uncollide(userlabelg, { waitTime: 0, nameKey: 'sample' })
		}
	}
	resize()

	// drag resize
	obj.scattersvg_resizehandle
		.style('position', 'absolute')
		.style('right', '0px')
		.style('bottom', '0px')
		.attr('class', 'sja_clbtext')
		.text('drag to resize')
		.on('mousedown', event => {
			event.preventDefault()
			const b = d3select(document.body)
			const x = event.clientX
			const y = event.clientY
			const w0 = width
			const h0 = height
			b.on('mousemove', event => {
				width = w0 + event.clientX - x
				height = h0 + event.clientY - y
				resize()
			})
			b.on('mouseup', () => {
				b.on('mousemove', null).on('mouseup', null)
			})
		})

	function resetDimensions() {
		const bbox = rootholder.getBoundingClientRect()
		const w = (width * bbox.width) / currBbox.width
		width = obj.dimensions.minWidth ? Math.max(obj.dimensions.minWidth, w) : w
		const h = (height * bbox.height) / currBbox.height
		height = obj.dimensions.minHeight ? Math.max(obj.dimensions.minHeight, h) : h
		currBbox = bbox
		resize()
	}

	let timeout
	if (obj.dimensions.autoResize) {
		window.addEventListener('resize', () => {
			if (timeout) clearTimeout(timeout)
			timeout = setTimeout(resetDimensions, 50)
		})
	}

	makeConfigPanel(obj)
}

function makeConfigPanel(obj) {
	const svg = obj.scattersvg

	// settings buttons
	obj.scattersvg_buttons.style('position', 'absolute').style('right', '0px').style('top', '0px')

	// zoom button
	obj.zoom_active = false
	const zoom_btn = obj.scattersvg_buttons
		.append('div')
		.style('padding', '2px 5px')
		.style('border', '1px solid #999')
		.style('color', '#999')
		.style('background-color', '#fff')
		.style('cursor', 'pointer')
		.style('font-weight', '300')
		.style('border-radius', '5px')
		.style('text-align', 'center')
		.text('Pan / Zoom')
		.on('click', zoomToggle)

	const zoom_menu = obj.scattersvg_buttons
		.append('div')
		.style('margin-top', '2px')
		.style('padding', '2px 5px')
		.style('border-radius', '5px')
		.style('text-align', 'center')
		.style('display', obj.zoom_active ? 'block' : 'none')
		.style('background-color', '#ddd')

	const zoom_inout_div = zoom_menu.append('div').style('margin', '5px 2px')

	zoom_inout_div
		.append('div')
		.style('display', 'block')
		.style('padding', '2px 4px')
		.style('font-size', '80%')
		.text('Zoom')

	zoom_inout_div
		.append('div')
		.style('display', 'block')
		.style('padding', '2px')
		.style('font-size', '70%')
		.html('<p style="margin:1px;">Mouse wheel </br>or use these buttons</p>')

	const zoom_in_btn = zoom_inout_div.append('button').style('margin', '1px').style('padding', '2px 7px').text('+')

	const zoom_out_btn = zoom_inout_div.append('button').style('margin', '1px').style('padding', '2px 8px').text('-')

	const pan_div = zoom_menu.append('div').style('margin', '5px 2px')

	pan_div.append('div').style('display', 'block').style('padding', '2px').style('font-size', '80%').text('Pan')

	pan_div
		.append('div')
		.style('display', 'block')
		.style('padding', '2px')
		.style('font-size', '70%')
		.html('<p style="margin:1px;">Mouse click </br>+ Mouse move</p>')

	const reset_div = zoom_menu.append('div').style('margin', '5px 2px')

	const reset_btn = reset_div.append('button').style('margin', '1px').style('padding', '2px 8px').text('Reset')

	function zoomToggle() {
		obj.zoom_active = obj.zoom_active ? false : true

		zoom_btn
			.style('border', obj.zoom_active ? '2px solid #000' : '1px solid #999')
			.style('color', obj.zoom_active ? '#000' : '#999')
			.style('background-color', obj.zoom_active ? '#eee' : '#fff')
			.style('font-weight', obj.zoom_active ? '400' : '300')

		lasso_btn.style('pointer-events', obj.zoom_active ? 'none' : 'auto')

		zoom_menu.style('display', obj.zoom_active ? 'block' : 'none')

		const zoom = d3zoom()
			.scaleExtent([1, 5])
			.on('zoom', obj.zoom_active ? zoomed : null)

		function zoomed(event) {
			obj.new_xscale = event.transform.rescaleX(obj.xscale)
			obj.new_yscale = event.transform.rescaleY(obj.yscale)
			obj.zoomed_scale = event.transform.k
			const dots = obj.dotg.selectAll('.sample_dot')
			dots.attr('transform', d => 'translate(' + obj.new_xscale(d.x) + ',' + obj.new_yscale(d.y) + ')')
			const userlabelg = obj.dotg.selectAll('.userlabelg')
			userlabelg.attr(
				'transform',
				d => 'translate(' + obj.new_xscale(d.x_ || d.x) + ',' + obj.new_yscale(d.y_ || d.y) + ')'
			)
		}

		if (obj.zoom_active) svg.call(zoom)
		else svg.on('.zoom', null)

		zoom_in_btn.on('click', () => {
			zoom.scaleBy(svg.transition().duration(750), 1.5)
		})

		zoom_out_btn.on('click', () => {
			zoom.scaleBy(svg.transition().duration(750), 0.5)
		})

		reset_btn.on('click', () => {
			svg.transition().duration(750).call(zoom.transform, zoomIdentity)
		})
	}

	const lasso_btn = obj.scattersvg_buttons
		.append('div')
		.style('display', 'block')
		.style('padding', '2px 5px')
		.style('margin-top', '5px')
		.style('border', '1px solid #999')
		.style('color', '#999')
		.style('background-color', '#fff')
		.style('cursor', 'pointer')
		.style('font-weight', '300')
		.style('border-radius', '5px')
		.style('text-align', 'center')
		.text('Lasso select')
		.on('click', lassoToggle)

	const lasso_menu = obj.scattersvg_buttons
		.append('div')
		.style('margin-top', '2px')
		.style('padding', '2px 5px')
		.style('border-radius', '5px')
		.style('text-align', 'center')
		.style('display', obj.lasso_active ? 'block' : 'none')
		.style('background-color', '#ddd')

	const lasso_div = lasso_menu.append('div').style('margin', '5px 2px')

	lasso_div
		.append('div')
		.style('display', 'block')
		.style('padding', '2px')
		.style('font-size', '80%')
		.text('Lasso usage')

	lasso_div
		.append('div')
		.style('display', 'block')
		.style('padding', '2px')
		.style('font-size', '70%')
		.html(
			'<p style="margin:1px;">Mouse click </br>+ Mouse move <br>' +
				'TIP: Release the mouse <br> when desired dots <br> are selected, without <br>closing the loop. </p>'
		)

	function lassoToggle() {
		const dots = obj.dotg.selectAll('g')
		obj.lasso_active = obj.lasso_active ? false : true
		zoom_btn.style('pointer-events', obj.lasso_active ? 'none' : 'auto')
		lasso_menu.style('display', obj.lasso_active ? 'block' : 'none')

		lasso_btn
			.style('border', obj.lasso_active ? '2px solid #000' : '1px solid #999')
			.style('color', obj.lasso_active ? '#000' : '#999')
			.style('background-color', obj.lasso_active ? '#eee' : '#fff')
			.style('font-weight', obj.lasso_active ? '400' : '300')

		lasso_select(obj, dots)

		// reset dots to original state if lasso button deactivated
		if (obj.lasso_active) return
		dots
			.selectAll('circle')
			.classed('not_possible', false)
			.classed('possible', false)
			.attr('r', radius)
			.style('fill-opacity', '1')
	}
}

function assign_color4dots(obj) {
	let byattr

	if (obj.colorbygeneexpression && obj.colorbygeneexpression.__inuse) {
	} else if (obj.attr_levels) {
		byattr = { key: obj.attr_levels[1].key }
		byattr.values = obj.sample_attributes[byattr.key].values
	} else if (obj.colorbyattributes) {
		byattr = { key: (obj.colorbyattributes.find(i => i.__inuse) || obj.colorbyattributes[0]).key }
		byattr.values = obj.sample_attributes[byattr.key].values
	}

	obj.dotselection.transition().attr('fill', d => {
		if (byattr) {
			const v = d.s[byattr.key]
			return byattr.values[v] ? byattr.values[v].color : 'black'
		}
		return '#ccc'
	})
}

function init_dotcolor_legend(obj) {
	/*
	dispatch function, 3 choices of legend:
	1. attr_levels
	2. flat list of colorbyattributes
	3. gene expression, not implemented
	*/

	if (obj.attr_levels) {
		legend_attr_levels(obj)
		return
	}
	if (obj.colorbyattributes) {
		legend_flatlist(obj)
		return
	}
	if (obj.colorbygeneexpression) {
		/* TODO
		const tr = obj.legendtable.append('tr')
		obj.colorbygeneexpression.labelhandle = tr.append('td')
			.append('div')
			.text('Gene expression')
		const td = tr.append('td')
		*/
	}
}

/*
hardcoded 2 levels
level 1 is not colored
level 2 is colored and based on sample_attributes[L2key].values{}
*/
function legend_attr_levels(obj) {
	const staydiv = obj.legendtable.append('tr').append('td').append('div').style('position', 'relative')
	const scrolldiv = staydiv.append('div')
	const L1 = obj.attr_levels[0]
	L1.v2c = new Map()
	// k: unique value by this level, v: {count}
	L1.unannotated = 0
	for (const d of obj.dots) {
		const v = d.s[L1.key]
		if (v == undefined || v == null) {
			L1.unannotated++
			continue
		}
		if (!L1.v2c.has(v)) L1.v2c.set(v, { dots: [] })
		L1.v2c.get(v).dots.push(d)
		if (L1.label) {
			L1.v2c.get(v).label = d.s[L1.label]
		}
	}
	// multiple ways to decide order of L1values
	for (const L1value of get_itemOrderList(L1, obj)) {
		const L1o = L1.v2c.get(L1value)
		const L1div = scrolldiv.append('div').style('margin-top', '20px').attr('class', 'sja_lb_div')
		L1div.append('div')
			.attr('class', 'sja_l1lb')
			.html((L1o.label || L1value) + ' &nbsp;<span style="font-size:.8em">n=' + L1o.dots.length + '</span>')
			.style('margin-top', '15px')

		const L2 = obj.attr_levels[1]
		if (L2) {
			const L2values = obj.sample_attributes[L2.key].values
			L2.v2c = new Map()
			L2.unannotated = 0
			for (const d of L1o.dots) {
				const v = d.s[L2.key]
				if (v == undefined || v == null) {
					L2.unannotated++
					continue
				}
				if (!L2.v2c.has(v)) {
					const o = L2values[v]
					if (o) {
						o.dots = []
						L2.v2c.set(v, o)
					}
				}
				if (L2.v2c.has(v)) {
					L2.v2c.get(v).dots.push(d)
					if (L2.label) {
						L2.v2c.get(v).label = d.s[L2.label]
					}
				}
			}
			if (!obj.hide_subtype_legend) {
				for (const L2value of get_itemOrderList(L2, obj)) {
					const L2o = L2.v2c.get(L2value)
					const cell = L1div.append('div')
						.style('display', 'inline-block')
						.style('white-space', 'nowrap')
						.attr('class', 'sja_clb')
						.on('click', () => {
							// clicking a value from this attribute to toggle the select on this value, if selected, only show such dots

							if (L2o.selected) {
								// already selected, turn off this category in legend
								L2o.selected = false
								cell.style('border', '')

								let alloff = true
								for (const k in L2values) {
									if (L2values[k].selected) alloff = false
								}
								if (alloff) {
									// all items are unselected, turn dots to default
									obj.dotselection.transition().attr('r', radius)
								} else {
									// still other items selected, only turn dots of this category to tiny
									obj.dotselection
										.filter(d => d.s[L2.key] == L2value)
										.transition()
										.attr('r', radius_tiny)
								}
								return
							}

							// not yet, select this one
							let alloff = true
							for (const k in L2values) {
								if (L2values[k].selected) alloff = false
							}
							L2o.selected = true
							cell.style('border', 'solid 1px #858585')
							if (alloff) {
								// none other groups selected so far, turn all the other groups tiny
								obj.dotselection.transition().attr('r', d => (d.s[L2.key] == L2value ? radius : radius_tiny))
							} else {
								// some other groups are also highlighted, only turn this group big
								obj.dotselection
									.filter(d => d.s[L2.key] == L2value)
									.transition()
									.attr('r', radius)
							}
						})
					cell
						.append('div')
						.style('display', 'inline-block')
						.attr('class', 'sja_mcdot')
						.style('background', L2o.color)
						.style('margin-right', '3px')
						.text(L2o.dots.length)
					cell
						.append('div')
						.style('display', 'inline-block')
						.style('color', L2o.color)
						.text(L2o.label || L2value)
					L2o.cell = cell
				}
			}
			if (L2.unannotated) {
				const d = L1div.append('div').style('margin-top', '20px')
				d.append('div').text('Unannotated for "' + L2.key + '": ' + L2.unannotated)
			}
		}
	}
	if (L1.unannotated) {
		const d = scrolldiv.append('div').style('margin-top', '20px')
		d.append('div').html('Unannotated for "' + L1.key + '": ' + L1.unannotated)
	}
	if (L1.v2c.size > 10) {
		scrolldiv.style('overflow-y', 'scroll').style('height', '800px').style('resize', 'vertical')
	}
}

/*
level{}
.key
.v2c Map
	k: value
	v: {dots[]}

will reference sample_attributes[key].values{} for outputting ordered list of keys
*/
function get_itemOrderList(level, obj) {
	const register = obj.sample_attributes[level.key]
	if (!register.values || register.orderByCount) {
		// no predefined values
		return [...level.v2c].sort((i, j) => j[1].dots.length - i[1].dots.length).map(i => i[0])
	}
	// by predefined order in register.values{}
	const lst = []
	for (const k in register.values) {
		if (level.v2c.has(k)) lst.push(k)
	}
	return lst
}

function legend_flatlist(obj) {
	if (!obj.colorbyattributes.find(i => i.__inuse)) obj.colorbyattributes[0].__inuse = true

	for (const attr of obj.colorbyattributes) {
		const tr = obj.legendtable.append('tr')

		// legend item name
		attr.labelhandle = tr
			.append('td')
			.append('div')
			.style('white-space', 'nowrap')
			.text(attr.label)
			.attr('class', 'sja_clb')
			.on('click', () => {
				// click an attribute to select it for coloring dots
				for (const attr2 of obj.colorbyattributes) {
					attr2.__inuse = false
					attr2.labelhandle.style('background', '').style('border-bottom', '')
				}
				attr.__inuse = true
				attr.labelhandle.style('background', '#ededed').style('border-bottom', 'solid 2px #858585')
				assign_color4dots(obj)
			})

		if (attr.__inuse) {
			attr.labelhandle.style('background', '#ededed').style('border-bottom', 'solid 2px #858585')
		}

		for (const d of obj.dots) {
			const v = d.s[attr.key]
			if (v == undefined || v == null) continue
			if (!attr.values[v]) attr.values[v] = { color: 'black' }
			attr.values[v].count = 1 + (attr.values[v].count || 0)
		}

		// legend values
		const cellholder = tr.append('td')

		for (const value in attr.values) {
			// for each value
			const o = attr.values[value]
			if (o.count == 0 || o.count == undefined) continue

			const cell = cellholder
				.append('div')
				.style('display', 'inline-block')
				.attr('class', 'sja_clb')
				.on('click', () => {
					// clicking a value from this attribute to toggle the select on this value, if selected, only show such dots

					if (o.selected) {
						// already selected, turn off
						o.selected = false
						cell.style('border', '')
						let alloff = true
						for (const k in attr.values) {
							if (attr.values[k].selected) alloff = false
						}
						if (alloff) {
							obj.dotselection.transition().attr('r', radius)
						} else {
							obj.dotselection
								.filter(d => d.s[attr.key] == value)
								.transition()
								.attr('r', radius_tiny)
						}
						return
					}

					// not yet, select this one
					let alloff = true
					for (const k in attr.values) {
						if (attr.values[k].selected) alloff = false
					}
					o.selected = true
					cell.style('border', 'solid 1px #858585')
					if (alloff) {
						obj.dotselection.transition().attr('r', d => (d.s[attr.key] == value ? radius : radius_tiny))
					} else {
						obj.dotselection
							.filter(d => d.s[attr.key] == value)
							.transition()
							.attr('r', radius)
					}
				})
			cell
				.append('div')
				.style('display', 'inline-block')
				.attr('class', 'sja_mcdot')
				.style('background', o.color)
				.style('margin-right', '3px')
				.text(o.count)
			cell
				.append('div')
				.style('display', 'inline-block')
				.style('color', o.color)
				.text(o.name || value)
			o.cell = cell
		}
	}
}

function update_dotcolor_legend(obj) {
	// update legend table by filter
	const filterd_dots = obj.dots.filter(d => obj.filteredSamples.has(d.sample))
	const attrs_list = Array.from(filterd_dots, d => d.s)

	const key1 = obj.attr_levels?.[0].label || obj.attr_levels?.[0].key
	const l1_labs = [...new Set(Array.from(attrs_list, a => a[key1]))]

	const key2 = obj.attr_levels?.[1].label || obj.attr_levels?.[1].key
	const l2_labs = [...new Set(Array.from(attrs_list, a => a[key2]))]

	const legend_divs = obj.legendtable.node().querySelectorAll('.sja_lb_div')
	for (const div1 of legend_divs) {
		// render main labels for level1
		const l1_label = d3select(div1)
			.select('.sja_l1lb')
			.node()
			.innerText.split(/\s{2}n=/)[0]
		if (!l1_labs.includes(l1_label)) d3select(div1).style('display', 'none')
		else {
			d3select(div1).style('display', 'block')
			// render secondary labels for level2
			const l2_divs = d3select(div1).node().querySelectorAll('.sja_clb')
			for (const div2 of l2_divs) {
				const clab = d3select(div2).node().querySelectorAll('div')[1]
				if (!l2_labs.includes(clab.innerText)) d3select(div2).style('display', 'none')
				else d3select(div2).style('display', 'inline-block')
			}
		}
	}
}

/*
clicking a dot can have different behaviors based on config
*/
function click_dot(dot, obj, event) {
	if (obj.dslabel) {
		// to launch browser view of tracks from this sample
		click_dot_mdsview(dot, obj, event)
		return
	}
	if (obj.mds) {
		click_dot_disco(dot, obj, event)
		return
	}
}
async function click_dot_disco(dot, obj, event) {
	const pane = client.newpane({ x: event.clientX, y: event.clientY })
	pane.header.text(dot.sample)
	const wait = client.tab_wait(pane.body)
	try {
		const sjcharts = await getsjcharts()
		const arg = {
			genome: obj.genome.name,
			dslabel: obj.mds.label,
			querykey: obj.mds.querykey,
			getsample4disco: dot.sample
		}
		const data = await client.dofetch('/mdssvcnv', arg)
		if (data.error) throw data.error
		if (!data.text) throw '.text missing'

		const discoHolder = pane.body.append('div')
		const renderer = await sjcharts.dtDisco({
			holderSelector: discoHolder,
			chromosomeType: obj.genome.name,
			majorchr: obj.genome.majorchr,
			settings: {
				showControls: false,
				selectedSamples: []
			},
			callbacks: {
				geneLabelClick: {
					type: 'genomepaint',
					hostURL: sessionStorage.getItem('hostURL') || '',
					genome: obj.genome.name,
					dslabel: obj.mds.label,
					sample: dot.sample
				}
			}
		})

		const disco_arg = {
			sampleName: dot.sample,
			data: JSON.parse(data.text)
		}
		renderer.main(disco_arg)
		wait.remove()
	} catch (e) {
		wait.text('Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}
function click_dot_mdsview(dot, obj, event) {
	const pane = client.newpane({ x: event.clientX, y: event.clientY })
	pane.header.text(dot.sample)

	const wait = pane.body.append('div').style('margin', '20px').text('Loading ...')

	client
		.dofetch('/mdssvcnv', {
			genome: obj.genome.name,
			dslabel: obj.dslabel,
			querykey: obj.querykey, // TODO general track
			gettrack4singlesample: dot.sample
		})
		.then(data => {
			// done getting assay tracks for this sample
			wait.remove()
			launch_singlesample({
				obj: obj,
				dot: dot,
				sampletracks: data.tracks,
				holder: pane.body
			})
		})
}

function lasso_select(obj, dots) {
	const svg = obj.scattersvg
	let lasso

	if (obj.lasso_active) {
		lasso = d3lasso().items(dots.selectAll('circle')).targetArea(svg)

		lasso.on('start', scatterplot_lasso_start).on('draw', scatterplot_lasso_draw).on('end', scatterplot_lasso_end)

		svg.call(lasso)
	} else {
		svg.selectAll('.lasso').remove()
		svg.on('mousedown.drag', null)
	}

	// Lasso custom functions
	function scatterplot_lasso_start() {
		if (!obj.lasso_active) return
		lasso.items().attr('r', 2).style('fill-opacity', '.5').classed('not_possible', true).classed('selected', false)
	}

	function scatterplot_lasso_draw() {
		if (!obj.lasso_active) return
		// Style the possible dots
		lasso
			.possibleItems()
			.attr('r', radius)
			.style('fill-opacity', '1')
			.classed('not_possible', false)
			.classed('possible', true)

		// Style the not possible dot
		// lasso.notPossibleItems()
		// 	.attr('r',2)
		// 	.style('fill-opacity','.5')
		// 	.classed('not_possible',true)
		// 	.classed('possible',false)
	}

	function scatterplot_lasso_end(event) {
		if (!obj.lasso_active) return

		// show menu if at least 1 sample selected
		const selected_samples = svg
			.selectAll('.possible')
			.data()
			.map(d => d.sample)
		if (selected_samples.length) show_lasso_menu(event, selected_samples)
		else obj.menu.hide()

		// Reset classes of all items (.possible and .not_possible are useful
		// only while drawing lasso. At end of drawing, only selectedItems()
		// should be used)
		lasso.items().classed('not_possible', false).classed('possible', false)

		// Style the selected dots
		lasso.selectedItems().attr('r', radius)

		// if none of the items are selected, reset radius of all dots or
		// keep them as unselected with tiny radius
		lasso
			.notSelectedItems()
			.attr('r', selected_samples.length == 0 ? radius : radius_tiny)
			.style('fill-opacity', '1')
	}

	function show_lasso_menu(event, samples) {
		obj.menu.clear().show(event.sourceEvent.clientX - 90, event.sourceEvent.clientY)

		if (obj.mds && obj.mds.gene2mutcount) {
			obj.menu.d
				.append('div')
				.attr('class', 'sja_menuoption')
				.text('Recurrently mutated genes')
				.on('click', async () => {
					obj.menu.hide()
					await click_mutated_genes(obj, samples)
				})
		}

		for (const opt of obj.lasso.postSelectMenuOptions) {
			obj.menu.d
				.append('div')
				.attr('class', 'sja_menuoption')
				.text(opt.label) //'List samples')
				.on('click', async () => {
					obj.menu.hide()
					const arg = {
						samples,
						sample_attributes: obj.sample_attributes,
						sample2dot: obj.sample2dot
					}
					if (opt.callback == 'listSamples') printData(arg)
					else opt.callback(arg)
				})
		}

		/*obj.menu.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.text('List samples')
			.on('click', async () => {
				obj.menu.hide()
				const arg = {
					samples,
					sample_attributes: obj.sample_attributes,
					sample2dot: obj.sample2dot
				}
				printData(arg)
			})*/

		obj.menu.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.text('Cancel')
			.on('click', () => {
				// Reset all dots
				lasso
					.items()
					.classed('not_possible', false)
					.classed('possible', false)
					.attr('r', radius)
					.style('fill-opacity', '1')

				obj.menu.hide()
			})

		obj.menu.d
			.append('div')
			.style('padding', '10px')
			.style('font-size', '.8em')
			.style('width', '150px')
			.text(samples.length + ' samples selected')
	}
}

function printData(obj) {
	const { samples, sample_attributes, sample2dot } = obj

	// create header labels
	const label_keys = Object.keys(sample_attributes)
	let labels = label_keys.map(k => (sample_attributes[k].label ? sample_attributes[k].label : k))
	labels.unshift('Sample')
	const labels_str = labels.join('\t')
	const lst = [labels_str]

	// create rows for each sample
	for (const s of samples) {
		if (sample2dot.get(s).s) {
			let sample_row = []
			sample_row.push(s)
			for (const k of label_keys) sample_row.push(sample2dot.get(s).s[k])
			lst.push(sample_row.join('\t'))
		}
	}
	// create container with raw data
	client.export_data('List of selected samples', [{ text: lst.join('\n') }])
}

function click_mutated_genes(obj, samples) {
	obj.pane = client.newpane({ x: event.clientX, y: event.clientY })
	obj.pane.header.text('Recurrently Mutated Genes')
	obj.pane.wait = client.tab_wait(obj.pane.body)
	obj.pane.matrix_criteria_div = obj.pane.body.append('div')
	obj.pane.sample_matrix_div = obj.pane.body.append('div')
	init_mutation_type_control(obj, samples)
}

function init_mutation_type_control(obj, samples) {
	let mutTypes = [],
		defaultTypes = [],
		selectedTypes = [],
		selected_cnv,
		nGenes = 15

	const holder = obj.pane.matrix_criteria_div
	if (obj.mds.mutCountType) {
		mutTypes = obj.mds.mutCountType

		const non_cnv_types = mutTypes.filter(m => !m.db_col.includes('cnv'))
		const cnv_types = mutTypes.filter(m => m.db_col.includes('cnv'))
		const default_cnv = cnv_types.find(t => t.default)
		selected_cnv = default_cnv

		defaultTypes = mutTypes.filter(t => t.default).map(t => t.db_col)
		selectedTypes = [...defaultTypes]

		const buttonrow = holder.append('div').style('margin', '5px 20px')
		const criteria_div = holder
			.append('div')
			.style('margin', '5px 20px')
			.style('padding', '5px')
			.style('border-top', 'solid 1px #ededed')
			.style('border-bottom', 'solid 1px #ededed')
			.style('background-color', '#FCFBF7')
			.style('font-size', '.8em')

		// button to toggle criteria div
		buttonrow
			.append('span')
			.style('margin-right', '20px')
			.style('font-size', '.8em')
			.text('MUTATION COUNT & NO. OF GENE CRITERIA')
			.attr('class', 'sja_clbtext')
			.on('click', () => {
				if (criteria_div.style('display') == 'none') {
					client.appear(criteria_div)
				} else {
					client.disappear(criteria_div)
				}
			})

		// mutation type selection
		const mut_div = criteria_div.append('div')
		const mut_label_div = mut_div.append('div').style('display', 'table-cell').style('width', '110px')

		mut_label_div.append('div').text('Consequences').style('padding-right', '15px')

		const mut_types_div = mut_div.append('div').style('display', 'table-cell').style('border-left', 'solid 1px #ededed')

		non_cnv_types.forEach(type => {
			const m_div = mut_types_div.append('div')
			const checkbox = m_div
				.append('input')
				.attr('type', 'checkbox')
				.attr('name', 'mut_type')
				.attr('value', type.db_col)
				.style('margin', '3px')
				.style('margin-left', '4px')
				.property('checked', type.default)

			checkbox.on('change', () => {
				if (checkbox.node().checked) {
					selectedTypes.push(checkbox.node().value)
				} else {
					selectedTypes = selectedTypes.filter(t => t !== checkbox.node().value)
				}
			})

			m_div.append('label').attr('for', type.db_col).html(type.label)
		})

		const cnv_checkbox = mut_types_div
			.append('input')
			.attr('type', 'checkbox')
			.attr('name', 'noncnv')
			.attr('value', 'cnv')
			.style('margin', '3px')
			.style('margin-left', '4px')
			.property('checked', default_cnv ? true : false)
			.on('change', () => {
				if (cnv_checkbox.node().checked) {
					size_select.property('disabled', false)
					ratio_select.property('disabled', false)
				} else {
					size_select.property('disabled', true)
					ratio_select.property('disabled', true)
				}
			})

		mut_types_div.append('label').attr('for', 'cnv').text('CNV')

		const cnv_options_div = mut_types_div.append('div').style('display', 'block').style('padding', '3px 15px')

		const cnv_size_cutoff = [...new Set(cnv_types.map(t => t.sizecutoff))]
		const cnv_ratio_cutoff = [...new Set(cnv_types.map(t => t.log2cutoff))]

		cnv_options_div.append('label').attr('for', 'cnv_size').style('margin', '2px 10px').text('Size cutoff')

		const size_select = cnv_options_div.append('select').attr('name', 'cnv_size')

		cnv_size_cutoff.forEach(size => {
			size_select.append('option').attr('value', size).text(size)
		})

		size_select.property('selectedIndex', default_cnv.sizecutoff == '1Mb' ? 0 : default_cnv.sizecutoff == '2Mb' ? 1 : 2)

		cnv_options_div.append('label').attr('for', 'log2_ratio').style('margin', '2px 10px').text('log2(ratio) cutoff')

		const ratio_select = cnv_options_div.append('select').attr('name', 'log2_ratio')

		cnv_ratio_cutoff.forEach(ratio => {
			ratio_select.append('option').attr('value', ratio.toFixed(1)).text(ratio.toFixed(1))
		})

		ratio_select.property('selectedIndex', default_cnv.log2cutoff == 0.1 ? 0 : default_cnv.log2cutoff == 0.2 ? 1 : 2)

		// gene # selection for sample matrix
		const gene_div = criteria_div.append('div').style('padding-top', '10px')
		const gene_label_div = gene_div.append('div').style('display', 'table-cell').style('width', '110px')

		gene_label_div.append('div').text('No. of Genes').style('padding-right', '15px')

		const gene_n_select_div = gene_div
			.append('div')
			.style('display', 'table-cell')
			.style('padding', '3px')
			.style('border-left', 'solid 1px #ededed')

		const gene_n = [10, 15, 20, 30, 40]

		const gene_n_select = gene_n_select_div.append('select').attr('name', 'gene_n')

		gene_n.forEach(n => {
			gene_n_select.append('option').attr('value', n).text(n)
		})

		gene_n_select.property(
			'selectedIndex',
			gene_n.findIndex(n => n == nGenes)
		)

		const calc_btn = criteria_div
			.append('button')
			.style('margin', '10px')
			.style('padding', '3px 10px')
			// .property('disabled', selectedTypes.every(e => defaultTypes ? true : false)
			.text('Calculate')
			.on('click', () => {
				const checked_boxes = mut_types_div.node().querySelectorAll('input:checked')
				selectedTypes = []
				checked_boxes.forEach(checkbox => {
					if (checkbox.value !== 'cnv' && !selectedTypes.includes(checkbox.value)) selectedTypes.push(checkbox.value)
					else if (checkbox.value == 'cnv') {
						const selected_size = size_select.node().value
						const selected_ratio = ratio_select.node().value
						selected_cnv = cnv_types.find(t => t.sizecutoff == selected_size && t.log2cutoff == selected_ratio)
						selectedTypes.push(selected_cnv.db_col)
					}
				})
				nGenes = gene_n_select.node().value
				get_mutation_count_data(obj, samples, selectedTypes, nGenes)
				defaultTypes = [...selectedTypes]
			})
	} else defaultTypes = ['total']

	get_mutation_count_data(obj, samples, defaultTypes, nGenes)
}

async function get_mutation_count_data(obj, samples, selectedMutTypes, nGenes) {
	try {
		const arg = {
			genome: obj.genome.name,
			dslabel: obj.mds.label,
			samples,
			selectedMutTypes,
			nGenes
		}
		const data = await client.dofetch2('mdsgenecount', { method: 'POST', body: JSON.stringify(arg) })
		if (data.error) throw data.error
		if (!data.genes) throw '.genes missing'
		if (!data.genes.length) {
			obj.pane.wait.html('No gene retrived with mutations.')
			obj.pane.matrix_criteria_div.style('display', 'none')
			return
		}
		make_sample_matrix({ obj, genes: data.genes, samples, holder: obj.pane.body })
		obj.pane.wait.remove()
	} catch (e) {
		obj.pane.wait.text('Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

function make_sample_matrix(args) {
	const { obj, genes, samples } = args
	const holder = obj.pane.sample_matrix_div
	holder.selectAll('*').remove()
	// convert genes to features
	for (const g of genes) {
		g.ismutation = true
		g.genename = g.gene
		g.label = g.gene
		delete g.gene
		g.querykeylst = ['svcnv', 'snvindel'] // FIXME hardcoded
		obj.features_on_rows ? (g.height = 50) : (g.width = 50)
	}
	const arg = {
		genome: obj.genome,
		dslabel: obj.mds.label,
		features: genes,
		features_on_rows: obj.features_on_rows,
		ismutation_allsymbolic: true,
		hostURL: sessionStorage.getItem('hostURL') || '',
		limitbysamplesetgroup: { samples },
		jwt: sessionStorage.getItem('jwt') || '',
		holder: holder.append('div').style('margin', '20px')
	}

	import('./samplematrix').then(_ => {
		const m = new _.Samplematrix(arg)
		m._pane = holder
	})
}

function launch_singlesample(p) {
	const { obj, dot, sampletracks, holder } = p

	const arg = {
		genome: obj.genome,
		hostURL: sessionStorage.getItem('hostURL') || '',
		jwt: sessionStorage.getItem('jwt') || '',
		holder: holder,
		chr: obj.genome.defaultcoord.chr,
		start: obj.genome.defaultcoord.start,
		stop: obj.genome.defaultcoord.stop,
		nobox: 1,
		tklst: []
	}

	if (obj.tracks) {
		// quick fix for adding tracks to single-sample view
		for (const t of obj.tracks) arg.tklst.push(t)
	}

	// TODO general track in single-sample mode

	const mdstk = obj.mds.queries[obj.querykey] // TODO general track
	if (mdstk) {
		const tk = {
			singlesample: { name: dot.sample },
			mds: obj.mds,
			querykey: obj.querykey
		}
		for (const k in mdstk) {
			tk[k] = mdstk[k]
		}
		arg.tklst.push(tk)

		if (mdstk.checkexpressionrank) {
			const et = {
				type: client.tkt.mdsexpressionrank,
				name: dot.sample + ' gene expression rank',
				//mds: tk.mds,
				dslabel: obj.mds.label,
				querykey: mdstk.checkexpressionrank.querykey,
				sample: dot.sample
			}

			/*
			in what group to compare expression rank?
			use the last attr from svcnv track
			*/
			if (mdstk.groupsamplebyattr) {
				const lst = mdstk.groupsamplebyattr.attrlst
				if (lst && lst.length) {
					et.attributes = []

					for (const attr of lst) {
						et.attributes.push({
							k: attr.k,
							label: attr.label,
							kvalue: dot.s[attr.k]
						})
					}
				}
			}

			arg.tklst.push(et)
		}
	}

	if (sampletracks) {
		for (const t of sampletracks) arg.tklst.push(t)
	}

	client.first_genetrack_tolist(obj.genome, arg.tklst)
	blocklazyload(arg)
}

import * as client from './client'
import * as common from './common'
import { axisLeft, axisBottom } from 'd3-axis'
import { scaleLinear, scaleOrdinal, schemeCategory10 } from 'd3-scale'
import { select as d3select, selectAll as d3selectAll, event as d3event } from 'd3-selection'
import blocklazyload from './block.lazyload'

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
get_data()
finish_setup
init_dotcolor_legend
init_plot()
assign_color4dots
click_dot
launch_singlesample


*/

const radius = 3
const radius_tiny = 0.7

export async function init(obj, holder, debugmode) {
	/*
	holder
	genome
	dslabel

	*/

	if (debugmode) {
		window.obj = obj
	}

	obj.menu = new client.Menu({ padding: '5px' })
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
			.on('keyup', () => {
				const str0 = d3event.target.value
				if (!str0) {
					// reset
					obj.dotselection.transition().attr('r', radius)
					return
				}
				const str = str0.toLowerCase()
				obj.dotselection
					.filter(d => d.sample.toLowerCase().indexOf(str) != -1)
					.transition()
					.attr('r', radius * 2)
				obj.dotselection
					.filter(d => d.sample.toLowerCase().indexOf(str) == -1)
					.transition()
					.attr('r', 1)
			})
	}
	obj.legendtable = tr1td2.append('table').style('border-spacing', '5px')

	const scatterdiv = tr1td1.append('div').style('position', 'relative')

	obj.scattersvg = scatterdiv.append('svg')
	obj.scattersvg_resizehandle = scatterdiv.append('div')

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
	if (!ad) throw 'both .analysisdata{} and .dslabel are missing'
	if (ad.samples) {
		// list
		if (!Array.isArray(ad.samples)) throw '.analysisdata.samples is not array'
		obj.dots = ad.samples
		// may load from tabular data
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
			obj.dots_user.push(d)
		}
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
			const cf = scaleOrdinal(schemeCategory10)
			for (const k in a.values) {
				if (!a.values[k].color) a.values[k].color = cf(k)
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
				const cf = scaleOrdinal(schemeCategory10)
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

	const xscale = scaleLinear().domain([minx, maxx])
	const yscale = scaleLinear().domain([miny, maxy])

	let toppad = 30,
		bottompad = 50,
		leftpad = 100,
		rightpad = 30,
		vpad = 20,
		width = 800, // make automatic
		height = 800,
		fontsize = 18

	const svg = obj.scattersvg

	//const xaxisg = svg.append('g')
	//const yaxisg = svg.append('g')
	const dotg = svg.append('g').attr('transform', 'translate(' + (leftpad + vpad) + ',' + toppad + ')')

	const dots = dotg
		.selectAll()
		.data(obj.dots)
		.enter()
		.append('g')

	const circles = dots
		.append('circle')
		.attr('stroke', 'none')
		.attr('r', radius)
		.on('mouseover', d => {
			d3event.target.setAttribute('stroke', 'white')
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
			obj.tip.show(d3event.clientX, d3event.clientY)
		})
		.on('mouseout', d => {
			d3event.target.setAttribute('stroke', 'none')
			obj.tip.hide()
		})
		.on('click', d => {
			click_dot(d, obj)
		})

	obj.dotselection = circles

	let userdots, usercircles, userlabelg, userlabels
	if (obj.dots_user) {
		userdots = dotg
			.selectAll()
			.data(obj.dots_user)
			.enter()
			.append('g')
		usercircles = userdots
			.append('circle')
			.attr('stroke', 'none')
			.attr('fill', 'black')
			.attr('r', radius)
			.on('mouseover', d => {
				userlabels.filter(i => i.sample == d.sample).attr('font-weight', 'bold')
			})
			.on('mouseout', d => {
				userlabels.filter(i => i.sample == d.sample).attr('font-weight', 'normal')
			})
		userlabelg = dotg
			.selectAll()
			.data(obj.dots_user)
			.enter()
			.append('g')
		userlabels = userlabelg
			.append('text')
			.attr('font-size', fontsize)
			.text(d => d.sample)
			.on('mouseover', d => {
				usercircles.filter(i => i.sample == d.sample).attr('r', radius * 2)
				svg.style('cursor', 'move')
			})
			.on('mouseout', d => {
				usercircles.filter(i => i.sample == d.sample).attr('r', radius)
				svg.style('cursor', 'auto')
			})
			.on('mousedown', d => {
				d3event.preventDefault()
				const b = d3select(document.body)
				const x = d3event.clientX
				const y = d3event.clientY
				// <g> is movable
				const g = userlabelg.filter(i => i.sample == d.sample)
				const [x1, y1] = g
					.attr('transform')
					.match(/[\d\.]+/g)
					.map(Number)
				b.on('mousemove', () => {
					g.attr('transform', 'translate(' + (x1 + d3event.clientX - x) + ',' + (y1 + d3event.clientY - y) + ')')
				})
				b.on('mouseup', () => {
					b.on('mousemove', null).on('mouseup', null)
				})
			})
	}

	assign_color4dots(obj)

	function resize() {
		bottompad = width / 20 + 20
		svg.attr('width', leftpad + vpad + width + rightpad).attr('height', toppad + height + vpad + bottompad)
		//dotg
		xscale.range([0, width])
		yscale.range([height, 0])
		dots.attr('transform', d => 'translate(' + xscale(d.x) + ',' + yscale(d.y) + ')')
		if (userdots) {
			userdots.attr('transform', d => 'translate(' + xscale(d.x) + ',' + yscale(d.y) + ')')
			userlabelg
				.transition() // smooth motion of the text label
				.attr('transform', d => {
					const x = xscale(d.x),
						y = yscale(d.y)
					// check label width
					let lw
					userlabels
						.filter(i => i.sample == d.sample)
						.each(function() {
							lw = this.getBBox().width
						})
						.attr('text-anchor', x + lw >= width ? 'end' : 'start')
					return 'translate(' + x + ',' + y + ')'
				})
		}
		//circles.attr('r',radius)
	}
	resize()

	// drag resize
	obj.scattersvg_resizehandle
		.style('position', 'absolute')
		.style('right', '0px')
		.style('bottom', '0px')
		.attr('class', 'sja_clbtext')
		.text('drag to resize')
		.on('mousedown', () => {
			d3event.preventDefault()
			const b = d3select(document.body)
			const x = d3event.clientX
			const y = d3event.clientY
			const w0 = width
			const h0 = height
			b.on('mousemove', () => {
				width = w0 + d3event.clientX - x
				height = h0 + d3event.clientY - y
				resize()
			})
			b.on('mouseup', () => {
				b.on('mousemove', null).on('mouseup', null)
			})
		})
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
	const staydiv = obj.legendtable
		.append('tr')
		.append('td')
		.append('div')
		.style('position', 'relative')
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
		const L1div = scrolldiv.append('div').style('margin-top', '20px')
		L1div.append('div')
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
					o.dots = []
					L2.v2c.set(v, o)
				}
				L2.v2c.get(v).dots.push(d)
				if (L2.label) {
					L2.v2c.get(v).label = d.s[L2.label]
				}
			}
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
		scrolldiv
			.style('overflow-y', 'scroll')
			.style('height', '800px')
			.style('resize', 'vertical')
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

function click_dot(dot, obj) {
	/*
	clicking a dot to launch browser view of tracks from this sample
	*/
	if (!obj.dslabel) return

	const pane = client.newpane({ x: d3event.clientX, y: d3event.clientY })
	pane.header.text(dot.sample)

	const wait = pane.body
		.append('div')
		.style('margin', '20px')
		.text('Loading ...')

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

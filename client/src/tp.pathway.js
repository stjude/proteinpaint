import { select as d3select, selectAll as d3selectAll, pointer } from 'd3-selection'
import { pie as d3pie, arc as d3arc } from 'd3-shape'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { pack as d3pack, hierarchy as d3hierarchy } from 'd3-hierarchy'
import * as d3drag from 'd3-drag'
import * as d3force from 'd3-force'
import * as common from '#shared/common.js'
import * as client from './client'
import { Menu } from '../dom/menu'

const tip = new Menu()

export default function (cohort, folder) {
	const dslst = []
	for (const n in cohort.dsset) {
		const ds = cohort.genome.datasets[n]
		if (!ds) {
			folder.text('error: dataset not found by name ' + n)
			return
		}
		dslst.push(ds)
	}
	const config = {
		geneToUpper: cohort.geneToUpper
	}
	if (cohort.diseasecolor) {
		config.diseasecolor = cohort.diseasecolor
	}

	if (cohort.genenetwork && cohort.genenetwork.list) {
		// pre-configured network
		// use only first dataset FIXME
		const ds = dslst[0]
		for (const network of cohort.genenetwork.list) {
			const holder = folder
				.append('div')
				.style('display', 'inline-block')
				.style('margin', '10px')
				.style('border', 'solid 1px #ccc')
			holder
				.append('div')
				.style('background-color', '#f1f1f1')
				.style('padding', '5px 10px')
				.text(network.name || 'network.name is undefined')
			const div = holder.append('div').style('margin', '10px')
			prepdata(ds, network, div, cohort)
		}
		return
	}
	for (const ds of dslst) {
		const holder = folder.append('div').style('margin', '10px')
		if (dslst.length > 1) {
			holder.style('border', 'solid 1px #ccc')
			holder.append('div').style('padding', '5px').style('background-color', '#ededed').text(ds.label)
		}
		const table = holder.append('table')
		const tr = table.append('tr')
		const td1 = tr.append('td').style('vertical-align', 'top')
		const td2 = tr.append('td').style('vertical-align', 'top')
		const row1 = td1.append('div').style('margin-bottom', '5px')
		row1
			.append('button')
			.text('Submit')
			.style('margin-right', '3px')
			.on('click', () => {
				prepdata_input(ds, input, td2, config)
			})
		row1
			.append('button')
			.text('Clear')
			.style('margin-right', '10px')
			.on('click', () => {
				input.node().value = ''
			})
		row1
			.append('a')
			.text('Help')
			.attr('href', 'https://docs.google.com/document/d/1PAlu-bJMBuHRVpGhB_eVaOmlhhbWneC_94_7RRItuA8/edit?usp=sharing')
			.attr('target', '_blank')
		const input = td1.append('textarea').attr('rows', 10).attr('cols', 20).attr('placeholder', 'enter pathway schema')
	}
}

function prepdata_input(ds, input, holder, config) {
	const text = input.node().value
	if (text == '') return
	let json
	try {
		json = JSON.parse(text)
	} catch (e) {
		holder.text('Invalid JSON')
		console.log(e)
		return
	}
	prepdata(ds, json, holder, config)
}

function prepdata(ds, json, holder, config) {
	const err = m => holder.html('<span style="color:red">' + m + '</span>')
	if (!json.nodes) return err('.nodes missing')
	if (!Array.isArray(json.nodes)) return err('.nodes should be an array')
	if (json.nodes.length == 0) return err('no nodes')
	const nodeid = new Map()
	for (const node of json.nodes) {
		if (!node.id) return err('.id missing for node ' + JSON.stringify(node))
		if (nodeid.has(node.id)) return err('duplicating node id: ' + node.id)
		nodeid.set(node.id, 1)
		const root = {
			name: node.name || 'nameless',
			children: [],
			node: node // refer to force-laying node
		}
		if (node.gene) {
			root.children.push({
				gene: node.gene
			})
		} else if (node.geneset) {
			// recursive structure
			root.children = node.geneset
		}
		const root2 = d3hierarchy(root)
		let genecount = 0
		for (const gene of root2.leaves()) {
			if (!gene.data.gene) return err('a gene has no gene name in node ' + JSON.stringify(node))
			genecount++
		}
		if (genecount == 0) return err('no gene in node ' + JSON.stringify(node))
		delete node.gene
		delete node.geneset
		node.root = root2
	}
	if (!json.links) return err('.links missing')
	if (!Array.isArray(json.links)) return err('.links should be an array')
	for (const link of json.links) {
		if (!link.source) return err('.source missing from a link ' + JSON.stringify(link))
		if (!nodeid.has(link.source)) return err('invalid "source" node in link ' + JSON.stringify(link))
		if (!link.target) return err('.target missing from a link ' + JSON.stringify(link))
		if (!nodeid.has(link.target)) return err('invalid "target" node in link ' + JSON.stringify(link))
	}
	holder.text('')
	makegraph(ds, json, holder, config)
}

function makegraph(ds, json, holder, config) {
	let diseasecolor
	if (config.diseasecolor) {
		const lst1 = [],
			lst2 = []
		for (const n in config.diseasecolor) {
			lst1.push(n)
			lst2.push(config.diseasecolor[n])
		}
		diseasecolor = scaleOrdinal().domain(lst1).range(lst2)
	} else {
		console.log('using hardcoded target color') //////////////////
		////////////////////
		/* hard coded diseases for pan-target study

			"AML":"#dc5ce2",
			"NBL":"#ff1111",
			"TALL":"#ffa500",
			"BALL":"#1f78b4",
			"WT":"#3e8320",
			"OS":"#6a3d9a"
		*/ diseasecolor = scaleOrdinal()
			.domain(['AML', 'NBL', 'TALL', 'BALL', 'WT', 'OS'])
			.range(['#dc5ce2', '#ff1111', '#ffa500', '#1f78b4', '#3e8320', '#6a3d9a'])
	}
	// getting data, mlst
	for (const node of json.nodes) {
		for (const gene of node.root.leaves()) {
			gene.datasize = 0
			const genename = config.geneToUpper ? gene.data.gene.toUpperCase() : gene.data.gene
			const mlst = ds.bulkdata[genename]
			if (mlst) {
				if (ds.hasdisease && ds.hassample) {
					// disease as pie
					// sample # as pie size
					const sampleset = new Set()
					const disease2sset = new Map()
					for (const m of mlst) {
						if (!m.disease) continue
						if (!m.sample) continue
						sampleset.add(m.sample)
						if (!disease2sset.has(m.disease)) {
							disease2sset.set(m.disease, new Set())
						}
						disease2sset.get(m.disease).add(m.sample)
					}
					const piedata = []
					for (const [diseasename, sset] of disease2sset) {
						piedata.push({
							name: diseasename,
							color: diseasecolor(diseasename),
							size: sset.size
						})
					}
					gene.pie = d3pie().value(d => d.size)(piedata)
					// !!!! somehow the value must be set to gene.data
					// won't work if set to gene.value
					gene.datasize = sampleset.size
				} else if (ds.hassample) {
					// mclass as pie
					// sample # as pie size
					const sampleset = new Map()
					const mclass2sset = new Map()
					for (const m of mlst) {
						if (!m.sample) continue
						if (!m.class) continue
						sampleset.set(m.sample, 1)
						if (!mclass2sset.has(m.class)) {
							mclass2sset.set(m.class, new Map())
						}
						mclass2sset.get(m.class).set(m.sample, 1)
					}
					const piedata = []
					for (const [cls, sset] of mclass2sset.entries()) {
						piedata.push({
							name: common.mclass[cls].label,
							color: common.mclass[cls].color,
							size: sset.size
						})
					}
					gene.pie = d3pie().value(d => d.size)(piedata)
					// !!!! somehow the value must be set to gene.data
					// won't work if set to gene.value
					gene.datasize = sampleset.size
				} else {
					// mclass as pie
					const mclass2count = new Map()
					for (const m of mlst) {
						if (!m.class) continue
						if (!mclas2count.has(m.class)) {
							mclass2count.set(m.class, 0)
						}
						mclass2count.set(m.class, mclass2count.get(m.class) + 1)
					}
					const piedata = []
					for (const [cls, size] of mclass2count.entries()) {
						piedata.push({
							name: common.mclass[cls].label,
							color: common.mclass[cls].color,
							size: size
						})
					}
					gene.pie = d3pie().value(d => d.size)(piedata)
					gene.datasize = mlst.length
				}
			}
		}
	}
	// gene value for deciding pie radius
	let minvalue = 9999,
		maxvalue = 0
	for (const node of json.nodes) {
		for (const d of node.root.leaves()) {
			if (d.datasize) {
				minvalue = Math.min(minvalue, d.datasize)
				maxvalue = Math.max(maxvalue, d.datasize)
			}
		}
	}
	const value2pieradius = scaleLinear().domain([minvalue, maxvalue])

	holder
		.append('div')
		.append('button')
		.text('Snapshot')
		.on('click', () => {
			client.to_svg(svg.node(), 'pathway')
		})
	const svg = holder.append('svg')
	/*
	const resize=svg.append('text')
		.text('drag to resize')
		.attr('class','sja_clbtext')
		.attr('text-anchor','end')
		.attr('font-size',12)
		.attr('font-family',client.font)
		.attr('fill','black')
		.on('mousedown',(event)=>{
			event.preventDefault()
			const x0=event.clientX
			const y0=event.clientY
			const body=d3select(document.body)
			const width0=width, height0=height
			body.on('mousemove',()=>{
				width=width0+event.clientX-x0
				height=height0+event.clientY-y0
				render(true)
			})
			body.on('mouseup',()=>{
				body.on('mousemove',null).on('mouseup',null)
			})
		})
		*/

	const defs = svg.append('svg:defs')
	defs
		.append('svg:marker')
		.attr('id', 'arrowactivate')
		.attr('viewBox', '0 -5 10 10')
		.attr('refX', 9)
		.attr('refY', 0)
		.attr('markerWidth', 6)
		.attr('markerHeight', 6)
		.attr('orient', 'auto')
		.append('svg:path')
		.attr('d', 'M0,-5L10,0L0,5')
	defs
		.append('svg:marker')
		.attr('id', 'arrowinhibit')
		.attr('viewBox', '0 -5 10 10')
		.attr('refX', 2)
		.attr('refY', 0)
		.attr('markerWidth', 6)
		.attr('markerHeight', 6)
		.attr('orient', 'auto')
		.append('rect')
		.attr('y', -5)
		.attr('width', 2)
		.attr('height', 10)
		.attr('fill', 'red')

	const legend = svg.append('g')

	// link lines
	const linkg = svg.selectAll().data(json.links).enter().append('line')
	linkg
		.attr('stroke', d => (d.inhibit ? 'red' : 'black'))
		.attr('stroke-width', '2')
		.attr('marker-end', d => (d.inhibit ? 'url(#arrowinhibit)' : 'url(#arrowactivate)'))

	// force nodes
	const node1g = svg
		.selectAll()
		.data(json.nodes)
		.enter()
		.append('g')
		.each(function (d) {
			d.nodeg = this
		})

	// pack nodes
	for (const node of json.nodes) {
		// all elements are relative to node1g, position defined by render(packing())
		node.pack = {}
		node.pack.gs = d3select(node.nodeg).selectAll().data(node.root.descendants()).enter().append('g')
		node.pack.circle = node.pack.gs.append('circle').attr('fill', d => {
			if (!d.parent) {
				// root
				if (d.children.length == 1) {
					// this removes gray circle background for nodes with a single gene
					return 'none'
				}
				return '#ededed'
			}
			if (!d.children) {
				// leaf
				return 'none'
			}
			return 'none'
		})
		/*
			no border

			.attr('stroke',d=>{
				if(!d.parent) {
					return 'none'
				}
				return '#ccc'
			})
			*/

		node.pack.pie = node.pack.gs
			.filter(d => !d.children && d.pie)
			.selectAll()
			.data(d => d.pie)
			.enter()
			.append('path')
			.attr('fill', d => d.data.color)
	}
	for (const node of json.nodes) {
		// put label on top of all circles and pies
		node.pack.gs
			.filter(d => !d.children)
			.each(d => {
				d.textlabel = d3select(node.nodeg)
					.append('text')
					.attr('class', 'sja_clbtext')
					.text(d.data.gene)
					.attr('font-family', client.font)
					.attr('text-anchor', 'middle')
					//.attr('dominant-baseline','central')
					.attr('fill', 'black')
					.call(d3drag.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended))
					.on('mouseover', event => {
						tip.clear().show(event.clientX + 20, event.clientY + 20)
						const div = tip.d
						div.append('div').text(d.data.gene).style('font-weight', 'bold').style('margin', '10px')
						const p = div.append('div').style('margin', '10px')
						if (d.datasize) {
							p.text('In ' + d.datasize + ' sample' + (d.datasize > 1 ? 's' : ''))
						} else {
							p.text('No sample')
						}
						if (d.pie) {
							const p = div.append('div').style('margin', '10px')
							d.pie.sort((a, b) => b.data.size - a.data.size)
							for (const pie of d.pie) {
								p.append('div')
									.style('margin', '3px 0px')
									.html(
										'<span style="background-color:' +
											pie.data.color +
											'">&nbsp;&nbsp;&nbsp;</span> ' +
											pie.data.name +
											' ' +
											pie.data.size
									)
							}
						}
					})
					.on('mouseout', () => {
						tip.hide()
					})
			})
	}

	let width = 800,
		height = 800

	const simulation = d3force
		.forceSimulation(json.nodes)
		.force(
			'link',
			d3force
				.forceLink()
				.id(d => d.id)
				.links(json.links)
			//.distance(50)
			//.strength(1)
		)
		.force(
			'charge',
			d3force.forceManyBody().strength(() => -1000)
			//.distanceMax(100)
		)
		.force('x', d3force.forceX())
		.force('y', d3force.forceY())
		.alphaDecay(0.1)
	//.velocityDecay(.8)
	//.on('end',()=>simuend())

	render()
	//window.json=json

	function render(restart) {
		const wh = Math.min(width, height)
		const pieminr = Math.min(5, wh / 50)
		const piemaxr = Math.min(50, wh / 20)

		value2pieradius.range([Math.pow(pieminr, 2), Math.pow(piemaxr, 2)])
		for (const node of json.nodes) {
			for (const gene of node.root.leaves()) {
				if (gene.datasize) {
					gene.pieradius = Math.sqrt(value2pieradius(gene.datasize))
				} else {
					gene.pieradius = 0
				}
			}
		}

		const fontsize = Math.min(20, wh / 40)
		const maxtextwidth = piemaxr * 1.5

		// leaf labels
		for (const node of json.nodes) {
			node.pack.gs
				.filter(d => !d.children)
				.each(d => {
					d.textlabel
						.attr('font-size', fontsize)
						.each(function () {
							let labelwidth = this.getBBox().width
							if (labelwidth > maxtextwidth) {
								labelwidth = maxtextwidth
								//this.setAttribute('font-size',1)
								this.setAttribute('font-size', maxtextwidth / this.getBBox().width)
							}
							this.setAttribute('font-size', 17) // XXX
							d.data.value = Math.max(labelwidth / 2, d.pieradius)
						})
						.attr('dominant-baseline', () => {
							if (d.pieradius == 0) {
								// empty, no pie
								return 'central'
							}
							return 'hanging'
						})
					// will set text y position in ticked()
				})
		}

		for (const node of json.nodes) {
			node.root.sum(d => d.value)
			d3pack().radius(d => d.data.value)(node.root)
			node.pack.circle
				.attr('r', d => d.r)
				.filter(d => !d.children && d.pie)
				.each(d => {
					for (const pie of d.pie) pie.data.r = d.pieradius
				})
			node.pack.pie.attr('d', d => {
				return d3arc()({ innerRadius: 0, outerRadius: d.data.r, startAngle: d.startAngle, endAngle: d.endAngle })
			})
		}
		simulation.force('center', d3force.forceCenter(width / 2, height / 2)).force(
			'collision',
			d3force
				.forceCollide()
				.radius(d => {
					return d.root.r + Math.max(20, d.root.r * 0.3)
				})
				.strength(0.9)
		)
		simulation.on('tick', simuend)
		svg.attr('width', width).attr('height', height)
		//resize.attr('x',width-2).attr('y',height-4)
		legend.selectAll('*').remove()
		let y = 0,
			pad = 3
		legend
			.append('text')
			.attr('font-size', fontsize)
			.attr('font-family', client.font)
			.attr('y', fontsize)
			.text('Sample number')
		y += fontsize + pad
		legend
			.append('circle')
			.attr('cx', pieminr)
			.attr('cy', y + pieminr)
			.attr('r', pieminr)
			.attr('fill', '#ccc')
		legend
			.append('text')
			.attr('x', pieminr * 2 + pad)
			.attr('font-size', fontsize)
			.attr('font-family', client.font)
			.attr('y', y + pieminr)
			.attr('dominant-baseline', 'central')
			.text(minvalue)
		y += Math.max(fontsize, pieminr * 2) + pad
		legend
			.append('circle')
			.attr('cx', piemaxr)
			.attr('cy', y + piemaxr)
			.attr('r', piemaxr)
			.attr('fill', '#ccc')
		legend
			.append('text')
			.attr('x', piemaxr * 2 + pad)
			.attr('font-size', fontsize)
			.attr('font-family', client.font)
			.attr('y', y + piemaxr)
			.attr('dominant-baseline', 'central')
			.text(maxvalue)
		y += Math.max(fontsize, piemaxr * 2) + pad
		if (ds.hasdisease) {
			for (const diseasename of diseasecolor.domain()) {
				legend
					.append('circle')
					.attr('cx', fontsize)
					.attr('cy', y + fontsize / 2)
					.attr('r', fontsize / 2)
					.attr('fill', diseasecolor(diseasename))
				legend
					.append('text')
					.attr('x', fontsize * 2 + pad)
					.attr('font-size', fontsize)
					.attr('font-family', client.font)
					.attr('y', y + fontsize / 2)
					.attr('dominant-baseline', 'central')
					.text(diseasename)
				y += fontsize + pad
			}
		}

		if (restart) {
			simulation.restart()
		}
	}

	function ticked() {
		linkg
			.each(d => (d.linelen = Math.sqrt(Math.pow(d.source.x - d.target.x, 2) + Math.pow(d.source.y - d.target.y, 2))))
			.attr('x1', d => {
				const r = d.source.root.r
				return d.source.x + ((d.target.x - d.source.x) * r) / d.linelen
			})
			.attr('y1', d => {
				const r = d.source.root.r
				return d.source.y + ((d.target.y - d.source.y) * r) / d.linelen
			})
			.attr('x2', d => {
				const r = d.target.root.r
				return d.source.x + ((d.target.x - d.source.x) * (d.linelen - r - 5)) / d.linelen
			})
			.attr('y2', d => {
				const r = d.target.root.r
				return d.source.y + ((d.target.y - d.source.y) * (d.linelen - r - 5)) / d.linelen
			})
		//node1g.attr('transform',d=>'translate('+(d.x-d.root.r)+','+(d.y-d.root.r)+')')
		node1g.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
		for (const node of json.nodes) {
			node.pack.gs.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
			// adjust gene label position
			// gene labels were attached to node.pack.gs
			// must be shifted by d.x d.y
			node.pack.gs
				.filter(d => !d.children)
				.each(d => {
					d.textlabel.attr('x', d.x).attr('y', d.y + d.pieradius)
				})
		}
	}

	function dragstarted(event, d) {
		/*
		const lst=d.ancestors()
		d=lst[lst.length-1].data.node
		*/
		if (!event.active) simulation.alphaTarget(0.1).restart()
		d.fx = d.x
		d.fy = d.y
	}
	function dragged(event, d) {
		/*
		const lst=d.ancestors()
		d=lst[lst.length-1].data.node
		*/
		const p = pointer(event, this)
		d.fx = p[0]
		d.fy = p[1]
	}
	function dragended(event, d) {
		if (!event.active) simulation.alphaTarget(0)
		/*
		const lst=d.ancestors()
		d=lst[lst.length-1].data.node
		*/
		d.fx = null
		d.fy = null
	}
	function simuend() {
		let x1 = 0,
			y1 = 0,
			x2 = 0,
			y2 = 0
		for (const node of json.nodes) {
			x1 = Math.min(x1, node.x - node.root.r)
			y1 = Math.min(y1, node.y - node.root.r)
			x2 = Math.max(x2, node.x + node.root.r - width)
			y2 = Math.max(y2, node.y + node.root.r - height)
		}
		width = width - x1 + x2
		height = height - y1 + y2
		for (const node of json.nodes) {
			node.x -= x1
			node.y -= y1
		}
		simulation
			.force('center')
			.x(width / 2)
			.y(height / 2)
		svg.attr('width', width).attr('height', height)
		ticked()
	}
}

import { scaleLinear, scaleLog, scaleOrdinal } from 'd3-scale'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'
import { axisTop } from 'd3-axis'
import { select as d3select, pointer as d3pointer } from 'd3-selection'
import { hierarchy, stratify } from 'd3-hierarchy'
import * as client from './client'
import { burst } from './ep.sun'
import { newboxplot, boxplotremove } from './ep.boxplot'
import { stratinput } from '#shared/tree.js'

/*
launch epaint

replace-by-mds

dotplot: serverside rendering
boxplot: server computed
histogram: server computed

*/

const minwidth = 300,
	maxwidth = 500,
	minheight = 400,
	maxheight = 700

// circle stroke opacity
const hl_strokeopacity = 0.6
const normal_strokeopacity = 0.2

export default class EPaint {
	constructor(arg) {
		/*
arg
.data[{}]
.expp{}
	.cohort
		optional
.genename
.presize
	.x
	.y
	.width
	.height
.block
	optional

.dsname str
.genome str
	optional
	if both provided, will enable gene search box

.hostURL
.samplecart
*/

		this.p = arg.expp

		if (this.p.cohort) {
			if (!this.p.cohort.suncolor) {
				this.p.cohort.suncolor = scaleOrdinal(schemeCategory20)
			}
		}
		this.boxcolor = '#006600'
		this.boxplots = []
		this.const_all = 'All ' + this.p.sampletype + 's'
		this.uselog = false
		this.dotmoved = false
		this.genename = arg.genename
		this.presize = arg.presize

		this.dsname = arg.dsname // both optional, if provided, will enable gene search
		this.genome = arg.genome

		this.hostURL = arg.block ? arg.block.hostURL : arg.hostURL
		this.samplecart = arg.samplecart
		if (arg.block) {
			// ep opened along with dstk has .block
			// subsequently opened ones hasn't
			const p = arg.block.holder.node().getBoundingClientRect()
			this.presize = {
				x: p.left + arg.block.leftheadw + arg.block.width + 20,
				y: p.top,
				width: Math.min(maxwidth, Math.max(minwidth, document.body.scrollWidth - p.left - p.width - 100)),
				height: Math.min(maxheight, Math.max(minheight, document.body.clientHeight - 270))
			}
		}
		this.source = arg.source
		this.data = arg.data
		this.data.sort((a, b) => b.value - a.value)
		this.minvalue = 0
		this.maxvalue = 0
		if (this.data.length > 0) {
			this.minvalue = this.maxvalue = this.data[0].value
		}
		// data sorted by value, get median
		this.sampletype2value = {}
		// key: sample name, val: numeric value, for highlight effect when mouse over skewer-disc
		for (const d of this.data) {
			const v = d.value
			this.minvalue = Math.min(this.minvalue, v)
			this.maxvalue = Math.max(this.maxvalue, v)
			this.sampletype2value[d[this.p.sampletype]] = v
		}
		if (this.p.scaleminvalue != undefined) {
			this.minvalue = this.p.scaleminvalue
		}

		this.pane = client.newpane({
			x: this.presize.x,
			y: this.presize.y
		})

		/*
	add a new class for identifying such panes
	so that next time user search for a gene (click callback on search box), the first instance of such pane will be removed
	*/
		this.pane.pane.classed('sja_ep_pane', true)

		// tooltip must be created after .pane
		this.dottip = new client.Menu({ padding: '10px' })

		if (arg.block) {
			const closebut = d3select(this.pane.header.node().previousSibling)
			// by closing, will fold to handle of ds
			closebut.on('click', () => {
				this.epaintfold(arg.block)
			})
		}

		this.pane.body.style('padding', '10px')

		const error = m => {
			this.pane.body.append('p').text(m)
		}

		if (this.data.length == 0) {
			this.pane.header.text(this.p.name)
			error('No expression data for ' + this.genename)
			return
		}

		// header
		this.pane.header.text(this.genename + ' ' + this.p.name + (this.dsname ? ' from ' + this.dsname : ''))

		makeButtons(this)

		// underneath button row
		this.treediv = this.pane.body
			.append('div')
			.style('display', 'none')
			.style('margin', '20px 0px 30px 0px')
			.style('padding', '10px')
			.style('background-color', '#FFFFE8')
		this.treediv
			.append('div')
			.style('font-size', '.7em')
			.style('color', '#858585')
			.style('text-align', 'center')
			.text('Click on a row to show/hide boxplot')

		this.svg = this.pane.body.append('svg')

		// may show select sample button
		if (this.samplecart) {
			// api effective
			// append the selection button which will be displayed when dragged on grabbar
			this.samplecartWrapper = this.pane.body.append('div')
			this.samplecart.setBtns({
				samplelst: this.grab && this.grab.selectedsamples ? this.grab.selectedsamples : [],
				basket: 'Gene Expression',
				id: this.genename + (!this.grab ? '' : ' FPKM:' + this.grab.min + '-' + this.grab.max),
				container: this.samplecartWrapper,
				reselectable: true,
				replaceable: false
			})
		}

		// resize button
		this.pane.body
			.append('div')
			.style('text-align', 'right')
			.append('span')
			.text('drag to resize')
			.attr('font-size', '.8em')
			.attr('font-family', client.font)
			.attr('class', 'sja_clbtext')
			.on('mousedown', event => {
				event.preventDefault()
				const x = event.clientX
				const y = event.clientY
				const width = this.width
				const height = this.height
				const b = d3select(document.body)
				b.on('mousemove', e2 => {
					this.render(width + e2.clientX - x, height + e2.clientY - y)
				})
				b.on('mouseup', () => {
					b.on('mousemove', null).on('mouseup', null)
				})
			})

		this.sf_boxheight = scaleLinear().domain([0, this.data.length])
		this.sf_boxlabelfontsize = scaleLinear()
		this.boxplots = []
		if (this.svgg) {
			this.svgg.remove()
		}
		this.svgg = this.svg.append('g')
		this.axisg = this.svgg.append('g')
		this.grabbar = this.svgg
			.append('rect')
			.attr('x', 0)
			.attr('y', 0)
			.attr('fill', 'white')
			.attr('fill-opacity', 0)
			.on('mousedown', event => {
				if (!this.p.cohort) {
					console.log('no .p.cohort')
					return
				}

				this.busy = true
				const x = d3pointer(event, this.grabbar.node())[0]
				const val1 = Number.parseFloat(this.x_scale.invert(x).toFixed(1))
				this.grab.x = x
				this.grab.width = 1
				this.grab.shade.attr('transform', 'translate(' + x + ',' + this.grab.y + ')')
				this.grab.shadebox
					.attr('width', 2)
					.attr('height', this.grab.height)
					.attr('stroke-opacity', 0.7)
					.attr('fill-opacity', 0.1)
				this.grab.shadehandle1.attr('fill-opacity', 0.5)
				this.grab.shadehandle2.attr('x', 2).attr('fill-opacity', 0.5)
				burst(this, val1, Number.parseFloat(this.x_scale.invert(x + 1).toFixed(1)))
				const b = d3select(document.body)
				b.on('mousemove', event => {
					event.preventDefault()
					let x2 = d3pointer(event, this.grabbar.node())[0]
					x2 = Math.max(-this.dotsize, x2)
					x2 = Math.min(this.width + this.dotsize, x2)
					this.grab.width = Math.max(1, Math.abs(x2 - x))
					this.grab.shadebox.attr('width', this.grab.width)
					this.grab.shadehandle2.attr('x', this.grab.width)
					if (x2 < x) {
						this.grab.x = x2
						this.grab.shade.attr('transform', 'translate(' + this.grab.x + ',' + this.grab.y + ')')
					}
					burst(this, val1, Number.parseFloat(this.x_scale.invert(x2).toFixed(1)))
				})
				b.on('mouseup', () => {
					this.busy = false
					b.on('mousemove', null).on('mouseup', null)
				})
			})
		this.verticalline = this.svgg
			.append('line')
			.attr('stroke', this.boxcolor)
			.attr('stroke-opacity', 0.1)
			.attr('shape-rendering', 'crispEdges')
		this.dur = 2000
		// bag of box at background
		this.boxbag = this.svgg.append('g')
		// graph of dots in middle
		this.graph = this.svgg.append('g')
		// sunburst at foreground
		this.sung = this.svgg.append('g')
		this.grab = {
			shade: this.sung.append('g'),
			holder: this.sung.append('g')
		}

		this.grab.shadebox = this.grab.shade
			.append('rect')
			.attr('stroke', this.p.hlcolor)
			.attr('stroke-width', 1)
			.attr('fill', this.p.hlcolor)
			.style('cursor', 'move')
			.on('mousedown', event => {
				if (!this.p.cohort) {
					// no cohort, do not show sunburst
					return
				}
				this.busy = true
				let x = event.clientX
				const b = d3select(document.body)
				b.on('mousemove', event => {
					event.preventDefault()
					const x2 = event.clientX
					this.grab.x += x2 - x
					x = x2
					this.grab.shade.attr('transform', 'translate(' + this.grab.x + ',' + this.grab.y + ')')
					burst(
						this,
						Number.parseFloat(this.x_scale.invert(this.grab.x).toFixed(1)),
						Number.parseFloat(this.x_scale.invert(this.grab.x + this.grab.width).toFixed(1))
					)
				}).on('mouseup', () => {
					this.busy = false
					b.on('mousemove', null).on('mouseup', null)
				})
			})
		this.grab.shadehandle1 = this.grab.shade
			.append('rect')
			.attr('x', -5)
			.attr('width', 5)
			.attr('height', 40)
			.attr('fill', this.p.hlcolor)
			.attr('fill-opacity', 0)
			.style('cursor', 'ew-resize')
			.on('mousedown', event => {
				this.busy = true
				let x = event.clientX
				const b = d3select(document.body)
				b.on('mousemove', event => {
					event.preventDefault()
					const x2 = event.clientX
					this.grab.width += x - x2
					if (this.grab.width <= 0) {
						this.grab.width -= x - x2
						return
					}
					this.grab.x += x2 - x
					x = x2
					this.grab.shade.attr('transform', 'translate(' + this.grab.x + ',' + this.grab.y + ')')
					this.grab.shadebox.attr('width', this.grab.width)
					this.grab.shadehandle2.attr('x', this.grab.width)
					burst(
						this,
						Number.parseFloat(this.x_scale.invert(this.grab.x).toFixed(1)),
						Number.parseFloat(this.x_scale.invert(this.grab.x + this.grab.width).toFixed(1))
					)
				}).on('mouseup', () => {
					this.busy = false
					b.on('mousemove', null).on('mouseup', null)
				})
			})
		this.grab.shadehandle2 = this.grab.shade
			.append('rect')
			.attr('x', 0)
			.attr('width', 5)
			.attr('height', 40)
			.attr('fill', this.p.hlcolor)
			.attr('fill-opacity', 0)
			.style('cursor', 'ew-resize')
			.on('mousedown', event => {
				let x = event.clientX
				const b = d3select(document.body)
				b.on('mousemove', event => {
					event.preventDefault()
					const x2 = event.clientX
					this.grab.width += x2 - x
					if (this.grab.width <= 0) {
						this.grab.width -= x2 - x
						return
					}
					x = x2
					this.grab.shadebox.attr('width', this.grab.width)
					this.grab.shadehandle2.attr('x', this.grab.width)
					burst(
						this,
						Number.parseFloat(this.x_scale.invert(this.grab.x).toFixed(1)),
						Number.parseFloat(this.x_scale.invert(this.grab.x + this.grab.width).toFixed(1))
					)
				}).on('mouseup', () => {
					this.busy = false
					b.on('mousemove', null).on('mouseup', null)
				})
			})
		// dots
		this.epdotg = this.graph.selectAll().data(this.data).enter().append('g')
		this.epdot = this.epdotg
			.append('circle')
			.attr('fill', this.p.hlcolor)
			.attr('fill-opacity', 0)
			.attr('stroke', 'black')
			.attr('stroke-width', 2)
			.attr('stroke-opacity', normal_strokeopacity)
			.each(function (d) {
				d.circle = this
			})
			.on('mouseover', (event, d) => {
				if (this.busy) return
				d.circle.setAttribute('transform', 'scale(1.5)')
				this.dottip.clear()
				const lst = [
					{
						k: this.p.datatype,
						v: '<span style="font-size:150%">' + d.value + '</span>'
					}
				]
				if (this.p.attrlst) {
					for (const a of this.p.attrlst) {
						lst.push({
							k: a.label || a.k,
							v: d[a.k]
						})
					}
				}
				const cangetmore = this.getsampleinfo(d, lst)
				client.make_table_2col(this.dottip.d, lst).style('zoom', 0.7)
				this.dottip.show(event.clientX, event.clientY)

				if (cangetmore) {
					// more info available from cohort.annotation
					this.dottip.d
						.append('div')
						.text('Full details')
						.attr('class', 'sja_menuoption')
						.on('click', () => {
							samplefulldetail(d, this.p.cohort, event.clientX - 100, event.clientY - 100)
						})
				}
			})
			.on('mouseout', (event, d) => {
				d.circle.setAttribute('transform', 'scale(1)')
			})
			.on('mousedown', (event, d) => {
				event.preventDefault()
				const y0 = event.clientY
				const b = d3select(document.body)
				const median = this.data[Math.floor(this.data.length / 2)].value
				if (d.value < median) {
					// shift
					const inity = this.dotgraph_y
					b.on('mousemove', event => {
						this.busy = true // must set it here so not busy for click
						this.dotmoved = true
						this.dotgraph_y = inity + event.clientY - y0
						this.graph.attr('transform', 'translate(0,' + this.dotgraph_y + ')')
					})
				} else {
					// lengthen
					const inith = this.heightmove
					b.on('mousemove', event => {
						this.dotmoved = true
						this.heightmove = inith + y0 - event.clientY
						const rowheight = this.heightmove / this.data.length
						this.epdotg.attr('transform', (d, i) => {
							d._y = this.height - this.heightmove + i * rowheight
							return 'translate(' + Math.max(0, this.x_scale(d.value)) + ',' + d._y + ')'
						})
					})
				}
				b.on('mouseup', () => {
					setTimeout(() => (this.busy = false), 50)
					b.on('mousemove', null).on('mouseup', null)
				})
			})
		//.on('click',d=>{ })

		this.render()
		const allsamplerow = this.treediv
			.append('div')
			.style('margin', '10px')
			.style('padding', '2px')
			.style('border', 'solid 1px transparent')
			.html('All samples&nbsp;&nbsp;' + this.data.length)
			.attr('class', 'sja_clb')
			.on('click', () => {
				let nf = true
				for (const b of this.boxplots) {
					if (b.id == 'all') nf = false
				}
				if (nf) {
					newboxplot(this, this.data, '', 'all', allsamplerow)
				} else {
					boxplotremove(this, 'all')
				}
			})

		if (this.p.cohort) {
			if (this.p.cohort && this.p.cohort.annotation && this.p.cohort.key4annotation) {
				// refit annotation
				for (const m of this.data) {
					const k4a = m[this.p.cohort.key4annotation]
					if (k4a) {
						const sanno = this.p.cohort.annotation[k4a]
						if (sanno) {
							if (this.p.cohort.levels) {
								for (const l of this.p.cohort.levels) {
									m[l.k] = sanno[l.k]
									if (l.full) {
										m[l.full] = sanno[l.full]
									}
								}
							} else {
								for (const k in sanno) {
									m[k] = sanno[k]
								}
							}
						}
					}
				}
			}

			const div = this.treediv
				.append('div')
				.style('margin', '10px')
				.style('height', '400px')
				.style('overflow-y', 'scroll')
				.style('resize', 'vertical')
			const input = stratinput(this.data, this.p.cohort.levels)
			const root = hierarchy(stratify()(input))
			root.sum(i => i.value)
			root.eachBefore(n => {
				if (!n.parent) return
				const row = div
					.append('div')
					.style('margin', '2px')
					.style('padding', '2px')
					.style('border', 'solid 1px transparent')
					.attr('class', 'sja_clb')
				for (let i = 1; i < n.depth; i++) {
					row.append('span').style('color', '#ccc').style('padding', '0px 15px').text('|')
				}
				const d = n.data.data
				row.append('span').html(d.name + '&nbsp;') // somehow no longer n.data.name
				if (d.full) {
					row
						.append('span')
						.html(d.full + '&nbsp;')
						.style('font-size', '.7em')
						.style('color', '#858585')
				}
				if (d.lst && d.lst.length) {
					row.append('span').text(d.lst.length)
					row.on('click', () => {
						let nf = true
						for (const b of this.boxplots) {
							if (b.id == d.id) nf = false
						}
						if (nf) {
							newboxplot(this, d.lst, d.name, d.id, row)
						} else {
							boxplotremove(this, d.id)
						}
					})
				}
			})
		} else {
			this.treediv.append('div').style('margin', '10px').text('Cannot stratify sample: no cohort information.')
		}
		newboxplot(this, this.data, '', 'all', allsamplerow)
		// end of constructor
	}

	epaintfold(block) {
		if (!this.handle) {
			// no folded handle
			const ds = this.genome.datasets[this.dsname]
			if (!ds) {
				alert('invalid dataset name: ' + this.dsname)
				return
			}
			this.handle = block.ds2handle[this.dsname].handle
				.append('div')
				.classed('sja_opaque8', true)
				.style('background-color', '#999')
				.style('color', 'white')
				.style('padding', '2px 4px')
				.style('margin-left', '1px')
				.text('e')
			this.handle.on('click', () => {
				this.pane.pane.style('display', 'block')
				client.flyindi(this.handle, this.pane.pane)
				this.handle.style('display', 'none')
			})
		}
		this.handle.style('display', 'inline-block')
		client.flyindi(this.pane.pane, this.handle)
		this.pane.pane.style('display', 'none')
	}

	makescale_ep() {
		const axish = this.axish - 2
		if (this.uselog) {
			this.x_scale = scaleLog().domain([1, this.maxvalue]).range([0, this.width])
		} else {
			this.x_scale = scaleLinear().domain([this.minvalue, this.maxvalue]).range([0, this.width])
		}
		const scale = axisTop().scale(this.x_scale).tickSizeInner(this.tickh)
		if (this.uselog) {
			scale.ticks(6, ',.0f')
		} else {
			// not to show jumbled labels in case of very large values
			let fontwidth
			this.axisg
				.append('text')
				.text(Math.ceil(this.maxvalue))
				.attr('font-size', axish - this.tickh)
				.each(function () {
					fontwidth = this.getBBox().width
				})
				.remove()
			scale.ticks(Math.floor(this.width / (fontwidth + 20)))
		}
		if (this.axis) {
			this.axis.remove()
		}
		this.axis = this.axisg
			.append('g')
			.attr('transform', 'translate(0,' + axish + ')')
			.call(scale)
		client.axisstyle({
			axis: this.axis,
			fontsize: axish - this.tickh,
			showline: true
		})
	}

	render(width, height) {
		if (!width) {
			width = this.presize.width
			height = this.presize.height
		}
		this.width = width
		this.width2 = width * 0.05
		this.dotsize = Math.max(13, width / 30)
		this.height = height
		this.sf_boxheight.range([10, this.height / 8])
		const groupmax = Math.min(this.data.length * 0.7, 300)
		this.sf_boxlabelfontsize
			.domain([0, Math.log(groupmax), Math.log(this.data.length)])
			.range([8, this.sf_boxheight(groupmax) / 2, 1 + this.sf_boxheight(groupmax) / 2])
		this.heightmove = this.height
		this.rowheight_reset()
		this.svgg.attr('transform', 'translate(' + this.dotsize + ',0)')
		this.axish = Math.max(18, this.width * 0.04)
		this.tickh = this.axish * 0.3
		this.makescale_ep()
		this.grabbar.attr('width', this.width)
		this.grabbar.attr('height', this.axish)
		// only to get width2_
		const tmp = this.svgg
			.append('text')
			.text(this.data.length)
			.attr('font-family', client.font)
			.attr('font-size', this.sf_boxlabelfontsize(Math.log(this.data.length)))
		this.width2_ = tmp.node().getBBox().width + 3
		tmp.remove()
		const tmp2 = this.svgg.append('text').text('COUNT').attr('font-size', 1).attr('font-family', client.font)
		const size2 = Math.max(8, (this.width2_ - 3) / tmp2.node().getBBox().width)
		tmp2.remove()
		this.axispad = 5 + size2 + this.dotsize / 2
		this.verticalline
			.attr('x1', this.width + this.width2 - this.width2_)
			.attr('y1', this.axish + 5)
			.attr('x2', this.width + this.width2 - this.width2_)
			.attr('y2', this.axish + this.height + this.axispad)
		this.dotgraph_y = this.axish + this.axispad
		this.dotgraph_y_default = this.dotgraph_y
		this.boxbag.attr('transform', 'translate(0,' + this.dotgraph_y + ')')
		this.graph.attr('transform', 'translate(0,' + this.dotgraph_y + ')')
		this.sung.attr('transform', 'translate(0,' + this.dotgraph_y + ')')
		this.grab.y = -this.dotgraph_y - 10
		this.grab.height = this.height + this.dotgraph_y + 30
		this.grab.holder.attr('transform', 'translate(' + this.width / 2 + ',' + this.height / 2 + ')')
		this.grab.shadehandle1.attr('y', 12 + this.axish)
		this.grab.shadehandle2.attr('y', 12 + this.axish)
		this.epdotg.attr('transform', (d, i) => {
			d._y = i * this.rowheight
			return 'translate(0,' + d._y + ')'
		})
		this.epdot.attr('r', this.dotsize / 2)
		this.epdotg.attr('transform', d => 'translate(' + Math.max(0, this.x_scale(d.value)) + ',' + d._y + ')')
		//this.resizebutt.attr('x',this.width+this.width2) .attr('y',this.axish+this.axispad+this.height)
		if (this.grab.x) {
			let x1 = this.x_scale(this.grab.min),
				x2 = this.x_scale(this.grab.max)
			this.grab.x = x1
			this.grab.width = x2 - x1
			this.grab.shade.attr('transform', 'translate(' + x1 + ',' + this.grab.y + ')')
			this.grab.shadebox.attr('width', this.grab.width).attr('height', this.grab.height)
			this.grab.shadehandle2.attr('x', this.grab.width)
			burst(this, this.grab.min, this.grab.max)
		}
		for (const box of this.boxplots) {
			const labelfontsize = this.sf_boxlabelfontsize(Math.log(box.lst.length))
			const boxheight = this.sf_boxheight(box.lst.length)
			box.holder.attr('transform', 'translate(0,' + box.yoff + ')')
			box.hline
				.attr('y1', boxheight / 2)
				.attr('y2', boxheight / 2)
				.attr('x1', Math.max(0, this.x_scale(box.percentile[9])))
				.attr('x2', Math.max(0, this.x_scale(box.percentile[91])))
			box.label
				.attr('x', this.width + this.width2 - this.width2_ - 3)
				.attr('y', boxheight / 2)
				.attr('font-size', labelfontsize)
			box.label2
				.attr('x', this.width + this.width2 - this.width2_ + 3)
				.attr('y', boxheight / 2)
				.attr('font-size', labelfontsize)
			box.connline
				.attr('y1', boxheight / 2)
				.attr('y2', boxheight / 2)
				.attr('x1', Math.max(0, this.x_scale(box.percentile[91])))
				.attr('x2', Math.max(0, this.width + this.width2 - box.labelwidth - this.width2_ - 3))
			box.box
				.attr('height', boxheight)
				.attr('x', Math.max(0, this.x_scale(box.percentile[25])))
				.attr('width', Math.max(0, this.x_scale(box.percentile[75])) - Math.max(0, this.x_scale(box.percentile[25])))
			box.vlines
				.attr('x1', d => Math.max(0, this.x_scale(d)))
				.attr('x2', d => Math.max(0, this.x_scale(d)))
				.attr('y1', 0)
				.attr('y2', boxheight)
		}
		this.svg
			.attr('width', this.width + this.width2 + this.dotsize)
			.attr('height', this.height + this.axish + this.axispad + this.dotsize / 2)
	}

	getsampleinfo(d, lst) {
		// FIXME old style official ds adopt cohort.annotation

		if (this.p.cohort) {
			if (this.p.cohort.annotation && this.p.cohort.key4annotation) {
				const k4a = d[this.p.cohort.key4annotation]
				if (k4a) {
					lst.push({ k: this.p.cohort.key4annotation, v: k4a })

					const sanno = this.p.cohort.annotation[k4a]

					if (sanno) {
						let numberofkeys = 0
						// limit # of keys, do not show crazily long table
						for (const k in sanno) numberofkeys++

						if (this.p.cohort.levels) {
							for (const l of this.p.cohort.levels) {
								lst.push({
									k: l.label || l.k,
									v: sanno[l.k] == undefined ? '' : sanno[l.k]
								})
							}
							return numberofkeys > this.p.cohort.levels.length
						}
						let shownum = 0
						for (const k in sanno) {
							lst.push({ k: k, v: sanno[k] })
							if (++shownum == numberofkeys) return true
						}
						return false
					}
				}
			} else if (this.p.cohort.levels) {
				// old official ds
				for (const l of this.p.cohort.levels) {
					const v = d[l.k]
					if (!v) continue
					lst.push({
						k: l.label || l.k,
						v:
							d[l.k] +
							(l.full ? (d[l.full] ? ' <span style="font-size:.8em;color:#858585">' + d[l.full] + '</span>' : '') : '')
					})
				}
				return false
			}
		}
		// none above works
		for (const k in d) {
			if (k == 'circle' || k == '_y') continue
			if (typeof k == 'string') {
				const v = d[k]
				if (v) {
					lst.push({ k: k, v: v })
				}
			}
		}
		return false
	}

	rowheight_reset() {
		if (this.data) {
			this.rowheight = this.height / this.data.length
			return
		}
		this.rowheight = 0
	}

	dot_appendtext(set, lookup) {
		const used = []
		set
			.append('text')
			.text(d => lookup.get(d[this.p.sampletype]))
			.attr('font-family', client.font)
			.attr('font-size', this.dotsize)
			.each(function (d) {
				d.bb = this.getBBox()
			})
			.each(d => {
				const dotx = this.x_scale(d.value)
				const onleft = dotx - this.dotsize > d.bb.width
				let y1 = d._y - d.bb.height / 2,
					y2 = y1 + d.bb.height
				for (const u of used) {
					if (u.onleft == onleft && Math.max(u.y1, y1) < Math.min(u.y2, y2)) {
						// overlap, shift down
						y1 = u.y2
						y2 = y1 + d.bb.height
					}
				}
				delete d.bb
				d.mafrect = { y1: y1, y2: y2, onleft: onleft }
				used.push(d.mafrect)
			})
			.attr('class', 'sja_svgtext')
			.attr('dominant-baseline', 'central')
			.attr('fill', this.p.hlcolor)
			.attr('text-anchor', d => (d.mafrect.onleft ? 'end' : 'start'))
			.attr('x', d => (d.mafrect.onleft ? -1 : 1) * this.dotsize)
			.attr('y', d => d.mafrect.y1 - d._y + this.dotsize / 2)
			.on('click', (event, d) => {
				// cancel highlight
				d3select(d.circle)
					.attr('stroke-width', 1)
					.attr('stroke-opacity', normal_strokeopacity)
					.attr('stroke', 'black')
					.attr('r', this.dotsize / 2)
				d.showtext = false
				d3select(event.target).remove()
			})
			.attr('font-size', 1)
			.transition()
			.attr('font-size', this.dotsize)
	}

	may_hl(mlst, hl) {
		if (!this.data) return
		const samples = new Set()
		let nohit = true
		for (const m of mlst) {
			const sn = m[this.p.sampletype]
			if (!sn) continue
			samples.add(sn)
			if (this.sampletype2value[sn]) {
				nohit = false
			}
		}
		if (nohit) return
		this.epdot
			.filter(d => samples.has(d[this.p.sampletype]))
			//.attr('fill-opacity', hl ? .7 : 0)
			.attr('r', hl ? this.dotsize * 0.8 : this.dotsize / 2)
			.attr('stroke', hl ? this.p.hlcolor : 'black')
			.attr('stroke-opacity', hl ? hl_strokeopacity : normal_strokeopacity)

		const maf = this.p.maf
		if (!maf) return
		// show maf text
		const lookup = new Map() // key: sample, val: mutation maf v
		for (const m of mlst) {
			const sn = m[this.p.sampletype]
			const v = this.p.maf.get(m)
			if (!v) continue
			if (typeof v == 'string') {
				// fusion
				// FIXME better way of distinguishing it
				lookup.set(sn, v)
			} else {
				lookup.set(
					sn,
					v.v2 == 0
						? 'No ' + this.p.maf.label + ': site not covered'
						: this.p.maf.label + ': ' + (v.f * 100).toFixed(0) + '% (' + v.v1 + '/' + v.v2 + ')'
				)
			}
		}
		const set = this.epdotg.filter(d => lookup.has(d[this.p.sampletype]) && !d.showtext)
		if (hl) {
			this.dot_appendtext(set, lookup)
		} else {
			set.select('text').remove()
		}
	}
	// end of class
}

function showgene(ep, name) {
	// not in use
	// see if its dataset has custom expression db
	const ds = ep.genome.datasets[ep.dsname]
	if (ds.dbexpression) {
		// has custom expression db
		const par = {
			db: ds.dbexpression.dbfile,
			tablename: ds.dbexpression.tablename,
			keyname: ds.dbexpression.keyname,
			key: name
		}
		fetch(
			new Request(ep.hostURL + '/dbdata', {
				method: 'POST',
				body: JSON.stringify(par)
			})
		)
			.then(data => {
				return data.json()
			})
			.then(data => {
				if (data.error) throw { message: data.error }
				if (ds.dbexpression.tidy) {
					ds.dbexpression.tidy(data.rows)
				}
				const p = ep.pane.pane.node().getBoundingClientRect()
				new EPaint({
					hostURL: ep.hostURL,
					data: data.rows,
					expp: ep.p,
					presize: {
						x: p.left + 30,
						y: p.top + 50,
						width: ep.width,
						height: ep.height
					},
					genome: ep.genome,
					dsname: ep.dsname,
					genename: name,
					samplecart: ep.samplecart
				})
			})
			.catch(err => {
				window.alert(err.message)
				if (err.stack) console.log(err.stack)
			})
		return
	}

	// server-configed, no db info exposed
	fetch(
		new Request(ep.hostURL + '/dsdata', {
			method: 'POST',
			body: JSON.stringify({ genome: ep.genome.name, dsname: ep.dsname, expressiononly: 1, genename: name })
		})
	)
		.then(data => {
			return data.json()
		})
		.then(data => {
			if (data.error) throw { message: data.error }
			const p = ep.pane.pane.node().getBoundingClientRect()
			new EPaint({
				hostURL: ep.hostURL,
				data: data.data[0].lst,
				expp: ep.p,
				presize: {
					x: p.left + 30,
					y: p.top + 50,
					width: ep.width,
					height: ep.height
				},
				genome: ep.genome,
				dsname: ep.dsname,
				genename: name,
				samplecart: ep.samplecart
			})
		})
		.catch(err => {
			window.alert(err.message)
			if (err.stack) console.log(err.stack)
		})
}

function samplefulldetail(d, cohort, x, y) {
	const pane = client.newpane({ x: x, y: y })
	const k4a = d[cohort.key4annotation]
	pane.header.text(k4a)
	const lst = []
	const anno = cohort.annotation[k4a]
	for (const k in anno) {
		lst.push({ k: k, v: anno[k] })
	}
	client.make_table_2col(pane.body, lst)
}

function makeButtons(ep) {
	const butrow = ep.pane.body.append('div').style('margin-bottom', '10px')

	butrow
		.append('button')
		.text('Cohort')
		.on('click', () => {
			if (ep.treediv.style('display') == 'none') {
				client.appear(ep.treediv)
			} else {
				client.disappear(ep.treediv)
			}
		})

	butrow
		.append('button')
		.text('Log10')
		.on('click', () => {
			const dur = 700
			ep.uselog = !ep.uselog
			ep.makescale_ep()
			ep.epdotg
				.transition()
				.duration(dur)
				.attr(
					'transform',
					(d, i) => 'translate(' + (ep.uselog && d.value == 0 ? 0 : Math.max(0, ep.x_scale(d.value))) + ',' + d._y + ')'
				)
			for (const bp of ep.boxplots) {
				bp.vlines
					.transition()
					.duration(dur)
					.attr('x1', v => Math.max(0, ep.x_scale(v)))
					.attr('x2', v => Math.max(0, ep.x_scale(v)))
				bp.box
					.transition()
					.duration(dur)
					.attr('x', Math.max(0, ep.x_scale(bp.percentile[25])))
					.attr('width', Math.max(0, ep.x_scale(bp.percentile[75])) - Math.max(0, ep.x_scale(bp.percentile[25])))
				bp.hline
					.transition()
					.duration(dur)
					.attr('x1', Math.max(0, ep.x_scale(bp.percentile[9])))
					.attr('x2', Math.max(0, ep.x_scale(bp.percentile[91])))
				bp.connline
					.transition()
					.duration(dur)
					.attr('x1', Math.max(0, ep.x_scale(bp.percentile[91])))
					.attr('x2', ep.width + ep.width2 - bp.labelwidth - ep.width2_ - 3)
			}
			if (ep.grab.x) {
				let x1 = ep.x_scale(ep.grab.min),
					x2 = ep.x_scale(ep.grab.max)
				ep.grab.x = x1
				ep.grab.width = x2 - x1
				ep.grab.shade
					.transition()
					.duration(dur)
					.attr('transform', 'translate(' + x1 + ',' + ep.grab.y + ')')
				ep.grab.shadebox.transition().duration(dur).attr('width', ep.grab.width)
				ep.grab.shadehandle2.transition().duration(dur).attr('x', ep.grab.width)
			}
		})

	butrow
		.append('button')
		.text('SVG')
		.on('click', () => {
			client.to_svg(ep.svg.node(), ep.genename + '_expression')
		})

	butrow
		.append('button')
		.text('Data')
		.on('click', () => {
			const header = [ep.p.sampletype, ep.p.datatype]
			const attrlst = []
			if (ep.p.attrlst) {
				for (const a of ep.p.attrlst) {
					header.push(a.k)
					attrlst.push(a.k)
				}
			}
			if (ep.p.cohort) {
				for (const a of ep.p.cohort.levels) {
					header.push(a.k)
					attrlst.push(a.k)
				}
			}
			const rows = []
			for (const d of ep.data) {
				const row = [d[ep.p.sampletype], d.value]
				for (const k of attrlst) {
					row.push(d[k] || '')
				}
				rows.push(row.join('\t'))
			}
			client.export_data(ep.genename + ' ' + ep.p.name + ' data', [
				{ text: header.join('\t') + '\n' + rows.join('\n') }
			])
		})

	butrow
		.append('input')
		.attr('placeholder', 'Sample')
		.style('width', '60px')
		.style('margin-left', '5px')
		.on('keyup', event => {
			const str = event.target.value
			if (str == '') {
				ep.epdot
					.attr('r', ep.dotsize / 2)
					.attr('stroke', 'black')
					.attr('stroke-opacity', normal_strokeopacity)
				return
			}
			const lstr = str.toLowerCase()
			const set = new Set()
			for (const n in ep.sampletype2value) {
				if (n.toLowerCase().indexOf(lstr) != -1) {
					set.add(n)
				}
			}
			ep.epdot
				.filter(i => set.has(i[ep.p.sampletype]))
				.attr('r', ep.dotsize)
				.attr('stroke', ep.p.hlcolor)
				.attr('stroke-opacity', hl_strokeopacity)
			ep.epdot
				.filter(i => !set.has(i[ep.p.sampletype]))
				.attr('r', ep.dotsize / 2)
				.attr('stroke', 'black')
				.attr('stroke-opacity', normal_strokeopacity)
		})

	butrow
		.append('input')
		.attr('placeholder', 'Gene')
		.style('width', '60px')
		.style('margin-left', '5px')
		.on('keyup', event => {
			const str = event.target.value
			if (event.code == 'Enter') {
				showgene(ep, str)
				event.target.value = ''
				return
			}
		})

	if (ep.p.gtexlink) {
		butrow
			.append('span')
			.html('&nbsp;<a target=_blank href=https://www.gtexportal.org/home/gene/' + ep.genename + '>GTeX normal</a>')
	}
}

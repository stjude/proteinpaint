import * as client from './client'
import { event as d3event } from 'd3-selection'
import { axisTop } from 'd3-axis'
import { scaleLinear, scaleLog } from 'd3-scale'
import * as expressionstat from './block.mds.expressionstat'

/*
sloppy design!!!


# native track
.dslabel
.querykey

# custom track
.file/url/indexURL

.gene/chr/start/stop
.holder
.block
.sample
	.name
	.value


.color
	.cnvgain
	.cnvloss
	.sv

.svcnv
	.dslabel
	.querykey
	.valueCutoff
	.bplengthUpperLimit


plot.data{} is returned by server
if .data.lst[], then there is no sample grouping
if .data.groups[], then there is boxplots for each group


*/

const label_cnvgain = 'CNV gain'
const label_cnvloss = 'CNV loss'
const label_sv = 'SV'
const label_ase = 'Allele-specific expression'
const label_outlier = 'Outlier expression'

export async function init(p) {
	if (!p.genome) return alert('cannot initiate plot: genome missing')

	const plot = p

	plot.tip = new client.Menu({ padding: '0px' })

	if (plot.file || plot.url) {
		// is custom
		plot.gecfg = {}
	} else {
		// official
		if (!plot.dslabel) return alert('dslabel missing')
		if (!plot.querykey) return alert('querykey missing')
		const d = plot.genome.datasets[plot.dslabel]
		if (!d) return alert('invalid dataset label: ' + plot.dslabel)
		plot.gecfg = d.queries[plot.querykey]
		if (!plot.gecfg) return alert('invalid query key: ' + plot.querykey)
	}

	// init gecfg
	expressionstat.init_config(plot.gecfg)

	if (p.block && p.block.debugmode) {
		window.plot = plot
	}

	plot.errdiv = plot.holder.append('div').style('margin', '10px')

	const buttonrow = plot.holder.append('div').style('margin', '10px')

	plot.buttonrow = buttonrow

	mayaddgrouperselect(plot)

	// below button row, show/hide boxes
	const configdiv = plot.holder
		.append('div')
		.style('margin', '10px')
		.style('border', 'solid 1px #ededed')
		.style('padding', '10px')
		.style('display', 'none')

	plot.table_boxplotstats = plot.holder
		.append('table')
		.style('margin', '10px')
		.style('border-spacing', '4px')
		.style('border-collapse', 'separate')

	// TODO no log conversion if there is negative value (z-score)
	buttonrow
		.append('button')
		.text('Log10')
		.on('click', () => {
			plot.uselog = !plot.uselog
			d3event.target.innerHTML = plot.uselog ? 'Linear' : 'Log10'
			plot.place()
		})

	if (plot.sample) {
		plot.sample.shown = true
		buttonrow
			.append('button')
			.text(plot.sample.name + ' toggle')
			.on('click', () => {
				plot.sample.shown = !plot.sample.shown
				plot.sample.line.attr('stroke-opacity', plot.sample.shown ? 1 : 0)
				plot.sample.svgtext.attr('fill-opacity', plot.sample.shown ? 1 : 0)
			})
	}

	if (plot.svcnv) {
		/* boxplot options pertinent to cnv/loh
		 */

		buttonrow
			.append('button')
			.text('SV/CNV options')
			.on('click', () => {
				if (configdiv.style('display') == 'none') client.appear(configdiv)
				else client.disappear(configdiv)
			})

		plot.svcnv.useloss = true
		plot.svcnv.usegain = true
		plot.cnvconfig = {}
		plot.svconfig = {}

		// boxplot choice - cnv gain
		{
			const row = configdiv.append('div')
			const id = Math.random().toString()
			row
				.append('input')
				.attr('type', 'checkbox')
				.property('checked', true)
				.attr('id', id)
				.on('change', () => {
					plot.svcnv.usegain = d3event.target.checked
					plot.cnvconfig.div.style('display', plot.svcnv.usegain || plot.svcnv.useloss ? 'block' : 'none')
					loadplot(plot)
				})
			row
				.append('label')
				.attr('for', id)
				.attr('class', 'sja_clbtext')
				.html('&nbsp;Add boxplot for samples with copy number gain over ' + plot.gene)
				.style('color', plot.color.cnvgain)
		}

		// boxplot choice - cnv loss
		{
			const row = configdiv.append('div')
			const id = Math.random().toString()
			row
				.append('input')
				.attr('type', 'checkbox')
				.property('checked', true)
				.attr('id', id)
				.on('change', () => {
					plot.svcnv.useloss = d3event.target.checked
					plot.cnvconfig.div.style('display', plot.svcnv.usegain || plot.svcnv.useloss ? 'block' : 'none')
					loadplot(plot)
				})
			row
				.append('label')
				.attr('for', id)
				.attr('class', 'sja_clbtext')
				.html('&nbsp;Add boxplot for samples with copy number loss over ' + plot.gene)
				.style('color', plot.color.cnvloss)
		}

		// boxplot choice - cnv - config
		{
			const d = configdiv.append('div')
			plot.cnvconfig.div = d
			const d2 = d
				.append('div')
				.style('display', 'inline-block')
				.style('margin', '5px 10px 10px 30px')
				.style('border', 'solid 1px #ededed')
				.style('padding', '10px')

			// cnv log2 ratio
			{
				const row = d2.append('div').style('margin-bottom', '15px')
				row.append('span').html('CNV log2(ratio) cutoff&nbsp;')
				row
					.append('input')
					.property('value', plot.svcnv.valueCutoff || 0)
					.attr('type', 'number')
					.style('width', '50px')
					.on('keyup', () => {
						if (d3event.code != 'Enter' && d3event.code != 'NumpadEnter') return
						let v = Number.parseFloat(d3event.target.value)
						if (!v || v < 0) {
							// invalid value, set to 0 to cancel
							v = 0
						}
						if (v == 0) {
							if (plot.svcnv.valueCutoff) {
								// cutoff has been set, cancel and refetch data
								plot.svcnv.valueCutoff = 0
								loadplot(plot)
							} else {
								// cutoff has not been set, do nothing
							}
							return
						}
						// set cutoff
						if (plot.svcnv.valueCutoff) {
							// cutoff has been set
							if (plot.svcnv.valueCutoff == v) {
								// same as current cutoff, do nothing
							} else {
								// set new cutoff
								plot.svcnv.valueCutoff = v
								loadplot(plot)
							}
						} else {
							// cutoff has not been set
							plot.svcnv.valueCutoff = v
							loadplot(plot)
						}
					})
				row
					.append('div')
					.style('font-size', '.7em')
					.style('color', '#858585')
					.html('CNV with absolute log2(ratio) lower than cutoff will not be considered. Set to 0 to cancel.')
			}

			// focal cnv
			{
				const row = d2.append('div')
				row.append('span').html('CNV segment size limit&nbsp;')
				row
					.append('input')
					.property('value', plot.svcnv.bplengthUpperLimit || 0)
					.attr('type', 'number')
					.style('width', '80px')
					.on('keyup', () => {
						if (d3event.code != 'Enter' && d3event.code != 'NumpadEnter') return
						let v = Number.parseInt(d3event.target.value)
						if (!v || v < 0) {
							// invalid value, set to 0 to cancel
							v = 0
						}
						if (v == 0) {
							if (plot.svcnv.bplengthUpperLimit) {
								// cutoff has been set, cancel and refetch data
								plot.svcnv.bplengthUpperLimit = 0
								loadplot(plot)
							} else {
								// cutoff has not been set, do nothing
							}
							return
						}
						// set cutoff
						if (plot.svcnv.bplengthUpperLimit) {
							// cutoff has been set
							if (plot.svcnv.bplengthUpperLimit == v) {
								// same as current cutoff, do nothing
							} else {
								// set new cutoff
								plot.svcnv.bplengthUpperLimit = v
								loadplot(plot)
							}
						} else {
							// cutoff has not been set
							plot.svcnv.bplengthUpperLimit = v
							loadplot(plot)
						}
					})
				row.append('span').html('&nbsp;bp')
				row
					.append('div')
					.style('font-size', '.7em')
					.style('color', '#858585')
					.html('CNV segment longer than cutoff will not be considered. Set to 0 to cancel.')
			}

			// TODO get cnv from flanking
		}

		// boxplot choice - sv
		{
			const row = configdiv.append('div')
			const id = Math.random().toString()
			row
				.append('input')
				.attr('type', 'checkbox')
				.property('checked', false)
				.attr('id', id)
				.on('change', () => {
					plot.svcnv.usesv = d3event.target.checked
					plot.svconfig.div.style('display', plot.svcnv.usesv ? 'block' : 'none')
					loadplot(plot)
				})
			row
				.append('label')
				.attr('for', id)
				.attr('class', 'sja_clbtext')
				.html('&nbsp;Add boxplot for samples with structural variation over ' + plot.gene)
				.style('color', plot.color.sv)
		}

		// boxplot choice - sv - config
		{
			const d = configdiv.append('div').style('display', 'none')
			plot.svconfig.div = d
			const d2 = d
				.append('div')
				.style('display', 'inline-block')
				.style('margin', '5px 10px 10px 30px')
				.style('border', 'solid 1px #ededed')
				.style('padding', '10px')
			{
				const row = d2.append('div')
				row.append('span').html('Include SV from flanking region of length:&nbsp;')
				row
					.append('input')
					.property('value', 0)
					.attr('type', 'number')
					.style('width', '80px')
					.on('keyup', () => {
						if (d3event.code != 'Enter' && d3event.code != 'NumpadEnter') return
						let v = Number.parseInt(d3event.target.value)
						if (!v || v < 0) {
							// invalid value, set to 0 to cancel
							v = 0
						}
						if (v == 0) {
							if (plot.svcnv.svflank) {
								// cutoff has been set, cancel and refetch data
								plot.svcnv.svflank = 0
								loadplot(plot)
							} else {
								// cutoff has not been set, do nothing
							}
							return
						}
						// set cutoff
						if (plot.svcnv.svflank) {
							// cutoff has been set
							if (plot.svcnv.svflank == v) {
								// same as current cutoff, do nothing
							} else {
								// set new cutoff
								plot.svcnv.svflank = v
								loadplot(plot)
							}
						} else {
							// cutoff has not been set
							plot.svcnv.svflank = v
							loadplot(plot)
						}
					})
				row.append('span').html('&nbsp;bp')
				row
					.append('div')
					.style('font-size', '.7em')
					.style('color', '#858585')
					.html('Set to 0 to cancel.')
			}
		}
	}

	/*
	make button holders for:
	- boxplot stats
	- sample fpkm

	since it will only know if the gene has boxplots or not after server returns
	the boxplot button is shown after that

	each time the plot is updated the buttons are remade, thus the need for holders
	*/
	plot.buttonholder_boxplot = buttonrow.append('span')
	plot.buttonholder_sampleexpdata = buttonrow.append('span')
	buttonrow
		.append('button')
		.text('SVG')
		.on('click', () => {
			client.to_svg(plot.svg.node(), 'Expression')
		})

	plot.svg = plot.holder.append('svg')
	const axisg = plot.svg.append('g')
	plot.g0 = plot.svg.append('g')

	const axisheight = 50
	const lablspace = 10
	const axisw = 500
	const rowheight = 16
	const rowspace = 10
	const _rowspace = 2
	const axispad2 = 30
	const fontsize = 14
	const circleyshift = 2

	plot.place = () => {
		plot.axislabel.attr('x', axisw / 2)

		let labwidth = 0
		let rightwidth = 0

		const scale0 = (plot.uselog ? scaleLog() : scaleLinear())
			.domain([plot.data.min == 0 ? 0.001 : plot.data.min, plot.data.max])
			.range([0, axisw])
		const scale = v => {
			if (plot.uselog) {
				if (v == 0) return 0
				// should not use log in case of negative value
			}
			return scale0(v)
		}

		client.axisstyle({
			axis: axisg.transition().call(axisTop().scale(scale0)),
			showline: 1
		})

		let y = rowspace
		if (plot.data.lst) {
			labwidth = 20
			rightwidth = 20
			for (const d of plot.data.lst) {
				d.circle
					.transition()
					.attr('cx', scale(d.value))
					.attr('cy', y)
					.attr('r', rowheight / 2)
				y += circleyshift
			}
		} else {
			for (const g of plot.data.groups) {
				g.g.attr('transform', 'translate(0,' + y + ')')

				const _rowheight = rowheight * (g.boxplots.length > 1 ? 0.8 : 1)

				let _y = 0
				for (const bp of g.boxplots) {
					if (bp.label) {
						bp.label
							.attr('font-size', _rowheight)
							.attr('x', axisw + 5)
							.attr('y', _y + _rowheight / 2)
							.each(function() {
								rightwidth = Math.max(rightwidth, this.getBBox().width)
							})
					}

					if (bp.hline) {
						// has boxplot for this group, could be missing
						const w1 = scale(bp.w1)
						const w2 = scale(bp.w2)
						const p25 = scale(bp.p25)
						const p50 = scale(bp.p50)
						const p75 = scale(bp.p75)
						bp.hline
							.transition()
							.attr('x1', w1)
							.attr('x2', w2)
							.attr('y1', _y + _rowheight / 2)
							.attr('y2', _y + _rowheight / 2)
						bp.linew1
							.transition()
							.attr('x1', w1)
							.attr('x2', w1)
							.attr('y1', _y)
							.attr('y2', _y + _rowheight)
						bp.linew2
							.transition()
							.attr('x1', w2)
							.attr('x2', w2)
							.attr('y1', _y)
							.attr('y2', _y + _rowheight)
						bp.box
							.transition()
							.attr('x', p25)
							.attr('y', _y)
							.attr('width', p75 - p25)
							.attr('height', _rowheight)
						bp.linep50
							.transition()
							.attr('x1', p50)
							.attr('x2', p50)
							.attr('y1', _y)
							.attr('y2', _y + _rowheight)
					}

					for (const d of bp.out) {
						d.circle
							.transition()
							.attr('cx', scale(d.value))
							.attr('cy', _y + _rowheight / 2)
							.attr('r', _rowheight / 3)
					}
					_y += _rowheight + _rowspace
				}
				const h = (_rowheight + _rowspace) * g.boxplots.length - _rowspace

				g.label
					.attr('x', -lablspace)
					.attr('y', h / 2)
					.attr('font-size', fontsize)
					.each(function() {
						labwidth = Math.max(labwidth, this.getBBox().width)
					})

				if (g.bg)
					g.bg
						.attr('y', -rowspace / 2)
						.attr('width', axisw)
						.attr('height', h + rowspace)

				y += h + rowspace
			}
		}
		plot.g0.attr('transform', 'translate(' + (labwidth + lablspace) + ',' + axisheight + ')')
		axisg.attr('transform', 'translate(' + (labwidth + lablspace) + ',' + axisheight + ')')

		if (plot.sample) {
			plot.sample.g.transition().attr('transform', 'translate(' + scale(plot.sample.value) + ',' + y + ')')
			plot.sample.line.attr('y1', -y)
		}
		plot.svg.attr('width', labwidth + lablspace + axisw + axispad2 + rightwidth).attr('height', axisheight + y + 30)
	}

	try {
		await loadplot(plot)
	} catch (e) {
		client.sayerror(plot.errdiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

async function loadplot(plot) {
	const arg = {
		genome: plot.genome.name,
		gene: plot.gene,
		chr: plot.chr,
		start: plot.start,
		stop: plot.stop,
		svcnv: plot.svcnv,
		index_boxplotgroupers: plot.index_boxplotgroupers,
		sampleset: plot.sampleset
	}
	if (plot.dslabel) {
		arg.dslabel = plot.dslabel
		arg.querykey = plot.querykey
	} else {
		arg.iscustom = 1
		arg.file = plot.file
		arg.url = plot.url
		arg.indexURL = plot.indexURL
	}

	plot.g0
		.append('text')
		.text('Loading ...')
		.attr('font-size', 20)
		.attr('text-anchor', 'center')
		.attr('dominant-baseline', 'central')
		.attr('x', plot.svg.attr('width') / 2)
		.attr('y', plot.svg.attr('height') / 2)

	const data = await client.dofetch2('mdsgeneboxplot', { method: 'POST', body: JSON.stringify(arg) })
	if (data.error) throw data.error

	// must clear g0 since may be adding/removing boxplots
	plot.g0.selectAll('*').remove()

	plot.axislabel = plot.g0
		.append('text')
		.attr('font-size', 14)
		.attr('font-family', client.font)
		.attr('text-anchor', 'middle')
		.attr('y', -25)
		.text(plot.gene + ' ' + plot.gecfg.datatype)

	plot.data = data

	const color0 = 'green'
	// gecfg.itemcolor

	if (data.lst) {
		/* all samples are in one group
	no boxplot; show waterfall plot
	*/

		addbutton_showdata_fromlst(plot)

		for (const d of data.lst) {
			d.circle = plot.g0
				.append('circle')
				.attr('fill', 'white')
				.attr('fill-opacity', 0)
				.attr('stroke', color0)
				.attr('stroke-opacity', 0.8)
				.on('mouseover', () => {
					plot.tip
						.clear()
						.d.append('div')
						.style('margin', '10px')
						.html(d.sample + '<br>' + d.value)
					plot.tip.show(d3event.clientX, d3event.clientY)
				})
				.on('mouseout', () => plot.tip.hide())

			if (plot.clicksample) {
				d.circle.on('click', () => {
					plot.clicksample(d, null, plot)
				})
			}
		}
	} else {
		/* samples in groups
	one boxplot per group
	*/

		addbutton_boxplotstats(plot)
		addbutton_showdata_newquery(plot)

		for (const [i, g] of data.groups.entries()) {
			g.g = plot.g0.append('g')
			if (i % 2 == 0) {
				g.bg = g.g.append('rect').attr('fill', '#f5f5f5')
			}

			g.label = g.g
				.append('text')
				.attr('font-family', client.font)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'central')
				.attr('class', 'sja_clbtext')
				.text(g.name)
				.on('click', () => {
					// click a group label to show rope plot for this group alone
					init2(Math.max(100, d3event.clientX - 100), Math.max(100, d3event.clientY - 100), plot, g)
				})

			if (g.attributes) {
				g.label
					.on('mouseover', () => {
						plot.tip.clear().show(d3event.clientX, d3event.clientY)
						const d = plot.tip.d.append('div').style('margin', '10px')
						for (const a of g.attributes) {
							d.append('div').html(
								a.kvalue + (a.fullvalue ? ' <span style="opacity:.5;font-size:.8em;">' + a.fullvalue + '</span>' : '')
							)
						}
					})
					.on('mouseout', () => {
						plot.tip.hide()
					})
			}

			for (const bp of g.boxplots) {
				let color

				if (bp.iscnvgain) {
					color = plot.color.cnvgain
					bp.label = g.g.append('text').text('CNV gain (' + bp.samplecount + ')')
				} else if (bp.iscnvloss) {
					color = plot.color.cnvloss
					bp.label = g.g.append('text').text('CNV loss (' + bp.samplecount + ')')
				} else if (bp.issv) {
					color = 'black'
					bp.label = g.g.append('text').text('SV (' + bp.samplecount + ')')
				} else {
					color = color0
				}

				if (bp.label) {
					bp.label
						.attr('fill', color)
						.attr('font-family', client.font)
						.attr('dominant-baseline', 'central')
				}

				if (bp.w1 != undefined) {
					// has valid values for boxplot, could be missing
					bp.hline = g.g
						.append('line')
						.attr('stroke', color)
						.attr('shape-rendering', 'crispEdges')
					bp.linew1 = g.g
						.append('line')
						.attr('stroke', color)
						.attr('shape-rendering', 'crispEdges')
					bp.linew2 = g.g
						.append('line')
						.attr('stroke', color)
						.attr('shape-rendering', 'crispEdges')
					bp.box = g.g
						.append('rect')
						.attr('fill', 'white')
						.attr('stroke', color)
						.attr('shape-rendering', 'crispEdges')
					bp.linep50 = g.g
						.append('line')
						.attr('stroke', color)
						.attr('shape-rendering', 'crispEdges')
				}
				// outliers
				for (const d of bp.out) {
					d.circle = g.g
						.append('circle')
						.attr('stroke', color)
						.attr('fill', 'white')
						.attr('fill-opacity', 0)
						.on('mouseover', () => {
							plot.tip
								.clear()
								.d.append('div')
								.style('margin', '10px')
								.html(d.sample + '<br>' + d.value)
							plot.tip.show(d3event.clientX, d3event.clientY)
						})
						.on('mouseout', () => {
							plot.tip.hide()
						})

					if (plot.clicksample) {
						d.circle.on('click', () => {
							plot.clicksample(d, g, plot)
						})
					}
				}
			}
		}
	}
	if (plot.sample) {
		plot.sample.g = plot.g0.append('g')
		plot.sample.svgtext = plot.sample.g
			.append('text')
			.text(plot.sample.name)
			.attr('font-family', client.font)
			.attr('font-size', 12)
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'hanging')
			.attr('fill', 'blue')
		plot.sample.line = plot.sample.g
			.append('line')
			.attr('shape-rendering', 'crispEdges')
			.attr('stroke', 'blue')
	}
	plot.place()
}

function addbutton_boxplotstats(plot) {
	/*
call when server returns .data.groups[] but not .data.lst[]
*/
	plot.buttonholder_boxplot.selectAll('*').remove()
	plot.buttonholder_boxplot
		.append('button')
		.text('Boxplots')
		.on('click', () => {
			if (plot.table_boxplotstats.style('display') == 'block') {
				client.disappear(plot.table_boxplotstats)
				return
			}

			plot.table_boxplotstats.selectAll('*').remove()
			const tr = plot.table_boxplotstats.append('tr')
			tr.append('td')
				.text('Group')
				.style('font-size', '.8em')
				.style('opacity', 0.5)
			tr.append('td')
				.text('1st quartile')
				.style('font-size', '.8em')
				.style('opacity', 0.5)
			tr.append('td')
				.text('Median')
				.style('font-size', '.8em')
				.style('opacity', 0.5)
			tr.append('td')
				.text('3rd quartile')
				.style('font-size', '.8em')
				.style('opacity', 0.5)
			for (const [i, g] of plot.data.groups.entries()) {
				const tr = plot.table_boxplotstats.append('tr').style('background', i % 2 ? '' : '#f1f1f1')
				tr.append('td').text(g.name)

				const boxplot = g.boxplots ? g.boxplots[0] : null

				tr.append('td').text(boxplot ? boxplot.p25 : '')
				tr.append('td').text(boxplot ? boxplot.p50 : '')
				tr.append('td').text(boxplot ? boxplot.p75 : '')
			}
			client.appear(plot.table_boxplotstats)
		})
}

function addbutton_showdata_fromlst(plot) {
	/*
only when .data.lst[] is returned by server
*/
	plot.buttonrow
		.append('button')
		.text(plot.gecfg.datatype)
		.on('click', () => {
			const pane = client.newpane({ x: 100, y: 100 })
			pane.header.text(plot.gene + ' ' + plot.gecfg.datatype)
			const table = pane.body
				.append('table')
				.style('border-spacing', '4px')
				.style('border-collapse', 'separate')
			const tr = table.append('tr')
			tr.append('td')
				.text('Sample')
				.style('font-size', '.8em')
				.style('opacity', 0.5)
			tr.append('td')
				.text(plot.gecfg.datatype)
				.style('font-size', '.8em')
				.style('opacity', 0.5)
			for (const i of plot.data.lst) {
				const tr = table.append('tr')
				tr.append('td').text(i.sample)
				tr.append('td').text(i.value)
			}
		})
}

function addbutton_showdata_newquery(plot) {
	/*
only when .data.lst[] is not returned by server
to query server for it
server may deny the request!
*/
	plot.buttonholder_sampleexpdata.selectAll('*').remove()

	plot.buttonholder_sampleexpdata
		.append('button')
		.text(plot.gecfg.datatype)
		.on('click', async () => {
			const pane = client.newpane({ x: 100, y: 100 })
			pane.header.text(plot.gene + ' ' + plot.gecfg.datatype)
			const wait = pane.body
				.append('div')
				.style('margin', '30px')
				.text('Loading...')

			const arg = {
				genome: plot.genome.name,
				gene: plot.gene,
				chr: plot.chr,
				start: plot.start,
				stop: plot.stop,
				getalllst: 1
			}
			if (plot.dslabel) {
				arg.dslabel = plot.dslabel
				arg.querykey = plot.querykey
			} else {
				arg.iscustom = 1
				arg.file = plot.file
				arg.url = plot.url
				arg.indexURL = plot.indexURL
			}

			try {
				const data = await client.dofetch2('mdsgeneboxplot', { method: 'POST', body: JSON.stringify(arg) })
				if (data.error) throw data.error
				wait.remove()
				const table = pane.body
					.append('table')
					.style('border-spacing', '4px')
					.style('border-collapse', 'separate')
				const tr = table.append('tr')
				tr.append('td')
					.text('Sample')
					.style('font-size', '.8em')
					.style('opacity', 0.5)
				tr.append('td')
					.text(plot.gecfg.datatype)
					.style('font-size', '.8em')
					.style('opacity', 0.5)
				for (const i of data.lst) {
					const tr = table.append('tr')
					tr.append('td').text(i.sample)
					tr.append('td').text(i.value)
				}
			} catch (e) {
				wait.text('Error: ' + (e.message || e))
				if (e.stack) console.log(e.stack)
			}
		})
}

/********** init2 *************/

function init2(x, y, plot, group) {
	/*
	clicking a group
	*/
	const pane = client.newpane({ x: x, y: y })
	pane.header.text(plot.gene + ' ' + plot.gecfg.datatype + ' in ' + group.name)

	const pp = {
		_plot: plot,
		holder: pane.body,
		uselog: plot.uselog
	}

	if (group.attributes) {
		// the group is associated with valid attributes
		pp.getgroup = group.attributes
	} else {
		// the group is unannoated
		pp.getgroup = 1
		pp.getgroup_unannotated = 1
	}

	pp.errdiv = pp.holder.append('div').style('margin', '10px')

	const buttonrow = pp.holder.append('div').style('margin', '10px')
	const configdiv = pp.holder
		.append('div')
		.style('margin', '10px')
		.style('border', 'solid 1px #ededed')
		.style('padding', '10px')
		.style('display', 'none')

	buttonrow
		.append('button')
		.text('Log10')
		.on('click', () => {
			pp.uselog = !pp.uselog
			d3event.target.innerHTML = pp.uselog ? 'Linear' : 'Log10'
			pp.place()
		})

	buttonrow
		.append('button')
		.text('Data')
		.on('click', () => {
			const pane2 = client.newpane({ x: 200, y: 200 })
			pane2.header.text(pane.header.node().innerHTML)
			const table = pane2.body
				.append('table')
				.style('border-spacing', '2px')
				.style('border-collapse', 'separate')
			const tr = table.append('tr')
			tr.append('td')
				.text('Sample')
				.style('font-size', '.8em')
				.style('opacity', 0.5)
			tr.append('td')
				.text(plot.gecfg.datatype)
				.style('font-size', '.8em')
				.style('opacity', 0.5)

			for (const [i, d] of pp.data.lst.entries()) {
				const tr = table.append('tr')
				//if(!(i%2)) tr.style('background','#f1f1f1')

				const td = tr.append('td').text(d.sample)

				if (plot.clicksample) {
					td.attr('class', 'sja_clbtext').on('click', () => {
						plot.clicksample(d, group, plot)
					})
				}

				tr.append('td').text(d.value)
			}
		})

	pp.svg = pp.holder.append('svg')

	pp.g0 = pp.svg.append('g')

	const axisg = pp.svg.append('g')

	const axiswidth = 400
	const circleradius = 6
	const axisticksize = 6
	const axislabelfontsize = 14
	const axispad = 10
	const statuscolpad = 5
	const circleyshift = 2

	pp.place = () => {
		// determine width of status columns
		// if there are text, set by text width, otherwise default width
		for (const col of pp.statuscolumns) {
			// default width
			col.width = 20
			for (const d of pp.data.lst) {
				if (!d.status2cell) continue
				const cell = d.status2cell.get(col.name)
				if (!cell) continue
				if (cell.label) {
					cell.label.attr('font-size', circleradius * 2 - 2).each(function() {
						col.width = Math.max(col.width, this.getBBox().width + 2)
					})
				}
			}
		}

		let samplenamewidth = 0
		for (const d of pp.data.lst) {
			if (d.samplelabel) {
				d.samplelabel
					.attr('font-size', circleradius * 2 - 1)
					.attr('x', -statuscolpad)
					.attr('y', circleradius)
					.each(function() {
						samplenamewidth = Math.max(samplenamewidth, this.getBBox().width)
					})
			}
		}

		let statuslabelheight = 0

		let statustotalwidth = 0
		for (const col of pp.statuscolumns) {
			if (!col.g) {
				col.g = pp.g0.append('g')
				col.namelabel = col.g
					.append('text')
					.attr('font-family', client.font)
					.attr('dominant-baseline', 'central')
					.attr('transform', 'rotate(-90)')
					.text(col.name)
			}

			col.g.attr('transform', 'translate(' + (statustotalwidth + col.width / 2) + ',0)')

			col.namelabel.attr('font-size', Math.min(15, col.width)).each(function() {
				statuslabelheight = Math.max(statuslabelheight, this.getBBox().width)
			})

			statustotalwidth += col.width + statuscolpad
		}
		statustotalwidth += circleradius

		const topheight = Math.max(statuslabelheight, axisticksize + axislabelfontsize + 20)

		pp.g0.attr('transform', 'translate(' + (samplenamewidth + statuscolpad) + ',' + topheight + ')')

		pp.axislabel.attr('x', statustotalwidth + axiswidth / 2)

		axisg.attr('transform', 'translate(' + (samplenamewidth + statuscolpad + statustotalwidth) + ',' + topheight + ')')

		// fpkm value scale
		const scale0 = (pp.uselog ? scaleLog() : scaleLinear())
			.domain([pp.data.min == 0 ? 0.001 : pp.data.min, pp.data.max])
			.range([0, axiswidth])
		const scale = v => {
			if (pp.uselog) {
				if (v == 0) return 0
				// should not use log in case of negative value
			}
			return scale0(v)
		}

		client.axisstyle({
			axis: axisg.transition().call(
				axisTop()
					.scale(scale0)
					.tickSize(axisticksize)
			),
			showline: 1
		})

		let y = axispad

		for (const [idx, d] of pp.data.lst.entries()) {
			d.rowg.attr('transform', 'translate(0,' + y + ')')

			if (d.rowbg) {
				d.rowbg.attr('width', statustotalwidth + axiswidth).attr('height', circleradius * 2)
			}

			d.circle
				.transition()
				.attr('r', circleradius)
				.attr('cx', statustotalwidth + scale(d.value))
				.attr('cy', circleradius)

			if (d.samplelabel) {
				// full row

				if (idx > 0 && !pp.data.lst[idx - 1].samplelabel) {
					// previous row is not full, still shift it down
					y += circleradius * 2 - circleyshift
					d.rowg.attr('transform', 'translate(0,' + y + ')')
				}

				if (d.status2cell) {
					let x = 0
					for (const col of pp.statuscolumns) {
						const cell = d.status2cell.get(col.name)
						if (cell) {
							cell.g.attr('transform', 'translate(' + (x + col.width / 2) + ',' + circleradius + ')')
							cell.rect
								.attr('x', -col.width / 2)
								.attr('y', -circleradius)
								.attr('width', col.width)
								.attr('height', circleradius * 2)
						}
						x += col.width + statuscolpad
					}
				}

				y += circleradius * 2
			} else {
				// tight row
				y += circleyshift
			}
		}

		pp.svg
			.attr('width', samplenamewidth + statuscolpad + statustotalwidth + axiswidth + circleradius)
			.attr('height', topheight + axispad + y + circleradius * 2)
		// end of pp.place()
	}

	pp.makegraph = () => {
		const _p = pp._plot

		pp.axislabel = pp.g0
			.append('text')
			.attr('font-size', 14)
			.attr('font-family', client.font)
			.attr('text-anchor', 'middle')
			.attr('y', -25)
			.text(_p.gene + ' ' + _p.gecfg.datatype)

		for (const d of pp.data.lst) {
			expressionstat.measure(d, _p.gecfg)
		}

		// consult pp to check what attribute to use for expanding

		let hasgain = false,
			hasloss = false,
			hassv = false,
			hasase = false,
			hasoutlier = false
		for (const d of pp.data.lst) {
			if (d.gain) hasgain = true
			if (d.loss) hasloss = true
			if (d.sv) hassv = true
			if (d.estat.ase_monoallelic || d.estat.ase_uncertain || d.estat.ase_biallelic) hasase = true
			if (d.estat.outlier || d.estat.outlier_asehigh) hasoutlier = true
		}

		pp.statuscolumns = []

		// TODO may show text inside status cell, so will determine column width here

		if (hasgain) {
			pp.statuscolumns.push({
				name: label_cnvgain
				//width:20,
			})
		}
		if (hasloss) {
			pp.statuscolumns.push({
				name: label_cnvloss
				//width:20,
			})
		}
		if (hassv) {
			pp.statuscolumns.push({
				name: label_sv,
				width: 20
			})
		}
		if (hasase) {
			pp.statuscolumns.push({
				name: label_ase,
				width: 20
			})
		}
		if (hasoutlier) {
			pp.statuscolumns.push({
				name: label_outlier,
				width: 20
			})
		}

		for (const d of pp.data.lst) {
			d.rowg = pp.g0.append('g')

			if (d.gain || d.loss || d.sv || d.estat.ase_monoallelic || d.estat.ase_biallelic || d.estat.ase_uncertain) {
				// has status, show bg row
				d.rowbg = d.rowg.append('rect').attr('class', 'sja_bgbox')
			}

			d.circle = d.rowg
				.append('circle')
				.attr('fill', 'white')
				.attr('fill-opacity', 0)
				.attr('stroke', '#858585')
				.on('mouseover', () => {
					tooltip_pp(d, _p.tip.clear().d, pp)
					_p.tip.show(d3event.clientX, d3event.clientY)
				})
				.on('mouseout', () => {
					_p.tip.hide()
				})

			if (_p.clicksample) {
				d.circle.on('click', () => {
					_p.clicksample(d, group, _p)
				})
			}

			// make cells
			const status2cell = new Map()

			if (d.gain) {
				const cell = { g: d.rowg.append('g') }
				cell.rect = cell.g.append('rect').attr('fill', _p.color.cnvgain)
				status2cell.set(label_cnvgain, cell)
			}

			if (d.loss) {
				const cell = { g: d.rowg.append('g') }
				cell.rect = cell.g.append('rect').attr('fill', _p.color.cnvloss)
				status2cell.set(label_cnvloss, cell)
			}

			if (d.sv) {
				const cell = { g: d.rowg.append('g') }
				cell.rect = cell.g.append('rect').attr('fill', _p.color.sv)
				status2cell.set(label_sv, cell)
			}

			if (d.estat.ase_monoallelic || d.estat.ase_biallelic || d.estat.ase_uncertain) {
				// ase cell, will print word in the cell
				const cell = { g: d.rowg.append('g') }
				;(cell.rect = cell.g.append('rect').attr('fill', expressionstat.ase_color(d, _p.gecfg))),
					(cell.label = cell.g
						.append('text')
						.text(d.estat.ase_monoallelic ? 'Mono' : d.estat.ase_biallelic ? 'Bi' : '?')
						.attr('font-family', client.font)
						.attr('dominant-baseline', 'central')
						.attr('text-anchor', 'middle')
						.attr('fill', 'white'))
				status2cell.set(label_ase, cell)
			}

			if (d.estat.outlier) {
				const cell = { g: d.rowg.append('g') }
				cell.rect = cell.g.append('rect').attr('fill', _p.gecfg.outlier.color_outlier)
				status2cell.set(label_outlier, cell)
			} else if (d.estat.outlier_asehigh) {
				const cell = { g: d.rowg.append('g') }
				cell.rect = cell.g.append('rect').attr('fill', _p.gecfg.outlier.color_outlier_asehigh)
				status2cell.set(label_outlier, cell)
			}

			if (status2cell.size) {
				d.status2cell = status2cell
				d.samplelabel = d.rowg
					.append('text')
					.attr('font-family', client.font)
					.attr('text-anchor', 'end')
					.attr('dominant-baseline', 'central')
					.text(d.sample)
			}
		}
		pp.place()
		// end of pp.makegraph()
	}

	loadplot2(pp)
}

async function loadplot2(pp) {
	const _p = pp._plot
	const arg = {
		genome: _p.genome.name,
		gene: _p.gene,
		chr: _p.chr,
		start: _p.start,
		stop: _p.stop,
		getgroup: pp.getgroup,
		getgroup_unannotated: pp.getgroup_unannotated,
		svcnv: _p.svcnv,
		sampleset: _p.sampleset
	}
	if (_p.dslabel) {
		arg.dslabel = _p.dslabel
		arg.querykey = _p.querykey
	} else {
		arg.iscustom = 1
		arg.file = _p.file
		arg.url = _p.url
		arg.indexURL = _p.indexURL
	}

	pp.g0
		.append('text')
		.text('Loading ...')
		.attr('font-size', 20)
		.attr('text-anchor', 'center')
		.attr('dominant-baseline', 'central')
		.attr('x', pp.svg.attr('width') / 2)
		.attr('y', pp.svg.attr('height') / 2)

	try {
		const data = await client.dofetch2('mdsgeneboxplot', { method: 'POST', body: JSON.stringify(arg) })
		if (data.error) throw data.error
		pp.g0.selectAll('*').remove()
		pp.data = data
		pp.makegraph()
	} catch (e) {
		client.sayerror(pp.errdiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

function tooltip_pp(d, holder, pp) {
	const lst = [{ k: 'sample', v: d.sample }, { k: pp._plot.gecfg.datatype, v: d.value }]
	if (d.gain || d.loss || d.sv) {
		const l2 = []
		if (d.gain) {
			l2.push(
				'<span style="padding:0px 5px;color:white;background:' + pp._plot.color.cnvgain + '">Copy number gain</span>'
			)
		}
		if (d.loss) {
			l2.push(
				'<span style="padding:0px 5px;color:white;background:' + pp._plot.color.cnvloss + '">Copy number loss</span>'
			)
		}
		if (d.sv) {
			l2.push('<span style="padding:0px 5px;color:white;background:' + pp._plot.color.sv + '">SV</span>')
		}
		lst.push({ k: 'Overlap', v: l2.join(' ') })
	}

	const table = client.make_table_2col(holder, lst)
	expressionstat.showsingleitem_table(d, pp._plot.gecfg, table)
}

/********** init2 ends *************/

function mayaddgrouperselect(plot) {
	/*
quick fix!!

generate a <select> with options based on plot.boxplotgroupers
*/
	if (!plot.boxplotgroupers) return
	const select = plot.buttonrow.append('select').on('change', () => {
		plot.index_boxplotgroupers = d3event.target.selectedIndex
		loadplot(plot)
	})
	for (const [idx, name] of plot.boxplotgroupers.entries()) {
		select.append('option').text(name)
	}
}

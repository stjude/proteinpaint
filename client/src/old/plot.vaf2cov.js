import { select as d3select, event as d3event } from 'd3-selection'
import * as client from '../client'
import { scaleLinear, scaleOrdinal, schemeCategory10 } from 'd3-scale'
import { axisBottom, axisLeft } from 'd3-axis'
import { format as d3format } from 'd3-format'

/*

One scatterplot for a group of samples of the same sampletype (or no sampletype at all)

	x axis: coverage
	y axis: VAF

	also show histograms for x and y

alternative: paired normal-tumor 2d-VAF plot may be more informative

*/

export default function plot_vaf2cov(arg) {
	/*
	.holder
	.data[ {} ]
		.mut
		.total
		.maf
		.sampleobj
	.tip
	.width
	.height
	.bincount
	.color
	.samplecolor
	.maxtotal
	.automax  bool
	.genotype bool
		if .genotype, .color will be added to data[i]

.data will be modified
*/

	// sampleobj is optional
	for (const i of arg.data) {
		if (!i.sampleobj) i.sampleobj = {}
	}

	let width = arg.width || 200
	let height = arg.height || 200
	const gray = arg.color || '#999'
	let marksize

	// max coverage
	let maxtotal = arg.maxtotal || 0
	if (arg.automax) {
		for (const i of arg.data) {
			maxtotal = Math.max(maxtotal, i.total)
		}
	}

	// max maf
	let maxf = 1

	// bins for histogram
	const xbin = []
	const ybin = []
	const bincount = arg.bincount || 20

	for (let i = 0; i < bincount; i++) {
		xbin.push(0)
		ybin.push(0)
	}

	{
		const xbs = maxtotal / bincount
		const ybs = maxf / bincount
		for (const i of arg.data) {
			if (i.total >= maxtotal) {
				xbin[bincount - 1]++
			} else {
				xbin[Math.floor(i.total / xbs)]++
			}
			ybin[Math.floor((i.maf == 1 ? 0.99 : i.maf) / ybs)]++
		}
	}

	const xbinmax = Math.max(...xbin)
	const ybinmax = Math.max(...ybin)

	const xscale = scaleLinear().domain([0, maxtotal]),
		yscale = scaleLinear().domain([0, maxf]),
		xbinscale = scaleLinear().domain([0, xbinmax]),
		ybinscale = scaleLinear().domain([0, ybinmax])

	const svg = arg.holder.append('svg').style('margin', '10px')

	const xlab = svg
		.append('text')
		.text('Coverage')
		.attr('text-anchor', 'middle')
		.attr('fill', gray)
		.attr('font-family', client.font)

	const ylabg = svg.append('g')
	const ylab = ylabg
		.append('text')
		.text('VAF')
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'middle')
		.attr('fill', gray)
		.attr('font-family', client.font)
		.attr('transform', 'rotate(-90)')
	const xaxis = svg.append('g')
	const yaxis = svg.append('g')
	const boxg = svg.append('g')
	const box = boxg
		.append('rect')
		.attr('stroke', gray)
		.attr('stroke-dasharray', '2,2')
		.attr('fill', 'none')
		.attr('shape-rendering', 'crispEdges')
	const midline = boxg
		.append('line')
		.attr('stroke', gray)
		.attr('stroke-dasharray', '2,2')
		.attr('shape-rendering', 'crispEdges')
	// ybin
	const ybing = svg.append('g')
	const ybinbar = ybing
		.selectAll()
		.data(ybin)
		.enter()
		.append('rect')
	const ybinaxis = svg.append('g')
	// xbin
	const xbing = svg.append('g')
	const xbinbar = xbing
		.selectAll()
		.data(xbin)
		.enter()
		.append('rect')
	const xbinaxis = svg.append('g')
	// genotype
	let gtg = null,
		gtlab,
		gt,
		gtl1,
		gtl2,
		gtname

	if (arg.genotype) {
		const gtcolor = scaleOrdinal(schemeCategory10)
		const set = new Set()
		for (const d of arg.data) {
			if (d.genotype) {
				set.add(d.genotype)
				d.color = gtcolor(d.genotype)
			}
		}
		const lst = [...set]
		gtg = svg.append('g')
		gtlab = gtg
			.append('text')
			.text('Genotype')
			.attr('dominant-baseline', 'central')
			.attr('font-family', client.font)
		gt = gtg
			.selectAll()
			.data(lst)
			.enter()
			.append('g')
		gtl1 = gt.append('line').attr('stroke', d => gtcolor(d))
		gtl2 = gt.append('line').attr('stroke', d => gtcolor(d))
		gtname = gt
			.append('text')
			.text(d => d)
			.attr('fill', d => gtcolor(d))
			.attr('dominant-baseline', 'central')
			.attr('font-family', client.font)
	}

	// sample crosses
	const spg = boxg
		.selectAll()
		.data(arg.data)
		.enter()
		.append('g')
	const spgl1 = spg
		.append('line')
		.attr('stroke-opacity', 0.6)
		.attr('stroke', d => (d.color ? d.color : d.sampleobj.color || arg.samplecolor))
		.each(function(d) {
			d.crosshair1 = d3select(this)
		})
	const spgl2 = spg
		.append('line')
		.attr('stroke-opacity', 0.6)
		.attr('stroke', d => (d.color ? d.color : d.sampleobj.color || arg.samplecolor))
		.each(function(d) {
			d.crosshair2 = d3select(this)
		})
	const spgkick = spg
		.append('circle')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.on('mouseover', d => {
			d.crosshair1
				.attr('stroke-width', 3)
				.attr('x1', -marksize - 2)
				.attr('y1', -marksize - 2)
				.attr('x2', marksize + 2)
				.attr('y2', marksize + 2)
			d.crosshair2
				.attr('stroke-width', 3)
				.attr('x1', marksize + 2)
				.attr('y1', -marksize - 2)
				.attr('x2', -marksize - 2)
				.attr('y2', marksize + 2)
			arg.tip.clear()
			arg.tip.show(d3event.clientX, d3event.clientY)
			const lst = [{ k: 'mut', v: d.mut }, { k: 'total', v: d.total }]
			if (d.genotype) {
				lst.push({ k: 'genotype', v: d.genotype })
			}
			for (const k in d.sampleobj) {
				if (k == 'color') continue
				lst.push({ k: k, v: d.sampleobj[k] })
			}
			client.make_table_2col(arg.tip.d, lst).style('margin', 'none')

			if (arg.mouseover) {
				arg.mouseover(d)
			}
		})

		.on('mouseout', d => {
			d.crosshair1
				.attr('stroke-width', 1)
				.attr('x1', -marksize)
				.attr('y1', -marksize)
				.attr('x2', marksize)
				.attr('y2', marksize)
			d.crosshair2
				.attr('stroke-width', 1)
				.attr('x1', marksize)
				.attr('y1', -marksize)
				.attr('x2', -marksize)
				.attr('y2', marksize)
			arg.tip.hide()

			if (arg.mouseout) {
				arg.mouseout(d)
			}
		})
	if (arg.click) {
		spgkick.on('click', d => {
			arg.click(d)
		})
	}

	const drag = svg
		.append('text')
		.text('drag to resize')
		.attr('class', 'sja_clbtext')
		.attr('font-size', 13)
		.attr('text-anchor', 'end')
		.attr('fill', gray)
		.on('mousedown', () => {
			d3event.preventDefault()
			const b = d3select(document.body)
			const x0 = d3event.clientX,
				y0 = d3event.clientY,
				width0 = width,
				height0 = height
			b.on('mousemove', () => {
				width = width0 + d3event.clientX - x0
				height = height0 + d3event.clientY - y0
				resize()
			})
			b.on('mouseup', () => {
				b.on('mousemove', null).on('mouseup', null)
			})
		})

	function resize() {
		const fontsize = Math.max(12, Math.min(width, height) / 25)
		const pad2 = height / 20
		marksize = Math.ceil(fontsize / 3)
		const ticksize = marksize,
			axisw = ticksize + fontsize * 3,
			axish = ticksize + 20,
			pad = fontsize * 1.3,
			pad0 = fontsize * 1.6,
			barheight = height / 5,
			barwidth = width / 5
		xscale.range([0, width])
		yscale.range([height, 0])
		xbinscale.range([barheight, 0])
		ybinscale.range([0, barwidth])
		svg
			.attr('width', fontsize + axisw + pad0 + width + pad + barwidth + pad2 + ticksize)
			.attr('height', fontsize / 2 + barheight + pad + height + pad0 + axish + ticksize + fontsize)
		xlab
			.attr('font-size', fontsize)
			.attr('x', fontsize + axisw + pad0 + width / 2)
			.attr('y', fontsize / 2 + barheight + pad + height + pad0 + axish + ticksize + fontsize - 5)
		ylabg.attr('transform', 'translate(' + fontsize + ',' + (fontsize / 2 + barheight + pad + height / 2) + ')')
		ylab.attr('font-size', fontsize)
		xaxis
			.attr(
				'transform',
				'translate(' + (fontsize + axisw + pad0) + ',' + (fontsize / 2 + barheight + pad + height + pad0) + ')'
			)
			.call(
				axisBottom()
					.scale(xscale)
					.ticks(4)
					.tickSize(ticksize)
			)
		client.axisstyle({
			axis: xaxis,
			color: gray,
			fontsize: fontsize,
			showline: true
		})
		yaxis.attr('transform', 'translate(' + (fontsize + axisw) + ',' + (fontsize / 2 + barheight + pad) + ')').call(
			axisLeft()
				.scale(yscale)
				.ticks(5)
				.tickSize(ticksize)
		)
		client.axisstyle({
			axis: yaxis,
			color: gray,
			fontsize: fontsize,
			showline: true
		})
		boxg.attr('transform', 'translate(' + (fontsize + axisw + pad0) + ',' + (fontsize / 2 + barheight + pad) + ')')
		box.attr('width', width).attr('height', height)
		midline
			.attr('y1', height / 2)
			.attr('x2', width)
			.attr('y2', height / 2)

		spg.attr(
			'transform',
			d => 'translate(' + xscale(d.total > maxtotal ? maxtotal : d.total) + ',' + yscale(d.maf) + ')'
		)

		spgl1
			.attr('x1', -marksize)
			.attr('y1', -marksize)
			.attr('x2', marksize)
			.attr('y2', marksize)
		spgl2
			.attr('x1', marksize)
			.attr('y1', -marksize)
			.attr('x2', -marksize)
			.attr('y2', marksize)
		spgkick.attr('r', marksize)
		ybing.attr(
			'transform',
			'translate(' + (fontsize + axisw + pad0 + width + pad) + ',' + (fontsize / 2 + barheight + pad + height) + ')'
		)

		const binh = height / bincount
		ybinbar
			.attr('y', (d, i) => -binh * (i + 1))
			.attr('width', d => ybinscale(d))
			.attr('height', binh)
			.attr('fill', gray)
		ybinaxis
			.attr(
				'transform',
				'translate(' +
					(fontsize + axisw + pad0 + width + pad) +
					',' +
					(fontsize / 2 + barheight + pad + height + pad0) +
					')'
			)
			.call(
				axisBottom()
					.scale(ybinscale)
					.tickValues([0, ybinmax])
					.tickFormat(d3format('d'))
			)
		client.axisstyle({
			axis: ybinaxis,
			color: gray,
			showline: true
		})
		xbing.attr('transform', 'translate(' + (fontsize + axisw + pad0) + ',' + (fontsize / 2 + barheight) + ')')
		const binw = width / bincount
		xbinbar
			.attr('x', (d, i) => binw * i)
			.attr('y', d => xbinscale(d) - barheight)
			.attr('height', d => barheight - xbinscale(d))
			.attr('width', binw)
			.attr('fill', gray)
		xbinaxis.attr('transform', 'translate(' + (fontsize + axisw) + ',' + fontsize / 2 + ')').call(
			axisLeft()
				.scale(xbinscale)
				.tickValues([0, xbinmax])
				.tickFormat(d3format('d'))
		)
		client.axisstyle({
			axis: xbinaxis,
			color: gray,
			showline: true
		})
		drag
			.attr('x', fontsize + axisw + pad0 + width + pad + barwidth + pad2 + ticksize - 5)
			.attr('y', fontsize / 2 + barheight + pad + height + pad0 + axish + ticksize + fontsize - 5)

		if (gtg) {
			gtg.attr('transform', 'translate(' + (fontsize + axisw + pad0 + width + pad) + ',' + fontsize / 2 + ')')
			gtlab.attr('font-size', fontsize)
			gt.attr('transform', (d, i) => {
				return 'translate(0,' + (fontsize / 2 + 3 + (fontsize + 1) * i + fontsize / 2) + ')'
			})
			gtl1
				.attr('y1', -fontsize / 2)
				.attr('x2', fontsize)
				.attr('y2', fontsize / 2)
			gtl2
				.attr('x1', fontsize)
				.attr('y1', -fontsize / 2)
				.attr('y2', fontsize / 2)
			gtname.attr('x', fontsize + 5).attr('font-size', fontsize)
		}
	}
	resize()

	return spg
}

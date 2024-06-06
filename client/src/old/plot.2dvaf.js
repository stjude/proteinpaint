import * as client from '../client'
import { scaleLinear } from 'd3-scale'
import { axisBottom, axisLeft, axisRight } from 'd3-axis'

/*
for germline variants of:
	- normal vs tumor
	- germline vs diagnosis vs relapse

compared to cov-vaf plot, this can represent 2 or 3 group of samples identified by different sample type

not the same thing as 2dmaf




args:

 (configuration)
cfg{}
	.individualkey
	.sampletypekey
	.xsampletype
	.yleftsampletype
	.yrightsampletype


data[{}]
	each element for one patient, with multiple sampletypes, each sampletype as one axis
	.<cfg.individualkey>
	.sampletypes{}
		.<cfg.xsampletype>
		.<cfg.yleftsampletype>
		.<cfg.yrightsampletype>
			.total
			.vaf
	.color (optional)


each datapoint:
	- should have .individualkey (e.g. patient name), as a way of telling what data points are about different samples of the same patient
	- should represent a combination of .xsampletype and .y(left/right)sampletype, but not both
	  using .sampletypes{} to tell if the datapoint should be rendered on left or right



*/

const gray = '#999'
const centercolor = '#d95f02'
const xcolor = '#7570b3'
const ycolor = '#1b9e77' // left
const yrcolor = '#c51b8a' // right
const rectfill = '#f3f3f3'

const dotstrokeopacity = 0.9 // circle or rect

export default function plot_2dvaf(data, cfg, holder) {
	if (cfg.individualcategories) {
		/*
	individuals are associated with categorical attribute
	e.g. hm/bt/st as patient diagnosis group
	will use this to assign color to each individual
	*/
		for (const d of data) {
			const value = d[cfg.individualcategories.categorykey]
			if (value && cfg.individualcategories.categories[value]) {
				// has valid value
				d.color = cfg.individualcategories.categories[value].color
			}
		}
	}

	const ik = cfg.individualkey

	{
		// header, showing sample count, category legend
		const div = holder.append('div').style('margin', '5px 10px 10px 30px')

		// show total # of ik
		const s = new Set()
		for (const d of data) {
			s.add(d[ik])
		}
		div.append('div').text(s.size + ' ' + ik + (s.size > 1 ? 's' : ''))

		if (cfg.individualcategories) {
			for (const k in cfg.individualcategories.categories) {
				// count # of individuals with this category
				const s = new Set()
				for (const d of data) {
					const ikname = d[ik]
					if (!ikname) continue
					if (d[cfg.individualcategories.categorykey] == k) {
						s.add(ikname)
					}
				}
				const row = div.append('div').style('margin', '5px')
				row
					.append('div')
					.style('display', 'inline-block')
					.attr('class', 'sja_mcdot')
					.style('background-color', cfg.individualcategories.categories[k].color)
					.style('padding', '1px 3px')
					.text(s.size)
					.style('margin-right', '5px')
				row
					.append('span')
					.text(cfg.individualcategories.categories[k].label || k)
					.style('color', cfg.individualcategories.categories[k].color)
			}
		}
	}

	const tip = new client.Menu({ border: 'none', padding: '0px' })

	//// mouse over dots anywhere

	const mouseover = (s, x, y) => {
		if (circle_yleft) {
			circle_yleft.filter(d => d[ik] == s[ik]).attr('fill-opacity', 0.5)
		}
		if (circle_yright) {
			circle_yright.filter(d => d[ik] == s[ik]).attr('fill-opacity', 0.5)
		}
		circle_xdp.filter(d => d[ik] == s[ik]).attr('fill-opacity', 0.5)
		circle_center.filter(d => d[ik] == s[ik]).attr('fill-opacity', 0.5)
		tip.show(x, y)
		tip.clear()
		const lst = [
			{ k: ik, v: s[ik] },
			{
				k: cfg.xsampletype,
				v: s.sampletypes[cfg.xsampletype].vaf.toFixed(2) + ', ' + s.sampletypes[cfg.xsampletype].total
			}
		]
		if (cfg.individualcategories) {
			const v = s[cfg.individualcategories.categorykey]
			if (v && cfg.individualcategories.categories[v]) {
				lst.push({
					k: cfg.individualcategories.categorylabel || cfg.individualcategories.categorykey,
					v: cfg.individualcategories.categories[v].label || v
				})
			}
		}
		if (s.sampletypes[cfg.yleftsampletype]) {
			lst.push({
				k: cfg.yleftsampletype,
				v: s.sampletypes[cfg.yleftsampletype].vaf.toFixed(2) + ', ' + s.sampletypes[cfg.yleftsampletype].total
			})
		}
		if (s.sampletypes[cfg.yrightsampletype]) {
			lst.push({
				k: cfg.yrightsampletype,
				v: s.sampletypes[cfg.yrightsampletype].vaf.toFixed(2) + ', ' + s.sampletypes[cfg.yrightsampletype].total
			})
		}
		client.make_table_2col(tip.d, lst)
	}
	const mouseout = s => {
		tip.hide()
		if (circle_yleft) {
			circle_yleft.filter(d => d[ik] == s[ik]).attr('fill-opacity', 0)
		}
		if (circle_yright) {
			circle_yright.filter(d => d[ik] == s[ik]).attr('fill-opacity', 0)
		}
		circle_xdp.filter(d => d[ik] == s[ik]).attr('fill-opacity', 0)
		circle_center.filter(d => d[ik] == s[ik]).attr('fill-opacity', 0)
	}

	let xwidth = 300
	let yheight = 300
	let marksize
	let xvafheight = 80
	let yvafwidth = 80
	let xdpheight = 100
	let ydpheight = 100
	let sp = 10
	let sp2 = 10
	let toppad = 10
	let rightpad = 10
	let radius = 8
	let fontsize = 12
	let ticksize = 6

	let maxdp_x = 0
	let maxdp_yleft = 0
	let maxdp_yright = 0

	for (const d of data) {
		maxdp_x = Math.max(maxdp_x, d.sampletypes[cfg.xsampletype].total)
		if (d.sampletypes[cfg.yleftsampletype]) {
			maxdp_yleft = Math.max(maxdp_yleft, d.sampletypes[cfg.yleftsampletype].total)
		}
		if (d.sampletypes[cfg.yrightsampletype]) {
			maxdp_yright = Math.max(maxdp_yleft, d.sampletypes[cfg.yrightsampletype].total)
		}
	}

	// max vaf
	let maxvaf = 1
	let minvaf = 0

	const scalevaf_x = scaleLinear().domain([minvaf, maxvaf])
	const scalevaf_y = scaleLinear().domain([minvaf, maxvaf])

	const scaledp_x = scaleLinear().domain([0, maxdp_x])
	let scaledp_yleft
	let scaledp_yright
	if (maxdp_yleft) {
		scaledp_yleft = scaleLinear().domain([0, maxdp_yleft])
	}
	if (maxdp_yright) {
		scaledp_yright = scaleLinear().domain([0, maxdp_yright])
	}

	const svg = holder.append('svg').style('margin', '10px')

	//// y left VAF axis

	let axevaf_yleft, axisvaf_yleft, yleftlabg, yleftlab
	if (maxdp_yleft) {
		axevaf_yleft = svg.append('g')
		axisvaf_yleft = axevaf_yleft.append('g')
		yleftlabg = axevaf_yleft.append('g')
		yleftlab = yleftlabg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.text(cfg.yleftsampletype + ' VAF')
			.attr('font-family', client.font)
			.attr('fill', ycolor)
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'central')
	}

	//// y right VAF axis

	let axevaf_yright, axisvaf_yright, yrightlabg, yrightlab
	if (maxdp_yright) {
		axevaf_yright = svg.append('g')
		axisvaf_yright = axevaf_yright.append('g')
		yrightlabg = axevaf_yright.append('g')
		yrightlab = yrightlabg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.text(cfg.yrightsampletype + ' VAF')
			.attr('font-family', client.font)
			.attr('fill', ycolor)
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'central')
	}

	//// x VAF axis

	const axe_xvaf = svg.append('g')
	const axis_xvaf = axe_xvaf.append('g')
	const xlab = axe_xvaf
		.append('text')
		.text(cfg.xsampletype + ' VAF')
		.attr('font-family', client.font)
		.attr('fill', xcolor)
		.attr('text-anchor', 'middle')

	//// y left dp-VAF dot plot

	let axedp_yleft, rectdp_yleft, midlinedp_yleft, axisdp_yleft, dotg_yleft, circle_yleft
	if (maxdp_yleft) {
		axedp_yleft = svg.append('g')
		rectdp_yleft = axedp_yleft
			.append('rect') // background box
			.attr('fill', rectfill)
		midlinedp_yleft = axedp_yleft
			.append('line') // .5 mid line
			.attr('stroke', 'white')
			.attr('stroke-width', 2)
		axisdp_yleft = axedp_yleft.append('g')
		dotg_yleft = axedp_yleft
			.append('g')
			.selectAll()
			.data(data.filter(d => d.sampletypes[cfg.yleftsampletype]))
			.enter()
			.append('g')
		circle_yleft = dotg_yleft
			.append('circle')
			.attr('fill', d => d.color || ycolor)
			.attr('fill-opacity', 0)
			.attr('stroke', d => d.color || ycolor)
			.attr('stroke-opacity', dotstrokeopacity)
			.on('mouseover', (event, d) => mouseover(d, event.clientX, event.clientY))
			.on('mouseout', mouseout)
	}

	//// y right dp-VAF plot

	let axedp_yright, rectdp_yright, midlinedp_yright, axisdp_yright, dotg_yright, circle_yright
	if (maxdp_yright) {
		axedp_yright = svg.append('g')
		rectdp_yright = axedp_yright
			.append('rect') // background box
			.attr('fill', rectfill)
		midlinedp_yright = axedp_yleft
			.append('line') // .5 mid line
			.attr('stroke', 'white')
			.attr('stroke-width', 2)
		axisdp_yright = axedp_yright.append('g')
		dotg_yright = axedp_yright
			.append('g')
			.selectAll()
			.data(data.filter(d => d.sampletypes[cfg.yrightsampletype]))
			.enter()
			.append('g')
		circle_yright = dotg_yright
			.append('rect')
			.attr('fill', d => d.color || ycolor)
			.attr('fill-opacity', 0)
			.attr('stroke', d => d.color || ycolor)
			.attr('stroke-opacity', dotstrokeopacity)
			.on('mouseover', (event, d) => mouseover(d, event.clientX, event.clientY))
			.on('mouseout', mouseout)
	}

	// x dp dot plot is always shown!

	const axe_xdp = svg.append('g')
	const rect_xdp = axe_xdp
		.append('rect') // background box
		.attr('fill', rectfill)
	const midlinedp_x = axe_xdp
		.append('line') // .5 mid line
		.attr('stroke', 'white')
		.attr('stroke-width', 2)
	const dplab = axe_xdp
		.append('text')
		.text('Coverage')
		.attr('text-anchor', 'end')
		.attr('dominant-baseline', 'central')
		.attr('font-family', client.font)
		.attr('fill', gray)
	const axis_xdp = axe_xdp.append('g')
	const dotg_xdp = axe_xdp.append('g').selectAll().data(data).enter().append('g')
	const circle_xdp = dotg_xdp
		.append('circle')
		.attr('fill', d => d.color || xcolor)
		.attr('fill-opacity', 0)
		.attr('stroke', d => d.color || xcolor)
		.attr('stroke-opacity', dotstrokeopacity)
		.on('mouseover', (event, d) => mouseover(d, event.clientX, event.clientY))
		.on('mouseout', mouseout)

	const plotg_center = svg.append('g')
	const rect_center = plotg_center
		.append('rect') // background box
		.attr('fill', rectfill)
	const midline_xcenter = plotg_center
		.append('line') // .5 horizontal mid line
		.attr('stroke', 'white')
		.attr('stroke-width', 2)
	const midline_ycenter = plotg_center
		.append('line') // .5 vertical mid line
		.attr('stroke', 'white')
		.attr('stroke-width', 2)
	const dotg_center = plotg_center.append('g').selectAll().data(data).enter().append('g')
	const circle_center = dotg_center
		.append('circle')
		.attr('fill', d => d.color || centercolor)
		.attr('fill-opacity', 0)
		.attr('stroke', d => d.color || centercolor)
		.attr('stroke-opacity', dotstrokeopacity)
		.on('mouseover', (event, d) => mouseover(d, event.clientX, event.clientY))
		.on('mouseout', mouseout)

	const render = () => {
		xvafheight = ticksize + fontsize + 10 + fontsize * 2
		yvafwidth = ticksize + fontsize * 2 + 10 + fontsize * 2

		sp = radius * 2
		sp2 = ticksize + fontsize + radius + 10

		scalevaf_x.range([0, xwidth])
		scalevaf_y.range([0, -yheight])
		scaledp_x.range([0, xdpheight])
		if (scaledp_yleft) {
			scaledp_yleft.range([0, -ydpheight])
		}
		if (scaledp_yright) {
			scaledp_yright.range([0, ydpheight])
		}

		if (axevaf_yleft) {
			axevaf_yleft.attr('transform', 'translate(' + yvafwidth + ',' + (toppad + yheight) + ')')
			yleftlabg.attr('transform', 'translate(-' + (yvafwidth - fontsize) + ',-' + yheight / 2 + ')')
			yleftlab.attr('font-size', fontsize * 2)
		}
		if (axevaf_yright) {
			axevaf_yright.attr(
				'transform',
				'translate(' +
					((maxdp_yleft ? yvafwidth + sp + ydpheight : 0) + sp2 + xwidth + sp2 + ydpheight + sp) +
					',' +
					(toppad + yheight) +
					')'
			)
			yrightlabg.attr('transform', 'translate(' + (yvafwidth - fontsize) + ',-' + yheight / 2 + ')')
			yrightlab.attr('font-size', fontsize * 2)
		}

		axe_xvaf.attr(
			'transform',
			'translate(' + (yvafwidth + sp + ydpheight + sp2) + ',' + (toppad + yheight + sp2 + xdpheight + sp) + ')'
		)
		xlab
			.attr('font-size', fontsize * 2)
			.attr('x', xwidth / 2)
			.attr('y', xvafheight)

		if (axedp_yleft) {
			axedp_yleft.attr('transform', 'translate(' + (yvafwidth + sp + ydpheight) + ',' + (toppad + yheight) + ')')
			axisdp_yleft.attr('transform', 'translate(0,' + (5 + radius) + ')')
			rectdp_yleft.attr('x', -ydpheight).attr('y', -yheight).attr('width', ydpheight).attr('height', yheight)
			midlinedp_yleft
				.attr('x1', -ydpheight)
				.attr('y1', -yheight / 2)
				.attr('y2', -yheight / 2)
		}

		if (axedp_yright) {
			axedp_yright.attr(
				'transform',
				'translate(' +
					((maxdp_yleft ? yvafwidth + sp + ydpheight : 0) + sp2 + xwidth + sp2) +
					',' +
					(toppad + yheight) +
					')'
			)
			axisdp_yright.attr('transform', 'translate(0,' + (5 + radius) + ')')
			rectdp_yright.attr('y', -yheight).attr('width', ydpheight).attr('height', yheight)
			midlinedp_yright
				.attr('y1', -yheight / 2)
				.attr('y2', -yheight / 2)
				.attr('x2', ydpheight)
		}

		// x dp
		axe_xdp.attr('transform', 'translate(' + (yvafwidth + sp + ydpheight + sp2) + ',' + (toppad + yheight + sp2) + ')')
		axis_xdp.attr('transform', 'translate(-' + (5 + radius) + ',0)')
		rect_xdp.attr('width', xwidth).attr('height', xdpheight)
		midlinedp_x
			.attr('x1', xwidth / 2)
			.attr('x2', xwidth / 2)
			.attr('y2', xdpheight)
		dplab
			.attr('x', -40)
			.attr('y', xdpheight / 2)
			.attr('font-size', fontsize * 1.5)

		// center 2dvaf
		plotg_center.attr('transform', 'translate(' + (yvafwidth + sp + ydpheight + sp2) + ',' + (toppad + yheight) + ')')
		rect_center.attr('y', -yheight).attr('width', xwidth).attr('height', yheight)
		midline_xcenter
			.attr('y1', -yheight / 2)
			.attr('y2', -yheight / 2)
			.attr('x2', xwidth)
		midline_ycenter
			.attr('x1', xwidth / 2)
			.attr('x2', xwidth / 2)
			.attr('y2', -yheight)

		if (axisvaf_yleft) {
			client.axisstyle({
				axis: axisvaf_yleft.call(
					axisLeft()
						.scale(scalevaf_y)
						.tickSize(ticksize - 2)
				),
				showline: true,
				color: gray,
				fontsize: fontsize
			})
		}
		if (axisvaf_yright) {
			client.axisstyle({
				axis: axisvaf_yright.call(
					axisRight()
						.scale(scalevaf_y)
						.tickSize(ticksize - 2)
				),
				showline: true,
				color: gray,
				fontsize: fontsize
			})
		}
		client.axisstyle({
			axis: axis_xvaf.call(
				axisBottom()
					.scale(scalevaf_x)
					.tickSize(ticksize - 2)
			),
			showline: true,
			color: gray,
			fontsize: fontsize
		})
		client.axisstyle({
			axis: axis_xdp.call(
				axisLeft()
					.scale(scaledp_x)
					.tickSize(ticksize - 2)
					.tickValues([0, maxdp_x])
			),
			showline: true,
			color: gray,
			fontsize: fontsize
		})
		if (axisdp_yleft) {
			client.axisstyle({
				axis: axisdp_yleft.call(
					axisBottom()
						.scale(scaledp_yleft)
						.tickSize(ticksize - 2)
						.tickValues([0, maxdp_yleft])
				),
				showline: true,
				color: gray,
				fontsize: fontsize
			})
		}
		if (axisdp_yright) {
			client.axisstyle({
				axis: axisdp_yright.call(
					axisBottom()
						.scale(scaledp_yright)
						.tickSize(ticksize - 2)
						.tickValues([0, maxdp_yright])
				),
				showline: true,
				color: gray,
				fontsize: fontsize
			})
		}

		if (dotg_yleft) {
			dotg_yleft.attr('transform', d => {
				const i = d.sampletypes[cfg.yleftsampletype]
				return 'translate(' + scaledp_yleft(i.total) + ',' + scalevaf_y(i.vaf) + ')'
			})
		}
		if (dotg_yright) {
			dotg_yright.attr('transform', d => {
				const i = d.sampletypes[cfg.yrightsampletype]
				return 'translate(' + scaledp_yright(i.total) + ',' + scalevaf_y(i.vaf) + ')'
			})
		}
		dotg_xdp.attr('transform', d => {
			const i = d.sampletypes[cfg.xsampletype]
			return 'translate(' + scalevaf_x(i.vaf) + ',' + scaledp_x(i.total) + ')'
		})
		dotg_center.attr('transform', d => {
			const x = d.sampletypes[cfg.xsampletype]
			const y = d.sampletypes[cfg.yleftsampletype] || d.sampletypes[cfg.yrightsampletype]
			return 'translate(' + scalevaf_x(x.vaf) + ',' + scalevaf_y(y.vaf) + ')'
		})

		circle_xdp.attr('r', radius)
		circle_center.attr('r', radius)
		if (circle_yleft) {
			circle_yleft.attr('r', radius)
		}
		if (circle_yright) {
			circle_yright
				.attr('x', -radius)
				.attr('y', -radius)
				.attr('width', radius * 2)
				.attr('height', radius * 2)
		}

		svg
			.attr(
				'width',
				(maxdp_yleft ? yvafwidth + sp + ydpheight : 0) +
					sp2 +
					xwidth +
					sp2 +
					(maxdp_yright ? ydpheight + sp + yvafwidth : 0)
			)
			.attr('height', toppad + yheight + sp2 + xdpheight + sp + xvafheight)
	}
	render()
}

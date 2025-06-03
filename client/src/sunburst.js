import { select as d3select } from 'd3-selection'
import { stratify, partition } from 'd3-hierarchy'
import { arc as d3arc } from 'd3-shape'
import { rgb as d3rgb } from 'd3-color'
import { scaleOrdinal } from 'd3-scale'
import { schemeCategory10 } from 'd3-scale-chromatic'

import { textlensf } from './client'

/*
may be p4-ready

todo:
- custom color scheme

*/

const dur1 = 500 // needs annotation
const dur2 = 250

export default function (opts) {
	const {
		occurrence,
		boxyoff,
		boxheight,
		boxwidth,
		svgheight,
		g,
		pica,
		cx,
		cy,
		nodes,
		chartlabel,
		click_ring,
		click_listbutton
	} = opts

	g.attr('transform', 'translate(' + cx + ',' + cy + ')')

	const suncolor = scaleOrdinal(schemeCategory10)

	const eye = g.append('g')
	const ring = g.append('g')
	const sun = { g, eye, ring, pica, busy: false, boxyoff, svgheight, cx, cy }

	const radius = Math.max(boxheight * 0.2, Math.min(boxheight * 0.42, Math.log(occurrence) * 24))
	// radius is set, shift g if it get outside

	if (cx < radius) {
		sun.cx = radius
	} else if (cx + radius > boxwidth) {
		sun.cx = boxwidth - radius
	}
	if (cy < radius) {
		sun.cy = radius
	} else if (cy + radius > boxheight) {
		sun.cy = boxheight - radius
	}
	g.transition()
		.delay(dur1 + dur2)
		.attr('transform', 'translate(' + sun.cx + ',' + sun.cy + ')')

	// hierarchy
	const root = stratify()(nodes)
	root.sum(i => i.value)
	root.sort((a, b) => b.value - a.value)
	partition().size([1, Math.pow(radius, 2)])(root)

	// blocker
	eye.append('circle').attr('r', radius).attr('fill', 'white').attr('fill-opacity', 0)

	let emptyspace
	const arcfunc = d3arc()
		.startAngle(d => Math.PI * 2 * d.x0)
		.endAngle(d => Math.PI * 2 * d.x1)
		.innerRadius(d => {
			if (!d.parent) {
				emptyspace = Math.sqrt(d.y1) - radius / 15
				return emptyspace
			}
			return Math.sqrt(d.y0)
		})
		.outerRadius(d => {
			d.outradius = Math.sqrt(d.y1)
			return d.outradius
		})

	ring
		.selectAll()
		.data(root.descendants())
		.enter()
		.append('path')
		.attr('d', arcfunc)
		.attr('stroke', 'white')
		.attr('fill', d => {
			if (!d.parent) {
				// is root
				return 'white'
			}
			// which key to use for assigning color for this wedge
			let key
			if (d.children) {
				key = d.id
			} else {
				if (!d.parent.parent) {
					// parent is root, still use self
					key = d.id
				} else {
					key = d.parent.id
				}
			}
			const c = suncolor(key)
			d._color = c
			return c
		})
		.on('mouseover', (event, d) => {
			if (!d.parent) return
			if (sun.busy) return

			event.target.setAttribute('fill', d3rgb(d._color).darker(0.5).toString())
			slicemouseover(d, sun)
		})
		.on('mouseout', (event, d) => {
			pica.g.selectAll('*').remove()
			if (!d.parent) return
			event.target.setAttribute('fill', d._color)
		})
		.on('click', async (event, d) => {
			if (!click_ring) return // no callback
			if (sun.busy) return // do not allow clicking while is busy. this prevents a bug in gdc mds3 that double-clicking on a ring will issue two sample-fetching requests and show the same sample table twice
			sun.busy = true
			await click_ring(event, d)
			sun.busy = false
		})

	const eyeheight = emptyspace * 2
	ring
		.attr('transform', 'scale(.3,.3)')
		.attr('fill-opacity', 0)
		.transition()
		.duration(dur1)
		.attr('transform', 'scale(1,1)')
		.attr('fill-opacity', 1)
		.on('end', () => {
			eye.shutter = eye
				.append('rect')
				.attr('x', -emptyspace)
				.attr('y', -emptyspace)
				.attr('width', emptyspace * 2)
				.attr('height', 0)
				.attr('fill', '#ededed')
				.on('click', () => remove(sun))
			eye.shutter
				.transition()
				.duration(dur2)
				.attr('height', emptyspace * 2)
				.on('end', () => {
					// shutter done, add things
					eye.fore = eye.append('g')
					const fontsize1 = Math.min(eyeheight / (chartlabel.length * textlensf), emptyspace * 0.6)
					eye.fore
						.append('text')
						.text(chartlabel)
						.attr('text-anchor', 'middle')
						.attr('dominant-baseline', 'central')
						.attr('fill', '#858585')
						.attr('font-weight', 'bold')
						.attr('font-family', 'Arial')
						.attr('font-size', fontsize1)
					const fontsize = Math.min(
						18,
						Math.min(
							(emptyspace * 0.7) / (occurrence.toString().length * textlensf),
							(emptyspace - fontsize1 / 2) * 0.7
						)
					)
					eye.fore
						.append('text')
						.text(occurrence)
						.attr('text-anchor', 'middle')
						.attr('fill', '#858585')
						.attr('y', -fontsize1 / 2 - 2)
						.attr('font-family', 'Arial')
						.attr('font-size', fontsize)
					eye
						.append('rect')
						.attr('x', -emptyspace)
						.attr('y', -emptyspace)
						.attr('width', emptyspace * 2)
						.attr('height', emptyspace * 2)
						.attr('fill', 'black')
						.attr('fill-opacity', 0)
						.on('click', () => {
							if (sun.busy) return
							remove(sun)
						})
						.on('mousedown', event => {
							event.preventDefault()
							event.stopPropagation()
							const mx = event.clientX,
								my = event.clientY,
								body = d3select(document.body)
							let cx0 = sun.cx,
								cy0 = sun.cy
							body
								.on('mousemove', event => {
									sun.busy = true // must set here but not mousedown
									sun.cx = cx0 + event.clientX - mx
									sun.cy = cy0 + event.clientY - my
									g.attr('transform', 'translate(' + sun.cx + ',' + sun.cy + ')')
								})
								.on('mouseup', () => {
									setTimeout(() => (sun.busy = false), 10)
									body.on('mousemove', null).on('mouseup', null)
								})
						})

					if (click_listbutton) {
						// button at bottom
						sun.listbutt = eye.append('g').attr('transform', 'translate(0,' + fontsize1 / 2 + ')')
						const listbutt_bg = sun.listbutt
							.append('rect')
							.attr('x', -eyeheight / 2)
							.attr('width', eyeheight)
							.attr('height', emptyspace - fontsize1 / 2)
							.attr('fill', '#d9d9d9')
						const listbutt_text = sun.listbutt
							.append('text')
							.text('Info')
							.attr('y', (emptyspace - fontsize1 / 2) / 2)
							.attr('dominant-baseline', 'central')
							.attr('text-anchor', 'middle')
							.attr('font-family', 'Arial')
							.attr('fill', '#858585')
							.attr('font-size', Math.min(18, fontsize))
						sun.listbutt
							.append('rect')
							.classed('sja_info_click', true) //For tape test
							.attr('x', -eyeheight / 2)
							.attr('width', eyeheight)
							.attr('height', emptyspace - fontsize1 / 2)
							.attr('fill-opacity', 0)
							.on('mouseover', () => {
								listbutt_bg.attr('fill', '#bababa')
								listbutt_text.attr('fill', 'white')
							})
							.on('mouseout', () => {
								listbutt_bg.attr('fill', '#d9d9d9')
								listbutt_text.attr('fill', '#858585')
							})
							.on('click', event => {
								remove(sun)
								const x = event.clientX - radius,
									y = event.clientY - radius
								setTimeout(() => click_listbutton(x, y), dur1)
							})
					}
				})
		})
}

function remove(sun) {
	sun.busy = true
	if (sun.eye.fore) {
		sun.eye.fore.remove()
	}
	if (sun.listbutt) {
		sun.listbutt.remove()
	}
	if (sun.eye.shutter) {
		sun.eye.shutter
			.transition()
			.attr('height', 0)
			.on('end', () => {
				sun.ring
					.transition()
					.attr('transform', 'scale(.5,.5)')
					.attr('fill-opacity', 0)
					.on('end', () => {
						sun.g.remove()
						sun.pica.g.selectAll('*').remove()
					})
			})
	} else {
		sun.ring
			.transition()
			.attr('transform', 'scale(.5,.5)')
			.attr('fill-opacity', 0)
			.on('end', () => {
				sun.g.remove()
				sun.pica.g.selectAll('*').remove()
			})
	}
	sun.pica.g.selectAll('*').remove()
}

function slicemouseover(d, sun) {
	const fontsize = 13
	const barheight = 10
	const ypad = 1

	let toangle = (d.x0 + d.x1) / 2
	/*
	mid angle determines pica placement, 
	*/
	if (toangle >= 0.375 && toangle <= 0.625) {
		// around PI, see if need to shift to >PI or <PI
		// get low point yoff given angle PI and d.outradius and placement in box
		const yoff = sun.boxyoff + sun.cy + d.outradius

		// need to get pica height by # of rows
		const picaheight = fontsize + ypad + fontsize

		if (yoff >= sun.svgheight - 30) {
			// not enough space in svg at angle PI, shift
			if (toangle <= 0.5) {
				toangle = Math.max(0.25, d.x0)
			} else {
				toangle = Math.min(0.75, d.x1)
			}
		}
	}

	sun.pica.g.selectAll('*').remove()
	const x = sun.cx + (d.outradius + 5) * Math.sin(Math.PI * 2 * toangle)
	const y = sun.cy - (d.outradius + 5) * Math.cos(Math.PI * 2 * toangle)
	sun.pica.g.attr('transform', 'translate(' + x + ',' + y + ')')

	const barwidth = 60

	// cohortsize is optional; when it's present, bar will be rendered
	let bar = null
	const cohortsize = d.data.cohortsize

	if (Number.isFinite(cohortsize)) {
		bar = sun.pica.g.append('g')
		bar
			.append('rect')
			.attr('width', barwidth + 4)
			.attr('height', barheight + 4)
			.attr('fill', 'white')
			.attr('shape-rendering', 'crispEdges')
		bar
			.append('rect')
			.attr('x', 2)
			.attr('y', 2)
			.attr('width', barwidth)
			.attr('height', barheight)
			.attr('fill', '#ECE5FF')
			.attr('shape-rendering', 'crispEdges')
		bar
			.append('rect')
			.attr('x', 2)
			.attr('y', 2)
			.attr('width', barwidth * Math.min(1, d.value / cohortsize)) // avoids showing a very long bar when cohortsize<d.value (in gdc controlled data)
			.attr('height', barheight)
			.attr('fill', '#9F80FF')
			.attr('shape-rendering', 'crispEdges')
	}

	const text0 = sun.pica.g
		.append('text')
		.attr('stroke', 'white')
		.attr('stroke-width', 3)
		.attr('font-size', fontsize)
		.attr('font-family', 'Arial')
	const text = sun.pica.g
		.append('text')
		.attr('fill', 'black')
		.attr('fill-opacity', 1)
		.attr('font-size', fontsize)
		.attr('font-family', 'Arial')
	// FIXME "sample" hardcoded
	const textt = d.data.name + ', ' + d.value + ' sample' + (d.value > 1 ? 's' : '')
	text0.text(d.data.name)
	text.text(d.data.name)
	const text20 = sun.pica.g
		.append('text')
		.attr('stroke', 'white')
		.attr('stroke-width', 3)
		.attr('font-size', fontsize)
		.attr('font-family', 'Arial')
	const text2 = sun.pica.g
		.append('text')
		.attr('fill', 'black')
		.attr('fill-opacity', 1)
		.attr('font-size', fontsize)
		.attr('font-family', 'Arial')
	const tt = d.value + ' sample' + (d.value > 1 ? 's' : '') + (bar ? ' (' + cohortsize + ' total)' : '')
	text20.text(tt)
	text2.text(tt)
	const textwidth = Math.max(text.node().getBBox().width, text2.node().getBBox().width)

	if (toangle < 0.25) {
		text20.attr('y', bar ? -3 - barheight - ypad : 0)
		text2.attr('y', bar ? -3 - barheight - ypad : 0)
		text0.attr('y', (bar ? -3 - barheight - ypad : 0) - fontsize - ypad)
		text.attr('y', (bar ? -3 - barheight - ypad : 0) - fontsize - ypad)
		if (bar) {
			bar.attr('transform', 'translate(0,-' + barheight + ')')
		}
	} else if (toangle < 0.5) {
		text0.attr('dominant-baseline', 'hanging').attr('y', 0)
		text.attr('dominant-baseline', 'hanging').attr('y', 0)
		text20.attr('dominant-baseline', 'hanging').attr('y', ypad + fontsize)
		text2.attr('dominant-baseline', 'hanging').attr('y', ypad + fontsize)
		if (bar) {
			bar.attr('transform', 'translate(0,' + (fontsize + ypad) * 2 + ')')
		}
	} else if (toangle < 0.75) {
		text0.attr('dominant-baseline', 'hanging').attr('text-anchor', 'end').attr('y', 0)
		text.attr('dominant-baseline', 'hanging').attr('text-anchor', 'end').attr('y', 0)
		text20
			.attr('dominant-baseline', 'hanging')
			.attr('text-anchor', 'end')
			.attr('y', ypad + fontsize)
		text2
			.attr('dominant-baseline', 'hanging')
			.attr('text-anchor', 'end')
			.attr('y', ypad + fontsize)
		if (bar) {
			bar.attr('transform', 'translate(-' + barwidth + ',' + (fontsize + ypad) * 2 + ')')
		}
	} else {
		text20.attr('text-anchor', 'end').attr('y', bar ? -3 - barheight - ypad : 0)
		text2.attr('text-anchor', 'end').attr('y', bar ? -3 - barheight - ypad : 0)
		text0.attr('text-anchor', 'end').attr('y', (bar ? -3 - barheight - ypad : 0) - fontsize - ypad)
		text.attr('text-anchor', 'end').attr('y', (bar ? -3 - barheight - ypad : 0) - fontsize - ypad)
		if (bar) {
			bar.attr('transform', 'translate(-' + barwidth + ',-' + barheight + ')')
		}
	}
}

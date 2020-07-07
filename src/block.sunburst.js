import { select as d3select, event as d3event } from 'd3-selection'
import { stratify, partition } from 'd3-hierarchy'
import { arc as d3arc } from 'd3-shape'
import { rgb as d3rgb } from 'd3-color'
import { scaleOrdinal, schemeCategory10 } from 'd3-scale'
import * as client from './client'

export default function(opts) {
	/*
	may drop tk and block
	*/

	const { occurrence, tk, block, g, pica, cx0, cy0, nodes, levels, chartlabel } = opts

	g.attr('transform', 'translate(' + cx0 + ',' + cy0 + ')')

	const suncolor = scaleOrdinal(schemeCategory10)

	let cx = cx0,
		cy = cy0,
		dur1 = 500,
		dur2 = 250

	const eye = g.append('g')
	const ring = g.append('g')
	const sun = { g, eye, ring, pica, busy: false }

	const radius = Math.max(tk.height * 0.2, Math.min(tk.height * 0.42, Math.log(occurrence) * 24))
	// radius is set, shift g if it get outside

	let newcx = cx,
		newcy = cy
	if (cx < radius) {
		newcx = radius
	} else if (cx + radius > block.width) {
		newcx = block.width - radius
	}
	if (cy < radius) {
		newcy = radius
	} else if (cy + radius > tk.height) {
		newcy = tk.height - radius
	}
	if (newcx != cx || newcy != cy) {
		g.transition()
			.delay(dur1 + dur2)
			.attr('transform', 'translate(' + newcx + ',' + newcy + ')')
		cx = newcx
		cy = newcy
	}
	// hierarchy
	const root = stratify()(nodes)
	root.sum(i => i.value)
	root.sort((a, b) => b.value - a.value)
	partition().size([1, Math.pow(radius, 2)])(root)

	// blocker
	eye
		.append('circle')
		.attr('r', radius)
		.attr('fill', 'white')
		.attr('fill-opacity', 0)

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
		.on('mouseover', d => {
			if (!d.parent) return
			if (sun.busy) return

			d3event.target.setAttribute(
				'fill',
				d3rgb(d._color)
					.darker(0.5)
					.toString()
			)
			slicemouseover(d, pica, cx, cy, tk, block)
		})
		.on('mouseout', d => {
			pica.g.selectAll('*').remove()
			if (!d.parent) return
			d3event.target.setAttribute('fill', d._color)
		})

		.on('click', d => {
			// clicking on slice
			if (arg.noclickring) {
				// no clicking rings
				return
			}
			if (!d.parent) {
				// root not clickable
				return
			}
			if (arg.cohort.annotation) {
				// external annotation
				if (d.data.lst.length == 1) {
					// single sample
					showsinglesample(
						d.data.lst[0].k4a,
						arg.cohort.annotation[d.data.lst[0].k4a],
						d3event.clientX,
						d3event.clientY
					)
					return
				}
				showmanysample(d.data.lst, arg.cohort, d3event.clientX, d3event.clientY)
				return
			}
			// old style official ds
			itemtable({
				mlst: d.data.lst,
				x: d3event.clientX,
				y: d3event.clientY,
				tk: tk,
				block: block,
				pane: true
			})
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
					const fontsize1 = Math.min(eyeheight / (chartlabel.length * client.textlensf), emptyspace * 0.6)
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
							(emptyspace * 0.7) / (occurrence.toString().length * client.textlensf),
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
						.on('mousedown', () => {
							d3event.preventDefault()
							d3event.stopPropagation()
							let cx0 = cx,
								cy0 = cy,
								mx = d3event.clientX,
								my = d3event.clientY,
								body = d3select(document.body)
							body
								.on('mousemove', () => {
									sun.busy = true // must set here but not mousedown
									cx = cx0 + d3event.clientX - mx
									cy = cy0 + d3event.clientY - my
									g.attr('transform', 'translate(' + cx + ',' + cy + ')')
								})
								.on('mouseup', () => {
									setTimeout(() => (sun.busy = false), 10)
									body.on('mousemove', null).on('mouseup', null)
								})
						})

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
						.text('List')
						.attr('y', (emptyspace - fontsize1 / 2) / 2)
						.attr('dominant-baseline', 'central')
						.attr('text-anchor', 'middle')
						.attr('font-family', 'Arial')
						.attr('fill', '#858585')
						.attr('font-size', Math.min(18, fontsize))
					sun.listbutt
						.append('rect')
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
						.on('click', () => {
							if (arg.m2detail) {
								remove(sun)
								itemtable({
									mlst: [arg.m2detail],
									pane: true,
									x: d3event.clientX - radius,
									y: d3event.clientY - radius * 2,
									tk: tk,
									block: block
								})
								return
							}

							const p = d3event.target.getBoundingClientRect()
							remove(sun)
							setTimeout(
								() =>
									itemtable({
										mlst: arg.mlst,
										x: p.left,
										y: p.top,
										tk: tk,
										block: block,
										pane: true
									}),
								500
							)
						})
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

function slicemouseover(d, pica, cx, cy, tk, block) {
	const fontsize = 13
	const barheight = 10
	const ypad = 1

	let toangle = (d.x0 + d.x1) / 2
	/*
	mid angle determines pica placement, 
	*/
	if (toangle >= 0.375 && toangle <= 0.625) {
		// around PI, see if need to shift to >PI or <PI
		// get low point yoff given angle PI and d.outradius and placement in tk
		const yoff = tk.yoff + cy + d.outradius
		const alltkh = Number.parseFloat(block.svg.attr('height'))

		// need to get pica height by # of rows
		const picaheight = fontsize + ypad + fontsize

		if (yoff >= alltkh - 30) {
			// not enough space in block at angle PI, shift
			if (toangle <= 0.5) {
				toangle = Math.max(0.25, d.x0)
			} else {
				toangle = Math.min(0.75, d.x1)
			}
		}
	}

	pica.g.selectAll('*').remove()
	const x = cx + (d.outradius + 5) * Math.sin(Math.PI * 2 * toangle)
	const y = cy - (d.outradius + 5) * Math.cos(Math.PI * 2 * toangle)
	pica.g.attr('transform', 'translate(' + x + ',' + y + ')')

	const barwidth = 60

	let bar = null,
		cohortsize = 0

	/*
	if(cht && cht.root) {
		bar=pica.g.append('g')
		bar.append('rect')
			.attr('width',barwidth+4)
			.attr('height',barheight+4)
			.attr('fill','white')
			.attr('shape-rendering','crispEdges')
		bar.append('rect')
			.attr('x',2)
			.attr('y',2)
			.attr('width',barwidth)
			.attr('height',barheight)
			.attr('fill',cht.fbarbg || '#ededed')
			.attr('shape-rendering','crispEdges')
		cht.root.each(i=>{
			if(i.id==d.id) {
				cohortsize=i.value
			}
		})
		if(cohortsize>0) {
			bar.append('rect')
			.attr('x',2)
			.attr('y',2)
			.attr('width',barwidth*d.value/cohortsize)
			.attr('height',barheight)
			.attr('fill',cht.fbarfg || '#858585')
			.attr('shape-rendering','crispEdges')
		}
	}
	*/
	const text0 = pica.g
		.append('text')
		.attr('stroke', 'white')
		.attr('stroke-width', 3)
		.attr('font-size', fontsize)
		.attr('font-family', 'Arial')
	const text = pica.g
		.append('text')
		.attr('fill', 'black')
		.attr('fill-opacity', 1)
		.attr('font-size', fontsize)
		.attr('font-family', 'Arial')
	// FIXME "sample" hardcoded
	const textt = d.data.name + ', ' + d.value + ' sample' + (d.value > 1 ? 's' : '')
	text0.text(d.data.name)
	text.text(d.data.name)
	const text20 = pica.g
		.append('text')
		.attr('stroke', 'white')
		.attr('stroke-width', 3)
		.attr('font-size', fontsize)
		.attr('font-family', 'Arial')
	const text2 = pica.g
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
		text0
			.attr('dominant-baseline', 'hanging')
			.attr('text-anchor', 'end')
			.attr('y', 0)
		text
			.attr('dominant-baseline', 'hanging')
			.attr('text-anchor', 'end')
			.attr('y', 0)
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

function showsinglesample(samplename, anno, x, y) {
	const lst = []
	for (const k in anno) {
		lst.push({ k: k, v: anno[k] })
	}
	const pane = client.newpane({ x: x, y: y })
	pane.header.text(samplename)
	client.make_table_2col(pane.body, lst)
}

function showmanysample(samples, cohort, x, y) {
	// each sample has k4a
	const attrset = new Set()
	for (const s of samples) {
		const a = cohort.annotation[s.k4a]
		for (const k in a) {
			attrset.add(k)
		}
	}
	const pane = client.newpane({ x: x, y: y })
	pane.header.text(samples.length + ' ' + cohort.key4annotation + 's')
	const table = pane.body.append('table')

	const headers = [...attrset]
	{
		// header
		const tr = table.append('tr')
		for (const h of headers) {
			tr.append('td')
				.text(h)
				.style('color', '#858585')
				.style('font-size', '.7em')
		}
	}

	for (const s of samples) {
		const tr = table.append('tr').attr('class', 'sja_tr')
		const anno = cohort.annotation[s.k4a]
		for (const h of headers) {
			tr.append('td').text(anno[h] == undefined ? '' : anno[h])
		}
	}
}

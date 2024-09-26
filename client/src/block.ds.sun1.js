import { select as d3select } from 'd3-selection'
import { stratify, partition } from 'd3-hierarchy'
import { arc as d3arc } from 'd3-shape'
import { rgb as d3rgb } from 'd3-color'
import { itemtable } from './block.ds.itemtable'
import { stratinput } from '#shared/tree.js'
import { scaleOrdinal } from 'd3-scale'
import { schemeCategory10 } from 'd3-scale-chromatic'
import * as client from './client'

export default function (tk, block, arg) {
	/*
arg:
	.cx
	.cy
		circle center x/y
		offset in tk.glider
	.mlst
		from tk.mlst[]
	.label
	.cohort
		.root
			if available, the cohort has all its samples stratified by levels[], and ready to present percentage in given sub set
		.levels[]
		.key2color - hardcoded colors
		.suncolor

	.noclickring
	.m2detail
*/

	if (!arg.cohort) {
		console.error('arg.cohort missing')
		return
	}
	if (!arg.cohort.levels) {
		console.error('arg.cohort.levels missing')
		return
	}

	if (!arg.cohort.key2color && !arg.cohort.suncolor) {
		// auto color maker
		arg.cohort.suncolor = scaleOrdinal(schemeCategory10)
	}

	let itemlst

	if (!arg.cohort.annotation) {
		itemlst = arg.mlst
		// itemlst must not be empty
	} else {
		if (!arg.cohort.key4annotation) {
			console.error('arg.cohort.key4annotation missing')
			return
		}
		/*
	mlst:
		for official ds with maf-db:
			one m is a variant in a sample
		for multi-sample vcf:
			m.sampledata has per-sample info
	will normalize such and put to itemlst, each contains necessary annotation that match .cohort.levels and can be used to make sunburst
	*/

		itemlst = []

		if (arg.mlst[0].sampledata) {
			// multi-sample vcf
			for (const m of arg.mlst) {
				if (!m.sampledata) {
					// error
					continue
				}
				for (const s of m.sampledata) {
					const k4a = s.sampleobj[arg.cohort.key4annotation]
					if (!k4a) {
						// this sample dont map to a proper key for cohort.annotation
						continue
					}
					const sanno = arg.cohort.annotation[k4a]
					if (!sanno) {
						// not annotated
						continue
					}
					const s2 = {
						k4a: k4a
					}
					for (const l of arg.cohort.levels) {
						s2[l.k] = sanno[l.k]
						if (l.full) {
							s2[l.full] = sanno[l.full]
						}
					}
					itemlst.push(s2)
				}
			}
		} else {
			// each m is one variant per sample
			for (const m of arg.mlst) {
				const k4a = m[arg.cohort.key4annotation]
				if (!k4a) {
					continue
				}
				const sanno = arg.cohort.annotation[k4a]
				if (!sanno) {
					continue
				}
				const s2 = {
					k4a: k4a
				}
				for (const l of arg.cohort.levels) {
					s2[l.k] = sanno[l.k]
					if (l.full) {
						s2[l.full] = sanno[l.full]
					}
				}
				itemlst.push(s2)
			}
		}

		if (itemlst.length == 0) {
			/*
		since itemlst is recalculated, it maybe empty
		terminate
		*/
			if (arg.m2detail) {
				itemtable({
					mlst: [arg.m2detail],
					pane: true,
					x: arg.cx,
					y: arg.cy,
					tk: tk,
					block: block
				})
			} else {
				itemtable({
					mlst: arg.mlst,
					pane: true,
					x: arg.cx,
					y: arg.cy,
					tk: tk,
					block: block
				})
			}
			return
		}
	}

	let cx = arg.cx,
		cy = arg.cy,
		dur1 = 500,
		dur2 = 250
	const g = tk.glider.append('g').attr('transform', 'translate(' + cx + ',' + cy + ')')
	const pica = tk.pica
	const eye = g.append('g')
	const ring = g.append('g')
	const sun = {
		g: g,
		eye: eye,
		ring: ring,
		pica: pica,
		busy: false
	}

	let radius = Math.log(itemlst.length) * 24
	if (radius > tk.height * 0.42) {
		radius = tk.height * 0.42
	} else if (radius < tk.height * 0.2) {
		radius = tk.height * 0.2
	}
	// radius is set, shift g if it get outside
	let newcx = cx,
		newcy = cy
	if (cx - radius < 0) {
		newcx = radius
	} else if (cx + radius > block.width) {
		newcx = block.width - radius
	}
	if (cy - radius < 0) {
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
	const dat = stratinput(itemlst, arg.cohort.levels)
	const root = stratify()(dat)
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

			// what color
			let c
			if (arg.cohort.key2color) {
				c = arg.cohort.key2color[key]
				if (!c) {
					console.log(key)
					c = '#858585'
				}
			} else {
				c = arg.cohort.suncolor(key)
			}
			d._color = c

			return c
		})
		.on('mouseover', (event, d) => {
			if (!d.parent) return
			if (sun.busy) return

			event.target.setAttribute('fill', d3rgb(d._color).darker(0.5).toString())
			slicemouseover(d, pica, arg, cx, cy, tk, block)
		})
		.on('mouseout', (event, d) => {
			pica.g.selectAll('*').remove()
			if (!d.parent) return
			event.target.setAttribute('fill', d._color)
		})

		.on('click', (event, d) => {
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
					showsinglesample(d.data.lst[0].k4a, arg.cohort.annotation[d.data.lst[0].k4a], event.clientX, event.clientY)
					return
				}
				showmanysample(d.data.lst, arg.cohort, event.clientX, event.clientY)
				return
			}
			// old style official ds
			itemtable({
				mlst: d.data.lst,
				x: event.clientX,
				y: event.clientY,
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
					const fontsize1 = Math.min(eyeheight / (arg.label.length * client.textlensf), emptyspace * 0.6)
					eye.fore
						.append('text')
						.text(arg.label)
						.attr('text-anchor', 'middle')
						.attr('dominant-baseline', 'central')
						.attr('fill', '#858585')
						.attr('font-weight', 'bold')
						.attr('font-family', 'Arial')
						.attr('font-size', fontsize1)
					const fontsize = Math.min(
						18,
						Math.min(
							(emptyspace * 0.7) / (itemlst.length.toString().length * client.textlensf),
							(emptyspace - fontsize1 / 2) * 0.7
						)
					)
					eye.fore
						.append('text')
						.text(itemlst.length)
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
							let cx0 = cx,
								cy0 = cy,
								mx = event.clientX,
								my = event.clientY,
								body = d3select(document.body)
							body
								.on('mousemove', event => {
									sun.busy = true // must set here but not mousedown
									cx = cx0 + event.clientX - mx
									cy = cy0 + event.clientY - my
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
						.text(arg.m2detail ? 'Show' : 'List')
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
						.on('click', event => {
							if (arg.m2detail) {
								remove(sun)
								itemtable({
									mlst: [arg.m2detail],
									pane: true,
									x: event.clientX - radius,
									y: event.clientY - radius * 2,
									tk: tk,
									block: block
								})
								return
							}

							const p = event.target.getBoundingClientRect()
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

function slicemouseover(d, pica, arg, cx, cy, tk, block) {
	const cht = arg.cohort

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
		const picaheight = fontsize + ypad + fontsize + (cht && cht.root ? ypad + barheight + 5 : 0)

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

	if (cht && cht.root) {
		bar = pica.g.append('g')
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
			.attr('fill', cht.fbarbg || '#ededed')
			.attr('shape-rendering', 'crispEdges')
		cht.root.each(i => {
			if (i.id == d.id) {
				cohortsize = i.value
			}
		})
		if (cohortsize > 0) {
			bar
				.append('rect')
				.attr('x', 2)
				.attr('y', 2)
				.attr('width', (barwidth * d.value) / cohortsize)
				.attr('height', barheight)
				.attr('fill', cht.fbarfg || '#858585')
				.attr('shape-rendering', 'crispEdges')
		}
	}
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
			tr.append('td').text(h).style('color', '#858585').style('font-size', '.7em')
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

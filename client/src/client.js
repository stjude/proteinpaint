///////////////////
//
// all client-side stuff, including DOM
//
///////////////////

import { scaleLinear } from 'd3-scale'
import { select as d3select, selectAll as d3selectAll } from 'd3-selection'
import { rgb as d3rgb } from 'd3-color'
import * as common from '#shared/common.js'
import { set_base_zindex } from '#common/globals'
import { dofetch, dofetch2, dofetch3 } from '../common/dofetch'
// support client code that import dofetch* from client.js
// TODO: update affected code to import dofetch* directly from common/dofetch.js
export { dofetch, dofetch2, dofetch3 }
import { Menu, make_table_2col, fillbar, axisstyle, sayerror } from '#dom'
export { Menu, axisstyle, fillbar, make_table_2col, sayerror }
import { first_genetrack_tolist } from '../common/1stGenetk'
export { first_genetrack_tolist }

export const font = 'Arial'
export const unspecified = 'Unspecified'
export const colorinframe = 'green'
export const coloroutframe = '#858585'
export const colorbgleft = '#FCE3B8'
export const colorbgright = '#D2E2FC'
export const colorantisense = 'red'
export const colorctx = '#DE3336'
export const textlensf = 0.6 // to replace n.getBBox().width for detecting filling font size which breaks in chrome

export let base_zindex = null

// things that used to be in client.js but now have been moved to common
export const tkt = common.tkt
export const gmmode = common.gmmode

export const domaincolorlst = [
	'#8dd3c7',
	'#bebada',
	'#fb8072',
	'#80b1d3',
	'#E8E89E',
	'#a6d854',
	'#fdb462',
	'#ffd92f',
	'#e5c494',
	'#b3b3b3'
]

export function appear(d, display) {
	d.style('opacity', 0)
		.style('display', display || 'block')
		.transition()
		.style('opacity', 1)
}

export function disappear(d, remove) {
	d.style('opacity', 1)
		.transition()
		.style('opacity', 0)
		.call(() => {
			if (remove) {
				d.remove()
			} else {
				d.style('display', 'none').style('opacity', 1)
			}
		})
}

export const tip = new Menu({ padding: '' })
tip.d.style('z-index', 1000)

export function newpane(pm) {
	/*
	parameter

	.setzindex
		quick dirty way to set the global variable base_zindex

	.x
	.y
	.toshrink
		bool
	.close
		callback
	.closekeep
		bool
	.headpad
		header label bar padding

	*/

	if (pm.setzindex) {
		/*
		dirty fix
		*/
		base_zindex = pm.setzindex
		set_base_zindex(pm.setzindex)
		return
	}

	const dur = 300
	const pp = {}
	const body = d3select(document.body)
	pp.pane = body
		.append('div')
		.attr('class', 'sja_pane')
		.style('left', pm.x + window.pageXOffset + 'px')
		.style('top', pm.y + window.pageYOffset + 'px')
		.style('opacity', 0)

	if (pm.$id) {
		pp.pane.attr('id', pm.$id)
	}

	if (base_zindex) {
		// fixed, from embedding instructions
		pp.pane.style('z-index', base_zindex)
	}

	pp.pane.transition().duration(dur).style('opacity', 1)

	const toprow = pp.pane.append('div').on('mousedown', event => {
		event.preventDefault()
		event.stopPropagation()
		const oldx = Number.parseInt(pp.pane.style('left')),
			oldy = Number.parseInt(pp.pane.style('top'))
		const x0 = event.clientX,
			y0 = event.clientY
		body.on('mousemove', event => {
			pp.pane.style('left', oldx + event.clientX - x0 + 'px').style('top', oldy + event.clientY - y0 + 'px')
		})
		body.on('mouseup', function () {
			body.on('mouseup', null).on('mousemove', null)
		})
		// order of precedence, among all panes
		document.body.appendChild(pp.pane.node())
	})

	const butt = toprow
		.append('div')
		.attr('class', 'sja_menuoption')
		.style('display', 'inline-block')
		.style('padding', '4px 10px')
		.style('margin', '0px')
		.style('border-right', 'solid 1px white')
		.style('cursor', 'default')
		.style('font-size', '1.5em')
		.on('mousedown', event => {
			document.body.dispatchEvent(new Event('mousedown'))
			event.stopPropagation()
		})

	if (pm.toshrink) {
		pp.mini = false
		butt.html('&#9473;').on('click', () => {
			butt.html(pp.mini ? '&#9473;' : '&#9725;')
			if (pp.mini) {
				appear(pp.body)
			} else {
				disappear(pp.body)
			}
			pp.mini = !pp.mini
		})
	} else {
		butt.html('&times;')
		if (pm.close) {
			// custom callback on close button
			butt.on('click', pm.close)
		} else if (pm.closekeep) {
			// hide and keep to bring it on later
			butt.on('click', () => {
				pp.pane
					.transition()
					.duration(dur)
					.style('opacity', 0)
					.call(() => pp.pane.style('display', 'none'))
			})
		} else {
			// close and remove pane from page
			butt.on('click', () => {
				pp.pane
					.transition()
					.duration(dur)
					.style('opacity', 0)
					.call(() => pp.pane.remove())
			})
		}
	}
	// where you can write
	pp.header = toprow
		.append('div')
		.style('display', 'inline-block')
		.style('font-family', font)
		.style('padding', pm.headpad || '5px 10px')
	pp.body = pp.pane.append('div').style('font-family', font)
	return pp
}

export function getdomaintypes(gm) {
	if (!gm.pdomains) return []

	const types = new Map()
	// k: domain.name+domain.description
	// v: {} attributes of this type of domain

	for (const i of gm.pdomains) {
		const key = i.name + i.description
		if (types.has(key)) {
			types.get(key).start = Math.min(types.get(key).start, i.start)
		} else {
			types.set(key, {
				name: i.name,
				description: i.description,
				color: i.color,
				start: i.start,
				iscustom: i.iscustom,
				url: i.url,
				pmid: i.pmid,
				CDD: i.CDD,
				Pfam: i.Pfam,
				SMART: i.SMART,
				COG: i.COG,
				PRK: i.PRK,
				Curated_at_NCBI: i.Curated_at_NCBI
			})
		}
	}
	const lst = []
	for (const [key, domaintype] of types) {
		domaintype.key = key
		domaintype.fill = domaintype.color
		domaintype.stroke = d3rgb(domaintype.color).darker(1).toString()
		delete domaintype.color
		lst.push(domaintype)
	}
	lst.sort((a, b) => a.start - b.start)
	return lst
}

export function sketchSplicerna(holder, gm, pxwidth, color) {
	let intronpx = 10
	if (intronpx * (gm.exon.length - 1) > pxwidth * 0.3) {
		intronpx = Math.max(2, (pxwidth * 0.3) / (gm.exon.length - 1))
	}
	let exonlen = 0
	for (const e of gm.exon) {
		exonlen += e[1] - e[0]
	}
	const inw = intronpx * (gm.exon.length - 1)
	const exonsf = (pxwidth - (inw > pxwidth * 0.4 ? 0 : inw)) / exonlen
	// reset width
	pxwidth = exonsf * exonlen + inw
	const canvas = holder.append('canvas').node()
	canvas.width = pxwidth
	const h = 20
	const pad = 4
	canvas.height = h
	const ctx = canvas.getContext('2d')
	ctx.strokeStyle = color
	//ctx.setLineDash([1,1])
	ctx.beginPath()
	ctx.moveTo(0, Math.floor(h / 2) - 0.5)
	ctx.lineTo(pxwidth, Math.floor(h / 2) - 0.5)
	ctx.stroke()
	// gm.exon is 5 to 3
	const reverse = gm.strand == '-'
	let x = 0
	for (const e of gm.exon) {
		let thin1 = null,
			thick = null,
			thin2 = null
		if (reverse) {
			const start = e[1],
				stop = e[0],
				cds5 = gm.codingstop,
				cds3 = gm.codingstart
			if (stop >= cds5) {
				thin1 = e
			} else if (stop >= cds3) {
				if (start >= cds5) {
					thin1 = [cds5, start]
					thick = [stop, cds5]
				} else {
					thick = e
				}
			} else {
				if (start >= cds5) {
					// assumption: 1 single continuous cds
					thin1 = [cds5, start]
					thin2 = [stop, cds3]
					thick = [cds3, cds5]
				} else if (start >= cds3) {
					thin2 = [stop, cds3]
					thick = [cds3, start]
				} else {
					thin2 = e
				}
			}
		} else {
			if (e[1] <= gm.codingstart) {
				thin1 = e
			} else if (e[1] <= gm.codingstop) {
				if (e[0] <= gm.codingstart) {
					thin1 = [e[0], gm.codingstart]
					thick = [gm.codingstart, e[1]]
				} else {
					thick = e
				}
			} else {
				if (e[0] <= gm.codingstart) {
					// assumption: 1 single continuous cds
					thin1 = [e[0], gm.codingstart]
					thin2 = [gm.codingstop, e[1]]
					thick = [gm.codingstart, gm.codingstop]
				} else if (e[0] < gm.codingstop) {
					thin2 = [gm.codingstop, e[1]]
					thick = [e[0], gm.codingstop]
				} else {
					thin2 = e
				}
			}
		}
		if (thin1) {
			ctx.fillStyle = '#aaa'
			const exonw = Math.max(1, (thin1[1] - thin1[0]) * exonsf)
			ctx.fillRect(x, pad, exonw, h - pad * 2)
			x += exonw
		}
		if (thick) {
			ctx.fillStyle = color
			const exonw = Math.max(1, (thick[1] - thick[0]) * exonsf)
			ctx.fillRect(x, 0, exonw, h)
			x += exonw
		}
		if (thin2) {
			ctx.fillStyle = '#aaa'
			const exonw = Math.max(1, (thin2[1] - thin2[0]) * exonsf)
			ctx.fillRect(x, pad, exonw, h - pad * 2)
			x += exonw
		}
		x += intronpx
	}
}

export function sketchGmsum(holder, rglst, gm, exonsf, intronw, pxwidth, h, color) {
	const canvas = holder.append('canvas').node()
	canvas.width = pxwidth
	canvas.height = h
	const pad = Math.ceil(h / 5)
	const ctx = canvas.getContext('2d')
	let start
	let x = 0
	for (const r of rglst) {
		if (r.chr != gm.chr) {
			x += r.width + intronw
			continue
		}
		if (gm.start >= r.start && gm.start <= r.stop) {
			start = x + (r.reverse ? r.stop - gm.start : gm.start - r.start) * exonsf
			break
		}
		x += r.width + intronw
	}
	let stop
	x = 0
	for (const r of rglst) {
		if (r.chr != gm.chr) {
			x += r.width + intronw
			continue
		}
		if (gm.stop >= r.start && gm.stop <= r.stop) {
			stop = x + (r.reverse ? r.stop - gm.stop : gm.stop - r.start) * exonsf
			break
		}
		x += r.width + intronw
	}
	ctx.strokeStyle = color
	ctx.beginPath()
	ctx.moveTo(start, Math.floor(h / 2) + 0.5)
	ctx.lineTo(stop, Math.floor(h / 2) + 0.5)
	ctx.stroke()

	const thin = []
	if (gm.utr5) thin.push(...gm.utr5)
	if (gm.utr3) thin.push(...gm.utr3)
	if (!gm.cdslen) thin.push(...gm.exon)
	for (const e of thin) {
		let x = 0
		for (const r of rglst) {
			if (r.chr != gm.chr) {
				x += r.width + intronw
				continue
			}
			const start = Math.max(e[0], r.start)
			const stop = Math.min(e[1], r.stop)
			if (start >= stop) {
				x += r.width + intronw
				continue
			}
			ctx.fillStyle = '#aaa'
			ctx.fillRect(
				x + (r.reverse ? (r.stop - stop) * exonsf : (start - r.start) * exonsf),
				pad,
				Math.max(1, (stop - start) * exonsf),
				h - pad * 2
			)
			x += r.width + intronw
		}
	}
	if (gm.coding) {
		for (const e of gm.coding) {
			let x = 0
			for (const r of rglst) {
				if (r.chr != gm.chr) {
					x += r.width + intronw
					continue
				}
				const start = Math.max(e[0], r.start)
				const stop = Math.min(e[1], r.stop)
				if (start >= stop) {
					x += r.width + intronw
					continue
				}
				ctx.fillStyle = color
				ctx.fillRect(
					x + (r.reverse ? (r.stop - stop) * exonsf : (start - r.start) * exonsf),
					0,
					Math.max(1, (stop - start) * exonsf),
					h
				)
				x += r.width + intronw
			}
		}
	}
}

export function sketchRna(holder, gm, pxwidth, color) {
	const canvas = holder.append('canvas').node()
	canvas.width = pxwidth
	const h = 20
	const pad = 4
	canvas.height = h
	const ctx = canvas.getContext('2d')
	if (!gm.cdslen) {
		ctx.fillStyle = '#aaa'
		ctx.fillRect(0, pad, pxwidth, h - pad * 2)
		return
	}
	const sf = pxwidth / gm.rnalen
	let x = 0
	if (gm.utr5) {
		let ulen = 0
		for (const e of gm.utr5) ulen += e[1] - e[0]
		ctx.fillStyle = '#aaa'
		ctx.fillRect(0, pad, sf * ulen, h - pad * 2)
		x = sf * ulen
	}
	if (gm.pdomains && gm.pdomains.length) {
		ctx.fillStyle = 'white'
		ctx.fillRect(x, 0, gm.cdslen * sf, h)
		gm.pdomains.sort((a, b) => b.stop - b.start - a.stop + a.start)
		for (const domain of gm.pdomains) {
			ctx.fillStyle = domain.color
			ctx.fillRect(x + domain.start * 3 * sf, 0, (domain.stop - domain.start + 1) * 3 * sf, h)
		}
		ctx.strokeStyle = 'black'
		ctx.strokeRect(x, 0, gm.cdslen * sf, h)
	} else {
		ctx.fillStyle = color
		ctx.fillRect(x, 0, gm.cdslen * sf, h)
	}
	x += gm.cdslen * sf
	if (gm.utr3) {
		let ulen = 0
		for (const e of gm.utr3) ulen += e[1] - e[0]
		ctx.fillStyle = '#aaa'
		ctx.fillRect(x, pad, sf * ulen, h - pad * 2)
	}
}
export function sketchProtein2(holder, gm, pxwidth) {
	const canvas = holder.append('canvas').node()
	canvas.width = pxwidth
	const h = 20
	const pad = 4
	canvas.height = h
	const ctx = canvas.getContext('2d')
	const sf = pxwidth / (gm.cdslen / 3)
	gm.pdomains.sort((a, b) => b.stop - b.start - a.stop + a.start)
	ctx.fillStyle = 'white'
	ctx.fillRect(0, 0, pxwidth, h)
	for (const domain of gm.pdomains) {
		ctx.fillStyle = domain.color
		ctx.fillRect(domain.start * sf, 0, (domain.stop - domain.start + 1) * sf, h)
	}
	ctx.strokeStyle = 'black'
	ctx.strokeRect(0, 0, pxwidth, h)
}

export function sketchGene(holder, gm, pxwidth, h, bpstart, bpstop, color, nostrand, reverse) {
	const canvas = holder.append('canvas').node()
	canvas.width = pxwidth
	canvas.height = h
	const ctx = canvas.getContext('2d')
	const sf = scaleLinear().range([1, pxwidth])
	if (reverse) {
		sf.domain([bpstop, bpstart])
	} else {
		sf.domain([bpstart, bpstop])
	}
	ctx.strokeStyle = color
	ctx.fillStyle = color
	bpBox(ctx, gm.start, gm.stop, bpstart, bpstop, h / 2, 1)
	const pad = Math.ceil(h / 5)
	if (gm.utr3) {
		for (const e of gm.utr3) {
			bpBox(ctx, e[0], e[1], bpstart, bpstop, pad + 1, h - pad * 2 - 1)
		}
	}
	if (gm.utr5) {
		for (const e of gm.utr5) {
			bpBox(ctx, e[0], e[1], bpstart, bpstop, pad + 1, h - pad * 2 - 1)
		}
	}
	if (gm.coding) {
		for (const e of gm.coding) {
			bpBox(ctx, e[0], e[1], bpstart, bpstop, 1, h)
		}
	}
	if (gm.codingstart == gm.codingstop) {
		for (const e of gm.exon) {
			bpBox(ctx, e[0], e[1], bpstart, bpstop, pad + 1, h - pad * 2 - 1)
		}
	}
	if (!nostrand && gm.strand) {
		const ypad = 3 // but not pad
		if (gm.coding) {
			for (const e of gm.coding) {
				bpStrand(ctx, gm.strand, e[0], e[1], bpstart, bpstop, 1 + ypad, h - ypad * 2 - 1, 'white')
			}
		}
		if (gm.intron) {
			for (const e of gm.intron) {
				bpStrand(ctx, gm.strand, e[0], e[1], bpstart, bpstop, 1 + ypad, h - ypad * 2 - 1, color ? color : 'black')
			}
		}
	}
	function bpBox(ctx, start, stop, borderstart, borderstop, y, h) {
		const a = Math.max(start, borderstart)
		const b = Math.min(stop, borderstop)
		if (a >= b) return
		ctx.fillRect(Math.floor(sf(reverse ? b : a)), y, Math.max(1, Math.abs(sf(b) - sf(a))), h)
	}
	function bpStrand(ctx, strand, start, stop, borderstart, borderstop, y, h, color) {
		const a = Math.max(start, borderstart)
		const b = Math.min(stop, borderstop)
		if (a >= b) return
		const pad = 2,
			spacing = h / 2,
			w = sf(b) - sf(a)
		if (w <= pad * 2 + h / 2) return
		ctx.strokeStyle = color
		const fillcount = Math.floor((w - pad * 2) / (h / 2 + spacing))
		let x = Math.floor(sf(a) + (w - fillcount * (h / 2 + spacing)) / 2) + 0.5
		ctx.beginPath()
		for (let i = 0; i < fillcount; i++) {
			if (strand == '+') {
				ctx.moveTo(x, y)
				ctx.lineTo(x + h / 2, y + h / 2)
				ctx.lineTo(x, y + h)
			} else {
				ctx.moveTo(x + h / 2, y)
				ctx.lineTo(x, y + h / 2)
				ctx.lineTo(x + h / 2, y + h)
			}
			x += h / 2 + spacing
		}
		ctx.stroke()
	}
}

export function sketchProtein(holder, gm, pxwidth) {
	let aalen = -1
	if (gm.cdslen) {
		aalen = gm.cdslen / 3
	}
	return holder
		.append('span')
		.html(
			'&nbsp;' +
				(aalen > 0 ? Math.ceil(aalen) + ' AA' + (Number.isInteger(aalen) ? '' : ' (incomplete CDS)') : 'noncoding')
		)
}

export function newpane3(x, y, genomes) {
	const pane = newpane({ x: x, y: y })
	const inputdiv = pane.body.append('div').style('margin', '40px 20px 20px 20px')
	const p = inputdiv.append('p')
	p.append('span').html('Genome&nbsp;')
	const gselect = p.append('select')
	for (const n in genomes) {
		gselect.append('option').text(n)
	}
	const filediv = inputdiv.append('div').style('margin', '20px 0px')
	const saydiv = pane.body.append('div').style('margin', '10px 20px')
	const visualdiv = pane.body.append('div').style('margin', '20px')
	return [pane, inputdiv, gselect.node(), filediv, saydiv, visualdiv]
}

export function to_svg(svg, name, opts = {}) {
	if (opts.apply_dom_styles) {
		opts.svgClone = svg.cloneNode(true)
		const clone = d3select(opts.svgClone) // make it easier to apply style below

		// TODO: may use opts.excludeSelector instead of harcoded classname?
		for (const elem of opts.svgClone.querySelectorAll('.sjpp-exclude-svg-download')) {
			elem.remove()
		}

		const styles = window.getComputedStyle(svg)
		for (const s of styles) {
			clone.style(s, styles.getPropertyValue(s))
		}
	}

	const a = document.createElement('a')
	document.body.appendChild(a)

	a.addEventListener(
		'click',
		function () {
			const serializer = new XMLSerializer()
			const svg_blob = new Blob([serializer.serializeToString(opts.svgClone ? opts.svgClone : svg)], {
				type: 'image/svg+xml'
			})
			a.download = name + '.svg'
			a.href = URL.createObjectURL(svg_blob)
			document.body.removeChild(a)
		},
		false
	)
	a.click()
}

export function filetypeselect(holder) {
	const s = holder.append('select')
	s.append('option').text('SNV and indel') // 0
	s.append('option').text('SV (tabular format)') // 1
	s.append('option').text('Fusion gene (tabular format)') // 2
	s.append('option').text('ITD') // 3
	s.append('option').text('Deletion, intragenic') // 4
	s.append('option').text('Truncation') // 5
	s.append('option').text('CNV, gene-level')
	// TODO vcf, new tabular format for fusion
	return s
}

export function export_data(title, lst, posx = 1, posy = 1, rows = 10, cols = 100, div = null) {
	// lst: {label, text}

	let body // holder of ui
	if (!div) {
		const pane = newpane({
			x: (window.innerWidth / 2 - 200) * posx,
			y: (window.innerHeight / 2 - 150) * posy
		})
		pane.header.text(title)
		body = pane.body
	} else {
		div.append('p').text(title)
		body = div.append('div')
	}

	for (const w of lst) {
		const div = body.append('div').style('margin-top', '10px')
		if (w.label) {
			div.append('div').text(w.label).style('margin', '5px')
		}
		body.append('textarea').text(w.text).attr('readonly', 1).attr('rows', rows).attr('cols', cols)
	}
	body
		.append('p')
		.style('font-size', '.7em')
		.text('Click on the text box above and press Ctrl-A to select all text for copy-pasting.')
}

export function flyindi(from, to) {
	const p1 = from.node().getBoundingClientRect()
	const p2 = to.node().getBoundingClientRect()
	const d = d3select(document.body)
		.append('div')
		.style('position', 'absolute')
		.style('border', 'solid 1px black')
		.style('left', p1.left + window.pageXOffset + 'px')
		.style('top', p1.top + window.pageYOffset + 'px')
		.style('width', p1.width + 'px')
		.style('height', p1.height + 'px')
	if (base_zindex) {
		d.style('z-index', base_zindex + 3)
	}
	d.transition()
		.duration(500)
		.style('left', p2.left + window.pageXOffset + 'px')
		.style('top', p2.top + window.pageYOffset + 'px')
		.style('width', p2.width + 'px')
		.style('height', p2.height + 'px')
		.on('end', () => d.remove())
}

export function labelbox(arg) {
	/* a box with label overlapping its border
	- holder
	- label
	- color
	*/
	const fontsize = 16
	if (!arg.color) {
		arg.color = '#ccc'
	}
	const d0 = arg.holder
		.append('div')
		.style('position', 'relative')
		.style('padding-top', fontsize / 2 + 'px')
	if (arg.margin) {
		d0.style('margin', arg.margin)
	}
	const bin = d0
		.append('div')
		.style('border', 'solid 1px ' + arg.color)
		.style('padding', fontsize + 'px')
		.style('padding-bottom', fontsize / 2 + 'px')
	d0.append('div')
		.text(arg.label)
		.style('position', 'absolute')
		.style('left', '15px')
		.style('top', '0px')
		.style('background-color', 'white')
		.style('color', arg.color)
		.style('font-family', font)
		.style('font-size', fontsize + 'px')
		.style('padding', '0px 10px')
	return bin
}

export function category2legend(categories, holder) {
	// bound to tk logic
	holder.selectAll('*').remove()
	for (const key in categories) {
		const c = categories[key]
		const div = holder
			.append('div')
			.style('display', 'inline-block')
			.style('white-space', 'nowrap')
			.style('padding', '5px 20px 5px 0px')
		div
			.append('div')
			.style('display', 'inline-block')
			.style('background-color', c.color)
			.style('margin-right', '5px')
			.style('padding', '0px 4px')
			.html('&nbsp;')
		div.append('div').style('display', 'inline-block').style('color', c.color).text(c.label)
	}
}

export function bulk_badline(header, lines) {
	// surpress warnings on selected sites
	if (window.location.hostname == 'viz.stjude.cloud' || window.location.hostname == 'pecan.stjude.cloud') return
	if (window.sessionStorage.getItem('suppressErrors')?.includes(`"bulk-bad-lines"`)) return

	const np = newpane({ x: 400, y: 60 })
	np.body.style('margin', '20px 10px 10px 10px')
	np.header.text(lines.length + ' line' + (lines.length > 1 ? 's' : '') + ' rejected, click to check')
	if (lines.length <= 50) {
		// small # of lines, show link for each
		for (const [number, err, line] of lines) {
			np.body
				.append('div')
				.classed('sja_clbtext', true)
				.style('margin', '3px')
				.text('Line ' + number + ': ' + err)
				.on('click', () => {
					const n2 = newpane({ x: 500, y: 60 })
					n2.header.text('Line ' + number)
					n2.body.style('margin', '10px')
					const t = n2.body.append('table').style('border-spacing', '1px').style('border-collapse', 'separate')
					let fl = true
					for (let i = 0; i < header.length; i++) {
						const tr = t.append('tr')
						if (fl) {
							tr.style('background-color', '#ededed')
						}
						fl = !fl
						tr.append('td').text(header[i])
						tr.append('td').text(line[i] == undefined ? '' : line[i])
					}
				})
		}
		return
	}
	// group lines by reasons of reject
	const reason = new Map()
	for (const [number, err, line] of lines) {
		if (!reason.has(err)) {
			reason.set(err, [])
		}
		reason.get(err).push({ number: number, line: line })
	}

	const lst = [...reason]

	lst.sort((a, b) => b[1].length - a[1].length)

	for (const [thisreason, linelst] of lst) {
		const line1 = linelst[0]
		np.body
			.append('div')
			.classed('sja_menuoption', true)
			.style('margin', '5px')
			.text(
				'Line ' + line1.number + ': ' + thisreason + (linelst.length > 1 ? ' (total ' + linelst.length + ' lines)' : '')
			)
			.on('click', () => {
				const n2 = newpane({ x: 500, y: 60 })
				n2.header.text('Line ' + line1.number)
				const t = n2.body.style('margin', '10px').append('table')
				let fl = true
				for (let i = 0; i < header.length; i++) {
					const tr = t.append('tr')
					if (fl) {
						tr.style('background-color', '#ededed')
					}
					fl = !fl
					tr.append('td').text(header[i])
					tr.append('td').text(line1.line[i] == undefined ? '' : line1.line[i])
				}
			})
	}
}

export function ensureisblock(b) {
	if (!b) return 'No Block{} object given'
	if (typeof b != 'object') return 'Block is not an object'
	if (!b.error) return 'method block.error() missing'
	if (!b.genome) return 'block.genome missing'
	return null
}

export function mclasscolorchangeui(tip) {
	tip.d.append('p').html('<span style="color:#858585;font-size:.7em">EXAMPLE</span> M ; red')
	const input = tip.d
		.append('textarea')
		.attr('cols', 25)
		.attr('rows', 5)
		.attr('placeholder', 'One class per line, join color and class code by semicolon.')
	const row = tip.d.append('div')
	row
		.append('button')
		.text('Submit')
		.on('click', () => {
			const str = input.property('value').trim()
			if (!str) return
			errdiv.text('')
			const good = []
			for (const line of str.split('\n')) {
				const l = line.split(';')
				if (l.length != 2) return errdiv.text('no separator in line: ' + line)
				const c = l[0].trim()
				const color = l[1].trim()
				if (!c || !color) return errdiv.text('wrong line: ' + line)
				if (!common.mclass[c]) return errdiv.text('wrong class: ' + c)
				good.push([c, color])
			}
			if (good.length) {
				for (const [c, color] of good) {
					common.mclass[c].color = color
				}
				mclasscolor2table(table)
				errdiv.text('New color set!')
			}
		})
	row
		.append('button')
		.text('Clear')
		.on('click', () => {
			input.property('value', '')
			errdiv.text('')
		})
	const errdiv = row.append('span').style('margin-left', '10px')

	const table = tip.d.append('div').style('margin-top', '5px')
	mclasscolor2table(table)

	tip.d
		.append('p')
		.style('font-size', '.8em')
		.html(
			'<a href=https://en.wikipedia.org/wiki/Web_colors target=_blank>Use color names</a>, or #ff0000 or rgb(255,0,0)'
		)
}

export function mclasscolor2table(table, snvonly) {
	table.style('border-spacing', '3px').selectAll('*').remove()
	const tr = table.append('tr').style('color', '#858585').style('font-size', '.7em')
	tr.append('td').text('CLASS')
	tr.append('td').attr('colspan', 2).text('LABEL, COLOR')
	for (const k in common.mclass) {
		const c = common.mclass[k]
		if (snvonly && c.dt != common.dtsnvindel) continue

		// Blank class color is white

		const tr = table.append('tr')
		tr.append('td').text(k)
		{
			const dot = tr
				.append('td')
				.append('span')
				.attr('class', 'sja_mcdot')
				.style('background-color', c.color)
				.html('&nbsp;&nbsp;')
			if (k == 'Blank') dot.style('border', 'solid 1px #eee')
		}
		tr.append('td')
			.text(c.label)
			.style('color', k == 'Blank' ? '#ddd' : c.color)
	}
}

// bigwig track
export const bwSetting = {
	height: 1,
	pcolor: 2,
	ncolor: 3,
	pcolor2: 4,
	ncolor2: 5,
	autoscale: 6,
	fixedscale: 7,
	percentilescale: 8,
	nodotplot: 9,
	usedotplot: 10,
	usedividefactor: 11,
	nodividefactor: 12
}

export function tkexists(t, tklst) {
	// return the tkobj found in the list
	for (const t0 of tklst) {
		if (t0.type != t.type) continue
		switch (t.type) {
			case tkt.bigwig:
			case tkt.bedj:
			case tkt.junction:
			case tkt.mdsjunction:
			case tkt.bampile:
			case tkt.hicstraw:
			case tkt.expressionrank:
				// single file
				if ((t.file && t.file == t0.file) || (t.url && t.url == t0.url)) {
					return t0
				}
				break
			case tkt.bigwigstranded:
				if (t.strand1 && t0.strand1 && t.strand1.file == t0.strand1.file && t.strand1.url == t0.strand1.url) {
					if (t.strand2 && t0.strand2 && t.strand2.file == t0.strand2.file && t.strand2.url == t0.strand2.url) {
						return t0
					}
				}
				break
			// TODO pgv ds-vcf
		}
	}
	return null
}

export function ranksays(v) {
	if (v >= 100) return 'HIGHEST'
	if (v >= 90) return 'HIGH ' + v + '%'
	if (v >= 70) return 'high ' + v + '%'
	if (v >= 30) return v + '%'
	if (v >= 10) return 'low ' + v + '%'
	if (v > 0) return 'LOW ' + v + '%'
	return 'LOWEST'
}

export function rgb2hex(rgb) {
	// should be replaced by d3-color.rgb(xx).hex()
	if (rgb[0] == '#') return rgb
	const r = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i)
	return r && r.length === 4
		? '#' +
				('0' + parseInt(r[1], 10).toString(16)).slice(-2) +
				('0' + parseInt(r[2], 10).toString(16)).slice(-2) +
				('0' + parseInt(r[3], 10).toString(16)).slice(-2)
		: ''
}

export function keyupEnter(event) {
	return event.code == 'Enter' || event.code == 'NumpadEnter'
}

export function may_findmatchingsnp(chr, poslst, genome, alleleLst) {
	/*
chr: string, required
poslst[]
	int, or {start, stop}
	required
genome{ name }, required
alleleLst[], optional
*/
	if (!genome || !genome.hasSNP) return
	const p = {
		byCoord: true,
		genome: genome.name,
		chr: chr,
		ranges: [],
		alleleLst
	}
	for (const i of poslst) {
		if (Number.isFinite(i)) {
			p.ranges.push({ start: i, stop: i + 1 })
		} else if (i.start && i.stop) {
			p.ranges.push(i)
		}
	}
	return dofetch('snp', p).then(data => {
		if (data.error) throw data.error
		return data.results
	})
}

export function snp_printhtml(m, d) {
	/*
m{}
	.name
	.observed
*/
	d.append('a')
		.text(m.name)
		.attr('href', 'https://www.ncbi.nlm.nih.gov/snp/' + m.name)
		.attr('target', '_blank')
	d.append('div').attr('class', 'sja_tinylogo_body').text(m.observed)
	d.append('div').attr('class', 'sja_tinylogo_head').text('ALLELE')
}

export function clinvar_printhtml(m, d) {
	/*
m{}
	.id
	.value
	.bg
	.textcolor
*/
	d.append('div')
		.style('display', 'inline-block')
		.style('background', m.bg)
		.style('padding', '3px')
		.append('a')
		.attr('href', 'https://www.ncbi.nlm.nih.gov/clinvar/variation/' + m.id)
		.attr('target', '_blank')
		.style('color', m.textcolor)
		.text(m.value)
		.style('font-size', '.9em')
		.style('text-decoration', 'none')
}

export function gmlst2loci(gmlst) {
	// gmlst as is returned by genelookup:deep
	const locs = []
	for (const f of gmlst) {
		let nooverlap = true
		for (const r of locs) {
			if (f.chr == r.chr && Math.max(f.start, r.start) < Math.min(f.stop, r.stop)) {
				r.start = Math.min(r.start, f.start)
				r.stop = Math.max(r.stop, f.stop)
				nooverlap = false
			}
		}
		if (nooverlap) {
			locs.push({
				name: f.isoform,
				chr: f.chr,
				start: f.start,
				stop: f.stop
			})
		}
	}
	return locs
}

export function tab2box(holder, tabs, runall, tabheader) {
	/*
tabs[ tab{} ]
	.label:
		required
	.callback()
		required

this function attaches .box (d3 dom) to each tab of tabs[]

*/
	const tr = holder.append('table').style('border-spacing', '0px').style('border-collapse', 'separate').append('tr')
	const tdleft = tr.append('td').style('vertical-align', 'top').style('padding', '10px 0px 10px 10px')
	const tdright = tr
		.append('td')
		.style('vertical-align', 'top')
		.style('border-left', 'solid 1px #aaa')
		.style('padding', '10px')
	const has_acitve_tab = tabs.findIndex(t => t.active) == -1 ? false : true

	if (tabheader) {
		const tHeader = tdleft
			.append('div')
			.style('padding', '5px 10px')
			.style('margin', '5px 5px 10px 5px')
			.style('font-weight', '550')
			.text(tabheader)
	}

	for (let i = 0; i < tabs.length; i++) {
		const tab = tabs[i]

		tab.tab = tdleft
			.append('div')
			.style('padding', '5px 10px')
			.style('margin', '0px')
			.style('border-top', 'solid 1px #ddd')
			.style('border-radius', '0px')
			.classed('sja_menuoption', !has_acitve_tab && i != 0)
			.html(tab.label)

		tab.box = tdright
			.append('div')
			.style('padding', '3px')
			.style('display', (!has_acitve_tab && i == 0) || tab.active ? 'block' : 'none')

		if ((runall && tab.callback) || (!has_acitve_tab && i == 0 && tab.callback) || tab.active) {
			tab.callback(tab.box)
			delete tab.callback
		}
		if (has_acitve_tab) tab.tab.classed('sja_menuoption', !tab.active)

		tab.tab.on('click', () => {
			if (tab.box.style('display') != 'none') {
				tab.tab.classed('sja_menuoption', true)
				tab.box.style('display', 'none')
			} else {
				tab.tab.classed('sja_menuoption', false)
				appear(tab.box)
				for (let j = 0; j < tabs.length; j++) {
					if (i != j) {
						tabs[j].tab.classed('sja_menuoption', true)
						tabs[j].box.style('display', 'none')
					}
				}
			}
			if (tab.callback) {
				tab.callback(tab.box)
				delete tab.callback
			}
		})
	}
}

export function tab_wait(d) {
	return d.append('div').style('margin', '30px').text('Loading...')
}

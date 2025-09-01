import * as client from './client'
import { table2col } from '#dom'
import { scaleLinear } from 'd3-scale'
import { axisBottom } from 'd3-axis'
import { format as d3format } from 'd3-format'
import { select as d3select } from 'd3-selection'
import * as coord from './coord'
import { legend_newrow } from './block.legend'
import { basecompliment, default_text_color } from '#shared/common.js'
import { rgb } from 'd3-color'

/*
the "gene model" track, showing in one of four modes:
- genomic
- splicing RNA
- exon only
- protein
- aggregated isoforms



********************** EXPORTED

gmtkfromtemplate()
gmtkmaketk()
gmtkrender()



********************** INTERNAL

configpanel()
configpanel_gmsum()
render1gm()
domainlegend()


TODO make adaptor and split from block bundle

*/

const linecolor = 'black'

const exonboundaryclass = 'exonboundaryclass'

export function gmtkfromtemplate(tk) {
	tk.stackheight = tk.stackheight0 = tk.stackheight || 30
	tk.stackspace = 5
	if (!tk.noncodingcolor) {
		tk.noncodingcolor = '#ccc'
	}
}

export function gmtkmaketk(tk, block) {
	tk.tklabel.text(block.usegm.name)
	tk.isoformlabel = block.maketklefthandle(tk, 13).attr('class', null).text(block.usegm.isoform)
	domainlegend(tk, block)
	tk.config_handle = block.maketkconfighandle(tk).on('click', () => {
		configpanel(tk, block)
	})
}

function configpanel(tk, block) {
	// config panel for gm track
	tk.tkconfigtip.clear().showunder(tk.config_handle.node())
	const holder = tk.tkconfigtip.d

	const table = holder.append('table')

	// display mode
	const tr1 = table.append('tr')
	tr1.append('td').text(block.gmmode)
	tr1
		.append('td')
		.attr('class', 'sja_menuoption')
		.text('switch display mode')
		.on('click', () => {
			table.remove()
			block.showgmmode4switch(holder)
		})

	// change isoform
	const tr2 = table.append('tr')
	if (block.allgm.length > 1) {
		tr2.append('td').text(block.usegm.isoform)
		tr2
			.append('td')
			.attr('class', 'sja_menuoption')
			.text('switch isoform')
			.on('click', () => {
				table.remove()
				block.showisoform4switch(holder)
			})
	}
	if (block.gmmode == client.gmmode.gmsum) {
		// in gmsum mode, customize isoform
		const tr3 = table.append('tr')
		let usecount = 0
		for (const m of block.allgm) {
			if (!m.hidden) usecount++
		}
		tr3
			.append('td')
			.text(
				usecount == block.allgm.length
					? 'Showing all ' + usecount + ' isoforms'
					: 'Showing ' + usecount + ' of ' + block.allgm.length + ' isoforms'
			)
		tr3
			.append('td')
			.attr('class', 'sja_menuoption')
			.text('show/hide isoforms')
			.on('click', () => {
				table.remove()
				configpanel_gmsum(block, holder)
			})
		table
			.append('tr')
			.append('td')
			.attr('colspan', 2)
			.style('padding-top', '15px')
			.style('font-size', '.8em')
			.html('To rearrange isoforms, drag and move<br>isoform names on the left of the track.')
	}

	if (
		block.usegm.exon.length > 1 &&
		(block.gmmode == client.gmmode.protein || block.gmmode == client.gmmode.exononly)
	) {
		// show/hide exon boundary lines
		const tr = table.append('tr')
		tr.append('td').text('Exon boundary')
		tr.append('td')
			.append('button')
			.text(tk.exonboundaryhide ? 'show lines' : 'hide lines')
			.on('click', event => {
				tk.exonboundaryhide = !tk.exonboundaryhide
				event.target.innerHTML = tk.exonboundaryhide ? 'show lines' : 'hide lines'
				block.usegm.__tkg.selectAll('.' + exonboundaryclass).attr('stroke-opacity', tk.exonboundaryhide ? 0 : 1)
			})
	}
	if (block.gmmode == client.gmmode.protein || block.gmmode == client.gmmode.exononly) {
		const tr = table.append('tr')
		const label = tr.append('td').attr('colspan', 2).append('label')
		label
			.append('input')
			.attr('type', 'checkbox')
			.property('checked', tk.noCodonNumberInsideBox)
			.on('change', () => {
				tk.noCodonNumberInsideBox = !tk.noCodonNumberInsideBox
				gmtkrender(tk, block)
			})
		label.append('span').style('margin-left', '10px').text('Hide codon numbers')
	}
}

function configpanel_gmsum(block, holder) {
	// group isoforms by gene track name
	const genetkset = new Map()
	for (const g of block.allgm) {
		if (!g.trackname) {
			client.sayerror(holder, '.trackname missing for ' + g.isoform)
			continue
		}
		if (!genetkset.has(g.trackname)) {
			genetkset.set(g.trackname, new Map())
		}
		genetkset.get(g.trackname).set(g, { hidden: g.hidden })
	}
	if (genetkset.size == 0) {
		client.sayerror(holder, 'no gene track names!')
		return
	}
	for (const [genetkname, isoformset] of genetkset) {
		const row = holder.append('div').style('margin', '5px')
		// if all isoforms of this track are hidden
		const id = Math.random()
		const tkcheckbox = row
			.append('input')
			.attr('type', 'checkbox')
			.attr('id', id)
			.on('change', () => {
				for (const obj of isoformset.values()) {
					obj.checkbox.node().checked = tkcheckbox.node().checked
				}
			})
		let allhidden = true
		for (const obj of isoformset.values()) {
			if (!obj.hidden) {
				allhidden = false
				break
			}
		}
		if (!allhidden) {
			tkcheckbox.property('checked', true)
		}
		row
			.append('label')
			.html('&nbsp;&nbsp;' + genetkname)
			.attr('for', id)
			.attr('class', 'sja_clbtext')
		for (const [isoform, obj] of isoformset) {
			const row = holder.append('div').style('margin', '3px 5px 3px 30px')
			const id = Math.random()
			obj.checkbox = row.append('input').attr('type', 'checkbox').attr('id', id)
			if (!obj.hidden) {
				obj.checkbox.property('checked', true)
			}
			row
				.append('label')
				.html(
					'&nbsp;&nbsp;' +
						isoform.isoform +
						' <span style="color:#858585">' +
						(isoform.cdslen ? Math.ceil(isoform.cdslen / 3) + ' AA' : 'noncoding') +
						'</span>'
				)
				.attr('for', id)
				.attr('class', 'sja_clbtext')
		}
	}
	holder
		.append('button')
		.style('display', 'block')
		.style('margin-top', '5px')
		.text('Apply changes')
		.on('click', () => {
			let usecount = 0
			const isoform2hide = new Set()
			for (const isoformset of genetkset.values()) {
				for (const [isoform, obj] of isoformset) {
					const show = obj.checkbox.node().checked
					if (show) {
						usecount++
					} else {
						isoform2hide.add(isoform)
					}
				}
			}
			if (usecount <= 1) {
				window.alert('Must select at least two isoforms')
				return
			}
			for (const gm of block.allgm) {
				gm.hidden = isoform2hide.has(gm)
			}
			delete block.gmmode
			block.setgmmode(client.gmmode.gmsum, true)
		})
}

export function gmtkrender(tk, block) {
	tk.busy = false
	block.ifbusy()
	tk.glider.attr('transform', 'translate(0,0)').selectAll('*').remove()
	if (!block.gmmode) {
		block.tkerror(tk, 'running usegm track but gmmode not set')
		return
	}

	const collectlabw = []

	if (block.gmmode == client.gmmode.gmsum) {
		tk.tklabel.text('')
		tk.isoformlabel.text('')
		tk.isoformnames = []
		const h = tk.stackheight * 0.7

		let y = 0
		for (const gm of block.allgm) {
			if (gm.hidden) {
				continue
			}
			gm.__tkg = tk.glider.append('g').attr('transform', 'translate(0,' + y + ')')
			gm.__tky = y
			render1gm(gm, h, tk, block)
			const thislab = gm.__tkg
				.append('text')
				.text(gm.isoform)
				.attr('y', h / 2)
				.attr('x', -12)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'central')
				.attr('fill', 'black')
				.attr('font-size', block.labelfontsize)
				.each(function () {
					collectlabw.push(this.getBBox().width)
				})
				.on('mousedown', event => {
					event.preventDefault()
					event.stopPropagation()
					moveisoform(gm, block, event.clientY, h + tk.stackspace)
				})
			tk.isoformnames.push(thislab)
			y += h + tk.stackspace
		}
		tk.height_main = y + tk.bottompad
	} else {
		tk.isoformnames = null
		block.usegm.__tkg = tk.glider.append('g')
		render1gm(block.usegm, tk.stackheight, tk, block)
		tk.height_main = tk.toppad + tk.stackheight + tk.bottompad
		tk.tklabel.text(block.usegm.name).each(function () {
			collectlabw.push(this.getBBox().width)
		})
		tk.isoformlabel.text(block.usegm.isoform).each(function () {
			collectlabw.push(this.getBBox().width)
		})
	}
	tk.leftLabelMaxwidth = Math.max(...collectlabw)
	block.block_setheight()
	block.setllabel()
}

function render1gm(gm, h, tk, block) {
	/*
gm:
h: coding exon height, reduced for noncoding exons
tk:
block:
*/

	// overall container
	const tkg = gm.__tkg

	// thickness reduction for noncoding exons
	const thinpad = Math.floor(h / 5)

	// 1 - get onscreen start/stop for gm in view range

	// left side of visible part of gm
	let start = null
	let x = 0 // cumulate
	for (let i = block.startidx; i <= block.stopidx; i++) {
		const r = block.rglst[i]
		if (r.chr != gm.chr) {
			x += r.width + block.regionspace
			continue
		}
		const a = Math.max(r.start, gm.start),
			b = Math.min(r.stop, gm.stop)
		if (a < b) {
			// left side of visible part is valid
			start = x + (r.reverse ? r.stop - b : a - r.start) * block.exonsf
			break
		}
		x += r.width + block.regionspace
	}
	if (start == null) {
		tkg
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('fill', linecolor)
			.attr('dominant-baseline', 'central')
			.attr('font-size', Math.min(15, h))
			.attr('x', block.width / 2)
			.attr('y', h / 2)
			.text(gm.name + ' ' + gm.isoform + ' is not in view range')
		return
	}
	// right side of visible part of gm
	let stop = null
	x = 0
	for (let i = block.startidx; i <= block.stopidx; i++) {
		const r = block.rglst[i]
		if (r.chr != gm.chr) {
			x += r.width + block.regionspace
			continue
		}
		const a = Math.max(r.start, gm.start),
			b = Math.min(r.stop, gm.stop)
		if (a < b) {
			stop = x + (r.reverse ? r.stop - a : b - r.start) * block.exonsf
			// don't break here keep looking till end of rglst to find max stop
		}
		x += r.width + block.regionspace
	}
	if (stop == null) {
		console.log('should not happen: stop position not found')
		tkg
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'central')
			.attr('font-size', Math.min(15, h))
			.attr('x', block.width / 2)
			.attr('y', h / 2)
			.text(gm.name + ' not in view range')
		return
	}

	// 2 - backdrop horizontal line from start to end
	const startinvr = start
	const stopinvr = stop
	tkg
		.append('line')
		.attr('x1', startinvr)
		.attr('y1', h / 2)
		.attr('x2', stopinvr)
		.attr('y2', h / 2)
		.attr('stroke', linecolor)
		.attr('shape-rendering', 'crispEdges')

	// collect all exonic boxes, for showing kicker
	const eboxes = []

	// 3 - thin box for noncoding exon
	//     collect them for printing nt letters later
	const thinlst = []

	if (block.gmmode != client.gmmode.protein) {
		if (gm.utr5) {
			thinlst.push(...gm.utr5)
		}
		if (gm.utr3) {
			thinlst.push(...gm.utr3)
		}
		if (gm.exon && !gm.coding) {
			// this is a noncoding gene
			thinlst.push(...gm.exon)
		}
		for (const e of thinlst) {
			x = 0
			for (let i = block.startidx; i <= block.stopidx; i++) {
				const r = block.rglst[i]
				if (r.chr != gm.chr) {
					x += r.width + block.regionspace
					continue
				}
				const start = Math.max(r.start, e[0]),
					stop = Math.min(r.stop, e[1])
				if (start >= stop) {
					x += r.width + block.regionspace
					continue
				}
				const b = tkg
					.append('rect')
					.attr('x', x + (r.reverse ? r.stop - stop : start - r.start) * block.exonsf)
					.attr('y', thinpad)
					.attr('width', Math.max(1, (stop - start) * block.exonsf))
					.attr('height', h - thinpad * 2)
					.attr('fill', tk.noncodingcolor)
				eboxes.push({ b: b, r: r, start: start, stop: stop })
			}
		}
	}

	// 4 - thick box coding and domain
	if (gm.pdomains) {
		gm.pdomains.sort((a, b) => b.stop - b.start - (a.stop - a.start))
	}
	// for drawing protein box if in view range
	let viewcodingstartpx = null,
		viewcodingstart = null, // genomic coord
		viewcodingstoppx = null,
		viewcodingstop = null
	if (gm.coding) {
		for (let ei = 0; ei < gm.coding.length; ei++) {
			const e = gm.coding[ei]
			x = 0
			for (let ri = block.startidx; ri <= block.stopidx; ri++) {
				const r = block.rglst[ri]
				if (r.chr != gm.chr) {
					x += r.width + block.regionspace
					continue
				}
				const start = Math.max(r.start, e[0]),
					stop = Math.min(r.stop, e[1])
				if (start >= stop) {
					x += r.width + block.regionspace
					continue
				}
				// will draw a thick box
				const boxstart = x + (r.reverse ? r.stop - stop : start - r.start) * block.exonsf
				const boxwidth = Math.max(1, (stop - start) * block.exonsf)
				if (viewcodingstartpx == null) {
					viewcodingstartpx = boxstart
					viewcodingstart = start
					viewcodingstop = stop
				} else {
					viewcodingstart = Math.min(start, viewcodingstart)
					viewcodingstop = Math.max(stop, viewcodingstop)
				}
				viewcodingstoppx = boxstart + boxwidth
				// white bg
				const b = tkg.append('rect').attr('x', boxstart).attr('width', boxwidth).attr('height', h).attr('fill', 'white')
				eboxes.push({ b: b, r: r, start: start, stop: stop })
				// domain?
				if (gm.pdomains) {
					let exoncdsstart = 0
					for (let j = 0; j < ei; j++) {
						exoncdsstart += gm.coding[j][1] - gm.coding[j][0]
					}
					const cdsstart = exoncdsstart + (r.reverse ? e[1] - stop : start - e[0])
					const cdsstop = exoncdsstart + (r.reverse ? e[1] - start : stop - e[0])
					for (const domain of gm.pdomains) {
						if (domain.name + domain.description in gm.domain_hidden) {
							continue
						}
						const dstart = Math.max(cdsstart, (domain.start - 1) * 3)
						const dstop = Math.min(cdsstop, domain.stop * 3)
						if (dstart < dstop) {
							tkg
								.append('rect')
								// FIXME assumed that the rglst can only be in 5'-3' order!!!
								.attr('x', boxstart + (dstart - cdsstart) * block.exonsf)
								.attr('width', Math.max(1, (dstop - dstart) * block.exonsf))
								.attr('height', h)
								.attr('fill', domain.color)
						}
					}
				}
				if (block.gmmode != client.gmmode.protein && block.gmmode != client.gmmode.exononly) {
					// enclosing box for each coding exon
					if (start == e[0]) {
						const _x = boxstart + (r.reverse ? boxwidth : 0)
						tkg.append('line').attr('x1', _x).attr('x2', _x).attr('y2', h).attr('stroke', linecolor)
					}
					if (stop == e[1]) {
						const _x = boxstart + (r.reverse ? 0 : boxwidth)
						tkg.append('line').attr('x1', _x).attr('x2', _x).attr('y2', h).attr('stroke', linecolor)
					}
					tkg
						.append('line')
						.attr('x1', boxstart)
						.attr('x2', boxstart + boxwidth)
						.attr('stroke', linecolor)
					tkg
						.append('line')
						.attr('x1', boxstart)
						.attr('x2', boxstart + boxwidth)
						.attr('y1', h)
						.attr('y2', h)
						.attr('stroke', linecolor)
				}
			}
		}
	}

	// 5 - enclosing box of entire coding region
	if (block.gmmode == client.gmmode.exononly || block.gmmode == client.gmmode.protein) {
		if (viewcodingstartpx != null && viewcodingstoppx != null) {
			tkg.append('line').attr('x1', viewcodingstartpx).attr('x2', viewcodingstoppx).attr('stroke', linecolor)
			tkg
				.append('line')
				.attr('x1', viewcodingstartpx)
				.attr('x2', viewcodingstoppx)
				.attr('y1', h)
				.attr('y2', h)
				.attr('stroke', linecolor)
			// FIXME association of codingstart and px is not clear
			const reverse = gm.strand == '-'
			if (viewcodingstart == gm.codingstart) {
				tkg
					.append('line')
					.attr('x1', reverse ? viewcodingstoppx : viewcodingstartpx)
					.attr('x2', reverse ? viewcodingstoppx : viewcodingstartpx)
					.attr('y2', h)
					.attr('stroke', linecolor)
			}
			if (viewcodingstop == gm.codingstop) {
				tkg
					.append('line')
					.attr('x1', reverse ? viewcodingstartpx : viewcodingstoppx)
					.attr('x2', reverse ? viewcodingstartpx : viewcodingstoppx)
					.attr('y2', h)
					.attr('stroke', linecolor)
			}
		}
		// exon boundary
		for (let i = block.startidx; i < block.stopidx; i++) {
			const r = block.rglst[i]
			if (r.chr != gm.chr) continue
			x = 0
			for (let j = block.startidx; j < i; j++) {
				x += block.rglst[j].width + block.regionspace
			}
			let thin = true
			if (gm.coding) {
				if (r.reverse) {
					thin = r.start <= gm.codingstart || r.start >= gm.codingstop
				} else {
					thin = r.stop <= gm.codingstart || r.stop >= gm.codingstop
				}
			}
			tkg
				.append('line')
				.attr('class', exonboundaryclass)
				.attr('x1', x + r.width + block.regionspace / 2)
				.attr('x2', x + r.width + block.regionspace / 2)
				.attr('y1', thin ? thinpad : 0)
				.attr('y2', h - (thin ? thinpad : 0))
				.attr('stroke', linecolor)
				.attr('stroke-dasharray', '4,2')
				.attr('shape-rendering', 'crispEdges')
				.attr('stroke-opacity', tk.exonboundaryhide ? 0 : 1)
		}
	}

	const showntseq = block.exonsf >= 6

	// 6 -  aa sequence and position
	if (
		gm.coding &&
		(block.gmmode == client.gmmode.protein ||
			block.gmmode == client.gmmode.exononly ||
			block.gmmode == client.gmmode.splicingrna)
	) {
		// is protein
		const showaaseq = block.exonsf >= 2
		const rowh = (h - 2) / 3
		// show aa
		let utr5len
		if (block.gmmode == client.gmmode.protein) {
			// not using utr
			utr5len = 0
		} else {
			utr5len = gm.utr5 ? gm.utr5.reduce((a, b) => a + b[1] - b[0], 0) : 0
		}

		const aadomain = [],
			aarange = []
		for (let i = block.startidx; i <= block.stopidx; i++) {
			const r = block.rglst[i]
			if (r.chr != gm.chr) {
				continue
			}
			x = 0
			for (let j = block.startidx; j < i; j++) {
				x += block.rglst[j].width + block.regionspace
			}
			const rstartexonbp = block.regioncumlen(i)
			const rstopexonbp = rstartexonbp + r.stop - r.start
			if (rstartexonbp >= utr5len + gm.cdslen || rstopexonbp <= utr5len) {
				// not in block region
				continue
			}
			let cdsstart, pxstart
			if (rstartexonbp < utr5len) {
				cdsstart = 0
				pxstart = (utr5len - rstartexonbp) * block.exonsf
			} else {
				cdsstart = rstartexonbp - utr5len
				pxstart = 0
			}

			/* TRICKY!!!
			offset value is usually 0
			if startCodonFrame is specified, will set non-0 value
			for modifying nt array index below while iterating through whose nt that will be translated
			this is because gm.cdseq (CDS sequence) contains extra nts associated with startCodonFrame
			*/
			const codonNtOffset = gm.startCodonFrame ? 3 - gm.startCodonFrame : 0

			const cdsstop = Math.min(gm.cdslen, rstopexonbp - utr5len)

			/*
		FIXME
		domain/range of the aa position scale is imprecise
		*/
			aadomain.push(1 + Math.floor(cdsstart / 3))
			aarange.push(x + pxstart + block.exonsf * (cdsstart % 3 == 0 ? 1.5 : cdsstart % 3 == 1 ? 0.5 : -0.5))
			aadomain.push(1 + Math.floor(cdsstop / 3))
			aarange.push(x + pxstart + (cdsstop - cdsstart) * block.exonsf)
			if (showntseq) {
				// must not include cdsstop
				for (let j = cdsstart; j < cdsstop; j++) {
					// shade over a codon

					const j2 = j - codonNtOffset // modified index

					if (Math.floor(j2 / 3) % 2 == 0) {
						tkg
							.append('rect')
							.attr('x', x + pxstart + (j - cdsstart) * block.exonsf)
							.attr('width', block.exonsf)
							.attr('height', rowh * 2)
							.attr('fill', 'black')
							.attr('fill-opacity', 0.1)
					}
					tkg
						.append('text')
						.text(gm.cdseq[j]) // do not use j2 here
						.attr('font-size', rowh)
						.attr('dominant-baseline', 'central')
						.attr('text-anchor', 'middle')
						.attr('fill', 'black')
						.attr('x', x + pxstart + (j - cdsstart + 0.5) * block.exonsf)
						.attr('y', 2 + rowh / 2)
						.attr('font-family', 'Courier') // no override; customary to show nucleotide/aa in this font
				}
			}
			if (cdsstart % 3 == 2) {
				// trim one bp
				cdsstart++
				pxstart += block.exonsf
			}
			if (showaaseq) {
				// must not include cdsstop
				for (let j = cdsstart; j < cdsstop; j++) {
					const j2 = j - codonNtOffset // modified index

					if (j2 % 3 != 1) {
						continue
					}
					tkg
						.append('text')
						.text(gm.aaseq[Math.floor(j2 / 3)])
						.attr('font-size', rowh)
						.attr('font-weight', 'bold')
						.attr('fill', 'black')
						.attr('dominant-baseline', showntseq ? 'central' : 'auto')
						.attr('text-anchor', 'middle')
						.attr('x', x + pxstart + (j - cdsstart + 0.5) * block.exonsf) // do not use j2 here
						.attr('y', h / 2)
						.attr('font-family', 'Courier') // no override; customary to show nucleotide/aa in this font
				}
			}
		}
		if (aadomain.length && !tk.noCodonNumberInsideBox) {
			const scale = scaleLinear().domain(aadomain).range(aarange)
			client.axisstyle({
				axis: tkg
					.append('g')
					.attr('transform', 'translate(0,' + (showaaseq ? (showntseq ? rowh * 2 : h / 2) : h / 2) + ')')
					.call(axisBottom().scale(scale).tickSize(0).tickFormat(d3format('d'))),
				color: 'black',
				showline: false,
				fontsize: rowh
			})
		}
	}

	// 7 - nt sequence in noncoding exons
	if (showntseq && gm.genomicseq) {
		const rowh = (h - 2) / 3
		for (const e of thinlst) {
			x = 0
			for (let i = block.startidx; i <= block.stopidx; i++) {
				const r = block.rglst[i]
				if (r.chr != gm.chr) {
					x += r.width + block.regionspace
					continue
				}
				const start = Math.max(r.start, e[0]),
					stop = Math.min(r.stop, e[1])
				if (start >= stop) {
					x += r.width + block.regionspace
					continue
				}
				for (let j = start; j < stop; j++) {
					let nt = gm.genomicseq[j - gm.start]
					if (r.reverse) {
						nt = basecompliment(nt)
					}
					tkg
						.append('text')
						.text(nt)
						.attr('font-size', rowh)
						.attr('dominant-baseline', 'central')
						.attr('text-anchor', 'middle')
						.attr('fill', 'black')
						.attr('font-family', 'Courier') // no override; customary to show nucleotide/aa in this font
						.attr(
							'x',
							x +
								(r.reverse
									? (r.stop - stop) * block.exonsf + (stop - start) * block.exonsf - (j - start + 0.5) * block.exonsf
									: (start - r.start) * block.exonsf + (j - start + 0.5) * block.exonsf)
						)
						.attr('y', h / 2)
				}
			}
		}
	}

	// 8 - invisible cover for tooltipping
	for (const e of eboxes) {
		tkg
			.append('rect')
			.attr('x', e.b.attr('x'))
			.attr('y', e.b.attr('y'))
			.attr('width', e.b.attr('width'))
			.attr('height', e.b.attr('height'))
			.attr('fill', '#858585')
			.attr('fill-opacity', 0)
			.on('mouseover', event => event.target.setAttribute('fill-opacity', 0.2))
			.on('mousemove', event => coord2legend(tk, event, e.r, e.start, e.stop, gm, block, h))
			.on('mouseout', event => {
				event.target.setAttribute('fill-opacity', 0)
				tk.tktip.hide()
			})
	}
}

function moveisoform(gm, block, y0, height) {
	const body = d3select(document.body)
	body.on('mousemove', event => {
		const dy = event.clientY - y0
		gm.__tkg.attr('transform', 'translate(0,' + (gm.__tky + dy) + ')')
		let gmidx = 0
		for (let i = 0; i < block.allgm.length; i++) {
			if (block.allgm[i].isoform == gm.isoform) {
				gmidx = i
				break
			}
		}
		if (dy < 0 && gmidx > 0) {
			let t2idx = gmidx - 1,
				t2 = block.allgm[t2idx]
			while (t2.hidden) {
				t2idx--
				if (t2idx < 0) {
					return
				}
				t2 = block.allgm[t2idx]
			}
			if (!t2) {
				return
			}
			if (-dy >= height) {
				block.allgm[t2idx] = gm
				block.allgm[gmidx] = t2
				gm.__tky = t2.__tky
				t2.__tky += height
				t2.__tkg.transition().attr('transform', 'translate(0,' + t2.__tky + ')')
				y0 = event.clientY
			}
		} else if (dy > 0 && gmidx < block.allgm.length - 1) {
			let t2idx = gmidx + 1,
				t2 = block.allgm[t2idx]
			while (t2.hidden) {
				t2idx++
				if (t2idx >= block.allgm.length) {
					return
				}
				t2 = block.allgm[t2idx]
			}
			if (!t2) {
				return
			}
			if (dy >= height) {
				// swap
				block.allgm[t2idx] = gm
				block.allgm[gmidx] = t2
				t2.__tky = gm.__tky
				gm.__tky += height
				t2.__tkg.transition().attr('transform', 'translate(0,' + t2.__tky + ')')
				y0 = event.clientY
			}
		}
	})
	body.on('mouseup', () => {
		gm.__tkg.transition().attr('transform', 'translate(0,' + gm.__tky + ')')
		body.on('mousemove', null).on('mouseup', null)
	})
}

function coord2legend(tk, event, r, start, stop, gm, block, h) {
	tk.tktip.clear()
	const table = table2col({ holder: tk.tktip.d, margin: '0px' })
	const a = event.target.getBoundingClientRect()
	const x = event.clientX - a.left

	let pos
	/*
	pos is 0-based!
	for reverse, must use stop minus ceil
	for forward, must use start plus floor
	*/
	if (r.reverse) {
		pos = stop - Math.ceil(x / block.exonsf)
	} else {
		pos = start + Math.floor(x / block.exonsf)
	}

	const p = coord.genomic2gm(pos, gm)
	if (p.atexon) table.addRow('Exon', p.atexon)

	if (p.atutr5) table.addRow("5' UTR", p.atutr5.off + ' bp')
	else if (p.atutr3) table.addRow("3' UTR", p.atutr3.off + ' bp')
	else if (p.aapos) table.addRow('AA', p.aapos + ' aa')

	if (p.rnapos) table.addRow('RNA', p.rnapos + ' bp')
	table.addRow(gm.chr, pos + 1)
	if (p.aapos && gm.pdomains) {
		table.table.style('margin-bottom', '5px')
		for (const d of gm.pdomains) {
			if (d.name + d.description in gm.domain_hidden) continue
			if (d.start <= p.aapos && d.stop >= p.aapos) {
				const row = tk.tktip.d.append('div')
				row.append('span').style('background-color', d.color).html('&nbsp;&nbsp;')
				row.append('span').html('&nbsp;' + d.name)
				if (d.description) {
					row
						.append('span')
						.style('font-size', '.7em')
						.html('&nbsp;' + (d.description.length > 30 ? d.description.substring(0, 20) + ' ...' : d.description))
				}
			}
		}
	}
	tk.tktip.show(event.clientX, gm.__tkg.node().getBoundingClientRect().top + h - 10)
}

//////////////// render domain legend ///////////////

// all link types. makelink() arg is element returned by getdomaintypes()
const domainLinks = [
	{
		key: 'CDD',
		makelink: domaintype => `https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=${domaintype.CDD}`
	},
	{
		key: 'Pfam',
		makelink: domaintype => `https://www.ebi.ac.uk/interpro/entry/pfam/PF${domaintype.Pfam.substr(4)}`
	},
	{
		key: 'SMART',
		makelink: domaintype =>
			`https://smart.embl.de/smart/do_annotation.pl?BLAST=DUMMY&DOMAIN=${domaintype.SMART.substr(5)}`
	},
	{
		key: 'COG',
		makelink: domaintype => `https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=${domaintype.COG}`
	},
	{
		key: 'PRK',
		makelink: domaintype => `https://www.ncbi.nlm.nih.gov/proteinclusters?term=${domaintype.PRK}`
	},
	{
		key: 'pmid', // may support comma-joined ids
		makelink: domaintype => `https://pubmed.ncbi.nlm.nih.gov/${domaintype.pmid}/`,
		txt: domaintype => `PubMed ${domaintype.pmid}`
	},
	{
		key: 'url',
		makelink: domaintype => domaintype.url,
		txt: () => 'Reference'
	}
]
async function domainlegend(tk, block) {
	if (!block.legend || !block.legend.holder) {
		// block not support legend
		return
	}
	if (!block.usegm) {
		// no gm in use?
		return
	}
	if (!tk.tr_legend) {
		const [tr, td] = legend_newrow(block, 'PROTEIN')
		tk.tr_legend = tr
		tk.td_legend = td
	}
	tk.td_legend.selectAll('*').remove()

	// get unique list of domain types from current gm (note that it may not cover all domains from all gm which could be minor issue)
	// any customizations to the domains (visibility and color), apply to all gm
	const domainTypes = client.getdomaintypes(block.usegm)

	const menuOptions = [
		{
			label: 'Hide',
			hide: d => block.usegm.domain_hidden[d.key],
			callback: d => {
				for (const m of block.allgm) {
					m.domain_hidden[d.key] = 1
				}
			}
		},
		{
			label: 'Show',
			hide: d => !block.usegm.domain_hidden[d.key],
			callback: d => {
				for (const m of block.allgm) {
					delete m.domain_hidden[d.key]
				}
			}
		},
		{
			label: 'Show All',
			hide: () => !Object.keys(block.usegm.domain_hidden).length,
			callback: () => {
				for (const m of block.allgm) {
					m.domain_hidden = {}
				}
			}
		},
		{
			label: 'Show only',
			hide: () => Object.keys(block.usegm.domain_hidden).length == domainTypes.length - 1,
			callback: d => {
				for (const m of block.allgm) {
					delete m.domain_hidden[d.key]
					for (const c of domainTypes) {
						if (c.key != d.key) m.domain_hidden[c.key] = 1
					}
				}
			}
		}
	]

	const legendRows = tk.td_legend
		.selectAll('div')
		.data(domainTypes)
		.enter()
		.append('div')
		.classed('sjpp-domain-legend-item', true)
		.style('margin', block.legend.vpad + ' 0px 8px 0px')

	legendRows.append('span').style('padding', '5px 0px').style('margin-right', '10px')

	//sja_clb class adds the background color hover effect
	const clickableRow = legendRows.append('span').classed('sja_clb', true)

	//Color box
	const colorbox = clickableRow
		.append('span')
		.style('background-color', d => d.fill)
		.html('&nbsp;&nbsp;&nbsp;')
		.style('margin-right', '10px')

	//Domain name
	const name = clickableRow
		.append('span')
		.text(d => d.name)
		.style('text-decoration', d => (block.usegm.domain_hidden[d.key] ? 'line-through' : 'none'))
		.style('color', default_text_color)
		.style('margin-right', '10px')

	//Domain description
	const description = clickableRow
		.append('span')
		.text(d => d.description)
		.style('text-decoration', d => (block.usegm.domain_hidden[d.key] ? 'line-through' : 'none'))
		.style('color', default_text_color)
		.style('font-size', '.7em')
		.style('margin-right', '10px')

	clickableRow.on('click', async (event, domaintype) => {
		block.tip.clear().showunder(event.target)

		//Dynamically add options from the array above
		await block.tip.d
			.selectAll('div')
			.data(menuOptions.filter(o => !o.hide(domaintype)))
			.enter()
			.append('div')
			.style('border-radius', '0px')
			.classed('sja_menuoption', true)
			.text(o => o.label)
			.on('click', (event, option) => {
				event.stopPropagation()
				option.callback(domaintype)
				updateItems()

				// Destroy menu and re-render the visualization
				block.tip.hide()
				gmtkrender(tk, block)
			})

		// Add color picker seperately to accommodate rendering needs
		if (!block.usegm.domain_hidden[domaintype.key]) {
			block.tip.d
				.append('div')
				.text('Color: ')
				.style('margin', '10px')
				.append('input')
				.attr('type', 'color')
				.attr('value', domaintype.fill)
				.style('margin-left', '5px')
				.on('change', event => {
					domaintype.fill = event.target.value
					for (const p of block.allgm) {
						// a gm may have more than 1 domain instances of this type. thus use .filter() to find all of them but not .find() to find only 1st one
						p.pdomains
							.filter(pd => pd.name + pd.description == domaintype.key)
							.forEach(i => (i.color = event.target.value))
					}
					updateItems()
					// Same as above
					block.tip.hide()
					gmtkrender(tk, block)
				})
		}
	})
	/* Add links dynamically to the row from the array above
		in a separate span. The hover effect will not apply to 
		this span. */
	legendRows.append('span').each(function (domaintype) {
		const holder = d3select(this)
		for (const link of domainLinks) {
			if (domaintype[link.key]) {
				holder
					.append('a')
					.attr('href', link.makelink(domaintype))
					.attr('target', '_blank')
					.text(link.txt ? link.txt(domaintype) : link.key)
					.style('font-size', '.7em')
					.style('padding-right', '10px')
			}
		}
	})

	//Updates the styling of the domain legend items based on the current hidden domains
	const updateItems = () => {
		const isHidden = domaintype => block.usegm.domain_hidden && block.usegm.domain_hidden[domaintype.key]
		colorbox.style('background-color', d => (isHidden(d) ? 'transparent' : d.fill))
		name.style('text-decoration', d => (isHidden(d) ? 'line-through' : 'none'))
		description.style('text-decoration', d => (isHidden(d) ? 'line-through' : 'none'))
	}

	if (block.usegm.coding && block.usegm.coding.length > 0) {
		// custom domain ui, only for coding gene
		let displayUI = false

		const addProteinBtn = tk.td_legend.append('div').style('margin-top', '10px')

		const proteinDomainUI = tk.td_legend.append('div').style('display', 'none')
		customdomainmakeui(block, tk, proteinDomainUI)

		const btn = addProteinBtn
			.append('div')
			.style('display', 'inline-block')
			.classed('sja_menuoption', true)
			.style('font-size', '.8em')
			.html(displayUI ? '&#9650; Add protein domain' : '&#9660; add protein domain')
			.on('click', () => {
				displayUI = !displayUI
				proteinDomainUI.style('display', displayUI ? 'block' : 'none')
				btn.html(displayUI ? '&#9650; add protein domain' : '&#9660; add protein domain')
			})
	}
}

let idIncrement = 0
function getId() {
	return `sjpp-customdomainui-${idIncrement++}`
}

function customdomainmakeui(block, tk, proteinDomainUI) {
	const wrapper = proteinDomainUI.style('padding', '20px')
	const textAreaId = getId()
	//header
	wrapper
		.append('label')
		.attr('for', textAreaId)
		.html(`Add domains for ${block.usegm.name} <span style="font-size:.8em">${block.usegm.isoform}</span>`)
	const lst = client.getdomaintypes(block.usegm)

	const customd = []
	for (const d of lst) {
		if (d.iscustom) customd.push(d)
	}
	if (customd.length > 0) {
		const div = wrapper.append('div').style('margin', '20px 0px')
		div.append('div').text('Click to remove a domain').style('font-size', '.8em').style('margin-bottom', '5px')
		for (const i of customd) {
			const row = div.append('div').classed('sja_menuoption', true)
			row
				.append('div')
				.style('background-color', i.fill)
				.style('border', 'solid 1px ' + i.stroke)
				.style('display', 'inline-block')
				.style('margin-right', '5px')
				.style('padding', '1px 2px')
				.html('&nbsp;')
			row.append('div').style('display', 'inline-block').text(i.name)
			row.on('click', () => {
				row.remove()
				const lst2 = []
				for (const d of block.usegm.pdomains) {
					if (d.iscustom && d.name == i.name) continue
					lst2.push(d)
				}
				block.usegm.pdomains = lst2
				gmtkrender(tk, block)
				domainlegend(tk, block)
			})
		}
	}
	wrapper
		.append('p')
		.style('font-size', '.9em')
		.html('<span style="font-size:.8em;color:#000">EXAMPLE</span>&nbsp;&nbsp;domain_name ; 100 200 ; red')
	const ta = wrapper.append('textarea').attr('id', textAreaId).attr('rows', 5).attr('cols', 30)
	const row1 = wrapper.append('div').style('margin-top', '5px')
	const select = row1.append('select')
	select.append('option').text('Codon position')
	select.append('option').text('mRNA position')
	select.append('option').text('Genomic position')
	row1
		.append('button')
		.text('Submit')
		.style('margin-left', '5px')
		.on('click', () => {
			const v = ta.property('value')
			if (v == '') return
			errdiv.style('display', 'none')
			const lines = v.trim().split('\n')
			for (const line of lines) {
				const l = line.split(';')
				if (l.length != 3) return err('invalid line: ' + line)
				const t = l[1].trim().split(' ')
				if (t.length != 2) return err('position requires start and stop: ' + line)
				const a = Number.parseInt(t[0])
				const b = Number.parseInt(t[1])
				if (Number.isNaN(a) || Number.isNaN(b)) return err('invalid position value: ' + line)
				let start, stop
				switch (select.node().selectedIndex) {
					case 0:
						start = a
						stop = b
						break
					case 1:
						let x = coord.rna2gmcoord(a, block.usegm)
						if (x == null) return err('cannot map RNA position ' + a + ' to gene model')
						start = coord.genomic2gm(x, block.usegm).aapos
						x = coord.rna2gmcoord(b, block.usegm)
						if (x == null) return err('cannot map RNA position ' + b + ' to gene model')
						stop = coord.genomic2gm(x, block.usegm).aapos
						break
					default:
						const a1 = coord.genomic2gm(a, block.usegm).aapos
						const a2 = coord.genomic2gm(b, block.usegm).aapos
						start = Math.min(a1, a2)
						stop = Math.max(a1, a2)
				}

				//Fix for users entering colors in different formats (i.e. red, rgb(255,0,0), etc.)
				//Color picker only accepts hex code for value
				const color = l[2].trim().startsWith('#') ? l[2].trim() : rgb(l[2].trim()).formatHex()
				block.usegm.pdomains.push({
					iscustom: true,
					name: l[0].trim(),
					color,
					start: start,
					stop: stop
				})
			}
			proteinDomainUI.style('display', 'none')
			gmtkrender(tk, block)
			domainlegend(tk, block)
			//customdomainmakeui(block, tk, pane)
		})
	row1
		.append('button')
		.text('Clear')
		.style('margin-left', '5px')
		.on('click', () => ta.property('value', ''))
	const errdiv = wrapper.append('div').style('margin-top', '10px').style('display', 'none')
	const err = m => {
		errdiv.style('display', 'block')
		client.sayerror(errdiv, m)
	}
	wrapper
		.append('div')
		.style('color', '#000')
		.style('margin-top', '20px')
		.html(
			`One protein domain per line.<br>
Each line has three fields joined by semicolon:
<ol>
  <li>Name, text with space, no semicolon.</li>
  <li>Range, two integers joined by space.</li>
  <li>Color, e.g. red, #FF0000, rgb(255,0,0).</li>
</ol>`
		)
}

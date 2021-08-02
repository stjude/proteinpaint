const app = require('./app')
const path = require('path')
const fs = require('fs')
const utils = require('./utils')
const createCanvas = require('canvas').createCanvas
const nt2aa = require('../shared/common').nt2aa

/*
should guard against file content error e.g. two tabs separating columns

genome=? is only required for gene tracks that will be translated, otherwise not required

*/

module.exports = genomes => {
	return async (req, res) => {
		if (app.reqbodyisinvalidjson(req, res)) return
		try {
			res.send(await do_query(req, genomes))
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function do_query(req, genomes) {
	const [e, tkfile, isurl] = app.fileurl(req)
	if (e) throw e

	let stackheight, stackspace, regionspace, width, fontsize
	if (req.query.getdata) {
		// no rendering, return list of parsed items
		if (req.query.getBED) {
			// experimental parameter to pass over BED file items to clientside
		}
	} else {
		stackheight = Number(req.query.stackheight)
		stackspace = Number(req.query.stackspace)
		regionspace = Number(req.query.regionspace)
		width = Number(req.query.width)
		if (Number.isNaN(stackheight)) throw 'stackheight is not integer'
		fontsize = Math.max(10, stackheight - 2)
		if (Number.isNaN(stackspace)) throw 'stackspace is not integer'
		if (Number.isNaN(regionspace)) throw 'regionspace is not integer'
		// width could be float!!
		if (Number.isNaN(width)) throw 'width is not a number'
	}

	if (req.query.usevalue) {
		if (!req.query.usevalue.key) throw '.key missing from .usevalue'
		if (req.query.usevalue.dropBelowCutoff) {
			req.query.usevalue.dropBelowCutoff = Number(req.query.usevalue.dropBelowCutoff)
			if (Number.isNaN(req.query.usevalue.dropBelowCutoff)) throw '.usevalue.dropBelowCutoff is not number'
		}
	}

	if (req.query.bplengthUpperLimit) {
		req.query.bplengthUpperLimit = Number(req.query.bplengthUpperLimit)
		if (Number.isNaN(req.query.bplengthUpperLimit)) throw 'bplengthUpperLimit not number'
	}

	if (!req.query.rglst) throw 'no rglst[]'
	//req.query.rglst = JSON.parse(req.query.rglst)
	if (!Array.isArray(req.query.rglst)) throw 'rglst is not an array'
	if (req.query.rglst.length == 0) throw 'empty rglst'
	for (const r of req.query.rglst) {
		// TODO validate regions
		if (r.reverse) {
			r.scale = p => Math.ceil((r.width * (r.stop - p)) / (r.stop - r.start))
		} else {
			r.scale = p => Math.ceil((r.width * (p - r.start)) / (r.stop - r.start))
		}
	}

	const color = req.query.color || '#3D7A4B'
	const flag_gm = req.query.gmregion || null
	const gmisoform = req.query.isoform
	const flag_onerow = req.query.onerow
	const categories = req.query.categories || null
	const __isgene = req.query.__isgene

	let dir
	if (isurl) {
		dir = await utils.cache_index(tkfile, req.query.indexURL)
	}

	const regionitems = await query_file(req.query, tkfile, dir, flag_gm, gmisoform)

	const items = []

	// apply filtering
	for (const lst of regionitems) {
		for (const i of lst) {
			if (req.query.usevalue) {
				const v = i[req.query.usevalue.key]
				if (!Number.isFinite(v)) {
					continue
				}
				if (req.query.usevalue.dropBelowCutoff && v < req.query.usevalue.dropBelowCutoff) {
					continue
				}
			}
			if (req.query.bplengthUpperLimit && i.stop - i.start > req.query.bplengthUpperLimit) {
				continue
			}
			items.push(i)
		}
	}

	if (req.query.getdata) {
		///////////////////////// exit ///////////////////
		return { items }
	}

	if (items.length == 0) {
		const canvas = createCanvas(width * req.query.devicePixelRatio, stackheight * req.query.devicePixelRatio)
		const ctx = canvas.getContext('2d')
		if (req.query.devicePixelRatio > 1) ctx.scale(req.query.devicePixelRatio, req.query.devicePixelRatio)
		ctx.font = stackheight + 'px Arial'
		ctx.fillStyle = '#aaa'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText('No data in view range', width / 2, stackheight / 2)
		///////////////////////// exit ///////////////////
		return {
			src: canvas.toDataURL(),
			height: stackheight
		}
	}

	const thinpad = Math.ceil(stackheight / 4) - 1

	if (flag_onerow || items.length >= 400) {
		// render all items in a single row
		// do not show names
		// may render strand
		const notmanyitem = items.length < 200
		const canvas = createCanvas(width * req.query.devicePixelRatio, stackheight * req.query.devicePixelRatio)
		const ctx = canvas.getContext('2d')
		if (req.query.devicePixelRatio > 1) ctx.scale(req.query.devicePixelRatio, req.query.devicePixelRatio)
		const mapisoform = items.length <= 200 ? [] : null
		for (const item of items) {
			const fillcolor =
				categories && item.category && categories[item.category] ? categories[item.category].color : item.color || color
			ctx.fillStyle = fillcolor
			for (const _r of item.rglst) {
				let cumx = 0
				for (let i = 0; i < _r.idx; i++) {
					cumx += req.query.rglst[i].width + regionspace
				}
				const r = req.query.rglst[_r.idx]
				const thin = []
				if (item.utr5) {
					thin.push(...item.utr5)
				}
				if (item.utr3) {
					thin.push(...item.utr3)
				}
				if (item.exon && (!item.coding || item.coding.length == 0)) {
					thin.push(...item.exon)
				}
				for (const e of thin) {
					const a = Math.max(r.start, e[0])
					const b = Math.min(r.stop, e[1])
					const pxa = cumx + r.scale(r.reverse ? b : a)
					const pxb = cumx + r.scale(r.reverse ? a : b)
					ctx.fillRect(pxa, thinpad, Math.max(1, pxb - pxa), stackheight - thinpad * 2)
					bedj_may_mapisoform(mapisoform, pxa, pxb, 1, item)
				}
				const thick = []
				if (item.exon) {
					if (item.coding && item.coding.length > 0) {
						thick.push(...item.coding)
					}
				} else {
					thick.push([item.start, item.stop])
				}
				for (const e of thick) {
					const a = Math.max(r.start, e[0])
					const b = Math.min(r.stop, e[1])
					const pxa = cumx + r.scale(r.reverse ? b : a)
					const pxb = cumx + r.scale(r.reverse ? a : b)
					ctx.fillRect(pxa, 0, Math.max(1, pxb - pxa), stackheight)
					bedj_may_mapisoform(mapisoform, pxa, pxb, 1, item)
					if (item.strand && notmanyitem) {
						ctx.strokeStyle = 'white'
						strokearrow(ctx, item.strand, pxa, thinpad, pxb - pxa, stackheight - thinpad * 2)
					}
				}
			}
		}
		///////////////////////// exit ///////////////////
		return {
			src: canvas.toDataURL(),
			height: stackheight,
			mapisoform: mapisoform
		}
	}

	////////// render normally

	if (req.query.hideItemNames) {
		// delete item names to prevent them from showing
		for (const i of items) delete i.name
	}

	let returngmdata = null
	if (__isgene && items.length < 50) {
		// gene data requested and not too many, so return data
		returngmdata = []
		for (const i of items) {
			const j = {}
			for (const k in i) {
				if (k == 'canvas' || k == 'rglst') continue
				j[k] = i[k]
			}
			returngmdata.push(j)
		}
	}

	const bpcount = req.query.rglst.reduce((a, b) => a + b.stop - b.start, 0)
	const maytranslate = req.query.translatecoding && bpcount < width * 3
	let genomeobj
	if (maytranslate) {
		if (!req.query.genome) throw 'genome missing for translating genes'
		genomeobj = genomes[req.query.genome]
		if (!genomeobj) throw 'invalid genome'
	}
	const translateitem = []
	const namespace = 1
	const namepad = 10 // box no struct: [pad---name---pad]
	const canvas = createCanvas(10, 10) // for measuring text only
	let ctx = canvas.getContext('2d')
	if (req.query.devicePixelRatio > 1) ctx.scale(req.query.devicePixelRatio, req.query.devicePixelRatio)
	ctx.font = 'bold ' + fontsize + 'px Arial'
	const packfull = items.length < 200
	const mapisoform = items.length < 200 ? [] : null
	// sort items
	// TODO from different chrs
	let sortreverse = false
	if (flag_gm) {
		sortreverse = flag_gm.reverse
	}
	for (const r of req.query.rglst) {
		if (r.reverse) {
			sortreverse = true
		}
	}

	items.sort((a, b) => {
		if (sortreverse) {
			if (a.stop == b.stop) {
				return a.start - b.start
			}
			return b.stop - a.stop
		} else {
			if (a.start == b.start) {
				return b.stop - a.stop
			}
			return a.start - b.start
		}
	})
	let hasstruct = false
	for (const i of items) {
		if (i.exon) hasstruct = true
	}

	// stack
	const stack = [0]
	let maxstack = 1,
		mapexon = null

	for (const item of items) {
		// px position in the whole view range
		let itemstartpx = null,
			itemstoppx = null

		for (const _r of item.rglst) {
			let cumx = 0
			for (let i = 0; i < _r.idx; i++) {
				cumx += req.query.rglst[i].width + regionspace
			}
			const r = req.query.rglst[_r.idx]
			const a = Math.max(item.start, r.start)
			const b = Math.min(item.stop, r.stop)
			if (a < b) {
				// item in this region
				const pxa = cumx + r.scale(r.reverse ? b : a)
				const pxb = cumx + r.scale(r.reverse ? a : b)
				if (itemstartpx == null) {
					itemstartpx = pxa
					itemstoppx = pxb
				} else {
					itemstartpx = Math.min(itemstartpx, pxa)
					itemstoppx = Math.max(itemstoppx, pxb)
				}
			}
		}
		if (itemstartpx == null) {
			continue
		}
		item.canvas = {
			start: itemstartpx,
			stop: itemstoppx,
			stranded: item.strand != undefined
		}
		if (item.coding && maytranslate) {
			item.willtranslate = true // so later the strand will not show
			translateitem.push(item)
		}
		let boxstart = itemstartpx
		let boxstop = itemstoppx
		if (packfull) {
			// check item name
			const namestr = item.name
			if (namestr) {
				item.canvas.namestr = namestr
				const namewidth = ctx.measureText(namestr).width
				item.canvas.namewidth = namewidth

				if (hasstruct) {
					if (item.canvas.start >= namewidth + namespace) {
						item.canvas.namestart = item.canvas.start - namespace
						boxstart = item.canvas.namestart - namewidth
						item.canvas.textalign = 'right'
					} else if (item.canvas.stop + namewidth + namespace <= width) {
						item.canvas.namestart = item.canvas.stop + namespace
						boxstop = item.canvas.namestart + namewidth
						item.canvas.textalign = 'left'
					} else {
						item.canvas.namehover = true
						item.canvas.textalign = 'left'
					}
				} else {
					if (Math.min(width, item.canvas.stop) - Math.max(0, item.canvas.start) >= namewidth + namepad * 2) {
						item.canvas.namein = true
					} else if (item.canvas.start >= namewidth + namespace) {
						item.canvas.namestart = item.canvas.start - namespace
						boxstart = item.canvas.namestart - namewidth
						item.canvas.textalign = 'right'
					} else if (item.canvas.stop + namewidth + namespace <= width) {
						item.canvas.namestart = item.canvas.stop + namespace
						boxstop = item.canvas.namestart + namewidth
						item.canvas.textalign = 'left'
					} else {
						// why??
						item.canvas.namein = true
					}
				}
			}
		}
		if (item.canvas.stop - item.canvas.start > width * 0.3) {
			// enable
			mapexon = []
		}
		for (let i = 1; i <= maxstack; i++) {
			if (stack[i] == undefined || stack[i] < boxstart) {
				item.canvas.stack = i
				stack[i] = boxstop
				break
			}
		}
		if (item.canvas.stack == undefined) {
			maxstack++
			stack[maxstack] = boxstop
			item.canvas.stack = maxstack
		}
		bedj_may_mapisoform(mapisoform, item.canvas.start, item.canvas.stop, item.canvas.stack, item)
	}

	// render

	canvas.width = width * req.query.devicePixelRatio
	const finalheight = (stackheight + stackspace) * maxstack - stackspace
	canvas.height = finalheight * req.query.devicePixelRatio
	ctx = canvas.getContext('2d')
	if (req.query.devicePixelRatio > 1) ctx.scale(req.query.devicePixelRatio, req.query.devicePixelRatio)
	ctx.font = 'bold ' + fontsize + 'px Arial'
	ctx.textBaseline = 'middle'
	ctx.lineWidth = 1

	for (const item of items) {
		// render an item

		const c = item.canvas
		if (!c) {
			// invisible item
			continue
		}
		const fillcolor =
			categories && item.category && categories[item.category] ? categories[item.category].color : item.color || color
		const y = (stackheight + stackspace) * (c.stack - 1)
		ctx.fillStyle = fillcolor
		if (item.exon || item.rglst.length > 1) {
			// through line
			ctx.strokeStyle = fillcolor
			ctx.beginPath()
			ctx.moveTo(c.start, Math.floor(y + stackheight / 2) + 0.5)
			ctx.lineTo(c.stop, Math.floor(y + stackheight / 2) + 0.5)
			ctx.stroke()
		}
		for (const _r of item.rglst) {
			let cumx = 0
			for (let i = 0; i < _r.idx; i++) {
				cumx += req.query.rglst[i].width + regionspace
			}
			const region = req.query.rglst[_r.idx]
			const thinbox = []
			if (item.utr3) {
				thinbox.push(...item.utr3)
			}
			if (item.utr5) {
				thinbox.push(...item.utr5)
			}
			if (item.exon && (!item.coding || item.coding.length == 0)) {
				thinbox.push(...item.exon)
			}
			for (const e of thinbox) {
				const a = Math.max(e[0], region.start)
				const b = Math.min(e[1], region.stop)
				if (a < b) {
					const pxa = cumx + region.scale(region.reverse ? b : a)
					const pxb = cumx + region.scale(region.reverse ? a : b)
					ctx.fillRect(pxa, y + thinpad, Math.max(1, pxb - pxa), stackheight - thinpad * 2)
				}
			}
			const thick = []
			if (item.exon) {
				if (item.coding && item.coding.length > 0) {
					thick.push(...item.coding)
				}
			} else {
				thick.push([item.start, item.stop])
			}
			let _strand = item.strand
			if (c.stranded && region.reverse) {
				_strand = item.strand == '+' ? '-' : '+'
			}
			for (const e of thick) {
				const a = Math.max(e[0], region.start)
				const b = Math.min(e[1], region.stop)
				if (a < b) {
					const pxa = cumx + region.scale(region.reverse ? b : a)
					const pxb = cumx + region.scale(region.reverse ? a : b)
					ctx.fillRect(pxa, y, Math.max(1, pxb - pxa), stackheight)

					// strand marks inside box

					if (c.stranded && !item.willtranslate) {
						ctx.strokeStyle = 'white'

						if (c.namein) {
							/*
						patch!!!
						to acknowledge name inside box cases
						this always happens to a singular item with no exon structure
						*/
							const w = (pxb - pxa - c.namewidth) / 2
							strokearrow(ctx, _strand, pxa, y + thinpad, w, stackheight - thinpad * 2)
							strokearrow(ctx, _strand, pxa + w + c.namewidth, y + thinpad, w, stackheight - thinpad * 2)
						} else {
							strokearrow(ctx, _strand, pxa, y + thinpad, pxb - pxa, stackheight - thinpad * 2)
						}
					}
				}
			}
			if (c.stranded && item.intron) {
				// intron arrows
				ctx.strokeStyle = fillcolor
				for (const e of item.intron) {
					const a = Math.max(e[0], region.start)
					const b = Math.min(e[1], region.stop)
					if (a < b) {
						const pxa = cumx + region.scale(region.reverse ? b : a)
						const pxb = cumx + region.scale(region.reverse ? a : b)
						strokearrow(ctx, _strand, pxa, y + thinpad, pxb - pxa, stackheight - thinpad * 2)
					}
				}
			}
			if (mapexon && item.exon) {
				for (let i = 0; i < item.exon.length; i++) {
					const e = item.exon[i]
					if (e[1] <= region.start || e[0] >= region.stop) continue
					const a = Math.max(e[0], region.start)
					const b = Math.min(e[1], region.stop)
					if (a < b) {
						const x1 = cumx + region.scale(region.reverse ? b : a)
						const x2 = cumx + region.scale(region.reverse ? a : b)
						mapexon.push({
							chr: item.chr,
							start: Math.min(e[0], e[1]),
							stop: Math.max(e[0], e[1]),
							x1: x1,
							x2: x2,
							y: c.stack,
							name: 'Exon ' + (i + 1) + '/' + item.exon.length
						})
					}
				}
				for (let i = 1; i < item.exon.length; i++) {
					const istart = item.exon[item.strand == '+' ? i - 1 : i][1],
						istop = item.exon[item.strand == '+' ? i : i - 1][0]
					if (istop <= region.start || istart >= region.stop) continue
					const a = Math.max(istart, region.start)
					const b = Math.min(istop, region.stop)
					if (a < b) {
						const x1 = cumx + region.scale(region.reverse ? b : a)
						const x2 = cumx + region.scale(region.reverse ? a : b)
						if (x2 < 0) continue
						mapexon.push({
							chr: item.chr,
							start: istart,
							stop: istop,
							x1: x1,
							x2: x2,
							y: c.stack,
							name: 'Intron ' + i + '/' + (item.exon.length - 1)
						})
					}
				}
			}
		}
		// name
		if (c.namestart != undefined) {
			ctx.textAlign = c.textalign
			ctx.fillStyle = fillcolor
			ctx.fillText(c.namestr, c.namestart, y + stackheight / 2)
		} else if (c.namehover) {
			const x = Math.max(10, c.start + 10)
			ctx.fillStyle = 'white'
			ctx.fillRect(x, y, c.namewidth + 10, stackheight)
			ctx.strokeStyle = fillcolor
			ctx.strokeRect(x + 1.5, y + 0.5, c.namewidth + 10 - 3, stackheight - 2)
			ctx.fillStyle = fillcolor
			ctx.textAlign = 'center'
			ctx.fillText(c.namestr, x + c.namewidth / 2 + 5, y + stackheight / 2)
		} else if (c.namein) {
			ctx.textAlign = 'center'
			ctx.fillStyle = 'white'
			ctx.fillText(c.namestr, (Math.max(0, c.start) + Math.min(width, c.stop)) / 2, y + stackheight / 2)
		}
	}

	const result = {
		height: finalheight,
		mapisoform,
		mapexon,
		returngmdata
	}
	if (translateitem.length == 0) {
		// nothing to be translated
		result.src = canvas.toDataURL()
		return result
	}
	// have genes to be translated
	const mapaa = []

	const altcolor = 'rgba(122,103,44,.7)',
		errcolor = 'red',
		startcolor = 'rgba(0,255,0,.4)',
		stopcolor = 'rgba(255,0,0,.5)'
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	for (const [i, item] of translateitem.entries()) {
		// need i
		const fillcolor =
			categories && item.category && categories[item.category] ? categories[item.category].color : item.color || color
		const c = item.canvas
		const y = (stackheight + stackspace) * (c.stack - 1)
		item.genomicseq = (await utils.get_fasta(genomeobj, item.chr + ':' + (item.start + 1) + '-' + item.stop))
			.split('\n')
			.slice(1)
			.join('')
			.toUpperCase()
		const aaseq = nt2aa(item)
		for (const _r of item.rglst) {
			const region = req.query.rglst[_r.idx]
			let cumx = 0
			for (let j = 0; j < _r.idx; j++) {
				cumx += req.query.rglst[j].width + regionspace
			}
			const bppx = region.width / (region.stop - region.start)
			const _fs = Math.min(stackheight, bppx * 3)
			const aafontsize = _fs < 8 ? null : _fs
			let minustrand = false
			if (c.stranded && item.strand == '-') {
				minustrand = true
			}
			let cds = 0
			if (aafontsize) {
				ctx.font = aafontsize + 'px Arial'
			}
			for (const e of item.coding) {
				// each exon, they are ordered 5' to 3'
				if (minustrand) {
					if (e[0] >= item.stop) {
						cds += e[1] - e[0]
						continue
					}
					if (e[1] <= item.start) {
						break
					}
				} else {
					if (e[1] <= item.start) {
						cds += e[1] - e[0]
						continue
					}
					if (e[0] >= item.stop) {
						break
					}
				}
				const lookstart = Math.max(item.start, e[0]),
					lookstop = Math.min(item.stop, e[1])
				if (minustrand) {
					cds += e[1] - lookstop
				} else {
					cds += lookstart - e[0]
				}
				let codonspan = 0
				for (let k = 0; k < lookstop - lookstart; k++) {
					// each coding base
					cds++
					codonspan++
					let aanumber
					if (cds % 3 == 0) {
						aanumber = cds / 3 - 1
					} else {
						if (k < lookstop - lookstart - 1) {
							continue
						} else {
							// at the 3' end of this exon
							aanumber = Math.floor(cds / 3)
						}
					}
					let aa = aaseq[aanumber],
						_fillcolor = Math.ceil(cds / 3) % 2 == 0 ? altcolor : null
					if (!aa) {
						aa = 4 // show text "4" to indicate error
						_fillcolor = errcolor
					} else if (aa == 'M') {
						_fillcolor = startcolor
					} else if (aa == '*') {
						_fillcolor = stopcolor
					}
					// draw aa
					let thispx,
						thiswidth = bppx * codonspan
					if (minustrand) {
						const thispos = lookstop - 1 - k
						thispx = cumx + region.scale(thispos)
					} else {
						const thispos = lookstart + k + 1 - codonspan
						thispx = cumx + region.scale(thispos)
					}
					if (region.reverse) {
						// correction!
						thispx -= thiswidth
					}
					codonspan = 0
					if (thispx >= cumx && thispx <= cumx + region.width) {
						// in view range
						// rect
						if (_fillcolor) {
							ctx.fillStyle = _fillcolor
							ctx.fillRect(thispx, y, thiswidth, stackheight)
						}
						if (aafontsize) {
							ctx.fillStyle = 'white'
							ctx.fillText(aa, thispx + thiswidth / 2, y + stackheight / 2)
						}
						mapaa.push({
							x1: thispx,
							x2: thispx + thiswidth,
							y: item.canvas.stack,
							name: aa + (aanumber + 1) + ' <span style="font-size:.7em;color:#858585">AA residue</span>'
						})
					}
				}
			}
		}
		if (c.namehover) {
			ctx.font = 'bold ' + fontsize + 'px Arial'
			const x = Math.max(10, c.start + 10)
			ctx.fillStyle = 'white'
			ctx.fillRect(x, y, c.namewidth + 10, stackheight)
			ctx.strokeStyle = fillcolor
			ctx.strokeRect(x + 1.5, y + 0.5, c.namewidth + 10 - 3, stackheight - 2)
			ctx.fillStyle = fillcolor
			ctx.fillText(c.namestr, x + c.namewidth / 2 + 5, y + stackheight / 2)
		}
	}
	// done translating
	result.src = canvas.toDataURL()
	result.mapaa = mapaa
	return result
}

function bedj_may_mapisoform(lst, pxa, pxb, y, item) {
	/* only handle singular bed items, or entire isoform
do not handle exon/intron parts
may return additional info for:
- creating url for clicking items
*/
	if (!lst) return // not to map
	if (!item.name && !item.isoform) return // no name
	const show = []
	if (item.name) show.push(item.name)
	if (item.isoform) show.push(item.isoform)
	lst.push({
		// return position for displaying in tooltip
		chr: item.chr,
		start: item.start,
		stop: item.stop,
		x1: pxa,
		x2: pxb,
		y: y, // stack number
		/* isoform is for client to select one and launch protein view
		 */
		isoform: item.isoform,
		//name:show.join(' ')+printcoord(item.chr, e[0], e[1])
		name: show.join(' ')
	})
}

async function query_file(q, tkfile, dir, flag_gm, gmisoform) {
	if (flag_gm) {
		// query over the gene region, just one region
		const items = []
		let errlinecount = 0
		await utils.get_lines_tabix([tkfile, flag_gm.chr + ':' + flag_gm.start + '-' + flag_gm.stop], dir, line => {
			const l = line.split('\t')
			let j = {}
			if (q.getBED) {
				j.rest = l.slice(3)
			} else if (l[3]) {
				try {
					j = JSON.parse(l[3])
				} catch (e) {
					errlinecount++
					return
				}
			}
			if (j.isoformonly && j.isoformonly != gmisoform) {
				// this is specific for what? idr per isoforms?
				return
			}
			j.chr = l[0]
			j.start = Number.parseInt(l[1])
			j.stop = Number.parseInt(l[2])
			j.rglst = []
			for (let i = 0; i < q.rglst.length; i++) {
				const r = q.rglst[i]
				// simply decide by the whole gene span, not by exons, otherwise there will result in gaps
				if (Math.max(j.start, r.start) < Math.min(j.stop, r.stop)) {
					j.rglst.push({ idx: i })
				}
			}
			if (j.rglst.length == 0) return
			items.push(j)
		})
		return [items]
	}
	// query over genomic regions
	// each item belong to only one region
	const regions = []

	for (const [idx, r] of q.rglst.entries()) {
		const itemofthisregion = []
		await utils.get_lines_tabix([tkfile, r.chr + ':' + r.start + '-' + r.stop], dir, line => {
			const l = line.split('\t')
			let j = {}
			if (q.getBED) {
				j.rest = l.slice(3)
			} else if (l[3]) {
				try {
					j = JSON.parse(l[3])
				} catch (e) {
					errlinecount++
					return
				}
			}
			j.chr = l[0]
			j.start = Number.parseInt(l[1])
			j.stop = Number.parseInt(l[2])
			j.rglst = [{ idx }]
			itemofthisregion.push(j)
		})
		regions.push(itemofthisregion)
	}
	return regions
}

function strokearrow(ctx, strand, x, y, w, h) {
	const pad = h / 2,
		arrowwidth = h / 2,
		arrowpad = Math.max(h / 2, 6)
	if (w - pad * 2 < arrowwidth) return
	const arrownum = Math.ceil((w - pad * 2) / (arrowwidth + arrowpad))
	if (arrownum <= 0) return
	const forward = strand == '+'
	let x0 = Math.ceil(x + (w - arrowwidth * arrownum - arrowpad * (arrownum - 1)) / 2)
	for (let i = 0; i < arrownum; i++) {
		ctx.beginPath()
		if (forward) {
			ctx.moveTo(x0, y)
			ctx.lineTo(x0 + arrowwidth, y + h / 2)
			ctx.moveTo(x0 + arrowwidth, y + h / 2 + 1)
			ctx.lineTo(x0, y + h)
		} else {
			ctx.moveTo(x0 + arrowwidth, y)
			ctx.lineTo(x0, y + h / 2)
			ctx.moveTo(x0, y + h / 2 + 1)
			ctx.lineTo(x0 + arrowwidth, y + h)
		}
		ctx.stroke()
		x0 += arrowwidth + arrowpad
	}
}

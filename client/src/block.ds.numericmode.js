import { scaleLinear } from 'd3-scale'
import { axisLeft } from 'd3-axis'
import { format as d3format } from 'd3-format'
import { arc as d3arc } from 'd3-shape'
import { rgb as d3rgb } from 'd3-color'
import { select as d3select } from 'd3-selection'
import { itemtable, query_vcfcohorttrack } from './block.ds.itemtable'
import * as client from './client'
import * as coord from './coord'
import * as common from '#shared/common.js'
import may_sunburst from './block.sunburst'
import {
	mlst_pretreat,
	tkdata_update_x,
	minbpwidth,
	disclabelspacing,
	getter_mcset_key,
	middlealignshift,
	epaint_may_hl,
	done_tknodata
} from './block.ds'

/*

new:
	samplebynumericvalue


FIXME ITD stack bars not working


********************** EXPORTED

rendernumerictk()

********************** INTERNAL

numeric_make()

*/

const clustercrowdlimit = 7 // at least 8 px per disc, otherwise won't show mname label

const mnamegetter = s => {
	if (!s) return ''
	// trim too long names
	if (s.length > 25) {
		return s.substr(0, 20) + '...'
	}
	return s
}

export function rendernumerictk(tk, block, originhidden) {
	/*
	makes:

	tk.data
	tk.skewer2

	*/

	const nm = tk.numericmode

	if (!nm.axisheight) {
		nm.axisheight = 100
	}

	// do not skip grouping!?

	// create group and plot anew
	tk.glider.selectAll('*').remove()
	delete tk.skewer

	const usemlst = mlst_pretreat(tk, block, originhidden)

	const x2mlst = new Map()
	for (const m of usemlst) {
		if (m.__x == undefined) {
			// dropped by filter
			continue
		}
		if (!x2mlst.has(m.__x)) {
			x2mlst.set(m.__x, [])
		}
		x2mlst.get(m.__x).push(m)
	}
	const datagroup = []
	const topxbins = []
	// by resolution
	if (block.exonsf >= minbpwidth) {
		// # pixel per nt is big enough
		// group by each nt
		for (const [x, mlst] of x2mlst) {
			datagroup.push({
				chr: mlst[0].chr,
				pos: mlst[0].pos,
				mlst: mlst,
				x: x
			})
		}
	} else {
		// # pixel per nt is too small
		if (block.usegm && block.usegm.coding && block.gmmode != client.gmmode.genomic) {
			// by aa
			// in gmsum, rglst may include introns, need to distinguish symbolic and rglst introns, use __x difference by a exonsf*3 limit
			const aa2mlst = new Map()
			for (const [x, mlst] of x2mlst) {
				if (mlst[0].chr != block.usegm.chr) {
					continue
				}
				// TODO how to identify if mlst belongs to regulatory region rather than gm
				let aapos = undefined
				for (const m of mlst) {
					if (Number.isFinite(m.aapos)) aapos = m.aapos
				}
				if (aapos == undefined) {
					aapos = coord.genomic2gm(mlst[0].pos, block.usegm).aapos
				}
				if (aapos == undefined) {
					console.error('data item cannot map to aaposition')
					console.log(mlst[0])
					continue
				}

				// this group can be anchored to a aa
				x2mlst.delete(x)

				if (!aa2mlst.has(aapos)) {
					aa2mlst.set(aapos, [])
				}
				let notmet = true
				for (const lst of aa2mlst.get(aapos)) {
					if (Math.abs(lst[0].__x - mlst[0].__x) <= block.exonsf * 3) {
						for (const m of mlst) {
							lst.push(m)
						}
						notmet = false
						break
					}
				}
				if (notmet) {
					aa2mlst.get(aapos).push(mlst)
				}
			}
			const utr5len = block.usegm.utr5 ? block.usegm.utr5.reduce((i, j) => i + j[1] - j[0], 0) : 0
			for (const llst of aa2mlst.values()) {
				for (const mlst of llst) {
					let m = null
					for (const m2 of mlst) {
						if (Number.isFinite(m2.rnapos)) m = m2
					}
					if (m == null) {
						console.log('trying to map mlst to codon, but no rnapos found')
						for (const m of mlst) {
							console.log(m)
						}
						continue
					}
					datagroup.push({
						chr: mlst[0].chr,
						pos: m.pos,
						mlst: mlst,
						x: mlst[0].__x
					})
				}
			}
		}
		// leftover by px bin
		const pxbin = []
		const binpx = 2
		for (const [x, mlst] of x2mlst) {
			const i = Math.floor(x / binpx)
			if (!pxbin[i]) {
				pxbin[i] = []
			}
			pxbin[i] = [...pxbin[i], ...mlst]
		}
		for (const mlst of pxbin) {
			if (!mlst) continue
			const xsum = mlst.reduce((i, j) => i + j.__x, 0)
			datagroup.push({
				isbin: true,
				chr: mlst[0].chr,
				pos: mlst[0].pos,
				mlst: mlst,
				x: xsum / mlst.length
			})
		}
	}

	datagroup.sort((a, b) => a.x - b.x)

	if (tk.data && block.pannedpx != undefined && (!block.usegm || block.gmmode == client.gmmode.genomic)) {
		// inherit genomic mode and panned
		const pastmode = {}
		for (const g of tk.data) {
			pastmode[g.chr + '.' + g.pos] = {
				xoffset: g.xoffset
			}
		}
		for (const g of datagroup) {
			const k = g.chr + '.' + g.pos
			if (pastmode[k]) {
				g.xoffset = pastmode[k].xoffset
			}
		}
	}
	tk.data = datagroup

	numeric_make(tk, block)

	tk.height_main =
		tk.toppad +
		nm.toplabelheight +
		//+disclabelspacing
		nm.maxradius +
		nm.axisheight +
		nm.maxradius +
		tk.stem1 +
		tk.stem2 +
		tk.stem3 +
		nm.bottomlabelheight +
		tk.bottompad

	if (!tk.data || tk.data.length == 0) {
		done_tknodata(tk, block)
		return
	}

	/*
	variants loaded for this track
	*/
}

function color4disc(m, tk) {
	if (tk.vcfinfofilter && tk.vcfinfofilter.setidx4mclass != undefined) {
		const mcset = tk.vcfinfofilter.lst[tk.vcfinfofilter.setidx4mclass]

		const [err, vlst] = getter_mcset_key(mcset, m)

		if (err || vlst == undefined) return 'black'

		for (const v of vlst) {
			if (mcset.categories[v]) {
				return mcset.categories[v].color
			} else {
				return 'black'
			}
		}
	}

	// mclass
	if (common.mclass[m.class]) {
		return common.mclass[m.class].color
	}
	return 'black'
}

function numeric_make(tk, block) {
	/*
	 */

	const nm = tk.numericmode

	// ITD/DEL stacked bars XXX won't do
	const stackbars = []
	for (const d of tk.data) {
		d.x0 = d.x
		if (d.xoffset != undefined) {
			d.x = d.x0 + d.xoffset
		}

		continue
		// TODO
		// updates x
		// create stack bars
		for (const g of d.groups) {
			g.aa = d // disc reference group
			let rnaspan = null
			if (g.dt == common.dtitd) {
				rnaspan = g.mlst[0].rnaduplength
				for (const m of g.mlst) {
					rnaspan = Math.max(rnaspan, m.rnaduplength)
				}
			} else if (g.dt == common.dtdel) {
				rnaspan = g.mlst[0].rnadellength
				for (const m of g.mlst) {
					rnaspan = Math.max(rnaspan, m.rnadellength)
				}
			} else {
				// no business
				continue
			}
			// no isInteger, rna position can have .5
			if (!Number.isFinite(rnaspan) || rnaspan < 0) {
				// support if genomic pos is available
				console.log('no rnaspan for stack bar from itd/del')
				console.log(g.mlst)
				continue
			}
			let pxspan = null
			if (block.usegm) {
				const rnapos = g.mlst[0].rnapos // rnapos should always be available!
				const genomicpos = coord.rna2gmcoord(rnapos + rnaspan, block.usegm)
				const hits = block.seekcoord(block.usegm.chr, genomicpos)
				if (hits.length > 0) {
					pxspan = hits[0].x - d.x
				} else {
					console.log(genomicpos + ' no hit on rglst')
				}
			}
			if (!Number.isFinite(pxspan)) {
				console.log('no pxspan for stack bar from itd/del')
				console.log(g.mlst)
				continue
			}
			g.stackbar = {
				aa: d.mlst[0].aapos,
				pxspan: pxspan,
				height: 4, // fixed bar height
				grp: g
			}
			d.hasstackbar = true
			stackbars.push(g.stackbar)
		}
	}
	// todo: done stack bars

	let stackbarmaxheight = 0 // for setting stem3
	if (stackbars.length > 0) {
		// XXX
		let ypad = 1
		for (let i = 0; i < stackbars.length; i++) {
			const si = stackbars[i]
			const overlap = []
			for (let j = 0; j < i; j++) {
				const sj = stackbars[j]
				if (Math.max(si.aa, sj.aa) < Math.min(si.pxspan + si.aa, sj.pxspan + sj.aa)) {
					overlap.push(sj)
				}
			}
			si.y = 2
			for (const sj of overlap) {
				if (Math.max(si.y, sj.y) < Math.min(si.y + si.height, sj.y + sj.height)) {
					si.y = sj.y + sj.height + ypad
				}
			}
			stackbarmaxheight = Math.max(stackbarmaxheight, si.y + si.height)
		}
	}

	// diameter, also m label font size
	const dotwidth = Math.max(14, block.width / 110)

	nm.dotwidth = dotwidth
	nm.maxradius = 0

	for (const d of tk.data) {
		for (const m of d.mlst) {
			// radius may be variable
			m.radius = dotwidth / 2
			nm.maxradius = Math.max(m.radius, nm.maxradius)

			// determine if has rim
			m.rimwidth = 0

			m.aa = d // m references data point
		}
	}

	/*
set:
- stack bar
- stem size
- dot radius

*/

	const showstem = adjustview(tk, block)

	nm.showsamplebar = showstem && tk.ds && tk.ds.samplebynumericvalue

	if (!nm.showsamplebar) {
		// do not show both at same time
		nm.showgenotypebyvalue = showstem && tk.ds && tk.ds.genotypebynumericvalue
	}

	tk.genotype2color.legend.style('display', nm.showsamplebar || nm.showgenotypebyvalue ? 'block' : 'none')

	// v is for variant-level values
	let mcset
	let vmin = null
	let vmax = null

	// in case of plotting genotype circles, circle radius is set by relative # of samples
	let genotypebyvaluesamplemax = 0
	let genotypebyvaluecircleradiusscale = null

	if (nm.showsamplebar) {
		mcset = { name: tk.ds.samplebynumericvalue.axislabel }
		for (const d of tk.data) {
			for (const m of d.mlst) {
				if (!m.sampledata) continue
				for (const s of m.sampledata) {
					const sn = s.sampleobj[tk.ds.cohort.key4annotation]
					if (!sn) continue
					const a = tk.ds.cohort.annotation[sn]
					if (!a) continue
					const v = a[tk.ds.samplebynumericvalue.attrkey]
					if (!Number.isFinite(v)) continue
					if (vmin == null) {
						vmin = v
						vmax = v
					} else {
						vmin = Math.min(vmin, v)
						vmax = Math.max(vmax, v)
					}
				}
			}
		}
	} else if (nm.showgenotypebyvalue) {
		mcset = { name: tk.ds.genotypebynumericvalue.axislabel }
		for (const d of tk.data) {
			for (const m of d.mlst) {
				let v = m.info[tk.ds.genotypebynumericvalue.refref.infokey]
				if (v != undefined) {
					if (vmin == null) {
						vmin = v
						vmax = v
					} else {
						vmin = Math.min(vmin, v)
						vmax = Math.max(vmax, v)
					}
				}
				v = m.info[tk.ds.genotypebynumericvalue.refalt.infokey]
				if (v != undefined) {
					if (vmin == null) {
						vmin = v
						vmax = v
					} else {
						vmin = Math.min(vmin, v)
						vmax = Math.max(vmax, v)
					}
				}
				v = m.info[tk.ds.genotypebynumericvalue.altalt.infokey]
				if (v != undefined) {
					if (vmin == null) {
						vmin = v
						vmax = v
					} else {
						vmin = Math.min(vmin, v)
						vmax = Math.max(vmax, v)
					}
				}

				// to get number of samples carrying each genotype
				let num_refref = 0,
					num_altalt = 0,
					num_refalt = 0

				if (tk.ds.genotypebynumericvalue.refref.genotypeCountInfokey) {
					// get sample count from info field but not individuals

					let v = m.info[tk.ds.genotypebynumericvalue.refref.genotypeCountInfokey]
					if (Number.isFinite(v)) {
						num_refref = v
					}
					v = m.info[tk.ds.genotypebynumericvalue.refalt.genotypeCountInfokey]
					if (Number.isFinite(v)) {
						num_refalt = v
					}
					v = m.info[tk.ds.genotypebynumericvalue.altalt.genotypeCountInfokey]
					if (Number.isFinite(v)) {
						num_altalt = v
					}
				} else {
					if (!m.sampledata) continue
					for (const s of m.sampledata) {
						if (!s.allele2readcount) continue
						if (s.allele2readcount[m.alt]) {
							if (s.allele2readcount[m.ref]) {
								num_refalt++
							} else {
								num_altalt++
							}
						} else {
							num_refref++
						}
					}
				}

				genotypebyvaluesamplemax = Math.max(genotypebyvaluesamplemax, num_refref, num_refalt, num_altalt)
			}
		}

		//genotypebyvaluecircleradiusscale = scaleLinear().domain([0, genotypebyvaluesamplemax]).range([4, 10])
		/*
	genotypebyvaluecircleradiusscale = (x)=>{
		return 2+ 8* (1 - Math.pow( (1- x/genotypebyvaluesamplemax), 4))
	}
	*/
		const w = Math.pow(12 / 2, 2) * Math.PI // unit area
		/*
	let mrd=0 // max disc radius
	if(genotypebyvaluesamplemax<=10) mrd=w*genotypebyvaluesamplemax*.9
	else if(genotypebyvaluesamplemax<=100) mrd=w*10
	else if(genotypebyvaluesamplemax<=1000) mrd=w*14
	else mrd=w*20
	*/
		const mrd = w * 10
		// scale for disc radius
		genotypebyvaluecircleradiusscale = scaleLinear()
			.domain([
				1,
				genotypebyvaluesamplemax * 0.1,
				genotypebyvaluesamplemax * 0.3,
				genotypebyvaluesamplemax * 0.6,
				genotypebyvaluesamplemax * 0.8,
				genotypebyvaluesamplemax
			])
			.range([w, w + (mrd - w) * 0.8, w + (mrd - w) * 0.85, w + (mrd - w) * 0.9, w + (mrd - w) * 0.95, mrd])
	} else {
		mcset = tk.vcfinfofilter.lst[tk.vcfinfofilter.setidx4numeric]

		// get value for each m
		for (const d of tk.data) {
			for (const m of d.mlst) {
				// default a valid number
				m._v = 0

				const [err, vlst] = getter_mcset_key(mcset, m)
				if (err) {
					console.log(err)
				} else if (vlst == undefined || vlst.length == 0) {
				} else {
					if (!Number.isFinite(vlst[0])) {
						console.log('invalid numerical value for variant: ' + vlst[0])
					} else {
						m._v = vlst[0]
					}
				}
				if (vmin == null) {
					vmin = m._v
					vmax = m._v
				} else {
					vmin = Math.min(m._v, vmin)
					vmax = Math.max(m._v, vmax)
				}
			}
		}
	}

	const numscale = scaleLinear().domain([vmin, vmax]).range([0, nm.axisheight])

	// set m._y
	for (const d of tk.data) {
		for (const m of d.mlst) {
			m._y = numscale(m._v)
		}
	}

	/*
set:
.data[].width
.data[].stemw
.data[].xoffset
.data[].x
.data[].mlst[].xoff
.data[].mlst[].rotate

*/

	if (showstem) {
		tk.stem1 = 5
		tk.stem2 = 20
		tk.stem3 = 10 // should be determined by stackbars
	} else {
		tk.stem1 = 0
		tk.stem2 = 0
		tk.stem3 = 0
	}

	// get mname label width
	for (const d of tk.data) {
		for (const m of d.mlst) {
			tk.glider
				.append('text')
				.text(mnamegetter(m.mname))
				.attr('font-family', client.font)
				.attr('font-size', m.radius * 2 - 2)
				.each(function () {
					m.labwidth = this.getBBox().width
				})
				.remove()
		}
	}

	// rotated labels, size protruding beyond y axis
	for (const d of tk.data) {
		// reset all
		for (const m of d.mlst) {
			delete m.labattop
			delete m.labatbottom
		}
	}
	if (showstem) {
		// show label for each disc, all rotated up
		for (const d of tk.data) {
			if (d.mlst.length == 1) {
				const m = d.mlst[0]
				m.labattop = true
			} else {
				// cluster
				if ((d.width - d.fixedgew) / (d.mlst.length - 1) < clustercrowdlimit) {
					// too crowded, no label
				} else {
					// show label for all m
					for (const m of d.mlst) {
						m.labattop = true
					}
				}
			}
		}
	} else {
		// no stem
		// sort items by v
		verticallabplace(tk)
	}
	nm.toplabelheight = 0
	nm.bottomlabelheight = 0

	if (nm.showsamplebar || nm.showgenotypebyvalue) {
		for (const d of tk.data) {
			for (const m of d.mlst) {
				nm.toplabelheight = Math.max(nm.toplabelheight, m.labwidth)
			}
		}
	} else {
		for (const d of tk.data) {
			for (const m of d.mlst) {
				if (m.labattop) {
					nm.toplabelheight = Math.max(nm.toplabelheight, m._y + m.labwidth - nm.axisheight)
				} else if (m.labatbottom) {
					nm.bottomlabelheight = Math.max(nm.bottomlabelheight, m.labwidth - m._y)
				}
			}
		}
	}

	// adjust toplabelheight by tk labels
	{
		let h = block.labelfontsize + tk.labyspace + block.labelfontsize // tk label and label_mcount
		if (tk.label_stratify) {
			h += tk.label_stratify.length * (tk.labyspace + block.labelfontsize)
		}
		nm.toplabelheight = Math.max(nm.toplabelheight, h)
	}

	// 1: axis
	tk.leftaxis
		.attr('transform', 'translate(-' + dotwidth / 2 + ',' + (nm.toplabelheight + nm.maxradius) + ')')
		.selectAll('*')
		.remove()
	{
		// axis is inverse of numscale
		const thisscale = scaleLinear().domain([vmin, vmax]).range([nm.axisheight, 0])
		const thisaxis = axisLeft().scale(thisscale).ticks(4)
		if (mcset.numberIsInteger) {
			thisaxis.tickFormat(d3format('d'))
			if (vmax - vmin < 3) {
				/*
			must do this to avoid axis showing redundant labels that doesn't make sense
			e.g. -1 -2 -2
			*/
				thisaxis.ticks(vmax - vmin)
			}
		}
		client.axisstyle({
			axis: tk.leftaxis.call(thisaxis),
			showline: true,
			fontsize: dotwidth
		})

		if (vmin == vmax) {
			tk.leftaxis
				.append('text')
				.attr('text-anchor', 'end')
				.attr('font-size', dotwidth)
				.attr('dominant-baseline', 'central')
				.attr('x', block.tkleftlabel_xshift)
				.attr('y', nm.axisheight)
				.text(vmin)
				.attr('fill', 'black')
		}
		// axis label, text must wrap
		{
			// read the max tick label width first
			let maxw = 0
			tk.leftaxis.selectAll('text').each(function () {
				maxw = Math.max(maxw, this.getBBox().width)
			})
			const lst = mcset.name.split(' ')
			const y = (nm.axisheight - lst.length * (dotwidth + 1)) / 2
			let maxlabelw = 0
			lst.forEach((text, i) => {
				tk.leftaxis
					.append('text')
					.attr('fill', 'black')
					.attr('font-size', dotwidth)
					.attr('dominant-baseline', 'central')
					.attr('text-anchor', 'end')
					.attr('y', y + (dotwidth + 1) * i)
					.attr('x', -(maxw + 15))
					.text(text)
					.each(function () {
						maxlabelw = Math.max(maxlabelw, this.getBBox().width + 15 + maxw)
					})
			})

			tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, maxlabelw)
		}
	}

	const _g = tk.glider.append('g').attr('transform', 'translate(0,0)')

	_g.append('line')
		.attr('y1', nm.toplabelheight + nm.maxradius)
		.attr('y2', nm.toplabelheight + nm.maxradius)
		.attr('x2', block.width)
		.attr('stroke', '#ededed')
		.attr('shape-rendering', 'crispEdges')
	_g.append('line')
		.attr('y1', nm.toplabelheight + nm.maxradius + nm.axisheight)
		.attr('y2', nm.toplabelheight + nm.maxradius + nm.axisheight)
		.attr('x2', block.width)
		.attr('stroke', '#ededed')
		.attr('shape-rendering', 'crispEdges')

	tk.skewer2 = _g
		.selectAll()
		.data(tk.data)
		.enter()
		.append('g')
		.attr('class', 'sja_skg2')
		.each(function (d) {
			// compute radius for each group
			d.g = this
		})

	tk.skewer2.attr(
		'transform',
		d =>
			'translate(' +
			d.x +
			',' +
			(nm.toplabelheight + disclabelspacing + nm.maxradius + nm.axisheight + nm.maxradius) +
			')'
	)

	// 2: stem
	if (showstem) {
		tk.skewer2
			.append('path')
			.attr('class', 'sja_aa_stem')
			.attr('d', d => skewer2_setstem(d, tk))
			.attr('stroke', d => color4disc(d.mlst[0], tk))
			.attr('fill', d => (d.mlst.length == 1 ? 'none' : '#ededed'))
	}

	// 3: discs

	const discg = tk.skewer2
		.selectAll()
		.data(d => d.mlst)
		.enter()
		.append('g')
		.attr('class', 'sja_aa_discg')
		.each(function (m) {
			m.g = this
		})

	if (nm.showsamplebar) {
		discg.attr('transform', m => 'translate(' + m.xoff + ',0)')

		for (const d of tk.data) {
			for (const m of d.mlst) {
				if (!m.sampledata) continue
				const g = d3select(m.g)
				for (const s of m.sampledata) {
					const sn = s.sampleobj[tk.ds.cohort.key4annotation]
					if (!sn) continue
					const a = tk.ds.cohort.annotation[sn]
					if (!a) continue
					const v = a[tk.ds.samplebynumericvalue.attrkey]
					if (!Number.isFinite(v)) continue
					const y = -numscale(v) - nm.maxradius
					const hasref = s.allele2readcount[m.ref]
					const hasalt = s.allele2readcount[m.alt]
					if (hasalt) continue
					g.append('line')
						.attr('x1', -m.radius)
						.attr('x2', m.radius)
						.attr('y1', y)
						.attr('y2', y)
						.attr('stroke', hasref ? (hasalt ? tk.genotype2color.ra : tk.genotype2color.rr) : tk.genotype2color.aa)
						.attr('shape-rendering', 'crispEdges')
						.on('mouseover', event => {
							const lst = [{ k: tk.ds.cohort.key4annotation, v: sn }]
							for (const k in a) {
								lst.push({ k: k, v: a[k] })
							}
							lst.push({ k: 'genotype', v: s.genotype })
							tk.tktip.clear().show(event.clientX, event.clientY)
							client.make_table_2col(tk.tktip.d, lst)
							event.target.setAttribute('stroke-width', 3)
							event.target.setAttribute('x1', -m.radius - 3)
							event.target.setAttribute('x2', m.radius + 3)
						})
						.on('mouseout', event => {
							tk.tktip.hide()
							event.target.setAttribute('stroke-width', 1)
							event.target.setAttribute('x1', -m.radius)
							event.target.setAttribute('x2', m.radius)
						})
				}
				for (const s of m.sampledata) {
					const sn = s.sampleobj[tk.ds.cohort.key4annotation]
					if (!sn) continue
					const a = tk.ds.cohort.annotation[sn]
					if (!a) continue
					const v = a[tk.ds.samplebynumericvalue.attrkey]
					if (!Number.isFinite(v)) continue
					const y = -numscale(v) - nm.maxradius
					const hasref = s.allele2readcount[m.ref]
					const hasalt = s.allele2readcount[m.alt]
					if (!hasalt) continue
					g.append('line')
						.attr('x1', -m.radius)
						.attr('x2', m.radius)
						.attr('y1', y)
						.attr('y2', y)
						.attr('stroke', hasref ? (hasalt ? tk.genotype2color.ra : tk.genotype2color.rr) : tk.genotype2color.aa)
						.attr('shape-rendering', 'crispEdges')
						.on('mouseover', event => {
							const lst = [{ k: tk.ds.cohort.key4annotation, v: sn }]
							for (const k in a) {
								lst.push({ k: k, v: a[k] })
							}
							lst.push({ k: 'genotype', v: s.genotype })
							tk.tktip.clear().show(event.clientX, event.clientY)
							client.make_table_2col(tk.tktip.d, lst)
							event.target.setAttribute('stroke-width', 3)
							event.target.setAttribute('x1', -m.radius - 3)
							event.target.setAttribute('x2', m.radius + 3)
						})
						.on('mouseout', event => {
							tk.tktip.hide()
							event.target.setAttribute('stroke-width', 1)
							event.target.setAttribute('x1', -m.radius)
							event.target.setAttribute('x2', m.radius)
						})
				}
			}
		}
	} else if (nm.showgenotypebyvalue) {
		discg.attr('transform', m => 'translate(' + m.xoff + ',0)')

		for (const d of tk.data) {
			for (const m of d.mlst) {
				let num_refref = 0,
					num_altalt = 0,
					num_refalt = 0

				// genotype count can either be encoded in INFO or figured from sampledata[]
				if (tk.ds.genotypebynumericvalue.refref.genotypeCountInfokey) {
					// from INFO
					num_refref = m.info[tk.ds.genotypebynumericvalue.refref.genotypeCountInfokey]
					num_altalt = m.info[tk.ds.genotypebynumericvalue.altalt.genotypeCountInfokey]
					num_refalt = m.info[tk.ds.genotypebynumericvalue.refalt.genotypeCountInfokey]
				} else {
					// from samples, require matrix
					if (!m.sampledata) continue
					for (const s of m.sampledata) {
						if (!s.allele2readcount) continue
						if (s.allele2readcount[m.alt]) {
							if (s.allele2readcount[m.ref]) {
								num_refalt++
							} else {
								num_altalt++
							}
						} else {
							num_refref++
						}
					}
				}

				const g = d3select(m.g)

				if (num_refref) {
					const v = m.info[tk.ds.genotypebynumericvalue.refref.infokey]
					if (v != undefined) {
						const y = -numscale(v) - nm.maxradius
						g.append('circle')
							.attr('cy', y)
							//.attr('r', genotypebyvaluecircleradiusscale( num_refref) )
							.attr('r', Math.sqrt(genotypebyvaluecircleradiusscale(num_refref)) / Math.PI)
							.attr('stroke', tk.ds.genotypebynumericvalue.refref.color)
							.attr('fill', 'white')
							.attr('fill-opacity', 0)
							.on('mouseover', event => {
								tk.tktip.show(event.clientX, event.clientY).clear()
								const lst = [
									{ k: 'Variant', v: m.chr + ':' + (m.pos + 1) + ' ' + m.ref + '>' + m.alt },
									{ k: 'Genotype', v: 'Ref/Ref' },
									{ k: '#sample', v: num_refref },
									{ k: tk.ds.genotypebynumericvalue.axislabel, v: v }
								]
								client.make_table_2col(tk.tktip.d, lst)
							})
							.on('mouseout', () => {
								tk.tktip.hide()
							})
					}
				}
				if (num_refalt) {
					const v = m.info[tk.ds.genotypebynumericvalue.refalt.infokey]
					if (v != undefined) {
						const y = -numscale(v) - nm.maxradius
						g.append('circle')
							.attr('cy', y)
							//.attr('r', genotypebyvaluecircleradiusscale( num_refalt) )
							.attr('r', Math.sqrt(genotypebyvaluecircleradiusscale(num_refalt)) / Math.PI)
							.attr('stroke', tk.ds.genotypebynumericvalue.refalt.color)
							.attr('fill', 'white')
							.attr('fill-opacity', 0)
							.on('mouseover', event => {
								tk.tktip.show(event.clientX, event.clientY).clear()
								const lst = [
									{ k: 'Variant', v: m.chr + ':' + (m.pos + 1) + ' ' + m.ref + '>' + m.alt },
									{ k: 'Genotype', v: 'Ref/Alt' },
									{ k: '#sample', v: num_refalt },
									{ k: tk.ds.genotypebynumericvalue.axislabel, v: v }
								]
								client.make_table_2col(tk.tktip.d, lst)
							})
							.on('mouseout', () => {
								tk.tktip.hide()
							})
					}
				}
				if (num_altalt) {
					const v = m.info[tk.ds.genotypebynumericvalue.altalt.infokey]
					if (v != undefined) {
						const y = -numscale(v) - nm.maxradius
						g.append('circle')
							.attr('cy', y)
							//.attr('r', genotypebyvaluecircleradiusscale( num_altalt) )
							.attr('r', Math.sqrt(genotypebyvaluecircleradiusscale(num_altalt)) / Math.PI)
							.attr('stroke', tk.ds.genotypebynumericvalue.altalt.color)
							.attr('fill', 'white')
							.attr('fill-opacity', 0)
							.on('mouseover', event => {
								tk.tktip.show(event.clientX, event.clientY).clear()
								const lst = [
									{ k: 'Variant', v: m.chr + ':' + (m.pos + 1) + ' ' + m.ref + '>' + m.alt },
									{ k: 'Genotype', v: 'Alt/Alt' },
									{ k: '#sample', v: num_altalt },
									{ k: tk.ds.genotypebynumericvalue.axislabel, v: v }
								]
								client.make_table_2col(tk.tktip.d, lst)
							})
							.on('mouseout', () => {
								tk.tktip.hide()
							})
					}
				}
			}
		}
	} else {
		discg.attr('transform', m => {
			return 'translate(' + m.xoff + ',' + (m._y + nm.maxradius) * -1 + ')'
		})

		// actual disc
		const discdot = discg.append('circle')
		// hollow disc
		discdot
			.filter(m => m.dt == common.dtitd || m.dt == common.dtdel || m.dt == common.dtnloss || m.dt == common.dtcloss)
			.attr('fill', 'white')
			.attr('stroke-width', 2)
			.attr('stroke', m => color4disc(m, tk))
			.attr('r', m => m.radius - 2)
		// full filled
		discdot
			.filter(m => m.dt == common.dtsnvindel || m.dt == common.dtsv || m.dt == common.dtfusionrna)
			.attr('fill', m => color4disc(m, tk))
			.attr('stroke', 'white')
			.attr('r', m => m.radius - 0.5)
		// masking half
		discg
			.filter(m => m.dt == common.dtfusionrna || m.dt == common.dtsv)
			.append('path')
			.attr('fill', 'white')
			.attr('stroke', 'none')
			.attr('d', m =>
				d3arc()({
					innerRadius: 0,
					outerRadius: m.radius - 2,
					startAngle: m.useNterm ? 0 : Math.PI,
					endAngle: m.useNterm ? Math.PI : Math.PI * 2
				})
			)

		// no text in disc

		// disc kick
		discg
			.append('circle')
			.attr('r', m => m.radius - 0.5)
			.attr('stroke', m => color4disc(m, tk))
			.attr('class', 'sja_aa_disckick')
			.attr('fill', 'white')
			.attr('fill-opacity', 0)
			.attr('stroke-opacity', 0)

			.on('mousedown', event => {
				event.stopPropagation()
			})

			.on('mouseover', (event, m) => {
				m_mouseover(m, tk)
				if (tk.disc_mouseover) {
					tk.disc_mouseover(m, event.target)
				} else {
					epaint_may_hl(tk, [m], true)
				}
			})

			.on('mouseout', (event, m) => {
				m_mouseout(m, tk)
				if (tk.disc_mouseout) {
					tk.disc_mouseout(m)
				} else {
					epaint_may_hl(tk, [m], false)
				}
			})

			.on('click', (event, m) => {
				const p = event.target.getBoundingClientRect()
				m_click(m, p, tk, block)
			})
	}

	// m label
	// only make for those whose to appear on top or bottom
	const textlabels = discg
		.filter(m => m.labattop || m.labatbottom)
		.append('text')
		.each(function (m) {
			m.textlabel = this
		})
		.text(m => mnamegetter(m.mname))
		.attr('font-family', client.font)
		.attr('font-size', m => {
			m._labfontsize = Math.max(12, m.radius * 1.2)
			return m._labfontsize
		})
		.attr('fill', m => color4disc(m, tk))
		.attr('x', m =>
			nm.showsamplebar || nm.showgenotypebyvalue
				? nm.axisheight + nm.maxradius + 4
				: m.radius + m.rimwidth + disclabelspacing
		)
		.attr('y', m => m._labfontsize * middlealignshift)
		.attr('class', 'sja_aa_disclabel')
		.attr('transform', m => 'rotate(' + (m.labattop ? '-' : '') + '90)')
		.on('mousedown', event => {
			event.stopPropagation()
		})
		.on('mouseover', (event, m) => m_mouseover(m, tk))
		.on('mouseout', (event, m) => m_mouseout(m, tk))
		.on('click', (event, m) => {
			m_click(m, { left: event.clientX, top: event.clientY }, tk, block)
		})

	if (tk.hlaachange) {
		// special effect for highlighted variants
		textlabels.filter(m => tk.hlaachange.has(m.mname)).classed('sja_pulse', true)
	}

	// disc rims
	/*
const rimfunc=d3arc()
	.innerRadius(d => d.radius )
	.outerRadius(d => d.radius+d.rimwidth )
	.startAngle(0)
	.endAngle(d=>{
		d.rim1_startangle= Math.PI*2*d.rim1count/d.mlst.length
		return d.rim1_startangle
		})
discg.append('path')
	.attr('d',rimfunc)
	.attr('fill',d=> color4disc(d.mlst[0]) )
	.attr('class','sja_aa_discrim')
	.attr('fill-opacity',0)
const rimfunc2=d3arc()
	.innerRadius(d=>d.radius+.5)
	.outerRadius(d=>d.radius+.5+d.rimwidth)
	.startAngle(d=>d.rim1_startangle)
	.endAngle(d=>d.rim1_startangle+Math.PI*2*d.rim2count/d.mlst.length)
discg
	.filter(d=>d.rim2count>0)
	.append('path')
	.attr('d',rimfunc2)
	.attr('stroke',d=>color4disc(d.mlst[0]))
	.attr('fill','none')
	.attr('class','sja_aa_discrim')
	.attr('stroke-opacity',0)
	*/
}

function m_mouseover(m, tk) {
	if (m.textlabel) {
		d3select(m.textlabel).attr('font-size', m._labfontsize * 1.1)
	}
	const nm = tk.numericmode
	if (nm.showsamplebar) return
	if (nm.showgenotypebyvalue) return

	// pica moves to center of m disc
	tk.pica.g.attr(
		'transform',
		'translate(' + (m.aa.x + m.xoff) + ',' + (nm.toplabelheight + nm.maxradius + nm.axisheight - m._y) + ')'
	)

	const linelen = 10
	const boxpad = 4
	const fontsize = m._labfontsize || 13 // _labfontsize is undefined if this m has no lab
	const color = color4disc(m, tk)

	let textw = 0,
		showlab = false
	// measure text w for value
	tk.pica.g
		.append('text')
		.attr('font-size', fontsize)
		.attr('font-family', client.font)
		.text(m._v)
		.each(function () {
			textw = this.getBBox().width
		})
		.remove()
	if (!m.labattop && !m.labatbottom) {
		// pica also show label
		showlab = true
		tk.pica.g
			.append('text')
			.attr('font-size', fontsize)
			.attr('font-family', client.font)
			.text(m.mname)
			.each(function () {
				textw = Math.max(textw, this.getBBox().width)
			})
			.remove()
	}
	const boxw = boxpad * 2 + textw
	let boxx,
		linex1,
		onleft = true
	if (boxw + linelen > m.aa.x + m.xoff) {
		// pica on right
		onleft = false
		linex1 = m.radius + m.rimwidth
		boxx = linex1 + linelen
	} else {
		// on left
		linex1 = -m.radius - m.rimwidth - linelen
		boxx = linex1 - boxw
	}

	// bg box for white rim
	tk.pica.g
		.append('rect')
		.attr('x', boxx - 2)
		.attr('y', -2 - boxpad - (showlab ? fontsize : fontsize / 2))
		.attr('width', 4 + boxw)
		.attr('height', 4 + boxpad * 2 + fontsize * (showlab ? 2 : 1))
		.attr('fill', 'white')
	tk.pica.g
		.append('line')
		.attr('x1', linex1)
		.attr('x2', linex1 + linelen)
		.attr('stroke', 'white')
		.attr('stroke-width', 3)
		.attr('shape-rendering', 'crispEdges')
	tk.pica.g
		.append('line')
		.attr('x1', linex1)
		.attr('x2', linex1 + linelen)
		.attr('stroke', color)
		.attr('shape-rendering', 'crispEdges')
	tk.pica.g
		.append('rect')
		.attr('x', boxx)
		.attr('y', -boxpad - (showlab ? fontsize : fontsize / 2))
		.attr('width', boxw)
		.attr('height', boxpad * 2 + fontsize * (showlab ? 2 : 1))
		.attr('fill', 'none')
		.attr('stroke', color)
		.attr('shape-rendering', 'crispEdges')
	tk.pica.g
		.append('text')
		.text(m._v)
		.attr('text-anchor', onleft ? 'end' : 'start')
		.attr('font-size', fontsize)
		.attr('font-family', client.font)
		.attr('x', onleft ? linex1 - boxpad : boxx + boxpad)
		.attr('y', showlab ? -fontsize / 2 : 0)
		.attr('fill', color)
		.attr('dominant-baseline', 'central')
	if (showlab) {
		tk.pica.g
			.append('text')
			.text(m.mname)
			.attr('text-anchor', onleft ? 'end' : 'start')
			.attr('font-size', fontsize)
			.attr('font-family', client.font)
			.attr('x', onleft ? linex1 - boxpad : boxx + boxpad)
			.attr('y', showlab ? fontsize / 2 : 0)
			.attr('fill', color)
			.attr('dominant-baseline', 'central')
	}
}

function m_mouseout(m, tk) {
	if (m.textlabel) {
		d3select(m.textlabel).attr('font-size', m._labfontsize)
	}
	tk.pica.g.selectAll('*').remove()
}

async function m_click(m, p, tk, block) {
	if (m.dt == common.dtfusionrna || m.dt == common.dtsv) {
		// should not happen
		itemtable({
			mlst: [m],
			pane: true,
			x: p.left - 10,
			y: p.top - 10,
			tk: tk,
			block: block,
			svgraph: true
		})
		return
	}

	if (m.occurrence > 1) {
		if (
			await may_sunburst(
				m.occurrence,
				[m],
				m.aa.x + m.xoff,
				tk.numericmode.toplabelheight + tk.numericmode.axisheight - m._y,
				tk,
				block
			)
		)
			return
	}

	itemtable({
		mlst: [m],
		pane: true,
		x: p.left - 10,
		y: p.top - 10,
		tk: tk,
		block: block
	})
}

function verticallabplace(tk) {
	const mlst = []
	for (const d of tk.data) {
		for (const m of d.mlst) {
			mlst.push({
				m: m,
				w: 2 * (m.radius + m.rimwidth),
				x: d.x0,
				y: m._y
			})
		}
	}

	mlst.sort((i, j) => j.y - i.y) // descending

	// 1. labels pointing up, none has label yet

	for (let i = 0; i < mlst.length; i++) {
		const big = mlst[i]
		let overlapwithdisc = false
		for (let j = 0; j < i; j++) {
			const small = mlst[j]
			if (Math.abs(big.x - small.x) < (big.w + small.w) / 2 - 2) {
				overlapwithdisc = true
				break
			}
		}
		if (!overlapwithdisc) {
			big.m.labattop = true
		}
	}

	// 2. labels pointing down

	for (let i = mlst.length - 1; i >= 0; i--) {
		const big = mlst[i]
		if (big.m.labattop) continue
		let overlapwithlabeleddisc = false
		for (let j = mlst.length - 1; j > i; j--) {
			const small = mlst[j]
			if (small.m.labatbottom && Math.abs(small.x - big.x) < (small.w + big.w) / 2 - 2) {
				overlapwithlabeleddisc = true
				break
			}
		}
		if (!overlapwithlabeleddisc) {
			big.m.labatbottom = true
		}
	}
}

function skewer2_setstem(d, tk) {
	if (d.mlst.length == 1) {
		return 'M0,0v' + tk.stem1 + 'l' + -d.xoffset + ',' + tk.stem2 + 'v' + tk.stem3
	}
	// funnel
	return (
		'M0,0' +
		'v' +
		tk.stem1 + // vertical down
		'l' +
		-d.xoffset +
		',' +
		tk.stem2 + // slope 1
		'v' +
		tk.stem3 + // vertical down
		//+'h1' // to right 1
		'v-' +
		tk.stem3 + // veritical up
		'l' +
		(d.stemw + d.xoffset - 1) +
		',-' +
		tk.stem2 + // slope 2
		'v-' +
		tk.stem1
	)
	//+'Z'
}

function adjustview(tk, block) {
	/*
	self adjusting
	for .data[], add:
		.x0
		.width
	for .data[0].mlst[], add:
		.xoff
	
	toggle between two views:
	1. cozy view, showing stem, x-shift, labels showing for all discs and point up
	2. crowded view, no stem, no x-shift, only show label for top/bottom items

	*/

	const nm = tk.numericmode

	const maxclusterwidth = 100

	let sumwidth = 0

	// set initial width

	for (const d of tk.data) {
		let w = 0
		for (const m of d.mlst) {
			w += 2 * (m.radius + m.rimwidth)
		}

		if (d.mlst.length == 1) {
			d.width = w
		} else {
			// cluster, apply maximum allowed span
			d.width = Math.min(maxclusterwidth, w)

			const m0 = d.mlst[0]
			const m1 = d.mlst[d.mlst.length - 1]
			d.fixedgew = m0.radius + m0.rimwidth + m1.radius + m1.rimwidth
		}

		sumwidth += d.width
	}

	let showstem = true

	if (sumwidth <= block.width) {
		// fits all
		// move all to left
		let cum = 0
		for (const d of tk.data) {
			d.x = cum + d.mlst[0].radius + d.mlst[0].rimwidth
			cum += d.width

			// stemw required for placing
			if (d.mlst.length == 1) {
				d.stemw = 0
			} else {
				d.stemw = d.width - d.fixedgew
			}
		}

		horiplace1(tk.data, block.width)

		for (const d of tk.data) {
			d.xoffset = d.x - d.x0

			if (d.mlst.length == 1) {
				d.mlst[0].xoff = 0
				d.stemw = 0
			} else {
				d.stemw = d.width - d.fixedgew

				const span = d.stemw / (d.mlst.length - 1)
				for (let i = 0; i < d.mlst.length; i++) {
					d.mlst[i].xoff = span * i
				}
			}
		}

		return true
	} else {
		/*
		over crowded

		let singwidthsum = 0
		let clustermcount = 0
		for(const d of tk.data) {
			if(d.mlst.length==1) {
				singwidthsum += d.width
			} else {
				clustermcount += d.mlst.length
			}
		}

		let shrinkfactor=.99
		while(1) {
			let w=0
			for(const d of tk.data) {
				if(d.mlst.length==1) {
					w+=d.width * shrinkfactor
				} else {
					if(d.shrinkfactor <= shrinkfactor) {
						w+=d.width
					} else {
						w+= d.originalwidth * shrinkfactor
					}
				}
			}
			if(w<=block.width) {
				// accept
				for(const d of tk.data) {
					d.width *= shrinkfactor
					if(d.mlst.length>1) {
						d.shrinkfactor = shrinkfactor
						if(d.stemw<=0) {
							console.log('.stemw < 0')
						}

					}
				}
				break
			}
			shrinkfactor-=.02
		}
		*/

		// do not shrink and horiplace
		for (const d of tk.data) {
			d.x = d.x0
			d.xoffset = 0
			for (const m of d.mlst) {
				m.xoff = 0
			}
		}

		// do not show stem
		return false
	}
}

function horiplace1(items, allwidth) {
	/*
	only for numeric
	*/
	for (let i = 0; i < items.length; i++) {
		if (items[i].x0 < 0) continue
		if (items[i].x0 > allwidth) break

		while (1) {
			let currsum = 0,
				newsum = 0
			for (let j = i; j < items.length; j++) {
				const t = items[j]
				if (t.x0 > allwidth) {
					return
				}
				currsum += Math.abs(t.x - t.x0 - t.stemw / 2)
				t.x++
				newsum += Math.abs(t.x - t.x0 - t.stemw / 2)
			}
			if (items[i].x > items[i].x0 - items[i].stemw / 2) {
				// wind back to make sure stem [i] stem is straight
				for (let j = i; j < items.length; j++) {
					items[j].x--
				}
				break
			}
			const z = items[items.length - 1]
			if (z.x + z.width / 2 >= allwidth) {
				return
			}
			if (newsum <= currsum) {
				// accept move
			} else {
				// reject move, procceed to next item
				for (let j = i; j < items.length; j++) {
					if (items[j].x0 > allwidth) {
						break
					}
					// wind back
					items[j].x--
				}
				break
			}
		}
	}
}

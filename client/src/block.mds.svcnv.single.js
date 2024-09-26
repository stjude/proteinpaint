import * as client from './client'
import * as common from '#shared/common.js'
import { scaleLinear, scaleLog } from 'd3-scale'
import { axisRight } from 'd3-axis'
import { tooltip_singleitem, svcoord2html, make_svgraph, detailtable_singlesample } from './block.mds.svcnv.clickitem'
import {
	map_cnv,
	labelspace,
	draw_colorscale_cnv,
	draw_colorscale_loh,
	intrasvcolor,
	trackclear,
	itemname_svfusion,
	vcfvariantisgermline
} from './block.mds.svcnv'
import { update_legend } from './block.mds.svcnv.legend'

export function render_singlesample(tk, block) {
	/*
	single-sample mode
	may not have any data!
	sv/fusion with both feet in view range as legged
	cnv & loh & snvindel & itd as stack bars
	*/

	trackclear(tk)

	const svlst = []
	const cnvlst = []
	const lohlst = []
	const itdlst = []
	const id2sv = {} // must dedup sv, tell by breakpoint position

	const usecopynumber = false // but not logratio

	let gainmaxvalue = 0, // for cnv logratio
		lossmaxvalue = 0,
		copynumbermax = 0, // for copy number converted from logratio, instead of logratio
		segmeanmax = 0

	if (tk.data) {
		// divide cnv/loh/sv/itd data into holders

		for (const item of tk.data) {
			if (item.dt == common.dtfusionrna || item.dt == common.dtsv) {
				// sv

				const id = item.chrA + '.' + item.posA + '.' + item.chrB + '.' + item.posB + '.' + item.dt

				if (!id2sv[id]) {
					map_sv(item, block)
					if (item.x0 || item.x1) {
						id2sv[id] = 1
						svlst.push(item)
						if (item.chrA != item._chr) {
							tk.legend_svchrcolor.interchrs.add(item.chrA)
							tk.legend_svchrcolor.colorfunc(item.chrA)
						}
						if (item.chrB != item._chr) {
							tk.legend_svchrcolor.interchrs.add(item.chrB)
							tk.legend_svchrcolor.colorfunc(item.chrB)
						}
					}
				}
				continue
			}

			// cnv, loh, itd

			map_cnv(item, tk, block)
			if (item.x1 == undefined || item.x2 == undefined) {
				console.log('unmappable: ' + item.chr + ' ' + item.start + ' ' + item.stop)
				continue
			}

			if (item.dt == common.dtloh) {
				// loh
				segmeanmax = Math.max(segmeanmax, item.segmean)
				lohlst.push(item)
			} else if (item.dt == common.dtcnv) {
				// cnv
				if (usecopynumber) {
					const v = 2 * Math.pow(2, item.value)
					copynumbermax = Math.max(copynumbermax, v)
				} else {
					// item.value is log2 ratio by default
					if (item.value > 0) {
						gainmaxvalue = Math.max(gainmaxvalue, item.value)
					} else {
						lossmaxvalue = Math.min(lossmaxvalue, item.value)
					}
				}

				cnvlst.push(item)
			} else if (item.dt == common.dtitd) {
				itdlst.push(item)
			}
		}

		if (cnvlst.length) {
			tk.cnvcolor.cnvmax = Math.max(gainmaxvalue, -lossmaxvalue)
			draw_colorscale_cnv(tk)
		}

		if (lohlst.length) {
			tk.cnvcolor.segmeanmax = segmeanmax
			draw_colorscale_loh(tk)
		}
	}

	// sv on top
	const svheight = render_singlesample_sv(group_sv(svlst), tk, block)

	/*
	stack bar plot on bottom:
		cnv, itd, loh as bars
		snvindel: show label
	*/
	tk.cnv_g.attr('transform', 'translate(0,' + svheight + ')')

	tk.waterfall.axisgg.attr('transform', 'translate(0,' + svheight + ')')

	const items = [...cnvlst, ...lohlst, ...itdlst] // stack bar items
	if (tk.data_vcf) {
		for (const m of tk.data_vcf) {
			if (m.x != undefined) {
				items.push(m)
			}
		}
	}

	const stackploth = render_singlesample_stack(items, tk, block)

	tk.height_main = tk.toppad + svheight + stackploth + tk.bottompad

	update_legend(tk, block)
}

function group_sv(lst) {
	/*
	sv/fusion will be merged

	for group of sv with both ends mapped, their ends are close enough within a bin

	for group of sv with only one mapped end, no matter which, that end for each is within a bin


	input:
	.x0 .x1 could be undefined
	.chrA .chrB
	.posA .posB

	output will add .lst[ {original} ]
	*/
	const newlst = []

	const pxbinsize = 8 // bin pixel size

	for (let i = 0; i < lst.length; i++) {
		const si = lst[i]
		if (si.__claimed) continue

		const thisgroup = {
			x0: si.x0,
			x1: si.x1,
			_chr: si._chr,
			chrA: si.chrA,
			chrB: si.chrB,
			posA: si.posA,
			posB: si.posB,
			lst: [si]
		}

		for (let j = i + 1; j < lst.length; j++) {
			const sj = lst[j]
			if (sj.__claimed) continue

			const isoneend = sj.x0 == undefined || sj.x1 == undefined

			if (si.x0 != undefined && si.x1 != undefined) {
				// two ends

				if (isoneend) continue

				if (Math.abs(sj.x0 - si.x0) <= pxbinsize && Math.abs(sj.x1 - si.x1) <= pxbinsize) {
					thisgroup.lst.push(sj)
					sj.__claimed = true
				}
			} else {
				// one end
				if (!isoneend) continue
				const end_i = si.x0 == undefined ? si.x1 : si.x0
				const end_j = sj.x0 == undefined ? sj.x1 : sj.x0
				if (Math.abs(end_i - end_j) <= pxbinsize) {
					thisgroup.lst.push(sj)
					sj.__claimed = true
				}
			}
		}

		newlst.push(thisgroup)
	}

	for (const s of lst) delete s.__claimed

	return newlst
}

function getcolor_snvindel(m, tk) {
	if (tk.mds && tk.mds.mutation_signature) {
		if (m.sampledata && m.sampledata[0]) {
			// which signature set this sample has
			for (const setkey in tk.mds.mutation_signature.sets) {
				const v = m.sampledata[0][setkey]
				if (v) {
					return tk.mds.mutation_signature.sets[setkey].signatures[v].color
				}
			}
		}
	}
	return common.mclass[m.class].color
}

function render_singlesample_stack(items, tk, block, svheight) {
	if (items.length == 0) return 0

	/*
	stack for cnv/loh/snvindel/itd
	all in items[]
	*/

	const stackheight = 12 // hardcoded
	const stackspace = 1

	let waterfall_shown = false

	if (tk.waterfall.inuse) {
		/* has waterfall, only show snvindel
		segment items still in stack plot
		*/
		const snvindels = items.filter(m => m.dt == common.dtsnvindel)
		if (snvindels.length > 1) {
			if (plot_waterfall(snvindels, tk, block)) {
				waterfall_shown = true
			}
		}
	}

	if (!waterfall_shown) {
		/* no waterfall
		prep & pre-render snvindel
		*/

		tk.waterfall.axisg.selectAll('*').remove()
		tk.waterfall.lab1.text('')
		tk.waterfall.lab2.text('')
		tk.waterfall.lab3.text('')

		for (const m of items) {
			if (m.dt != common.dtsnvindel) continue

			const g = tk.cnv_g.append('g')
			m._p = {
				g: g
			}
			/* for later use:
			stackw
			stackx
			g_x
			*/

			const color = getcolor_snvindel(m, tk)

			/////////////////////////////////// label is the same for snvindel/itd
			// mouseover event not on label but on cover box
			const lab = g
				.append('text')
				.attr('font-size', stackheight)
				.attr('font-family', client.font)
				.attr('fill', color)
				.attr('dominant-baseline', 'central')
				.text(m.mname)

			let labelw
			lab.each(function () {
				labelw = this.getBBox().width
			})

			const bgbox = g
				.append('rect')
				.attr('x', -stackheight / 2)
				.attr('y', -stackheight / 2)
				.attr('width', stackheight)
				.attr('height', stackheight)
				.attr('fill', color)
				.attr('fill-opacity', 0)

			let fgline1, fgline2

			if (m.sampledata && vcfvariantisgermline(m.sampledata[0], tk)) {
				fgline1 = g
					.append('line')
					.attr('stroke', color)
					.attr('stroke-width', 2)
					.attr('y1', 1 - stackheight / 2)
					.attr('y2', stackheight / 2 - 1)
				fgline2 = g
					.append('line')
					.attr('stroke', color)
					.attr('stroke-width', 2)
					.attr('x1', 1 - stackheight / 2)
					.attr('x2', stackheight / 2 - 1)
			} else {
				fgline1 = g
					.append('line')
					.attr('stroke', color)
					.attr('stroke-width', 2)
					.attr('x1', 1 - stackheight / 2)
					.attr('x2', stackheight / 2 - 1)
					.attr('y1', 1 - stackheight / 2)
					.attr('y2', stackheight / 2 - 1)
				fgline2 = g
					.append('line')
					.attr('stroke', color)
					.attr('stroke-width', 2)
					.attr('x1', 1 - stackheight / 2)
					.attr('x2', stackheight / 2 - 1)
					.attr('y1', stackheight / 2 - 1)
					.attr('y2', 1 - stackheight / 2)
			}

			// to cover both cross & label, will be placed after deciding whether label is on left/right
			m._p.cover = g
				.append('rect')
				.attr('y', -stackheight / 2)
				.attr('width', stackheight + labelspace + labelw)
				.attr('height', stackheight)
				.attr('fill', 'white')
				.attr('fill-opacity', 0)
				.on('mouseover', () => {
					bgbox.attr('fill-opacity', 1)
					fgline1.attr('stroke', 'white')
					fgline2.attr('stroke', 'white')
					tooltip_singleitem({
						item: m,
						m_sample: m.sampledata[0],
						tk: tk,
						block: block
					})
				})
				.on('mouseout', () => {
					tk.tktip.hide()
					bgbox.attr('fill-opacity', 0)
					fgline1.attr('stroke', color)
					fgline2.attr('stroke', color)
				})

			//////////////////////////////// set position for text label & cover

			m._p.stackw = stackheight + 5 + labelw

			if (block.width - m.x > labelw + labelspace + stackheight / 2) {
				// label on right
				m._p.stackx = m.x - stackheight / 2
				m._p.g_x = stackheight / 2
				lab.attr('x', stackheight / 2 + labelspace)
				m._p.cover.attr('x', -stackheight / 2)
			} else {
				// label on left
				m._p.stackx = m.x - stackheight / 2 - labelspace - labelw
				m._p.g_x = stackheight / 2 + labelspace + labelw
				lab.attr('x', -stackheight / 2 - labelspace).attr('text-anchor', 'end')
				m._p.cover.attr('x', -labelw - labelspace - stackheight / 2)
			}
		}
	}

	items.sort((i, j) => {
		const xi = i._p ? i._p.stackx : Math.min(i.x1, i.x2)
		const xj = j._p ? j._p.stackx : Math.min(j.x1, j.x2)
		return xi - xj
	})

	const stacks = [0]
	for (const item of items) {
		if (waterfall_shown && item.dt == common.dtsnvindel) continue
		/*
		must delete
		*/
		delete item.stack

		const itemstart = item._p ? item._p.stackx : Math.min(item.x1, item.x2)
		const itemwidth = item._p ? item._p.stackw : Math.abs(item.x1 - item.x2)

		for (let i = 0; i < stacks.length; i++) {
			if (stacks[i] <= itemstart) {
				stacks[i] = itemstart + itemwidth
				item.stack = i
				break
			}
		}
		if (item.stack == undefined) {
			item.stack = stacks.length
			stacks.push(itemstart + itemwidth)
		}
	}

	const yoff = waterfall_shown ? tk.waterfall.axisheight + tk.waterfall.bottompad : 0

	for (const item of items) {
		if (item.dt == common.dtloh || item.dt == common.dtcnv || item.dt == common.dtitd) {
			let color

			if (item.dt == common.dtloh) {
				color =
					'rgba(' +
					tk.cnvcolor.loh.r +
					',' +
					tk.cnvcolor.loh.g +
					',' +
					tk.cnvcolor.loh.b +
					',' +
					item.segmean / tk.cnvcolor.segmeanmax +
					')'
			} else if (item.dt == common.dtcnv) {
				if (item.value > 0) {
					color =
						'rgba(' +
						tk.cnvcolor.gain.r +
						',' +
						tk.cnvcolor.gain.g +
						',' +
						tk.cnvcolor.gain.b +
						',' +
						item.value / tk.cnvcolor.cnvmax +
						')'
				} else {
					color =
						'rgba(' +
						tk.cnvcolor.loss.r +
						',' +
						tk.cnvcolor.loss.g +
						',' +
						tk.cnvcolor.loss.b +
						',' +
						-item.value / tk.cnvcolor.cnvmax +
						')'
				}
			} else if (item.dt == common.dtitd) {
				color = common.mclass[common.mclassitd].color
			}

			tk.cnv_g
				.append('rect')
				.attr('x', Math.min(item.x1, item.x2))
				.attr('y', yoff + (stackheight + stackspace) * item.stack)
				.attr('width', Math.max(1, Math.abs(item.x2 - item.x1)))
				.attr('height', stackheight)
				.attr('fill', color)
				.attr('shape-rendering', 'crispEdges')
				.attr('stroke', 'none')
				.attr('class', 'sja_aa_skkick')
				.on('mouseover', () => {
					tooltip_singleitem({
						item: item,
						tk: tk
					})
				})
				.on('mouseout', () => {
					tk.tktip.hide()
				})
			continue
		}

		if (item.dt == common.dtsnvindel && !waterfall_shown) {
			item._p.g.attr(
				'transform',
				'translate(' +
					(item._p.stackx + item._p.g_x) +
					',' +
					(stackheight / 2 + (stackheight + stackspace) * item.stack) +
					')'
			)
			continue
		}
	}

	return yoff + stacks.length * (stackheight + stackspace) - stackspace
}

function plot_waterfall(snvindels, tk, block) {
	/*
waterfall only plots snvindel, not breakpoint
plot them in cnv_g, axis shown in .waterfall.axisgg{}
*/

	// first item has no dist
	snvindels[0].water = {
		h: tk.waterfall.axisheight
	}

	let maxdist = 0
	for (let i = 1; i < snvindels.length; i++) {
		const m = snvindels[i]
		if (m.chr != snvindels[i - 1].chr) {
			// saw a new chr; snv from subpanel could be in different chr
			m.water = {
				h: tk.waterfall.axisheight
			}
			continue
		}
		m.water = {
			bpdist: m.pos - snvindels[i - 1].pos
		}
		maxdist = Math.max(maxdist, m.water.bpdist)
	}

	if (maxdist < 2) {
		// cannot draw
		return false
	}

	// show axis
	client.axisstyle({
		axis: tk.waterfall.axisg.call(
			axisRight()
				.ticks(3, '.0f')
				.scale(scaleLog().domain([1, maxdist]).range([tk.waterfall.axisheight, 0]))
		),
		color: 'black',
		showline: 1
	})
	tk.waterfall.lab1.text('Log10').attr('y', tk.waterfall.axisheight / 2 - 14)
	tk.waterfall.lab2.text('intermutation').attr('y', tk.waterfall.axisheight / 2)
	tk.waterfall.lab3.text('distance').attr('y', tk.waterfall.axisheight / 2 + 14)

	for (let i = 1; i < snvindels.length; i++) {
		const m = snvindels[i]
		if (m.water.h) {
			// already set
			continue
		}
		if (m.water.bpdist == 0) {
			m.water.h = 0
		} else {
			m.water.h = (Math.log10(m.water.bpdist) * tk.waterfall.axisheight) / Math.log10(maxdist)
		}
	}

	// repetition of code

	const stackheight = 12 // hardcoded
	const stackspace = 1
	for (const m of snvindels) {
		const g = tk.cnv_g
			.append('g')
			.attr('transform', 'translate(' + m.x + ',' + (tk.waterfall.axisheight - m.water.h) + ')')

		const color = getcolor_snvindel(m, tk)

		const bgbox = g
			.append('rect')
			.attr('x', -stackheight / 2)
			.attr('y', -stackheight / 2)
			.attr('width', stackheight)
			.attr('height', stackheight)
			.attr('fill', color)
			.attr('fill-opacity', 0)

		let fgline1, fgline2

		if (m.sampledata && vcfvariantisgermline(m.sampledata[0], tk)) {
			fgline1 = g
				.append('line')
				.attr('stroke', color)
				.attr('stroke-width', 2)
				.attr('y1', 1 - stackheight / 2)
				.attr('y2', stackheight / 2 - 1)
			fgline2 = g
				.append('line')
				.attr('stroke', color)
				.attr('stroke-width', 2)
				.attr('x1', 1 - stackheight / 2)
				.attr('x2', stackheight / 2 - 1)
		} else {
			fgline1 = g
				.append('line')
				.attr('stroke', color)
				.attr('stroke-width', 2)
				.attr('x1', 1 - stackheight / 2)
				.attr('x2', stackheight / 2 - 1)
				.attr('y1', 1 - stackheight / 2)
				.attr('y2', stackheight / 2 - 1)
			fgline2 = g
				.append('line')
				.attr('stroke', color)
				.attr('stroke-width', 2)
				.attr('x1', 1 - stackheight / 2)
				.attr('x2', stackheight / 2 - 1)
				.attr('y1', stackheight / 2 - 1)
				.attr('y2', 1 - stackheight / 2)
		}

		// to cover both cross & label, will be placed after deciding whether label is on left/right
		g.append('rect')
			.attr('y', -stackheight / 2)
			.attr('x', -stackheight / 2)
			.attr('width', stackheight)
			.attr('height', stackheight)
			.attr('fill', 'white')
			.attr('fill-opacity', 0)
			.on('mouseover', () => {
				bgbox.attr('fill-opacity', 1)
				fgline1.attr('stroke', 'white')
				fgline2.attr('stroke', 'white')
				tooltip_singleitem({
					item: m,
					m_sample: m.sampledata[0],
					tk: tk,
					block: block
				})
			})
			.on('mouseout', () => {
				tk.tktip.hide()
				bgbox.attr('fill-opacity', 0)
				fgline1.attr('stroke', color)
				fgline2.attr('stroke', color)
			})
		delete m.water
	}
	return true // successfully drawn
}

function horiplace(lst, width) {
	/*
	j._x: ideal position
	j.x:  shifted position
	*/

	lst.forEach(i => (i.tox = i._x))
	const todo = lst

	todo.sort((a, b) => {
		return a.tox - b.tox
	})

	// push all to left
	// set initial x for all for shifting
	let cumx = todo.length == 0 ? 0 : todo[0].radius
	for (const i of todo) {
		i.x = cumx + i.radius
		cumx += i.radius * 2
	}

	for (let i = 0; i < todo.length; i++) {
		while (1) {
			let currsum = 0,
				newsum = 0
			for (let j = i; j < todo.length; j++) {
				const k = todo[j]
				// detect conditions to stop
				if (j > 0) {
					const prev = todo[j - 1]
					if (prev.x + prev.radius <= k.x - k.radius) {
						// not overlapping with previous
						if (k.x >= k.tox) {
							// so it can stop
							break
						}
					}
				} else {
					if (k.x >= k.tox) {
						// the first one, it can stop too
						break
					}
				}
				const z = todo[todo.length - 1]
				if (z.x + z.radius >= width) {
					// last one out of range
					break
				}
				currsum += Math.abs(k.x - k.tox)
				k.x++
				newsum += Math.abs(k.x - k.tox)
			}
			if (newsum < currsum) {
			} else {
				// reject
				for (let j = i; j < todo.length; j++) {
					todo[j].x--
				}
				break
			}
		}
	}
	todo.forEach(i => delete i.tox)
}

function render_singlesample_sv(svlst, tk, block) {
	if (svlst.length == 0) return 0

	let sf_discradius
	{
		let maxcount = 1
		for (const j of svlst) maxcount = Math.max(maxcount, j.lst.length)

		let mrd = 0 // max radius
		const w = Math.pow(tk.discradius, 2) * Math.PI // unit area

		/*
		if(maxcount==1) {
			mrd=w
		} else if(maxcount<=2) {
			mrd=w * 1.4
		} else if(maxcount<=3) {
			mrd=w * 1.7
		} else if(maxcount<=5) {
			mrd=w * 2
		} else if(maxcount<=8) {
			mrd=w * 3
		} else {
			mrd=w * 4
		}

		sf_discradius=scaleLinear()
			.domain([1,
				maxcount*.5+.1,
				maxcount*.6+.1,
				maxcount*.7+.1,
				maxcount*.8+.1,
				maxcount])
			.range([w,
				w+(mrd-w)*.8,
				w+(mrd-w)*.85,
				w+(mrd-w)*.9,
				w+(mrd-w)*.95,
				mrd])
				*/

		const s = scaleLinear()
		if (maxcount == 1) {
			s.domain([1, 1]).range([w, w])
		} else if (maxcount == 2) {
			s.domain([1, 2]).range([w, w * 1.3])
		} else if (maxcount == 3) {
			s.domain([1, 3]).range([w, w * 1.6])
		} else if (maxcount == 4) {
			s.domain([1, 4]).range([w, w * 1.8])
		} else if (maxcount == 6) {
			s.domain([1, 6]).range([w, w * 2])
		} else if (maxcount == 10) {
			s.domain([1, 10]).range([w, w * 3])
		} else {
			s.domain([1, maxcount]).range([w, w * 4])
		}
		sf_discradius = s
	}

	// clean sv

	let maxradius = 0

	for (const i of svlst) {
		i.radius = Math.sqrt(sf_discradius(i.lst.length) / Math.PI)
		maxradius = Math.max(i.radius, maxradius)

		if (i.x0 != undefined && i.x1 != undefined) {
			if (i.x0 > i.x1) {
				// x0 maybe bigger than x1
				const a = i.x1
				i.x1 = i.x0
				i.x0 = a
			}
			i._x = (i.x0 + i.x1) / 2
		} else {
			i._x = i.x0 || i.x1
		}
		i.x = i._x
	}

	/*
	radius for all items have been set
	sum up height for subtrack
	if sv has both x0/x1 will show both legs, will be higher, else lower
	*/
	const svheight =
		maxradius * 2 + // ball diameter
		maxradius * 2 + // raise height
		(svlst.find(s => s.x0 && s.x1) ? tk.legheight : 0)

	tk.svvcf_g.attr('transform', 'translate(0,' + (svheight - 0) + ')')

	const entirewidth = block.width + block.subpanels.reduce((i, j) => i + j.leftpad + j.width, 0)

	//horiplace( svlst, entirewidth )

	for (const sv of svlst) {
		const doubleleg = sv.x0 && sv.x1

		const thislegheight = tk.legheight * (doubleleg ? 1 : 0)
		const raiseheight = sv.lst.length == 1 ? sv.radius : sv.radius * 2

		const g = tk.svvcf_g.append('g').attr('transform', 'translate(' + sv.x + ',-' + (thislegheight + raiseheight) + ')')

		const otherchr = sv.chrA == sv._chr ? sv.chrB : sv.chrA
		const color = otherchr == sv._chr ? intrasvcolor : tk.legend_svchrcolor.colorfunc(otherchr)

		g.append('circle').attr('r', sv.radius).attr('cy', -sv.radius).attr('fill', color).attr('stroke', 'white')

		if (sv.lst.length > 1) {
			const s = sv.radius * 1.5
			const text = sv.lst.length.toString()
			const fontsize = Math.min(s / (text.length * client.textlensf), s)
			g.append('text')
				.text(text)
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'central')
				.attr('fill', 'white')
				.attr('y', -sv.radius)
				.attr('font-size', fontsize)
				.attr('font-family', client.font)
		}

		// cover
		g.append('circle')
			.attr('r', sv.radius)
			.attr('cy', -sv.radius)
			.attr('fill', 'white')
			.attr('fill-opacity', 0)
			.attr('stroke', color)
			.attr('stroke-opacity', 0)
			.attr('class', 'sja_aa_disckick')
			.on('mouseover', event => {
				if (sv.lst.length == 1) {
					tooltip_singleitem({
						item: sv.lst[0],
						tk: tk
					})
					return
				}
				tooltip_multi_sv(sv.lst, tk, event)
			})
			.on('mouseout', () => tk.tktip.hide())
			.on('click', event => {
				if (sv.lst.length == 1) {
					const m = sv.lst[0]
					const pane = client.newpane({ x: event.clientX, y: event.clientY })
					pane.header.text(m.sample)
					pane.body.style('margin-top', '10px')

					// 1 - may split button
					const [chr, otherpos] = get_split_coord(m, block)
					if (chr) {
						// will split
						const row = pane.body.append('div').style('margin-bottom', '5px')
						row
							.append('div')
							.style('display', 'inline-block')
							.text('Add new panel at ' + chr.name + ':' + otherpos)
							.attr('class', 'sja_menuoption')
							.on('click', () => {
								row.remove()
								split_panel(chr, otherpos, block)
							})
					}

					// 2 - svgraph
					make_svgraph(
						{
							item: m,
							block: block
							//tk: tk,
						},
						pane.body.append('div')
					)

					// 3 - detail table
					detailtable_singlesample({
						item: m,
						tk: tk,
						holder: pane.body.append('div')
					})

					return
				}
				panel_multi_sv(sv.lst, tk, block, event)
			})

		if (doubleleg) {
			g.append('line').attr('stroke', color).attr('y2', raiseheight).attr('shape-rendering', 'crispEdges')
			g.append('line') // right leg
				.attr('stroke', color)
				.attr('x2', (sv.x1 - sv.x0) / 2 - (sv.x - sv._x))
				.attr('y1', raiseheight)
				.attr('y2', raiseheight + thislegheight)
			g.append('line') // left leg
				.attr('stroke', color)
				.attr('x2', -(sv.x1 - sv.x0) / 2 - (sv.x - sv._x))
				.attr('y1', raiseheight)
				.attr('y2', raiseheight + thislegheight)
		} else {
			g.append('line')
				.attr('stroke', color)
				.attr('y2', raiseheight + thislegheight)
				.attr('shape-rendering', 'crispEdges')
		}
	}
	return svheight
}

function get_split_coord(sv, block) {
	let otherchr
	let otherpos
	if (sv._chr != sv.chrA) {
		otherchr = sv.chrA
		otherpos = sv.posA
	} else if (sv._chr != sv.chrB) {
		otherchr = sv.chrB
		otherpos = sv.posB
	}
	if (!otherchr) return [null]
	const chr = block.genome.chrlookup[otherchr.toUpperCase()]
	if (!chr) {
		block.error('Invalid chr name: ' + otherchr)
		return [null]
	}

	// see if this chr already exists...
	for (const p of block.subpanels) {
		if (p.chr == otherchr) {
			return [null]
		}
	}
	return [chr, otherpos]
}

function split_panel(chr, otherpos, block) {
	const span = 10000
	const p = {
		chr: chr.name,
		start: Math.max(0, otherpos - span),
		stop: Math.min(chr.len, otherpos + span),
		width: 600,
		leftpad: 10,
		leftborder: 'rgba(50,50,50,.1)'
	}
	p.exonsf = p.width / (p.stop - p.start)
	block.init_coord_subpanel(p)
	block.subpanels.push(p)
	block.ifbusy()
}

function map_sv(sv, block) {
	const lst1 = block.seekcoord(sv.chrA, sv.posA)
	for (const r of lst1) {
		if (r.ridx != undefined) {
			// in main, if outside won't show this end
			if (r.x > 0 && r.x < block.width) {
				sv.x0 = r.x
				break
			}
		} else if (r.subpanelidx != undefined) {
			sv.x0 = r.x
		}
	}
	const lst2 = block.seekcoord(sv.chrB, sv.posB)
	for (const r of lst2) {
		if (r.ridx != undefined) {
			// in main, if outside won't show this end
			if (r.x > 0 && r.x < block.width) {
				sv.x1 = r.x
				break
			}
		} else if (r.subpanelidx != undefined) {
			sv.x1 = r.x
		}
	}
}

function tooltip_multi_sv(lst, tk, event) {
	tk.tktip.clear()
	showtable_multi_sv(lst, tk.tktip.d, tk)
	tk.tktip.show(event.clientX, event.clientY)
}

function panel_multi_sv(lst, tk, block, event) {
	const pane = client.newpane({ x: event.clientX, y: event.clientY })
	showtable_multi_sv(lst, pane.body, tk)
}

function showtable_multi_sv(lst, holder, tk) {
	const table = holder.append('table')
	for (const i of lst) {
		const tr = table.append('tr')

		tr.append('td')
			.style('font-size', '.7em')
			.text(i.dt == common.dtsv ? 'SV' : 'Fusion')

		tr.append('td').text(itemname_svfusion(i))
		tr.append('td').style('font-size', '.8em').html(svcoord2html(i, tk))
	}
}

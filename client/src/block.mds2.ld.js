import * as client from './client'
import { make_one_checkbox } from '../dom/checkbox'
import { scaleLinear } from 'd3-scale'
import { axisTop } from 'd3-axis'
import { vcf_m_color } from './block.mds2.vcf'

/*
********************** EXPORTED
may_render_ld
may_create_ldlegend
********************** INTERNAL

*/

export function may_render_ld(data, tk, block) {
	/*
returns sum of heights of LD panels
*/
	if (!tk.ld) return 0
	if (!data.ld) return 0

	let rowheightsum = 0

	// render by the order of tk.ld.tracks[]
	for (const ldtk of tk.ld.tracks) {
		const lddata = data.ld[ldtk.name]
		if (!lddata) {
			// no data for this track
			delete ldtk.g
			continue
		}

		// has data for this track, register parts, yoff, and height for easy removal via legend checkbox
		ldtk.yoff = rowheightsum
		ldtk.g = {
			g: tk.g_ldrow.append('g').attr('transform', 'translate(0,' + rowheightsum + ')')
		}

		ldtk.g.label = tk.gleft_ldrow
			.append('text')
			.text(ldtk.name + ' LD')
			.attr('font-size', block.labelfontsize)
			.attr('x', block.tkleftlabel_xshift)
			.attr('text-anchor', 'end')
			.each(function () {
				tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, this.getBBox().width)
			})

		let rowheight = 0 // height of this tk row

		for (const r of lddata.rglst) {
			const g = ldtk.g.g.append('g').attr('transform', 'translate(' + r.xoff + ',0)')

			if (r.rangetoobig) {
				r.text_rangetoobig = g
					.append('text')
					.text(r.rangetoobig)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'central')
					.attr('x', r.width / 2)
				// set y after row height is decided
				rowheight = Math.max(rowheight, 50)
				continue
			}

			if (r.img) {
				g.append('image').attr('width', r.width).attr('height', r.img.height).attr('xlink:href', r.img.src)
				rowheight = Math.max(rowheight, r.img.height)
				continue
			}
		}

		// row height set
		ldtk.height = rowheight
		ldtk.g.label.attr('y', rowheightsum + Math.min(rowheight / 2, tk.ld.connheight))

		for (const r of lddata.rglst) {
			if (r.rangetoobig) {
				r.text_rangetoobig.attr('y', rowheight / 2)
			}
		}

		rowheightsum += rowheight
	}

	return rowheightsum
}

export function may_create_ldlegend(tk, block) {
	// run only once
	if (!tk.ld) return
	const row = tk.legend.table.append('tr')
	// td1
	row.append('td').style('text-align', 'right').style('opacity', 0.3).html('LD r<sup>2</sup>')

	// td2
	const td = row.append('td').style('padding', '10px')

	for (const ld of tk.ld.tracks) {
		const row2 = td.append('div').style('margin-bottom', '5px')
		// col2
		make_one_checkbox({
			holder: row2,
			labeltext: ld.name,
			checked: ld.shown,
			callback: async () => {
				if (ld.shown) {
					// remove
					ld.shown = false
					ld.g.label.remove()
					ld.g.g.remove()
					tk.height_main -= ld.height
					{
						let remove = false
						for (const t2 of tk.ld.tracks) {
							if (!t2.g) continue
							if (t2.name == ld.name) {
								remove = true
							} else {
								if (remove) {
									t2.yoff -= ld.height
									t2.g.label.transition().attr('y', t2.yoff + tk.ld.connheight)
									t2.g.g.transition().attr('transform', 'translate(0,' + t2.yoff + ')')
								} else {
									// no change
								}
							}
						}
					}
					block.block_setheight()
					return
				}
				// show
				ld.shown = true
				await tk.load()
			}
		})
	}

	// overlay
	{
		const div = td.append('div')
		const select = div.append('select').on('input', () => {
			const i = select.node().selectedIndex
			if (i == 0) {
				// no overlay
				delete tk.ld.overlaywith
				colorbardiv.style('display', 'none')
				tk.skewer2.selectAll('.sja_aa_disk_fill').attr('fill', m => vcf_m_color(m, tk))
			} else {
				tk.ld.overlaywith = tk.ld.tracks[i - 1].name
				colorbardiv.style('display', 'inline-block')
			}
		})
		select.append('option').text('No overlay')
		for (const ld of tk.ld.tracks) {
			select.append('option').text(ld.name)
		}

		const colorbardiv = div.append('div').style('display', 'none').style('margin-left', '10px')

		const colorlst = []
		for (let i = 0; i <= 1; i += 0.1) {
			colorlst.push(tk.ld.overlay.r2_to_color(i))
		}
		const svg = colorbardiv.append('svg')
		const axisheight = 20
		const barheight = 15
		const xpad = 10
		const axiswidth = 150
		client.axisstyle({
			axis: svg
				.append('g')
				.attr('transform', 'translate(' + xpad + ',' + axisheight + ')')
				.call(
					axisTop()
						.scale(scaleLinear().domain([0, 1]).range([0, axiswidth]))
						.ticks(4)
				),
			fontsize: 12
		})
		const grad = svg.append('defs').append('linearGradient').attr('id', 'grad')
		grad.append('stop').attr('offset', '0%').attr('stop-color', tk.ld.overlay.color_0)
		grad.append('stop').attr('offset', '100%').attr('stop-color', tk.ld.overlay.color_1)
		svg
			.append('rect')
			.attr('x', xpad)
			.attr('y', axisheight)
			.attr('width', axiswidth)
			.attr('height', barheight)
			.attr('fill', 'url(#grad)')

		svg.attr('width', xpad * 2 + axiswidth).attr('height', axisheight + barheight)
	}
}

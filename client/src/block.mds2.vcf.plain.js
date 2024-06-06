import { scaleLinear } from 'd3-scale'
import * as common from '#shared/common'
import * as client from './client'
import { divide_data_to_group } from './block.mds2.vcf'

/*

********************** EXPORTED
render
********************** INTERNAL



based on zoom level, toggle between two views:
1. cozy view, showing stem, x-shift, labels showing for all discs and point up
   at this mode, default is to draw a single circle for each variant
   alternatively, allow to show graphs e.g. boxplot
   such kind of values should all be server-computed
2. crowded view, no stem, no x-shift, only show label for top/bottom items

*/

const minbpwidth = 4
const disclabelspacing = 1 // px spacing between disc and label
const middlealignshift = 0.3
const labyspace = 5
const clustercrowdlimit = 7 // at least 8 px per disc, otherwise won't show mname label

export function render(data, r, _g, tk, block) {
	/*
	client-side rendering, copied from block.mds.svcnv.js
	*/

	const groups = divide_data_to_group(r, block)
	console.log(groups)
	return 0

	// group m in each bin by class
	for (const b of bins) {
		if (b.lst.length == 0) continue
		const name2group = new Map()
		// k: mclass key
		// v: mlst[]

		for (const m of b.lst) {
			if (!name2group.has(m.class)) {
				name2group.set(m.class, [])
			}
			name2group.get(m.class).push(m)
		}

		const lst = []
		for (const [classname, mlst] of name2group) {
			lst.push({
				name: common.mclass[classname].label,
				items: mlst,
				color: common.mclass[classname].color
			})
		}
		lst.sort((i, j) => j.items.length - i.items.length)
		b.groups = lst
	}

	let maxcount = 0 // per group
	for (const b of bins) {
		if (!b.groups) continue
		for (const g of b.groups) {
			maxcount = Math.max(maxcount, g.items.length)
		}
	}

	let maxheight = 0 // of all bins
	{
		const radius = 4
		let mrd = 0 // max radius
		const w = Math.pow(radius, 2) * Math.PI // unit area
		if (maxcount <= 3) {
			mrd = w * maxcount * 0.9
		} else if (maxcount <= 10) {
			mrd = w * 5
		} else if (maxcount <= 100) {
			mrd = w * 7
		} else {
			mrd = w * 10
		}
		const sf_discradius = scaleLinear()
			.domain([1, maxcount * 0.5 + 0.1, maxcount * 0.6 + 0.1, maxcount * 0.7 + 0.1, maxcount * 0.8 + 0.1, maxcount])
			.range([w, w + (mrd - w) * 0.8, w + (mrd - w) * 0.85, w + (mrd - w) * 0.9, w + (mrd - w) * 0.95, mrd])

		// note: must count # of samples in each mutation for radius & offset
		for (const bin of bins) {
			if (!bin.groups) continue

			for (const g of bin.groups) {
				// group dot radius determined by total number of samples in each mutation, not # of mutations

				g.radius = Math.sqrt(sf_discradius(g.items.length) / Math.PI)
			}

			// offset of a bin determined by the total number of samples
			// count again for the bin
			const totalnum = bin.groups.reduce((i, j) => j.samplecount + i, 0)

			bin.offset = Math.sqrt(sf_discradius(totalnum) / Math.PI)

			const sumheight = bin.groups.reduce((i, j) => i + j.radius * 2, 0)

			maxheight = Math.max(maxheight, bin.offset + sumheight)
		}
	}

	for (const b of bins) {
		if (!b.groups) continue

		const g = tk.vcfdensityg.append('g').attr('transform', 'translate(' + b.x + ',0)')

		let y = b.offset

		for (const grp of b.groups) {
			/*
			one dot for each group

			.name
			.items[]
			.radius
			.color
			.samplecount
			*/

			y += grp.radius
			g.append('circle').attr('cy', -y).attr('r', grp.radius).attr('fill', grp.color).attr('stroke', 'white')

			if (grp.radius >= 8) {
				// big enough dot, show # of items
				const s = grp.radius * 1.5
				const text = grp.samplecount.toString()
				const fontsize = Math.min(s / (text.length * client.textlensf), s)

				g.append('text')
					.text(text)
					.attr('y', -y)
					.attr('dominant-baseline', 'central')
					.attr('text-anchor', 'middle')
					.attr('font-size', fontsize)
					.attr('font-family', client.font)
					.attr('fill', 'white')
			}

			g.append('circle')
				.attr('cy', -y)
				.attr('r', grp.radius)
				.attr('fill', 'white')
				.attr('fill-opacity', 0)
				.attr('stroke', grp.color)
				.attr('stroke-opacity', 0)
				.attr('class', 'sja_aa_disckick')
				.on('mouseover', () => {
					tooltip_multi_vcfdense(grp, tk, block)
				})
				.on('mouseout', () => {
					tk.tktip.hide()
				})
				.on('click', () => {
					click_multi_vcfdense(grp, tk, block)
				})
			y += grp.radius
		}
		g.append('line').attr('y2', -b.offset).attr('stroke', b.groups[0].color)
	}
	return maxheight
}

function map_snv(r) {
	const scale = scaleLinear()
		.domain([r.start, r.stop])
		.range(r.reverse ? [r.xoff + r.width, r.xoff] : [r.xoff, r.xoff + r.width])
	for (const m of r.variants) {
		m.x = scale(m.pos)
	}
}

function snv2bins(r, block) {
	if (block.exonsf >= 3) {
		// group by basepairs
		const bp2lst = new Map()
		for (const m of r.variants) {
			if (m.x == undefined) continue
			if (!bp2lst.has(m.pos)) {
				bp2lst.set(m.pos, {
					x: m.x,
					lst: []
				})
			}
			bp2lst.get(m.pos).lst.push(m)
		}
		const bins = []
		for (const b of bp2lst.values()) {
			bins.push(b)
		}
		return bins
	}

	// fixed pixel width
	const binw = 10 // pixel
	const bins = []
	let x = r.xoff
	while (x < r.xoff + r.width) {
		bins.push({
			x1: x,
			x2: x + binw,
			x: x + binw / 2,
			lst: []
		})
		x += binw
	}

	// m to bins
	for (const m of r.variants) {
		if (m.x == undefined) {
			// unmapped
			continue
		}
		for (const b of bins) {
			if (b.x1 <= m.x && b.x2 >= m.x) {
				b.lst.push(m)
				break
			}
		}
	}
	return bins
}

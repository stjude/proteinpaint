import * as common from '#shared/common.js'
import * as client from './client'
import { vcfparsemeta } from '#shared/vcf.js'
import * as numericaxis from './block.mds2.vcf.numericaxis'
import * as plain from './block.mds2.vcf.plain'
import * as coord from './coord'

/*
********************** EXPORTED
may_render_vcf
vcf_m_color
getvcfheader_customtk
divide_data_to_group
********************** INTERNAL
vcf_rendervariants_oneregion

*/

const minbpwidth = 4

export function may_render_vcf(data, tk, block) {
	/* for now, assume always in variant-only mode for vcf
render all variants in one row
and return row height
*/
	if (!tk.vcf) return 0
	if (!data.vcf) return 0
	if (!data.vcf.rglst) return 0

	/* current implementation ignore subpanels
	to be fixed in p4
	*/

	let rowheight = 0

	for (const r of data.vcf.rglst) {
		const g = tk.g_vcfrow.append('g').attr('transform', 'translate(' + r.xoff + ',0)')

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

		if (r.imgsrc) {
			g.append('image').attr('width', r.width).attr('height', r.imgheight).attr('xlink:href', r.imgsrc)
			rowheight = Math.max(rowheight, r.imgheight)
			continue
		}

		if (r.variants) {
			const height = vcf_rendervariants_oneregion(data, r, g, tk, block)
			rowheight = Math.max(rowheight, height)
			continue
		}
	}

	// row height set
	for (const r of data.vcf.rglst) {
		if (r.rangetoobig) {
			r.text_rangetoobig.attr('y', rowheight / 2)
		}
	}

	// count total number of variants
	{
		const total = data.vcf.rglst.reduce((i, j) => i + j.variants.length, 0)
		tk.vcfrow_label_numbervariants.text(total == 0 ? 'No variant' : total + ' variant' + (total > 1 ? 's' : ''))
		// quick fix! to allow variant data to be accessible by #variant handle
		if (total == 0) {
			tk.__vcf_data = null
		} else {
			tk.__vcf_data = data
		}
	}

	return rowheight
}

function vcf_rendervariants_oneregion(data, r, g, tk, block) {
	/*
got the actual list of variants at r.variants[], render them
*/

	let height = 50

	if (tk.vcf.numerical_axis && tk.vcf.numerical_axis.in_use) {
		// numerical axis by info field
		// FIXME .default{} is now needed to access exported function. need to know reason and any other affected code
		height = numericaxis.render(data, r, g, tk, block)
	} else {
		// not numerical axis
		height = plain.render(data, r, g, tk, block)
	}

	return height
}

export function vcf_m_color(m, tk) {
	// TODO using categorical attribute
	return common.mclass[m.class].color
}

export function getvcfheader_customtk(tk, genome) {
	const arg = ['genome=' + genome.name]
	if (tk.file) {
		arg.push('file=' + tk.file)
	} else {
		arg.push('url=' + tk.url)
		if (tk.indexURL) arg.push('indexURL=' + tk.indexURL)
	}
	return client.dofetch2('vcfheader?' + arg.join('&')).then(data => {
		if (data.error) throw data.error
		const [info, format, samples, errs] = vcfparsemeta(data.metastr.split('\n'))
		if (errs) throw 'Error parsing VCF meta lines: ' + errs.join('; ')
		tk.info = info
		tk.format = format
		tk.samples = samples
		tk.nochr = data.nochr
	})
}

export function divide_data_to_group(r, block) {
	// legacy method
	const x2mlst = new Map()
	for (const m of r.variants) {
		const hits = block.seekcoord(m.chr, m.pos)
		if (hits.length == 0) {
			continue
		}
		if (hits.length == 1) {
			m.__x = hits[0].x
		} else {
			// hit at multiple regions, still use first hit as following code is not finished
			m.__x = hits[0].x
		}

		if (!x2mlst.has(m.__x)) {
			x2mlst.set(m.__x, [])
		}
		x2mlst.get(m.__x).push(m)
	}
	const datagroup = []
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
			// in protein view of a coding gene, see if to map to aa
			// in gmsum, rglst may include introns, need to distinguish symbolic and rglst introns, use __x difference by a exonsf*3 limit

			for (const mlst of x2mlst.values()) {
				const t = coord.genomic2gm(mlst[0].pos, block.usegm)
				for (const m of mlst) {
					m.aapos = t.aapos
					m.rnapos = t.rnapos
				}
			}

			const aa2mlst = new Map()
			// k: aa position
			// v: [ [m], [], ... ]

			for (const [x, mlst] of x2mlst) {
				if (mlst[0].chr != block.usegm.chr) {
					continue
				}
				// TODO how to identify if mlst belongs to regulatory region rather than gm

				const aapos = mlst[0].aapos

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

	return datagroup
}

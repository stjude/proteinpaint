/**
 * Functions for sketching gene models, RNA, and protein structures on canvas.
 * All canvas rendering functions consider devicePixelRatio for crisp image rendering.
 */

import { scaleLinear } from 'd3-scale'
import type { Div, Td } from '../types/d3'
import type { GeneModel, ExonRegion } from './types/isoformSelect'

/**
 * Interface for protein domains
 */
interface ProteinDomain {
	start: number
	stop: number
	color: string
}

/**
 * Extended GeneModel type that includes optional protein domains
 */
interface GeneModelWithDomains extends GeneModel {
	pdomains?: ProteinDomain[]
	rnalen?: number
	codingstart?: number
	codingstop?: number
	intron?: number[][]
}

/**
 * Helper function to configure canvas for high-DPI (Retina) displays.
 * Sets the canvas backing store size to match device pixel ratio for crisp rendering.
 */
export function setupCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D {
	const dpr = window.devicePixelRatio || 1

	// Set display size (css pixels)
	canvas.style.width = `${width}px`
	canvas.style.height = `${height}px`

	// Set actual size in memory (scaled by device pixel ratio)
	canvas.width = width * dpr
	canvas.height = height * dpr

	const ctx = canvas.getContext('2d')!

	// Scale all drawing operations by the dpr
	ctx.scale(dpr, dpr)

	return ctx
}

/**
 * Sketches a spliced RNA structure showing exons, introns, and coding regions.
 *
 * @param holder - D3 selection to append canvas to
 * @param gm - Gene model with exon structure
 * @param pxwidth - Width in pixels
 * @param color - Color for coding regions
 */
export function sketchSplicerna(holder: Div | Td, gm: GeneModelWithDomains, pxwidth: number, color: string): void {
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
	const canvas = holder.append('canvas').node() as HTMLCanvasElement
	const h = 20
	const pad = 4
	const ctx = setupCanvas(canvas, pxwidth, h)

	ctx.strokeStyle = color
	ctx.beginPath()
	ctx.moveTo(0, Math.floor(h / 2) - 0.5)
	ctx.lineTo(pxwidth, Math.floor(h / 2) - 0.5)
	ctx.stroke()

	// gm.exon is 5 to 3
	const reverse = gm.strand === '-'
	let x = 0
	for (const e of gm.exon) {
		let thin1: number[] | null = null,
			thick: number[] | null = null,
			thin2: number[] | null = null
		if (reverse) {
			// Check if coding start/stop are defined for reverse strand logic
			if (gm.codingstop === undefined || gm.codingstart === undefined) {
				// For non-coding or incomplete genes, render as thin
				thin1 = e
			} else {
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
			}
		} else {
			// Check if coding start/stop are defined for forward strand logic
			if (gm.codingstart === undefined || gm.codingstop === undefined) {
				// For non-coding or incomplete genes, render as thin
				thin1 = e
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

/**
 * px of a genomic position over the sketched regions of the given chr.
 *
 * A position outside them has no px of its own and takes the nearest edge of the layout, so
 * that a gene model running past the regions is clipped to them rather than dropped: the
 * regions may be a window of the gene, e.g. the exons a fusion breaks on and their context
 * (see makeExonScale in isoformSelect.ts), which no gene model of it begins or ends within.
 *
 * Returns undefined only when no region is of the gene's chr, i.e. there is nothing to draw.
 */
function posToPx(rglst: ExonRegion[], chr: string, pos: number, exonsf: number, intronw: number) {
	let x = 0
	let nearest: number | undefined
	let nearestDist = Infinity
	for (const r of rglst) {
		if (r.chr !== chr) {
			x += r.width! + intronw
			continue
		}
		if (pos >= r.start && pos <= r.stop) {
			return x + (r.reverse ? r.stop - pos : pos - r.start) * exonsf
		}
		// keep the edge of the region nearest to it, for when no region holds it
		const dist = pos < r.start ? r.start - pos : pos - r.stop
		if (dist < nearestDist) {
			nearestDist = dist
			const edge = pos < r.start ? r.start : r.stop
			nearest = x + (r.reverse ? r.stop - edge : edge - r.start) * exonsf
		}
		x += r.width! + intronw
	}
	return nearest
}

/**
 * Sketches a gene model summary across multiple regions.
 *
 * The regions are the whole of what is drawn: everything is clipped to them, so passing a
 * window of a gene's exons sketches only that window.
 *
 * @param holder - D3 selection to append canvas to
 * @param rglst - List of exon regions
 * @param gm - Gene model
 * @param exonsf - Exon scale factor
 * @param intronw - Intron width
 * @param pxwidth - Total width in pixels
 * @param h - Height in pixels
 * @param color - Color for coding regions
 * @param opts.exonNumbers - number the exons, in those boxes wide enough to hold the number
 */
export function sketchGmsum(
	holder: Div | Td,
	rglst: ExonRegion[],
	gm: GeneModelWithDomains,
	exonsf: number,
	intronw: number,
	pxwidth: number,
	h: number,
	color: string,
	opts: { exonNumbers?: boolean } = {}
): void {
	const canvas = holder.append('canvas').node() as HTMLCanvasElement
	const pad = Math.ceil(h / 5)
	const ctx = setupCanvas(canvas, pxwidth, h)

	const start = posToPx(rglst, gm.chr, gm.start, exonsf, intronw)
	const stop = posToPx(rglst, gm.chr, gm.stop, exonsf, intronw)

	if (start !== undefined && stop !== undefined) {
		ctx.strokeStyle = color
		ctx.beginPath()
		ctx.moveTo(start, Math.floor(h / 2) + 0.5)
		ctx.lineTo(stop, Math.floor(h / 2) + 0.5)
		ctx.stroke()
	}

	const thin: number[][] = []
	if (gm.utr5) thin.push(...gm.utr5)
	if (gm.utr3) thin.push(...gm.utr3)
	if (!gm.cdslen) thin.push(...gm.exon)
	for (const e of thin) {
		let x = 0
		for (const r of rglst) {
			if (r.chr !== gm.chr) {
				x += r.width! + intronw
				continue
			}
			const start = Math.max(e[0], r.start)
			const stop = Math.min(e[1], r.stop)
			if (start >= stop) {
				x += r.width! + intronw
				continue
			}
			ctx.fillStyle = '#aaa'
			ctx.fillRect(
				x + (r.reverse ? (r.stop - stop) * exonsf : (start - r.start) * exonsf),
				pad,
				Math.max(1, (stop - start) * exonsf),
				h - pad * 2
			)
			x += r.width! + intronw
		}
	}
	if (gm.coding) {
		for (const e of gm.coding) {
			let x = 0
			for (const r of rglst) {
				if (r.chr !== gm.chr) {
					x += r.width! + intronw
					continue
				}
				const start = Math.max(e[0], r.start)
				const stop = Math.min(e[1], r.stop)
				if (start >= stop) {
					x += r.width! + intronw
					continue
				}
				ctx.fillStyle = color
				ctx.fillRect(
					x + (r.reverse ? (r.stop - stop) * exonsf : (start - r.start) * exonsf),
					0,
					Math.max(1, (stop - start) * exonsf),
					h
				)
				x += r.width! + intronw
			}
		}
	}

	if (opts.exonNumbers) drawExonNumbers(ctx, rglst, gm, exonsf, intronw, h)
}

/**
 * Number the exons of a gene model within its boxes, skipping any box too narrow to hold
 * the number. Exon 1 is the 5' most, so the numbering runs against the genomic order on the
 * minus strand.
 *
 * Only a wide box is labelled, which is what a zoomed layout gives (see makeExonScale in
 * isoformSelect.ts): over a whole many-exon gene no box has the room and none is numbered.
 */
function drawExonNumbers(
	ctx: CanvasRenderingContext2D,
	rglst: ExonRegion[],
	gm: GeneModelWithDomains,
	exonsf: number,
	intronw: number,
	h: number
) {
	const ordered = [...gm.exon].sort((a, b) => a[0] - b[0])
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	ctx.font = `${Math.max(8, Math.min(10, h - 6))}px Arial`
	for (const [i, e] of ordered.entries()) {
		const label = String(gm.strand == '-' ? ordered.length - i : i + 1)
		// the widest piece of the exon that is drawn, as a region may clip it
		let bestX = 0
		let bestW = 0
		let bestCenter = 0
		let x = 0
		for (const r of rglst) {
			if (r.chr !== gm.chr) {
				x += r.width! + intronw
				continue
			}
			const start = Math.max(e[0], r.start)
			const stop = Math.min(e[1], r.stop)
			const w = (stop - start) * exonsf
			if (start < stop && w > bestW) {
				bestW = w
				bestX = x + (r.reverse ? (r.stop - stop) * exonsf : (start - r.start) * exonsf)
				bestCenter = (start + stop) / 2
			}
			x += r.width! + intronw
		}
		// padded, so that a number never touches the edges of the box holding it
		if (bestW < ctx.measureText(label).width + 4) continue
		/* a coding box is filled dark and a non-coding one light, so read the number off
		whichever the middle of it sits on: an exon may be part utr and part coding, and the
		number is centered over the piece drawn, not over the coding within it */
		const onCoding = gm.coding?.some(c => c[0] <= bestCenter && c[1] >= bestCenter)
		ctx.fillStyle = onCoding ? '#fff' : '#333'
		ctx.fillText(label, bestX + bestW / 2, h / 2)
	}
}

/**
 * Sketches an RNA structure showing UTRs, coding region, and protein domains.
 *
 * @param holder - D3 selection to append canvas to
 * @param gm - Gene model with RNA and domain information
 * @param pxwidth - Width in pixels
 * @param color - Color for coding region
 */
export function sketchRna(holder: Div | Td, gm: GeneModelWithDomains, pxwidth: number, color: string): void {
	const canvas = holder.append('canvas').node() as HTMLCanvasElement
	const h = 20
	const pad = 4
	const ctx = setupCanvas(canvas, pxwidth, h)

	if (!gm.cdslen) {
		ctx.fillStyle = '#aaa'
		ctx.fillRect(0, pad, pxwidth, h - pad * 2)
		return
	}
	const sf = pxwidth / gm.rnalen!
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

/**
 * Sketches a protein structure showing protein domains.
 *
 * @param holder - D3 selection to append canvas to
 * @param gm - Gene model with protein domain information
 * @param pxwidth - Width in pixels
 */
export function sketchProtein2(holder: Div | Td, gm: GeneModelWithDomains, pxwidth: number): void {
	const canvas = holder.append('canvas').node() as HTMLCanvasElement
	const h = 20
	const ctx = setupCanvas(canvas, pxwidth, h)

	const sf = pxwidth / (gm.cdslen! / 3)
	gm.pdomains!.sort((a, b) => b.stop - b.start - a.stop + a.start)
	ctx.fillStyle = 'white'
	ctx.fillRect(0, 0, pxwidth, h)
	for (const domain of gm.pdomains!) {
		ctx.fillStyle = domain.color
		ctx.fillRect(domain.start * sf, 0, (domain.stop - domain.start + 1) * sf, h)
	}
	ctx.strokeStyle = 'black'
	ctx.strokeRect(0, 0, pxwidth, h)
}

/**
 * Sketches a gene structure with exons, introns, UTRs, and strand direction.
 *
 * @param holder - D3 selection to append canvas to
 * @param gm - Gene model
 * @param pxwidth - Width in pixels
 * @param h - Height in pixels
 * @param bpstart - Start base pair position
 * @param bpstop - Stop base pair position
 * @param color - Color for gene features
 * @param nostrand - If true, don't show strand direction
 * @param reverse - If true, reverse the direction
 */
export function sketchGene(
	holder: Div | Td,
	gm: GeneModelWithDomains,
	pxwidth: number,
	h: number,
	bpstart: number,
	bpstop: number,
	color: string,
	nostrand?: boolean,
	reverse?: boolean
): void {
	const canvas = holder.append('canvas').node() as HTMLCanvasElement
	const ctx = setupCanvas(canvas, pxwidth, h)

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
	if (gm.codingstart === gm.codingstop) {
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
				bpStrand(ctx, gm.strand, e[0], e[1], bpstart, bpstop, 1 + ypad, h - ypad * 2 - 1, color)
			}
		}
	}

	function bpBox(
		ctx: CanvasRenderingContext2D,
		start: number,
		stop: number,
		borderstart: number,
		borderstop: number,
		y: number,
		h: number
	): void {
		const a = Math.max(start, borderstart)
		const b = Math.min(stop, borderstop)
		if (a >= b) return
		ctx.fillRect(Math.floor(sf(reverse ? b : a)), y, Math.max(1, Math.abs(sf(b) - sf(a))), h)
	}

	function bpStrand(
		ctx: CanvasRenderingContext2D,
		strand: string,
		start: number,
		stop: number,
		borderstart: number,
		borderstop: number,
		y: number,
		h: number,
		strokeColor: string
	): void {
		const a = Math.max(start, borderstart)
		const b = Math.min(stop, borderstop)
		if (a >= b) return
		const pad = 2,
			spacing = h / 2,
			w = sf(b) - sf(a)
		if (w <= pad * 2 + h / 2) return
		ctx.strokeStyle = strokeColor
		const fillcount = Math.floor((w - pad * 2) / (h / 2 + spacing))
		let x = Math.floor(sf(a) + (w - fillcount * (h / 2 + spacing)) / 2) + 0.5
		ctx.beginPath()
		for (let i = 0; i < fillcount; i++) {
			if (strand === '+') {
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

/**
 * Displays protein information (amino acid length) as text.
 * Note: This function does not use canvas rendering.
 *
 * @param holder - D3 selection to append span to
 * @param gm - Gene model with CDS information
 * @param pxwidth - Width in pixels (unused but kept for API compatibility)
 * @returns The created span element
 */
export function sketchProtein(holder: Div | Td, gm: GeneModelWithDomains, _pxwidth: number) {
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

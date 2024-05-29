import { ChrPosition } from 'types/hic'
import { FirstChrX } from './FirstChrX'

export class DetailCoordinates {
	hic: any
	errlist: string[]

	constructor(hic: any, errlist: string[]) {
		this.hic = hic
		this.errlist = errlist
	}

	getCoordinates(chrx: ChrPosition, chry: ChrPosition, data: any, resolution: number, canvas: any, fragData?: any) {
		const isFirstX = new FirstChrX(this.hic.chrorder, chrx.chr, chry.chr).isFirstX()
		const isintrachr = chrx.chr == chry.chr

		const canvaswidth = Number.parseInt(canvas.attr('width'))
		const canvasheight = Number.parseInt(canvas.attr('height'))

		// pixel per bp
		const xpxbp = canvaswidth / (chrx.stop - chrx.start)
		const ypxbp = canvasheight / (chry.stop - chry.start)

		const list = this.calculateCoordinates(isFirstX, isintrachr, xpxbp, ypxbp, resolution, chrx, chry, data, fragData)
		return list
	}

	calculateCoordinates(
		isFirstX: boolean,
		isintrachr: boolean,
		xpxbp: number,
		ypxbp: number,
		resolution: number,
		chrx: ChrPosition,
		chry: ChrPosition,
		data: any,
		fragData?: any
	) {
		const list: any[] = []
		for (const [xCoord, yCoord, value] of data.items) {
			let coord1: number, coord2: number, span1: number, span2: number

			if (fragData) {
				// the beginning fragment index
				const idx_start = isFirstX ? xCoord : yCoord
				const idy_start = isFirstX ? yCoord : xCoord

				/*
				convert fragment id to coordinate:
				start: start of idx_start
				stop: stop of idx_start + resolution
				*/
				// convert x

				if (fragData.x.id2coord && fragData.x.id2coord.has(idx_start)) {
					const [a, b] = fragData.x.id2coord.get(idx_start)
					coord1 = a
					span1 = b - a // note this likely to be replaced by [idx_start+resolution]
				} else {
					this.errlist.push(`[x id error] x: ${idx_start} y: ${idy_start}`)
					continue
				}

				{
					// the end of fragment id of x, it may be out of range!
					const id_stop = idx_start + resolution

					if (fragData.x.id2coord.has(id_stop)) {
						const [a, b] = fragData.x.id2coord.get(id_stop)
						span1 = b - coord1
					}
				}

				// convert y
				if (fragData.y.id2coord.has(idy_start)) {
					const [a, b] = fragData.y.id2coord.get(idy_start)
					coord2 = a
					span2 = b - a
				} else {
					this.errlist.push(`[y id error] x: ${idx_start} y: ${idy_start}`)
					continue
				}
				{
					// the end of fragment id of x, it may be out of range!
					const id_stop = idy_start + resolution

					if (fragData.y.id2coord.has(id_stop)) {
						const [a, b] = fragData.y.id2coord.get(id_stop)
						span2 = b - coord2
					}
				}
			} else {
				coord1 = isFirstX ? xCoord : yCoord
				coord2 = isFirstX ? yCoord : xCoord
				span1 = resolution
				span2 = resolution
			}

			if (isintrachr) {
				if (coord1 > chrx.start - span1 && coord1 < chrx.stop && coord2 > chry.start - span2 && coord2 < chry.stop) {
					list.push([
						Math.floor((coord1 - chrx.start) * xpxbp),
						Math.floor((coord2 - chry.start) * ypxbp),
						Math.ceil(span1 * xpxbp),
						Math.ceil(span2 * ypxbp),
						value
					])
				}
				if (coord2 > chrx.start - span2 && coord2 < chrx.stop && coord1 > chry.start && coord1 < chry.stop) {
					list.push([
						Math.floor((coord2 - chrx.start) * xpxbp),
						Math.floor((coord1 - chry.start) * ypxbp),
						Math.ceil(span2 * xpxbp),
						Math.ceil(span1 * ypxbp),
						value
					])
				}
				continue
			}

			// inter chr
			list.push([
				Math.floor((coord1 - chrx.start) * xpxbp),
				Math.floor((coord2 - chry.start) * ypxbp),
				Math.ceil(span1 * xpxbp),
				Math.ceil(span2 * ypxbp),
				value
			])
		}
		return list
	}
}

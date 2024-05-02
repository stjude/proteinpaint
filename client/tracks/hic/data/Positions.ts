import { Resolution } from './Resolution.ts'

export class Positions {
	resolution: Resolution
	error: (f: string | string[]) => void

	constructor(error: (f: string | string[]) => void) {
		this.error = error
		this.resolution = new Resolution(this.error)
	}
	setPosition(x: number, y: number, binpx: number, chrx: { chr: string }, chry: { chr: string }, hic: any) {
		const initialbinnum_detail = 20

		const resolution = this.resolution.getChrPairResolution(hic, chrx, chry)

		const viewrangebpw = resolution! * initialbinnum_detail

		let coordx = Math.max(1, Math.floor((x * resolution!) / binpx) - viewrangebpw / 2)
		let coordy = Math.max(1, Math.floor((y * resolution!) / binpx) - viewrangebpw / 2)

		// make sure positions are not out of bounds
		{
			const lenx = hic.genome.chrlookup[chrx.chr.toUpperCase()].len
			if (coordx + viewrangebpw >= lenx) {
				coordx = lenx - viewrangebpw
			}
			const leny = hic.genome.chrlookup[chry.chr.toUpperCase()].len
			if (coordy + viewrangebpw > leny) {
				coordy = leny - viewrangebpw
			}
		}
		const xObj = {
			chr: chrx.chr,
			start: coordx,
			stop: coordx + viewrangebpw
		}

		const yObj = {
			chr: chry.chr,
			start: coordy,
			stop: coordy + viewrangebpw
		}

		return [xObj, yObj]
	}
}

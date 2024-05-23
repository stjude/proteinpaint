import { Resolution } from './Resolution.ts'

export class Positions {
	resolution: Resolution
	minBinNum_bp: number
	error: (f: string | string[]) => void

	constructor(error: (f: string | string[]) => void, minBinNum_bp: number) {
		this.error = error
		this.resolution = new Resolution(this.error)
		this.minBinNum_bp = minBinNum_bp
	}
	setPosition(
		x: number,
		y: number,
		binpx: number,
		chrx: { chr: string },
		chry: { chr: string },
		hic: any,
		initialBinNum: number,
		width
	) {
		// const actualBinNum = Math.floor((initialCanvasSize/ width) * initialBinNum)
		const resolution = this.resolution.getChrPairResolution(hic, chrx, chry, this.minBinNum_bp)
		const viewrangebpw = resolution! * initialBinNum

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

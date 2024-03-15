import { Resolution } from './resolution'

export class Positions {
	resolution: Resolution
	error: (f: string | string[]) => void
	activeView: string
	currView: { nmeth: string; resolution: number; matrixType: string }

	constructor(
		error: (f: string | string[]) => void,
		activeView: string,
		currView: { nmeth: string; resolution: number; matrixType: string }
	) {
		this.error = error
		this.resolution = new Resolution(this.error)
		this.activeView = activeView
		this.currView = currView
	}
	setPositions(x: number, y: number, binpx: number, chrx: string, chry: string, hic: any) {
		const initialbinnum_detail = 20

		const resolution = this.resolution.getResolution(hic, this.activeView, this.currView, chrx, chry)

		const viewrangebpw = resolution! * initialbinnum_detail

		let coordx = Math.max(1, Math.floor((x * resolution!) / binpx) - viewrangebpw / 2)
		let coordy = Math.max(1, Math.floor((y * resolution!) / binpx) - viewrangebpw / 2)

		// make sure positions are not out of bounds
		{
			const lenx = hic.genome.chrlookup[chrx.toUpperCase()].len
			if (coordx + viewrangebpw >= lenx) {
				coordx = lenx - viewrangebpw
			}
			const leny = hic.genome.chrlookup[chry.toUpperCase()].len
			if (coordy + viewrangebpw > leny) {
				coordy = leny - viewrangebpw
			}
		}

		const xObj = {
			chr: chrx,
			start: coordx,
			stop: coordx + viewrangebpw
		}

		const yObj = {
			chr: chry,
			start: coordx,
			stop: coordx + viewrangebpw
		}

		return [xObj, yObj]
	}
}

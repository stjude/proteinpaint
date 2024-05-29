import { ChrPosition } from 'types/hic'

export class Resolution {
	error: (f: string | string[]) => void

	constructor(error: (f: string | string[]) => void) {
		this.error = error
	}

	getResolution(state: any, hic: any) {
		if (state.currView == 'genome') return hic['bpresolution'][0]
		if (state.currView == 'chrpair') {
			const resolution = this.getChrPairResolution(hic, state.x, state.y, state.minBinNum_bp)
			return resolution
		} else if (state.currView == 'detail') {
			const maxBpWidth = Math.max(state.x.stop - state.x.start, state.y.stop - state.y.start)
			const resolution = this.findResFromArray(maxBpWidth, state.minBinNum_bp, hic.bpresolution)
			return resolution
		} else {
			this.error(`Unknown view: ${state.currView}`)
			throw `Unknown view: ${state.currView}`
		}
	}

	getChrPairResolution(hic: any, x: any, y: any, minBinNum_bp: number) {
		const chrxlen = hic.genome.chrlookup[x.chr.toUpperCase()].len
		const chrylen = hic.genome.chrlookup[y.chr.toUpperCase()].len
		const maxchrlen = Math.max(chrxlen, chrylen)

		const resolution = this.findResFromArray(maxchrlen, minBinNum_bp, hic.bpresolution)

		if (resolution == null) {
			this.error(`No suitable resolution for ${x.chr}-${y.chr} pair.`)
			return
		}
		return resolution
	}

	findResFromArray(max: number, defaultValue: number, resolutionArray: number[], returnNum?: boolean): number | null {
		let resolution: number | null = null
		for (const res of resolutionArray) {
			if (max / res > defaultValue) {
				resolution = res
				break
			}
		}

		if (returnNum && resolution == null) {
			// use finest
			resolution = resolutionArray[resolutionArray.length - 1]
		}

		return resolution
	}

	getDefaultViewSpan(hic: any, x: any, y: any, initialBinNum: number, minBinNum_bp: number) {
		const chrpairResolution = this.getChrPairResolution(hic, x, y, minBinNum_bp)
		if (!chrpairResolution) return
		return chrpairResolution * initialBinNum
	}

	updateDetailResolution(bpresolution: any, x: ChrPosition, y: ChrPosition) {
		let resolution = null
		/** Pick the smallest span, then choose the next lowest resolution */
		const maxBpWidth = Math.min(x.stop - x.start, y.stop - y.start)
		for (const res of bpresolution) {
			if (maxBpWidth <= res) {
				resolution = bpresolution[bpresolution.indexOf(res) - 1]
				break
			}
		}
		if (resolution == null) {
			// use finest
			resolution = bpresolution[bpresolution.length - 1]
		}
		return resolution
	}
}

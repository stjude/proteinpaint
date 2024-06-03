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
			let resolution = this.findResFromArray(maxBpWidth, state.minBinNum_bp, hic.bpresolution)
			if (resolution == null && !hic.enzyme) {
				//Do not allow zooming to fragment resolution when enzyme is not defined
				resolution = hic.bpresolution[hic.bpresolution.length - 1]
			}
			/** if resolution is still null, will calculate frag data
			 * and fragment resolution in HicComponent setResolution()*/
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
}

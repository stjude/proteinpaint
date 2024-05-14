import { ChrPosition } from 'types/hic'

export class Resolution {
	error: (f: string | string[]) => void
	readonly initialBinNum = 20
	readonly minBinNum_bp = 200

	constructor(error: (f: string | string[]) => void) {
		this.error = error
	}

	getResolution(state: any, hic: any) {
		if (state.currView == 'genome') return hic['bpresolution'][0]
		if (state.currView == 'chrpair') {
			const resolution = this.getChrPairResolution(hic, state.x, state.y)
			return resolution
		} else if (state.currView == 'detail') {
			const maxBpWidth = Math.max(state.x.stop - state.x.start, state.y.stop - state.y.start)
			let resolution = null
			for (const res of hic.bpresolution) {
				if (maxBpWidth / res > this.minBinNum_bp) {
					resolution = res
					break
				}
			}
			if (resolution == null) {
				// use finest
				resolution = hic.bpresolution[hic.bpresolution.length - 1]
			}
			return resolution
		} else {
			this.error(`Unknown view: ${state.currView}`)
			throw `Unknown view: ${state.currView}`
		}
	}

	getChrPairResolution(hic: any, x: any, y: any) {
		const chrxlen = hic.genome.chrlookup[x.chr.toUpperCase()].len
		const chrylen = hic.genome.chrlookup[y.chr.toUpperCase()].len
		const maxchrlen = Math.max(chrxlen, chrylen)

		let resolution = null

		for (let i = 0; i < hic.bpresolution.length; i++) {
			const res = hic.bpresolution[i]
			if (maxchrlen / res > 200) {
				resolution = res
				break
			}
		}
		if (resolution == null) {
			this.error(`No suitable resolution for ${x.chr}-${y.chr} pair.`)
			return
		}
		return resolution
	}

	getDefaultViewSpan(hic: any, x: any, y: any) {
		const chrpairResolution = this.getChrPairResolution(hic, x, y)
		if (!chrpairResolution) return
		return chrpairResolution * this.initialBinNum
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

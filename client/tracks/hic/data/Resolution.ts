export class Resolution {
	error: (f: string | string[]) => void
	initialbinnum_detail = 20
	minimumbinnum_bp = 200

	constructor(error: (f: string | string[]) => void) {
		this.error = error
	}

	getResolution(state: any, hic: any) {
		if (state.currView == 'genome') return hic['bpresolution'][0]
		if (state.currView == 'chrpair') {
			const resolution = this.getChrPairResolution(hic, state.x, state.y)
			return resolution
		} else if (state.currView == 'detailed') {
			/**Must obtain the resolution for the chr pair before calculating the
			 * the resolution for the region. */
			const chrpairResolution = this.getChrPairResolution(hic, state.x, state.y)
			if (!chrpairResolution) return
			const viewRangeBpW = chrpairResolution * this.initialbinnum_detail

			let resolution = null
			for (const res of hic.bpresolution) {
				if (viewRangeBpW / res > this.minimumbinnum_bp) {
					resolution = res
					break
				}
			}
			if (resolution == null) {
				// use finest
				resolution = hic.bpresolution[hic.bpresolution.length - 1]
			}
			return resolution
		} else if (state.currView == 'horizontal') {
			//TODO
		} else {
			// this.error(`Unknown view: ${activeView}`)
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
}

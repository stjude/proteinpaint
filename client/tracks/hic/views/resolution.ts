export class Resolution {
	error: (f: string | string[]) => void
	initialbinnum_detail = 20
	minimumbinnum_bp = 200

	constructor(error: (f: string | string[]) => void) {
		this.error = error
	}

	getResolution(hic: any, activeView: string, currView: { nmeth: string; resolution: number }, x: any, y: any) {
		if (currView?.resolution) return currView.resolution
		if (activeView == 'chrpair') {
			const resolution = this.getChrPairResolution(hic, x, y)
			return resolution
		} else if (activeView == 'detailed') {
			/**Must obtain the resolution for the chr pair before calculating the
			 * the resolution for the region. */
			const chrpairResolution = this.getChrPairResolution(hic, x, y)
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
		} else if (activeView == 'horizontal') {
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

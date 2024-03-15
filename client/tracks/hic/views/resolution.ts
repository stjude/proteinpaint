export class Resolution {
	error: (f: string | string[]) => void

	constructor(error: (f: string | string[]) => void) {
		this.error = error
	}

	getResolution(hic: any, activeView: string, currView: { nmeth: string; resolution: number }, x: any, y: any) {
		//TODO: resolution for detail and horizontal view
		if (currView?.resolution) return currView.resolution
		if (activeView == 'chrpair') {
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
				this.error('no suitable resolution')
				return
			}
			return resolution
		}
	}
}

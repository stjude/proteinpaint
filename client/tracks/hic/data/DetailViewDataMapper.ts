import { DetailViewDataFetcher } from './DetailViewDataFetcher'

export class DetailViewDataMapper {
	hic: any
	dataFetcher: DetailViewDataFetcher
	minBinNum_bp = 20
	resolution: number | null = null
	errList: string[]

	constructor(hic: any, errList: string[]) {
		this.hic = hic
		this.errList = errList
		this.dataFetcher = new DetailViewDataFetcher(errList)
	}

	updateResolution(x: { chr: string; start: number; stop: number }, y: { chr: string; start: number; stop: number }) {
		const maxBpWidth = Math.max(x.stop - x.start, y.stop - y.start)
		for (const res of this.hic.bpresolution) {
			if (maxBpWidth / res > this.minBinNum_bp) {
				this.resolution = res
				break
			}
		}
		return this.resolution
	}

	async getFragData() {
		try {
			const xFragData = await this.dataFetcher.getXFragData(this.hic, this.resolution, this.hic.x)
		} catch (e: any) {
			this.errList.push(e.message || e)
			if (e.stack) console.log(e.stack)
		}
	}
}

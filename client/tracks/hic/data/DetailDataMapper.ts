import { DetailDataFetcher } from './DetailDataFetcher'
import { ChrPosition } from '../../../types/hic.ts'
import { ParseFragData } from './ParseFragData'

export class DetailDataMapper {
	hic: any
	dataFetcher: DetailDataFetcher
	errList: string[]
	parent: (prop: string, v?: number) => string | number
	frag = {
		x: {},
		y: {}
	}
	fragData = []

	constructor(hic: any, errList: string[], parent: any) {
		this.hic = hic
		this.errList = errList
		this.dataFetcher = new DetailDataFetcher(errList)
		this.parent = parent
	}

	async getFragData(chrx: ChrPosition, chry: ChrPosition) {
		try {
			const xFragData = await this.dataFetcher.getXFragData(this.hic, this.parent('calcResolution') as number, chrx)
			// if (!xFragData) {
			// 	//skipped the initial resolution calculation
			// 	//no need for this step
			// 	//this.parent('calcResolution', this.resolution!)
			// 	//TODO: update canvas with and height
			// } else {
			if (xFragData) {
				if (!xFragData.items) {
					this.errList.push(`No fragment data returned for ${chrx.chr}:${chrx.start}-${chrx.stop}`)
					return
				}

				const xParse = new ParseFragData(this.errList, xFragData.items)
				if (this.errList.length) return

				this.frag.x = {
					map: xParse.id2coord,
					start: xParse.min,
					stop: xParse.max
				}

				const yFragData = await this.dataFetcher.getYFragData(this.hic, chry)
				if (this.errList.length) return

				if (yFragData) {
					if (!yFragData.items) {
						this.errList.push(`No fragment data returned for ${chry.chr}:${chry.start}-${chry.stop}`)
						return
					}

					const yParse = new ParseFragData(this.errList, yFragData.items)
					if (this.errList.length) return

					this.frag.y = {
						start: yParse.min,
						stop: yParse.max
					}

					this.determineMap(yParse.id2coord, chrx, chry)
				}
			}
		} catch (e: any) {
			this.errList.push(e.message || e)
			if (e.stack) console.error(e.stack)
		}
	}

	determineMap(map, chrx: ChrPosition, chry: ChrPosition) {
		if (chrx.chr == chry.chr) {
			for (const [id, pos] of map) {
				this.frag.x['map'].set(id, pos)
			}
			this.frag.y['map'] = this.frag.x['map']
		} else {
			this.frag.y['map'] = map
		}
	}

	async getData(chrx: ChrPosition, chry: ChrPosition) {
		this.fragData = (await this.getFragData(chrx, chry)) as any
		return await this.dataFetcher.fetchData(
			this.hic,
			this.parent('state')['detail'],
			this.parent('calcResolution') as number,
			chrx,
			chry,
			this.fragData as any
		)
	}
}

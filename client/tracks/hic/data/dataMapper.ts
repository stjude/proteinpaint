import { dofetch2 } from '#src/client'
import { hicParseFile } from './parseData'

export class HicDataMapper {
	hic: any
	debugmode: boolean
	errList: string[]
	data = []

	constructor(hic: any, debugmode: boolean, errList: string[] = []) {
		this.hic = hic
		this.debugmode = debugmode
		this.errList = errList || []
	}

	async getHicStraw() {
		await hicParseFile(this.hic, this.debugmode, this.errList)
	}

	//helper function to return data per view requirement
	//TODO: rm chrs without data from hic.chrlst in this function on init()
	//TODO: include mincutoff in query?

	async getData(obj) {
		const vlst: number[] = []
		if (this.data.length) this.data = []
		if (!obj?.matrixType) obj.matrixType = 'observed'

		if (obj.lead && obj.follow) {
			await this.getHicData(obj.nmeth, obj.resolution, obj.matrixType, obj.lead, obj.follow, vlst, this.data)
		} else {
			try {
				this.data = (await dofetch2('hicdata?', {
					method: 'POST',
					body: JSON.stringify({
						chrlst: this.hic.chrlst,
						nmeth: obj.nmeth,
						resolution: obj.resolution,
						matrixType: obj.matrixType,
						file: this.hic.file,
						url: this.hic.url
					})
				})) as any
				for (const i of this.data as { items: number[][]; lead: number; follow: number }[]) {
					for (const v of i.items) {
						vlst.push(v[2])
					}
				}
			} catch (e: any) {
				this.errList.push(e.message || e)
				if (e.stack) console.log(e.stack)
			}
		}

		//Do not use Math.min() or Math.max().
		//Causes stack overflow
		const sortedVlst = vlst.sort((a: number, b: number) => a - b)
		const max = sortedVlst[Math.floor(sortedVlst.length * 0.99)] as number
		const min = sortedVlst[0]
		return [Math.floor(min), Math.floor(max)]
	}

	async getHicData(
		nmeth: string,
		resolution: number,
		matrixType: string,
		lead: string,
		follow: string,
		vlst: number[],
		viewData: any
	) {
		const arg = {
			matrixType,
			file: this.hic.file,
			url: this.hic.url,
			pos1: this.hic.nochr ? lead.replace('chr', '') : lead,
			pos2: this.hic.nochr ? follow.replace('chr', '') : follow,
			nmeth,
			resolution
		}

		try {
			const data = await dofetch2('hicdata?', {
				method: 'POST',
				body: JSON.stringify(arg)
			})
			if (data.error) {
				//Fix for error message displaying [Object object] instead of error message
				throw Error(`${lead} - ${follow}: ${data.error.error}`)
			}
			if (!data.items || data.items.length == 0) return
			// this.test.push(data.items)
			viewData.push({ items: data.items })
			for (const v of data.items) {
				vlst.push(v[2])
			}
		} catch (e: any) {
			/** Collect all errors from the response and then call error() above.
			 * This allows errors to appear in a single, expandable div.
			 */
			this.errList.push(e.message || e)
			if (e.stack) console.log(e.stack)
		}
	}
}

import { dofetch2 } from '#src/client'
import { min } from 'd3'
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

	async getData(nmeth: string, resolution: any, matrixType?: string, lead?: string, follow?: string) {
		const vlst = []
		if (this.data.length) this.data = []
		if (!matrixType) matrixType = 'observed'
		if (lead && follow) {
			await this.getHicData(nmeth, resolution, matrixType, lead, follow, vlst, this.data)
		} else {
			/** lead chr and follow chr not provided for genome view.
			 * Loop through all the chrs, getData, and trim hic.chrLst on result
			 */

			for (let i = 0; i < this.hic.chrlst.length; i++) {
				const lead = this.hic.chrlst[i]
				for (let j = 0; j <= i; j++) {
					const follow = this.hic.chrlst[j]
					await this.getHicData(nmeth, resolution, matrixType, lead, follow, vlst, this.data)
				}
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
			viewData.push({ items: data.items, lead: lead, follow: follow })
			for (const v of data.items) {
				vlst.push(v[2])
			}
		} catch (e: any) {
			/** Collect all errors from the response and then call self.error() above.
			 * This allows errors to appear in a single, expandable div.
			 */
			this.errList.push(e.message || e)
			if (e.stack) console.log(e.stack)
		}
	}
}

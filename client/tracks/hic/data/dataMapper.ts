import { dofetch2 } from '#src/client'
import { hicParseFile } from './parseData'

export class HicDataRequest {
	hic: any
	debugmode: boolean
	errList: string[]
	values: number[] = []

	constructor(hic: any, debugmode: boolean, errList: string[] = []) {
		this.hic = hic
		this.debugmode = debugmode
		this.errList = errList || []
	}

	async getHicStraw(hic: any) {
		await hicParseFile(hic, this.debugmode, this.errList)
	}

	//helper function to return data per view requirement
	//TODO: rm chrs without data from hic.chrlst in this function on init()
	async getData(lead: string, follow: string) {
		const vlst = []
		this.getHicData(this.hic, this.hic.nmeth, this.hic.resolution, lead, follow, vlst)
		const [min, max] = this.getMinMax(vlst)
		return [min, max]
	}

	//Should return this.data and this.vlist or a range for values
	async getHicData(hic: any, nmeth: string, resolution: number, lead: string, follow: string, vlst: number[]) {
		const arg = {
			//matrixType: state.view.matrixType???
			file: hic.file,
			url: hic.url,
			pos1: hic.nochr ? lead.replace('chr', '') : lead,
			pos2: hic.nochr ? follow.replace('chr', '') : follow,
			nmeth: nmeth,
			resolution: resolution
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
			for (const v of data.items) {
				this.values.push(v[2])
			}
		} catch (e: any) {
			/** Collect all errors from the response and then call self.error() above.
			 * This allows errors to appear in a single, expandable div.
			 */
			// self.errList.push(e.message || e)
			// if (e.stack) console.log(e.stack)
		}
	}

	getMinMax(values) {
		const min = Math.min(...values)
		const max = Math.max(...values)
		return [min, max]
	}
}

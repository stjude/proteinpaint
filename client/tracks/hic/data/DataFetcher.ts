import { dofetch3 } from '#src/client'

export class DataFetcher {
	hic: any
	debugmode: boolean
	errList: string[]

	constructor(hic: any, debugmode: boolean, errList: string[] = []) {
		this.hic = hic
		this.debugmode = debugmode
		this.errList = errList || []
	}

	async getData(obj: any) {
		if (!obj?.matrixType) obj.matrixType = 'observed'
		const arg = {
			matrixType: obj.matrixType,
			file: this.hic.file,
			url: this.hic.url,
			pos1: this.hic.nochr ? obj.lead.replace('chr', '') : obj.lead,
			pos2: this.hic.nochr ? obj.follow.replace('chr', '') : obj.follow,
			nmeth: obj.nmeth,
			resolution: obj.resolution
		}

		try {
			const data = await dofetch3('hicdata?', {
				method: 'POST',
				body: JSON.stringify(arg)
			})
			if (data.error) {
				//Fix for error message displaying [Object object] instead of error message
				throw Error(`${obj.lead} - ${obj.follow}: ${data.error.error}`)
			}
			if (!data.items || data.items.length == 0) return
			return data
		} catch (e: any) {
			this.errList.push(e.message || e)
			if (e.stack) console.error(e.stack)
		}
	}
}

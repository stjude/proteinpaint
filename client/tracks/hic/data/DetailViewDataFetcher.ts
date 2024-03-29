import { get } from '@sjcrh/proteinpaint-server/src/massSession'
import { dofetch2 } from '../../../src/client'

export class DetailViewDataFetcher {
	obj = {
		rglst: [] as { chr: string; start: number; stop: number }[]
	}
	errList: string[]

	constructor(errList: string[]) {
		this.errList = errList
	}

	isFragData(hic: any, resolution: number | null) {
		if (resolution != null) return
		if (!hic.enzyme) {
			resolution = hic.bpresolution[hic.bpresolution.length - 1]
			return
		}
	}

	formatFragArgs(enzymefile: string, chr: { chr: string; start: number; stop: number }) {
		const arg = {
			getdata: 1,
			getBED: 1,
			file: enzymefile,
			rglst: [chr]
		}
		return arg
	}

	/**
	 * @param arg Formated obj from either fn above
	 * @param errList
	 * @returns
	 */
	async getBedData(arg: any, errList: any) {
		try {
			return await dofetch2('tkbedj', { method: 'POST', body: JSON.stringify(arg) })
		} catch (e: any) {
			errList.push(e.message || e)
			if (e.stack) console.log(e.stack)
		}
	}

	async getXFragData(hic: any, resolution: number | null, chrx: { chr: string; start: number; stop: number }) {
		this.isFragData(hic, resolution)
		const reqArgs = this.formatFragArgs(hic.enzyme, chrx)
		return await this.getBedData(reqArgs, this.errList)
	}
}

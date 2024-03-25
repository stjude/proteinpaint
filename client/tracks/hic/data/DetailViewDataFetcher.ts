import { dofetch2 } from '../../../src/client'

export class DetailViewDataFetcher {
	obj = {
		getdata: 1,
		getBED: 1,
		rglst: [] as { chr: string; start: number; stop: number }[]
	}

	formatXFragArgs(enzymefile: string, chrx: { chr: string; start: number; stop: number }) {
		this.obj['file'] = enzymefile
		this.obj.rglst.push(chrx)
		return this.obj
	}

	formatYFragArgs(enzymefile: string, chry: { chr: string; start: number; stop: number }) {
		this.obj['file'] = enzymefile
		this.obj.rglst.push(chry)
		return this.obj
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
}

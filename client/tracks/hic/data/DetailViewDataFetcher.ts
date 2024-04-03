import { get } from '@sjcrh/proteinpaint-server/src/massSession'
import { dofetch, dofetch2 } from '../../../src/client'

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
	async getBedData(arg: any) {
		try {
			return await dofetch2('tkbedj', { method: 'POST', body: JSON.stringify(arg) })
		} catch (e: any) {
			this.errList.push(e.message || e)
			if (e.stack) console.log(e.stack)
		}
	}

	async getXFragData(hic: any, resolution: number | null, chrx: { chr: string; start: number; stop: number }) {
		this.isFragData(hic, resolution)
		const reqArgs = this.formatFragArgs(hic.enzyme, chrx)
		return await this.getBedData(reqArgs)
	}

	/**
	 * Separate request from data fetch
	 * Returns the additional fragment data
	 * @param fragCoords
	 */
	async fetchFragData(
		hic: any,
		detailView: any,
		resolution: number,
		x: { chr: string; start: number; stop: number },
		y: { chr: string; start: number; stop: number },
		fragCoords?: { x: { start: number; stop: number }; y: { start: number; stop: number } }
	) {
		const fragStrawArgs = {
			matrixType: detailView.matrixType,
			file: hic.file,
			url: hic.url,
			pos1: this.determinePosition(hic, x, fragCoords?.x),
			pos2: this.determinePosition(hic, y, fragCoords?.y),
			nmeth: detailView.nmeth,
			resolution: resolution
		}

		if (fragCoords) fragStrawArgs['isfrag'] = true

		try {
			const data = dofetch('hicdata?', {
				method: 'POST',
				body: JSON.stringify(fragStrawArgs)
			})
			console.log(data)
		} catch (e: any) {
			this.errList.push(e.message || e)
			if (e.stack) console.log(e.stack)
		}
	}

	determinePosition(
		hic: any,
		chr: { chr: string; start: number; stop: number },
		fragCoord?: { start: number; stop: number }
	) {
		if (fragCoord) {
			return `${hic.nochr ? chr.chr.replace('chr', '') : chr.chr}:${fragCoord.start}:${fragCoord.stop}`
		} else {
			return `${hic.nochr ? chr.chr.replace('chr', '') : chr.chr}:${chr.start}:${chr.stop}`
		}
	}
}

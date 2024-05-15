import { dofetch3 } from '../../../src/client'
import { ChrPosition } from '../../../types/hic.ts'

type FragCoord = { start: number; stop: number }

export class DetailDataFetcher {
	obj = {
		rglst: [] as ChrPosition[]
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

	formatFragArgs(enzymefile: string, chr: ChrPosition) {
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
	async getBedData(arg: { getdata: number; getBED: number; file: string; rglst: ChrPosition[] }) {
		try {
			return await dofetch3('tkbedj', { method: 'POST', body: JSON.stringify(arg) })
		} catch (e: any) {
			this.errList.push(e.message || e)
			if (e.stack) console.error(e.stack)
		}
	}

	async getXFragData(hic: any, resolution: number | null, chrx: ChrPosition) {
		this.isFragData(hic, resolution)
		if (!hic.enzymefile) return
		const reqArgs = this.formatFragArgs(hic.enzymefile, chrx)
		return await this.getBedData(reqArgs)
	}

	async getYFragData(hic: any, chry: ChrPosition) {
		const reqArgs = this.formatFragArgs(hic.enzymefile, chry)
		return await this.getBedData(reqArgs)
	}
	/**
	 * Separate request from data fetch
	 * Returns the additional fragment data
	 * @param fragCoords
	 */
	async fetchData(
		hic: any,
		detailView: any,
		resolution: number,
		x: ChrPosition,
		y: ChrPosition,
		fragCoords?: { x: FragCoord; y: FragCoord }
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
			const data = dofetch3('hicdata?', {
				method: 'POST',
				body: JSON.stringify(fragStrawArgs)
			}) as any
			if (data.error) {
				this.errList.push(data.error)
			}
			return data
		} catch (e: any) {
			this.errList.push(e.message || e)
			if (e.stack) console.error(e.stack)
		}
	}

	determinePosition(hic: any, chr: ChrPosition, fragCoord?: FragCoord) {
		if (fragCoord) {
			return `${hic.nochr ? chr.chr.replace('chr', '') : chr.chr}:${fragCoord.start}:${fragCoord.stop}`
		} else {
			return `${hic.nochr ? chr.chr.replace('chr', '') : chr.chr}:${chr.start}:${chr.stop}`
		}
	}
}

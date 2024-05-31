import { dofetch3 } from '#src/client'

export class GenomeDataFetcher {
	hic: any
	debugmode: boolean
	errList: string[]
	data: { items: number[][]; lead: string; follow: string }[] = []

	constructor(hic: any, debugmode: boolean, errList: string[] = []) {
		this.hic = hic
		this.debugmode = debugmode
		this.errList = errList || []
	}

	async getData(obj: { nmeth: number; resolution: number; matrixType: string }) {
		if (this.data.length) this.data = []
		if (!obj?.matrixType) obj.matrixType = 'observed'
		try {
			const res = await dofetch3('hicgenome?', {
				method: 'POST',
				body: JSON.stringify({
					chrlst: this.hic.chrlst,
					nmeth: obj.nmeth,
					resolution: obj.resolution,
					matrixType: obj.matrixType,
					file: this.hic.file,
					url: this.hic.url,
					nochr: this.hic.nochr
				})
			})

			if (res.error) {
				const errs = res.error.split('\n')
				for (const e of errs) {
					this.errList.push(e)
				}
			}
			return res.data
		} catch (e: any) {
			this.errList.push(e.message || e)
			if (e.stack) console.error(e.stack)
		}
	}
}

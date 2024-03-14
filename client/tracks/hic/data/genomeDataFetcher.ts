import { dofetch2 } from '#src/client'

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
	//TODO: include mincutoff in query?
	async getData(obj) {
		if (this.data.length) this.data = []
		if (!obj?.matrixType) obj.matrixType = 'observed'
		try {
			const res = await dofetch2('hicgenome?', {
				method: 'POST',
				body: JSON.stringify({
					chrlst: this.hic.chrlst,
					nmeth: obj.nmeth,
					resolution: obj.resolution,
					matrixType: obj.matrixType,
					file: this.hic.file,
					url: this.hic.url
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
			if (e.stack) console.log(e.stack)
		}

		// let countBlankM = 0
		// for (const i of this.data) {
		//     /** Addresses the nagging problem if no data is present for M chr, not to render
		//      * squares for chrM-chr*. Errors still appear for the user.
		//      * TODO: Move to server side???
		//      */
		//     if (i.lead == 'chrM' || i.lead == 'chrY' && !i.items.length) {
		//         countBlankM++
		//         continue
		//     }
		// }
		// if (countBlankM == 25) {
		//     const idx = this.hic.chrlst.indexOf('chrM')
		//     this.hic.chrlst.splice(idx, 1)
		// }
	}
}

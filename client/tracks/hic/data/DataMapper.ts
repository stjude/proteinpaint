export class DataMapper {
	hic: any

	constructor(hic: any) {
		this.hic = hic
	}

	sortData(data: any) {
		const vlst: number[] = []
		if (data?.items && data?.items.length) {
			//chrpair view
			//eventually horizontal and detail view
			for (const i of data.items) {
				vlst.push(i[2])
			}
		} else {
			//genome view
			let countBlankM = 0
			for (const d of data) {
				/** Addresses the nagging problem if no data is present for M chr, not to render
				 * squares for chrM-chr*. Errors still appear for the user.
				 * TODO: Move to server side???
				 */
				if (d?.lead == 'chrM' || (d?.lead == 'chrY' && !d.items.length)) {
					countBlankM++
					continue
				}
				for (const i of d.items) {
					vlst.push(i[2])
				}
			}

			if (countBlankM == 25) {
				const idx = this.hic.chrlst.indexOf('chrM')
				this.hic.chrlst.splice(idx, 1)
			}
		}

		// //Do not use Math.min() or Math.max(). Causes stack overflow
		const sortedVlst = vlst.sort((a: number, b: number) => a - b)
		const max = sortedVlst[Math.floor(sortedVlst.length * 0.99)] as number
		const min = sortedVlst[0]
		return [Math.floor(min), Math.floor(max)]
	}
}

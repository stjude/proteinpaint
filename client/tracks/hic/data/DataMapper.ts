export class DataMapper {
	hic: any

	constructor(hic: any) {
		this.hic = hic
	}

	sortData(data: any) {
		const vlst: number[] = []
		if (data?.items && data?.items.length) {
			//chrpair and detail views
			for (const i of data.items) {
				vlst.push(i[2])
			}
		} else {
			//genome view
			const blankChrs = new Set()
			for (const d of data) {
				/** Addresses the nagging problem if no data is present for M chr, not to render
				 * squares for chrM-chr*. Errors still appear for the user.
				 * TODO: Move to server side???
				 */
				if ((d.lead == 'chrM' && !d.items.length) || (d.lead == 'chrY' && !d.items.length)) {
					blankChrs.add(d.lead)
					continue
				}
				for (const i of d.items) {
					vlst.push(i[2])
				}
			}
			if (blankChrs.size) {
				for (const c of blankChrs) {
					const idx = this.hic.chrlst.indexOf(c)
					this.hic.chrlst.splice(idx, 1)
				}
			}
		}

		// Do not use Math.min() or Math.max(). Causes stack overflow
		const sortedVlst = vlst.sort((a: number, b: number) => a - b)
		const max = sortedVlst[Math.floor(sortedVlst.length * 0.99)] as number
		const min = sortedVlst[0]
		return [min, max]
	}
}

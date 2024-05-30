type Items = { rest: string[]; chr: string; start: number; stop: number; rglst: any }

export class ParseFragData {
	id2coord = new Map()
	min: number | null = null
	max: number | null = null
	items: Items[] = []
	errLst: string[]

	constructor(errLst: string[], items: Items[]) {
		this.errLst = errLst

		for (const i of items) {
			// id of first fragment
			if (!i.rest || !i.rest[0]) {
				this.errLst.push('items[].rest data problem')
			}
			const id = Number.parseInt(i.rest[0])
			if (Number.isNaN(id)) {
				this.errLst.push(`${i.start}.${i.stop} invalid fragment id: ${i.rest[0]}`)
			}
			this.id2coord.set(id, [i.start, i.stop])
			if (this.min == null) {
				this.min = id
				this.max = id
			} else {
				this.min = Math.min(this.min, id)
				this.max = Math.max(this.max as number, id)
			}
		}
	}
}

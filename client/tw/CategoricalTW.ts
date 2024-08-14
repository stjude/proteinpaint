import { CategoricalTW, TermGroupSetting, QGroupSetting } from '#types'
import { RootTW, TwInitOpts } from './RootTW.ts'

export type PartialCatTW = {
	id?: string
	term?: {
		type: 'categorical'
		id: string
		name?: string
		values?:
			| {
					[key: string | number]: { label?: string; key?: string }
			  }
			| Record<string, never>
		groupsetting?: TermGroupSetting
	}
	q?: {
		type?: string
		isAtomic: true
		groupsetting?: QGroupSetting // deprecated nested object, must support and reapply to root q object
	}
}

export class CategoricalBase extends RootTW {
	tw: CategoricalTW
	opts: TwInitOpts

	constructor(tw: CategoricalTW, opts: TwInitOpts) {
		super()
		this.tw = tw
		this.opts = opts
	}

	static async init(partialTw: PartialCatTW, opts?: TwInitOpts) {
		const tw = await CategoricalBase.fill(partialTw)
		return new CategoricalBase(tw, opts || {})
	}

	static async fill(tw: PartialCatTW): Promise<CategoricalTW> {
		if (tw.term?.type != 'categorical') throw `incorrect term.type='${tw.term?.type}', expecting 'categorical'`
		if (!tw.id && !tw.term?.id) throw 'missing tw.id and tw.term.id'
		//if (!tw.q.type) tw.q = {...tw.q, ...defaultQ}
		return {
			id: tw.term?.id || 'aaa',
			term: {
				type: 'categorical',
				id: tw.term?.id || 'test',
				name: tw.term?.name || tw.term?.id || 'test',
				values: tw.term?.values || {},
				groupsetting: {
					...{ useIndex: 0, lst: [] },
					...(tw.term?.groupsetting || {})
				}
			},
			q: !tw.q ? { type: 'values' } : tw.q
		}
	}
}

import { CategoricalTW, TermGroupSetting, QGroupSetting } from '#types'
import { RootTW } from './RootTW.ts'

type PartialCatTW = {
	id: string
	term: {
		type: 'categorical'
		id: string
		name?: string
		values
		groupsetting?: TermGroupSetting
	}
	q?: {
		type?: string
		isAtomic: true
		groupsetting?: QGroupSetting // deprecated nested object, must support and reapply to root q object
	}
}

export class CategoricalBase extends RootTW {
	static async fill(tw: PartialCatTW): Promise<CategoricalTW> {
		if (!tw.id && !tw.term.id) throw 'missing tw.id and tw.term.id'
		//if (!tw.q.type) tw.q = {...tw.q, ...defaultQ}
		return {
			id: tw.term.id,
			term: {
				type: 'categorical',
				id: tw.term.id,
				name: tw.term.name || tw.term.id,
				values: tw.term.values || {},
				groupsetting: {
					...{ useIndex: 0, lst: [] },
					...(tw.term.groupsetting || {})
				}
			},
			q: !tw.q ? { type: 'values' } : tw.q
		}
	}
}

import { TermWrapper, Q } from '#updated-types'
import { Term } from '#types'

export type TwOpts = {
	vocabApi?: any // TODO
	defaultQ?: any // TODO
	defaultQByTsHandler?: any // TODO
	//usecase?: any // TODO
}

export class TwBase {
	$id?: string
	isAtomic: true

	constructor(tw: TermWrapper, opts: TwOpts) {
		this.isAtomic = true
		if (tw.$id) this.$id = tw.$id
	}

	static setHiddenValues(q: Q, term: Term) {
		if (q.hiddenValues) return
		q.hiddenValues = {}
		// by default, fill-in with uncomputable values
		if (term.values) {
			for (const k in term.values) {
				if (term.values[k].uncomputable) q.hiddenValues[k] = 1
			}
		}
	}
}

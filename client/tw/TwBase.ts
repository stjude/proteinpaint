import { TermWrapper, Q } from '#updated-types'
import { Term } from '#types'

export type TwOpts = {
	vocabApi?: any // TODO
	defaultQ?: any // TODO
	//usecase?: any // TODO
}

export class TwBase {
	$id?: string
	isAtomic: true

	constructor(tw: TermWrapper, opts: TwOpts) {
		this.isAtomic = true
		if (tw.$id) this.$id = tw.$id
	}
}

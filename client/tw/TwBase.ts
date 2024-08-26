import { TermWrapper, Q } from '#updated-types'
import { Term } from '#types'
import { HandlerOpts } from './Handler'

export class TwBase {
	term: Term
	q: Q
	$id?: string
	isAtomic: true

	// #tw: TermWrapper
	// #opts: HandlerOpts

	constructor(tw: TermWrapper, opts) {
		this.term = tw.term
		this.q = tw.q
		this.isAtomic = true
		if (tw.$id) this.$id = tw.$id
	}
}

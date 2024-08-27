import { TermWrapper, Q } from '#updated-types'
import { Term } from '#types'
import { HandlerOpts } from './Handler'

export class TwBase {
	$id?: string
	isAtomic: true

	constructor(tw: TermWrapper, opts) {
		this.isAtomic = true
		if (tw.$id) this.$id = tw.$id
	}
}

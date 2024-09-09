import { TermWrapper, Q } from '#updated-types'
import { Term } from '#types'
import { SetCellPropsSignature } from '../plots/matrix.xtw'

export type TwOpts = {
	vocabApi?: any // TODO
	defaultQ?: any // TODO
	defaultQByTsHandler?: any // TODO
	addons?: {
		[TwTypeName: string]: {
			[methodName: string]: {
				value: (a: any) => any // required nested shape for native Object.defineProperties()
			}
			// | ((a: any) => any) // for convenience, not supported yet
		}
	}
	//usecase?: any // TODO
}

export class TwBase {
	type: string
	$id?: string
	isAtomic = true

	// define addons below, to be set using Object.defineProperties(this)
	// by defining allowed method names here, subclasses that inherit from
	// TwBase will be type checked
	setCellProps!: SetCellPropsSignature

	constructor(tw: TermWrapper, opts: TwOpts) {
		this.type = tw.type
		this.isAtomic = true
		if (tw.$id) this.$id = tw.$id
		// By using Object.defineProperties(), addon methods are not enumerable
		// and makes the xtw instance compatible with structuredClone(),
		// in contrast to using Object.assign()
		if (opts.addons?.[this.type]) {
			Object.defineProperties(this, opts.addons[this.type])
		}
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

	render(a: any): any {
		console.log(a)
		throw `should implement this method in subclass code, as needed`
	}
}

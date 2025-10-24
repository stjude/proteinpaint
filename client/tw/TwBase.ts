import type { Term, TermWrapper, Q } from '#types'
import type { SetCellPropsSignature } from '../plots/matrix/matrix.xtw.ts'
import { type UseCase } from '#termsetting'

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

	// TODO: may need to track these matrix specific tw props elsewhere
	sortSamples?: any
	minNumSamples?: number
	valueFilter?: any

	constructor(tw: TermWrapper, opts: TwOpts) {
		this.type = tw.type
		this.isAtomic = true
		if (tw.$id) this.$id = tw.$id
		if (tw.sortSamples) this.sortSamples = tw.sortSamples
		if (tw.minNumSamples) this.minNumSamples = tw.minNumSamples
		if (tw.valueFilter) this.valueFilter = tw.valueFilter

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

	getStatus(_?: UseCase, __?: any) {
		//if (_) {}
		return { text: '' }
	}
}

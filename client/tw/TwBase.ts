import type { Term, TermWrapper, Q } from '#types'
import type { SetCellPropsSignature } from '../plots/matrix/matrix.xtw.ts'
import { type UseCase } from '#termsetting'
import { isDictionaryType } from '#shared'
import { deepFreeze } from '#rx'

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
	$id: string
	isAtomic = true
	#tw: TermWrapper
	#isFrozen = false

	// define addons below, to be set using Object.defineProperties(this)
	// by defining allowed method names here, subclasses that inherit from
	// TwBase will be type checked
	setCellProps!: SetCellPropsSignature

	// TODO: may need to track these matrix specific tw props elsewhere
	sortSamples?: any
	minNumSamples?: number
	valueFilter?: any

	constructor(tw: TermWrapper, opts: TwOpts) {
		this.#tw = tw
		this.type = tw.type
		this.isAtomic = true
		this.$id = typeof tw.$id == 'string' ? tw.$id : get$id()
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

	getTw() {
		return this.#tw
	}

	render(a: any): any {
		console.log(a)
		throw `should implement this method in subclass code, as needed`
	}

	getStatus(_?: UseCase, __?: any) {
		//if (_) {}
		return { text: '' }
	}

	getMinCopy(override: any = {}) {
		const tw = this.#tw
		const copy: any = { term: {}, q: structuredClone(override.q || tw.q) }
		if (tw.$id) copy.$id = tw.$id
		if (tw.term) {
			if (isDictionaryType(tw.term.type)) {
				// dictionary term
				if (tw.term.id) copy.term.id = tw.term.id
				if (tw.term.name) copy.term.name = tw.term.name
				if (tw.term.type) copy.term.type = tw.term.type
				//if (tw.term.values) copy.term.values = tw.term.values
				if ((tw.term as any).groupsetting) copy.term.groupsetting = (tw.term as any).groupsetting
			} else {
				// non-dictionary term
				// pass entire tw.term because non-dictionary terms
				// cannot get rehydrated on server-side
				copy.term = structuredClone(tw.term)
				// dummy preset bins should not affect the uniqueness of a request payload
				if (copy.term.bins?.default?.isDummyPreset) delete copy.term.bins
			}
		}
		if (copy.q) {
			delete copy.q.isAtomic
		}
		return copy
	}

	deepFreeze() {
		if (this.#isFrozen) return this
		deepFreeze(this)
		this.#isFrozen = true
		return this
	}
}

const idSuffix = `_${Math.random().toString().slice(-5)}_${Date.now().toString().slice(-8, -3)}`
let i = 0

function get$id(): string {
	return `TwBase_${i++}_${idSuffix}`
}

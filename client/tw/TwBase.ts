import { TermWrapper, Q } from '@sjcrh/proteinpaint-types/updated'
import type { Term } from '#types'
import { SetCellPropsSignature } from '../plots/matrix/matrix.xtw.ts'

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

	#tw: TermWrapper
	#opts: TwOpts
	#groupsConfig: any

	// define addons below, to be set using Object.defineProperties(this)
	// by defining allowed method names here, subclasses that inherit from
	// TwBase will be type checked
	setCellProps!: SetCellPropsSignature

	// TODO: may need to track these matrix specific tw props elsewhere
	sortSamples?: any
	minNumSamples?: number
	valueFilter?: any

	constructor(tw: TermWrapper, opts: TwOpts = {}) {
		this.type = tw.type
		this.isAtomic = true
		if (tw.$id) this.$id = tw.$id
		// instance methods and private props will not be JSON.stringified(),
		// important to ignore when saving state
		this.#tw = tw
		this.#opts = opts
		if (tw.sortSamples) this.sortSamples = tw.sortSamples
		if (tw.minNumSamples) this.minNumSamples = tw.minNumSamples
		if (tw.valueFilter) this.valueFilter = tw.valueFilter

		this.#groupsConfig = {
			minGrpNum: 3,
			maxGrpNum: 5,
			groups: [],
			values: [],
			filters: []
		}

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

	showEditMenu() {
		//ignore
	}

	getPillStatus() {
		//ignore
	}

	getPillName() {
		const name = this.#tw.term.name
		if (!this.#opts.abbrCutoff) return name
		return name.length <= this.#opts.abbrCutoff + 2
			? name
			: '<label title="' + name + '">' + name.substring(0, this.#opts.abbrCutoff) + '...' + '</label>'
	}
}

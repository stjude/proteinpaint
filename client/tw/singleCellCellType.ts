import type { RawSingleCellCellTypeTerm, SingleCellCellTypeTerm, TermGroupSetting, TermValues } from '#types'

const termType = 'singleCellCellType'

export class SingleCellCellTypeBase {
	type = termType
	sample: string
	plot: string
	groupsetting: TermGroupSetting
	values: TermValues

	// option to fill-in/mutate the input raw term object in-place
	// - does not have to construct, but may require forced type casting in consumer code
	static fill(term: RawSingleCellCellTypeTerm) {
		if (term instanceof SingleCellCellTypeBase) return
		SingleCellCellTypeBase.validate(term)
		if (!term.groupsetting) term.groupsetting = { disabled: false }
		if (!term.values) term.values = {}
	}

	static validate(term: RawSingleCellCellTypeTerm) {
		if (typeof term !== 'object') throw new Error('term is not an object')
		if (term.type != termType) throw new Error(`incorrect term.type='${term?.type}', expecting '${termType}'`)
		if (!term?.sample) throw new Error('missing term.sample')
		if (!term?.plot) throw new Error('missing term.plot')
	}

	// option to construct an object instance and not mutate the input raw term
	// - will be used instead of tw.term literal object
	constructor(term: RawSingleCellCellTypeTerm | SingleCellCellTypeTerm) {
		SingleCellCellTypeBase.validate(term)
		this.sample = term.sample
		this.plot = term.plot
		this.groupsetting = term.groupsetting || { disabled: false }
		this.values = term.values || {}
	}
}

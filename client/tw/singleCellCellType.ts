import type { RawSingleCellCellTypeTerm, SingleCellCellTypeTerm, TermGroupSetting, TermValues } from '#types'
import { SINGLECELL_CELLTYPE } from '#shared/terms.js'

const termType = SINGLECELL_CELLTYPE

export class SingleCellCellTypeBase {
	type = termType
	sample: object
	plot?: string
	groupsetting: TermGroupSetting
	values: TermValues

	static fill(term: RawSingleCellCellTypeTerm) {
		if (term instanceof SingleCellCellTypeBase) return
		SingleCellCellTypeBase.validate(term)
		if (!term.groupsetting) term.groupsetting = { disabled: false }
		if (!term.values) term.values = {}
		/** Normalize native and gdc sample objects. Use sID as sample key */
		if (typeof term.sample == 'string') term.sample = { sID: term.sample }
	}

	static validate(term: RawSingleCellCellTypeTerm) {
		if (!term || typeof term !== 'object') throw new Error('term is not an object')
		if (term.type != termType) throw new Error(`incorrect term.type='${term?.type}', expecting '${termType}'`)
		if (!term?.sample) throw new Error('missing term.sample')
		// if (!term?.plot) throw new Error('missing term.plot')
	}

	constructor(term: RawSingleCellCellTypeTerm | SingleCellCellTypeTerm) {
		SingleCellCellTypeBase.validate(term)
		this.sample = term.sample
		this.plot = term.plot || ''
		this.groupsetting = term.groupsetting || { disabled: false }
		this.values = term.values || {}
	}
}

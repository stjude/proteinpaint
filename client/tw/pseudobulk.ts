import { type PseudobulkTerm, type RawPseudobulkTerm, PseudobulkAssay } from '#types'
import { PSEUDOBULK } from '#shared/terms.js'

const termType = PSEUDOBULK

export class PseudobulkBase {
	type = termType
	assay: (typeof PseudobulkAssay)[number]
	memberId: string
	category: string
	gene: string

	static fill(term: RawPseudobulkTerm) {
		if (term instanceof PseudobulkBase) return
		PseudobulkBase.validate(term)
		return term as PseudobulkTerm
	}

	static validate(term: RawPseudobulkTerm) {
		if (!term || typeof term !== 'object') throw new Error('term is not an object')
		if (term.type != termType) throw new Error(`incorrect term.type='${term?.type}', expecting '${termType}'`)
		if (!term.assay || !PseudobulkAssay.includes(term.assay)) throw new Error('term.assay is missing or invalid')
		if (!term.memberId || typeof term.memberId !== 'string') throw new Error('term.memberId is missing or not a string')
		if (!term.category || typeof term.category !== 'string') throw new Error('term.category is missing or not a string')
		if (!term.gene || typeof term.gene !== 'string') throw new Error('term.gene is missing or not a string')
	}

	constructor(term: RawPseudobulkTerm | PseudobulkTerm) {
		PseudobulkBase.validate(term)
		this.assay = term.assay
		this.memberId = term.memberId
		this.category = term.category
		this.gene = term.gene
	}
}

import { type PseudobulkTerm, type RawPseudobulkTerm, PseudobulkAssay  } from '#types'
import { PSEUDOBULK } from '#shared/terms.js'

const termType = PSEUDOBULK

export class PseudobulkBase {
    type = termType
    assay: typeof PseudobulkAssay
    termid: string

    static fill(term: RawPseudobulkTerm) {
        if (term instanceof PseudobulkBase) return
        PseudobulkBase.validate(term)
    }

    static validate(term: RawPseudobulkTerm) {
        if (!term || typeof term !== 'object') throw new Error('term is not an object')
        if (term.type != termType) throw new Error(`incorrect term.type='${term?.type}', expecting '${termType}'`)
        if (!term.assay || typeof term.assay !== typeof PseudobulkAssay ) throw new Error('term.assay is missing or not a string')
        if (!term.termid || typeof term.termid !== 'string') throw new Error('term.termid is missing or not a string')
    }

    constructor(term: RawPseudobulkTerm | PseudobulkTerm) {
        PseudobulkBase.validate(term)
        this.assay = term.assay
        this.termid = term.termid
    }
}
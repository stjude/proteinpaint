import { type TwOpts } from './TwBase.ts'
import type { RawIsoformExpTerm } from '#types'

const termType = 'isoformExpression'

export class IsoformExpBase {
	isoform: string
	name: string
	unit: string

	// option to fill-in/mutate the input raw term object in-place
	static async fill(term: RawIsoformExpTerm, opts: TwOpts) {
		IsoformExpBase.validate(term)
		if (!term.name) {
			term.unit = opts.vocabApi.termdbConfig.queries.isoformExpression?.unit || 'Isoform Expression'
			const name = `${term.isoform} ${term.unit}`
			term.name = name
		}
	}

	static validate(term: RawIsoformExpTerm) {
		if (typeof term !== 'object') throw 'term is not an object'
		if (term.type != termType) throw `incorrect term.type='${term?.type}', expecting '${termType}'`
		if (!term.isoform && !term.name) throw 'no isoform or name present'
		if (!term.isoform || typeof term.isoform != 'string')
			throw 'isoformExpression term.isoform must be non-empty string'
	}

	constructor(term: RawIsoformExpTerm, opts: TwOpts) {
		IsoformExpBase.validate(term)
		this.isoform = term.isoform || term.name
		this.unit = term.unit || opts.vocabApi.termdbConfig.queries.isoformExpression?.unit || 'Isoform Expression'
		this.name = term.name || `${term.isoform} ${this.unit}`
	}
}

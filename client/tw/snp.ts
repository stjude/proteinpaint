import type { RawSnpTerm, SnpTerm, TermGroupSetting, TermValues } from '#types'

const termType = 'snp'

export class SnpBase {
	type = termType
	id: string
	name: string
	chr: string
	start: number
	stop: number
	ref: string
	alt: string[]
	groupsetting: TermGroupSetting
	values: TermValues

	// option to fill-in/mutate the input raw term object in-place
	// - does not have to construct, but may require forced type casting in consumer code
	static fill(term: RawSnpTerm) {
		if (term instanceof SnpBase) return
		SnpBase.validate(term)
		if (!term.groupsetting) term.groupsetting = { disabled: false }
		if (!term.values) term.values = {}
	}

	static validate(term: RawSnpTerm) {
		if (typeof term !== 'object') throw 'term is not an object'
		if (term.type != termType) throw `incorrect term.type='${term?.type}', expecting '${termType}'`
		if (!term.id || !term.name) throw 'missing snp id/name'
		if (!term.chr || !Number.isInteger(term.start) || !Number.isInteger(term.stop))
			throw 'incomplete position information'
		if (!term.ref || !term.alt) throw 'missing allele information'
	}

	// option to construct an object instance and not mutate the input raw term
	// - will be used instead of tw.term literal object
	constructor(term: RawSnpTerm | SnpTerm) {
		SnpBase.validate(term)
		this.id = term.id
		this.name = term.name
		this.chr = term.chr
		this.start = term.start
		this.stop = term.stop
		this.ref = term.ref
		this.alt = term.alt
		this.groupsetting = term.groupsetting || { disabled: false }
		this.values = term.values || {}
	}
}

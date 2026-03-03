import type { RawTermCollection, TermCollection as TermCollectionType } from '#types'
import { type TwOpts } from '../TwBase'

const termType = 'termCollection'

// This is for the term, not tw
export class TermCollection {
	type = termType
	memberType: 'numeric' | 'categorical' = 'numeric'
	id: string
	name: string
	termIds?: string[]
	termlst: object[]
	propsByTermId: {
		[termId: string]: {
			[prop: string]: any
		}
	}

	// option to fill-in/mutate the input raw term object in-place
	// - does not have to construct, but may require forced type casting in consumer code
	static fill(term: RawTermCollection, opts: TwOpts = {}) {
		if (term instanceof TermCollection) return
		if (!opts.vocabApi?.termdbConfig?.termCollections)
			throw `missing vocabApi.termdbConfig.termCollections argument for fill()`
		const tc = opts.vocabApi.termdbConfig.termCollections.find(
			c => c.name == term.collectionId || c.name == term.id || c.name == term.name || term.name?.includes(c.name)
		)
		if (!tc) throw new Error(`no matching termCollection for for ${term.collectionId}`)
		if (!Array.isArray(tc.termIds)) throw new Error(`missing termCollection.termIds for '${tc.name}'`)
		if (!Array.isArray(tc.termlst)) throw new Error('missing tc.termlst[]')
		if (tc.termIds.length == 0) throw new Error('empty termIds[]')
		if (tc.termIds.length != tc.termlst.length) throw new Error('tc.termIds.length!=tc.termlst.length')
		if (!tc.propsByTermId) throw new Error(`propsByTermId missing for termCollection='${tc.name}'`)
		if (!term.propsByTermId) term.propsByTermId = tc.propsByTermId // assign if missing
		term.memberType = tc.type
		if (tc.type === 'categorical' && tc.categoryKeys) term.categoryKeys = tc.categoryKeys
		if (!term.termIds) term.termIds = term.termlst.map((t: any) => t.id)
		for (const t of term.termlst) {
			if (!term.propsByTermId[t.id]) term.propsByTermId[t.id] = tc.propsByTermId[t.id]
		}
		TermCollection.validate(term)
	}

	static validate(term: RawTermCollection | TermCollectionType) {
		if (typeof term !== 'object') throw 'term is not an object'
		if (term.type != termType) throw `incorrect term.type='${term?.type}', expecting '${termType}'`
	}

	// option to construct an object instance and not mutate the input raw term
	// - will be used instead of tw.term literal object
	constructor(term: TermCollectionType) {
		TermCollection.validate(term)
		this.id = term.id
		this.name = term.name
		this.memberType = term.memberType
		this.termlst = term.termlst
		this.termIds = term.termIds
		this.propsByTermId = term.propsByTermId || {}
	}
}

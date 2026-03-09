import type { RawNumericTermCollection, NumericTermCollection as NumericTermCollectionType } from '#types'
import { type TwOpts } from '../TwBase'

const termType = 'termCollection'

/** Term class for numeric termCollections (memberType: 'numeric') */
export class NumericTermCollection {
	readonly type = termType
	readonly memberType = 'numeric' as const
	id: string
	name: string
	termIds?: string[]
	termlst: object[]
	propsByTermId: {
		[termId: string]: {
			[prop: string]: any
		}
	}
	numerators?: string[]

	// Mutates the raw term object in-place; routes from CollectionCont.fill()
	static fill(term: RawNumericTermCollection, opts: TwOpts = {}) {
		if (term instanceof NumericTermCollection) return
		if (!opts.vocabApi?.termdbConfig?.termCollections)
			throw `missing vocabApi.termdbConfig.termCollections argument for fill()`
		const tc = opts.vocabApi.termdbConfig.termCollections.find(
			(c: { name: string }) => c.name === term.name || term.name?.startsWith(c.name + ' (')
		)
		if (tc) {
			if (!Array.isArray(tc.termIds)) throw new Error(`missing termCollection.termIds for '${tc.name}'`)
			if (!Array.isArray(tc.termlst)) throw new Error('missing tc.termlst[]')
			if (tc.termIds.length == 0) throw new Error('empty termIds[]')
			if (tc.termIds.length != tc.termlst.length) throw new Error('tc.termIds.length!=tc.termlst.length')
			if (!tc.propsByTermId) throw new Error(`propsByTermId missing for termCollection='${tc.name}'`)
			if (!term.propsByTermId) term.propsByTermId = tc.propsByTermId
			if (!term.termlst) term.termlst = tc.termlst
			term.name = tc.name // normalize legacy display-label to canonical config name
			const propsByTermId = term.propsByTermId!
			for (const t of term.termlst!) {
				if (!propsByTermId[(t as any).id]) propsByTermId[(t as any).id] = tc.propsByTermId[(t as any).id]
			}
		} else if (!term.termlst?.length) {
			throw new Error(`no matching termCollection for '${term.name}'`)
		}
		term.memberType = 'numeric'
		if (!term.termIds) term.termIds = term.termlst!.map((t: any) => t.id)
		NumericTermCollection.validate(term)
	}

	static validate(term: RawNumericTermCollection | NumericTermCollectionType) {
		if (typeof term !== 'object') throw 'term is not an object'
		if (term.type != termType) throw `incorrect term.type='${term?.type}', expecting '${termType}'`
	}

	constructor(term: NumericTermCollectionType) {
		NumericTermCollection.validate(term)
		this.id = term.id
		this.name = term.name
		this.termlst = term.termlst
		this.termIds = term.termIds
		this.propsByTermId = term.propsByTermId || {}
		this.numerators = term.numerators
	}
}

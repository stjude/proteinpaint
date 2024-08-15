import { TermWrapper, RawTW } from '#types'
import { mayHydrateDictTwLst } from '../termsetting/termsetting.ts'

export type UseCase = {
	target: string
	detail: string
}

export type TwInitOpts = {
	useCase?: UseCase
}

export class RootTW {
	static async fill(tw /*: RawTW*/, vocabApi?: any): Promise<TermWrapper> {
		const keys = Object.keys(tw)
		if (!keys.length) throw `empty tw object`
		if (tw.id && !tw.term) {
			// for dev work, testing, and URLs, it's convenient to only specify tw.id for a dictionary tw,
			// must support creating a hydrated tw.term from a minimal dict tw
			await mayHydrateDictTwLst([tw], vocabApi)
		}

		if (!tw.q) tw.q = {}
		tw.q.isAtomic = true

		switch (tw.term.type) {
			case 'categorical': {
				const { CategoricalBase } = await import('./CategoricalTW.ts')
				if (!tw.term.id) throw 'missing tw.term.id'
				return await CategoricalBase.fill(tw, vocabApi)
			}
			// case 'integer':
			// case 'float':
			// 	return

			// case 'condition':
			// 	return

			// case 'survival':
			// 	return

			// case 'geneVariant':
			// 	return

			// case 'geneExpression':
			// 	return

			default:
				throw `unrecognized tw.term?.type='${tw.term?.type}'`
		}
	}
}

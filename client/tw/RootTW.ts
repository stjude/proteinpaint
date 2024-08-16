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
		reshapeLegacyTw(tw)

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

// check for legacy tw structure that could be
// present in old saved sessions
function reshapeLegacyTw(tw) {
	// check for legacy q.groupsetting{}
	if (Object.keys(tw.q).includes('groupsetting')) {
		if (!tw.q.groupsetting.inuse) {
			tw.q.type = 'values'
		} else if (tw.q.type == 'predefined-groupset') {
			tw.q.predefined_groupset_idx = tw.q.groupsetting.predefined_groupset_idx
		} else if (tw.q.type == 'custom-groupset') {
			tw.q.customset = tw.q.groupsetting.customset
		} else {
			throw 'invalid q.type'
		}
		delete tw.q['groupsetting']
	}
}

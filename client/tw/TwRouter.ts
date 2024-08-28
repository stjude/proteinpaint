import { TermWrapper } from '#updated-types'
import { TwOpts } from './TwBase'
import { mayHydrateDictTwLst } from '../termsetting/termsetting.ts'
import { CategoricalRouter } from './CategoricalRouter'
import { CatValues, CatPredefinedGS, CatCustomGS, CatInstance, CatTypes } from './categorical'

export type TwHandlerInstance = CatInstance // | NumericHandlerInstance | ...
export type HandlerTypes = CatTypes // | ...

export type UseCase = {
	target: string
	detail: string
}

export type TwInitOpts = {
	useCase?: UseCase
}

export class TwRouter {
	opts: any

	constructor(opts) {
		this.opts = opts
	}

	static init(tw: TermWrapper, opts: TwOpts = {}): TwHandlerInstance {
		switch (tw.type) {
			case 'CatTWValues':
				return new CatValues(tw, opts)
			case 'CatTWPredefinedGS':
				return new CatPredefinedGS(tw, opts)
			case 'CatTWCustomGS':
				return new CatCustomGS(tw, opts)

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
				throw `unable to init(tw)`
		}
	}

	static async initRaw(rawTw /*: RawTW*/, opts: TwOpts = {}): Promise<TwHandlerInstance> {
		const tw = await TwRouter.fill(rawTw, opts)
		return TwRouter.init(tw, opts)
	}

	static async fill(tw /*: RawTW*/, opts: TwOpts = {}): Promise<TermWrapper> {
		await TwRouter.preprocess(tw, opts?.vocabApi)

		switch (tw.term.type) {
			case 'categorical': {
				return await CategoricalRouter.fill(tw, opts)
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

	// can reuse this function to generate valid preprocessed tw
	// for term-type specific unit tests
	static async preprocess(tw /*: RawTW*/, vocabApi?: any) {
		const keys = Object.keys(tw)
		if (!keys.length) throw `empty tw object`
		if (tw.id && !tw.term) {
			// for dev work, testing, and URLs, it's convenient to only specify tw.id for a dictionary tw,
			// must support creating a hydrated tw.term from a minimal dict tw
			await mayHydrateDictTwLst([tw], vocabApi)
			delete tw.id
		}

		if (!tw.q) tw.q = {}
		tw.q.isAtomic = true
		TwRouter.reshapeLegacyTw(tw)
	}

	// check for legacy tw structure that could be
	// present in old saved sessions
	static reshapeLegacyTw(tw) {
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
}

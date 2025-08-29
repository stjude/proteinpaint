import type { TermWrapper } from '#types'
import type { TwOpts, TwBase } from './TwBase'
import { mayHydrateDictTwLst } from '../termsetting/termsetting.ts'
// TODO: may convert these to dynamic imports
import { CategoricalBase, CatValues, CatPredefinedGS, CatCustomGS } from './categorical.ts'
import { GvBase, GvPredefinedGS, GvCustomGS } from './geneVariant.ts'
import { GeneExpBase } from './geneExpression.ts'
import { NumericBase, NumRegularBin, NumCustomBins, NumCont } from './numeric.ts'
import { DateBase } from './date.ts'

export const routedTermTypes = new Set([
	'categorical',
	'integer',
	'float',
	'geneVariant',
	'geneExpression',
	'date',
	'metaboliteIntensity'
])

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

	static init(tw: TermWrapper, opts: TwOpts = {}): TwBase {
		switch (tw.type) {
			case 'CatTWValues':
				return new CatValues(tw, opts)
			case 'CatTWPredefinedGS':
				return new CatPredefinedGS(tw, opts)
			case 'CatTWCustomGS':
				return new CatCustomGS(tw, opts)

			case 'NumTWRegularBin':
				return new NumRegularBin(tw, opts)
			case 'NumTWCustomBin':
				return new NumCustomBins(tw, opts)
			case 'NumTWCont':
				return new NumCont(tw, opts)

			case 'GvPredefinedGsTW':
				return new GvPredefinedGS(tw, opts)
			case 'GvCustomGsTW':
				return new GvCustomGS(tw, opts)

			default:
				// console.log(46, tw)
				throw `unable to init(tw)`
		}
	}

	static async initRaw(rawTw /*: RawTW*/, opts: TwOpts = {}): Promise<TwBase> {
		const tw = await TwRouter.fill(rawTw, opts)
		return TwRouter.init(tw, opts)
	}

	static async fill(tw /*: RawTW*/, opts: TwOpts = {}): Promise<TermWrapper> {
		await TwRouter.preprocess(tw, opts?.vocabApi)
		const type = tw.term.type == 'float' || tw.term.type == 'integer' ? 'numeric' : tw.term.type
		opts.defaultQ = opts.defaultQByTsHandler?.[type] || null

		switch (tw.term.type) {
			case 'categorical': {
				return await CategoricalBase.fill(tw, opts)
			}
			case 'integer':
			case 'float':
				return await NumericBase.fill(tw, opts)

			case 'geneExpression':
				return await GeneExpBase.fill(tw, opts)

			// case 'condition':
			// 	return

			// case 'survival':
			// 	return

			case 'geneVariant':
				return await GvBase.fill(tw, opts)

			case 'date':
				return await DateBase.fill(tw, opts)

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

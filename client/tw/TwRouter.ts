import type { TermWrapper } from '#types'
import type { TwOpts, TwBase } from './TwBase'
import { mayHydrateDictTwLst } from '#termsetting'
// TODO: may convert these to dynamic imports
import { QualValues, QualPredefinedGS, QualCustomGS } from './qualitative.ts'
import { GvBase, GvPredefinedGS, GvCustomGS } from './geneVariant.ts'
import { NumericBase } from './numeric.ts'

export const routedTermTypes = new Set([
	'categorical',
	'integer',
	'float',
	'geneVariant',
	'geneExpression',
	'date',
	'metaboliteIntensity',
	'ssGSEA',
	'snp',
	'singleCellGeneExpression',
	'singleCellCellType'
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

	static async init(tw: TermWrapper, opts: TwOpts = {}): Promise<TwBase> {
		switch (tw.type) {
			case 'NumTWRegularBin': {
				const { NumRegularBin } = await import('./NumRegularBin.ts')
				return new NumRegularBin(tw, opts)
			}
			case 'NumTWCustomBin': {
				const { NumCustomBins } = await import('./NumCustomBins.ts')
				return new NumCustomBins(tw, opts)
			}
			case 'NumTWCont': {
				const { NumCont } = await import('./NumCont.ts')
				return new NumCont(tw, opts)
			}
			case 'NumTWSpline': {
				const { NumSpline } = await import('./NumSpline.ts')
				return new NumSpline(tw, opts)
			}
			case 'GvPredefinedGsTW':
				return new GvPredefinedGS(tw, opts)
			case 'GvCustomGsTW':
				return new GvCustomGS(tw, opts)

			case 'QualTWValues':
				return new QualValues(tw, opts)
			case 'QualTWPredefinedGS':
				return new QualPredefinedGS(tw, opts)
			case 'QualTWCustomGS':
				return new QualCustomGS(tw, opts)

			default:
				throw `unable to init(tw)`
		}
	}

	static async initRaw(rawTw /*: RawTW*/, opts: TwOpts = {}): Promise<TwBase> {
		const tw = await TwRouter.fill(rawTw, opts)
		return await TwRouter.init(tw, opts)
	}

	static async fill(tw /*: RawTW*/, opts: TwOpts = {}): Promise<TermWrapper> {
		await TwRouter.preprocess(tw, opts?.vocabApi)
		const type = tw.term.type == 'float' || tw.term.type == 'integer' ? 'numeric' : tw.term.type
		opts.defaultQ = opts.defaultQByTsHandler?.[type] || null

		switch (tw.term.type) {
			case 'categorical':
			case 'singleCellCellType':
			case 'snp': {
				const { QualitativeBase } = await import('./qualitative')
				return await QualitativeBase.fill(tw, opts)
			}

			case 'integer':
			case 'float':
			case 'geneExpression':
			case 'metaboliteIntensity':
			case 'date':
			case 'ssGSEA':
			case 'singleCellGeneExpression':
				return await NumericBase.fill(tw, opts)

			// case 'condition':
			// 	return

			// case 'survival':
			// 	return

			case 'geneVariant':
				return await GvBase.fill(tw, opts)

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

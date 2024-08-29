import {
	CategoricalTerm,
	CategoricalQ,
	CatTWTypes,
	ValuesQ,
	PredefinedGroupSettingQ,
	CustomGroupSettingQ,
	NumericTerm,
	NumTWTypes,
	NumTWDiscreteTypes,
	NumTWCont,
	RegularNumericBinConfig,
	CustomNumericBinConfig,
	ContinuousNumericQ
} from '#types'
import { TwBase } from './TwBase'

export type DiscreteTWTypes = CatTWTypes | NumTWDiscreteTypes

export class DiscreteBase extends TwBase {
	term: CategoricalTerm | NumericTerm // | GeneVariantTerm | ...
	q: CategoricalQ | RegularNumericBinConfig | CustomNumericBinConfig // TODO: should use/fix(?) NumericDiscreteQ
	#tw: DiscreteTWTypes //

	constructor(tw: DiscreteTWTypes, opts) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q //as DiscreteQTypes
		this.#tw = tw
	}
}

export type ContTWTypes = NumTWCont

export class ContinuousBase extends TwBase {
	term: NumericTerm // | GeneExpressionTerm | MetaboliteIntensityTerm | ...
	q: ContinuousNumericQ
	#tw: ContTWTypes

	constructor(tw: ContTWTypes, opts) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q
		this.#tw = tw
	}
}

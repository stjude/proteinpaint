import { BaseQ, BaseTW, TermValues, BaseTerm, HiddenValues } from '../index'

export type RawNumTW = BaseTW & {
	// id: string
	type?: 'NumTWDiscrete'
	term: NumericTerm // must already exist, for dictionary terms, TwRouter.fill() will use mayHydrateDictTwLst()
	q:
		| {
				type?: 'regular-bin'
				mode?: 'discrete' | 'binary' //| 'spline'
				bin_size?: number
				first_bin?: {
					stop: number
				}
				hiddenValues?: HiddenValues
				preferredBins?: string
		  }
		| {
				type: 'custom-bin'
				mode?: 'discrete' | 'binary' //| 'spline'
				lst: [NumericBin, ...NumericBin[]]
				preferredBins?: string
				median?: number
		  }
		| {
				type?: undefined
				mode: 'continuous'
		  }
		| {
				type?: undefined
				mode: 'spline'
				knots: {
					value: number
				}[]
		  }
}

export type NumericTerm = BaseTerm & {
	id?: string
	// these concrete term.type values make it clear that only these are numeric,
	// "categorical", "condition", and other term.types are not included in this union
	type: 'integer' | 'float' | 'geneExpression' | 'metaboliteIntensity'
	bins: PresetNumericBins
	values?: TermValues
	/*densityNotAvailable?: boolean //Not used?
	logScale?: string | number
	max?: number
	min?: number
	name?: string
	skip0forPercentile?: boolean
	tvs?: Tvs
	values?: TermValues
	unit?: string
	valueConversion?: ValueConversion*/
}

export type StartUnboundedBin = {
	// where possible, assign a concrete value (true) when it is known in advance,
	// in which case, do not use an abstract type (boolean) to startunbounded
	startunbounded: true
	startinclusive?: false // cannot include an infinite bound
	stop: number
	stopinclusive?: boolean
	stopunbounded?: false
	label?: string
}

export type StopUnboundedBin = {
	start: number
	stopunbounded: true
	startinclusive?: boolean
	startunbounded?: false
	stopinclusive?: false // cannot include an infinite bound
	label?: string
}

// TODO??? should separate a fully bounded bin by startinclusive, stopinclusive
// since neighboring bins must not contain the same boundary value
export type FullyBoundedBin = {
	startunbounded?: false
	startinclusive?: boolean
	start: number
	stop: number
	stopinclusive?: boolean
	stopunbounded?: false
	label?: string
}

export type NumericBin = StartUnboundedBin | FullyBoundedBin | StopUnboundedBin

export type RegularNumericBinConfig = {
	type: 'regular-bin' // another concrete value being assigned, instead of `string`
	//regular-sized bins
	mode?: 'discrete'
	bin_size: number
	// first_bin.stop is always required
	first_bin: StartUnboundedBin | FullyBoundedBin

	// if last_bin?.start is set, then a fixed last bin is used; otherwise it's not fixed and computed from data
	last_bin?: StopUnboundedBin | FullyBoundedBin
}

export type CustomNumericBinConfig = {
	type: 'custom-bin'
	mode?: 'discrete' | 'binary'
	// since ts will allow NumericBin[] to be empty,
	// use this workaround to define a non-empty array
	lst: [NumericBin, ...NumericBin[]]
}

/*export type NumericQ = BaseQ & {
	// termType: 'float' | 'integer' -- converts to 'numeric'
	preferredBins?: 'median' | 'less' | 'default'
	modeBinaryCutoffType: 'normal' | 'percentile'
	modeBinaryCutoffPercentile?: number
	knots?: any //[]?
	scale?: number //0.1 | 0.01 | 0.001
	rounding: string
}*/

export type PresetNumericBins = {
	default: RegularNumericBinConfig | CustomNumericBinConfig
	less: RegularNumericBinConfig | CustomNumericBinConfig
	label_offset?: number
	label_offset_ignored?: boolean
	rounding?: string
	min?: number
	max?: number
}

export type BinnedNumericQ = RegularNumericBinConfig | CustomNumericBinConfig

export type DiscreteNumericQ = BinnedNumericQ &
	BaseQ & {
		mode: 'discrete' | 'binary'
	}

// TODO: test with live code that defines an actual binary q object
export type BinaryNumericQ = BaseQ & {
	mode: 'binary'
	type: 'custom-bin'
	// tuple type with 2 members
	lst: [StartUnboundedBin | FullyBoundedBin, StopUnboundedBin | FullyBoundedBin]
}

export type ContinuousNumericQ = BaseQ & {
	mode: 'continuous'
	//scale?: string
}

export type SplineNumericQ = BaseQ & {
	mode: 'spline'
	knots: {
		value: number
	}[]
}

export type NumericQ = DiscreteNumericQ | BinaryNumericQ | ContinuousNumericQ | SplineNumericQ

export type NumericTW = BaseTW & {
	//id: string
	term: NumericTerm
	q: NumericQ
}

export type NumTWDiscrete = BaseTW & {
	type: 'NumTWDiscrete'
	term: NumericTerm
	q: DiscreteNumericQ
}

export type NumTWBinary = BaseTW & {
	type: 'NumTWBinary'
	term: NumericTerm
	q: BinaryNumericQ
}

export type NumTWCont = BaseTW & {
	type: 'NumTWCont'
	term: NumericTerm
	q: ContinuousNumericQ
}

export type NumTWSpline = BaseTW & {
	type: 'NumTWSpline'
	term: NumericTerm
	q: SplineNumericQ
}

export type NumTWTypes = NumTWDiscrete | NumTWBinary | NumTWCont | NumTWSpline

export type DefaultMedianQ = {
	isAtomic?: true
	mode: 'discrete'
	type: 'custom-bin'
	preferredBins: 'median'
	lst: []
}

export type DefaultBinnedQ = {
	isAtomic: true
	mode: 'discrete'
	type: 'regular-bin' | 'custom-bin'
	preferredBins: 'default' | 'less'
}

export type DefaultNumericQ = NumericQ | DefaultBinnedQ | DefaultMedianQ

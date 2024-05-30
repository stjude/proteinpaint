import { BaseTW, TermValues, PredefinedGroupSetting, CustomGroupSetting, BaseTerm } from './term.ts'
import { BaseQ } from './term.ts'

/**
 *
 * @param start ....
 * @params stop
 */
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
	bin_size: number
	// first_bin.stop is always required
	first_bin: StartUnboundedBin | FullyBoundedBin

	// if last_bin?.start is set, then a fixed last bin is used; otherwise it's not fixed and computed from data
	last_bin?: StopUnboundedBin | FullyBoundedBin
}

export type CustomNumericBinConfig = {
	type: 'custom-bin'
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

export type BinnedNumericQ = RegularNumericBinConfig | CustomNumericBinConfig

export type DiscreteNumericQ = BaseQ &
	BinnedNumericQ & {
		mode: 'discrete'
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
	term: NumericTerm
	q: NumericQ
}

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

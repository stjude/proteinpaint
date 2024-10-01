import { MinBaseQ, BaseTW, TermValues, BaseTerm } from '../index.ts'

export type RawRegularBin = Partial<RegularNumericBinConfig> & { preferredBins?: string }

export type RawNumTWRegularBin = BaseTW & {
	type?: 'NumTWRegularBin'
	term: NumericTerm
	q: RawRegularBin
}

export type RawCustomBin = Partial<CustomNumericBinConfig> & { preferredBins?: string }

export type RawNumTWCustomBin = BaseTW & {
	type?: 'NumTWCustomBin'
	term: NumericTerm
	q: RawCustomBin
}

export type RawNumTWCont = BaseTW & {
	type?: 'NumTWCont'
	term: NumericTerm
	q: ContinuousNumericQ
}

export type RawNumTWSpline = BaseTW & {
	type?: 'NumTWSpline'
	term: NumericTerm
	q: SplineNumericQ
}

export type RawNumTW = RawNumTWCustomBin | RawNumTWRegularBin | RawNumTWCont | RawNumTWSpline

export type NumericTerm = BaseTerm & {
	id?: string
	// these concrete term.type values make it clear that only these are numeric,
	// "categorical", "condition", and other term.types are not included in this union
	type: 'integer' | 'float' | 'geneExpression' | 'metaboliteIntensity'
	bins: PresetNumericBins
	values?: TermValues
	unit?: string
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

export type RegularNumericBinConfig = MinBaseQ & {
	type: 'regular-bin' // another concrete value being assigned, instead of `string`
	//regular-sized bins
	mode?: 'discrete'
	bin_size: number
	// first_bin.stop is always required
	first_bin: StartUnboundedBin | FullyBoundedBin

	// if last_bin?.start is set, then a fixed last bin is used; otherwise it's not fixed and computed from data
	last_bin?: StopUnboundedBin | FullyBoundedBin
	label_offset?: number
}

export type CustomNumericBinConfig = MinBaseQ & {
	type: 'custom-bin'
	mode?: 'discrete' | 'binary'
	// since ts will allow NumericBin[] to be empty,
	// use this workaround to define a non-empty array
	lst: [NumericBin, ...NumericBin[]]
	preferredBins?: 'median'
}

// |
// {
// 	type?: 'custom-bin'
// 	mode?: 'discrete' | 'binary'
// 	// since ts will allow NumericBin[] to be empty,
// 	// use this workaround to define a non-empty array
// 	lst?: [NumericBin, ...NumericBin[]]
// }

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

export type DiscreteNumericQ = BinnedNumericQ //&
// MinBaseQ & {
// 	mode: 'discrete' | 'binary'
// }

// TODO: test with live code that defines an actual binary q object
export type BinaryNumericQ = MinBaseQ & {
	mode: 'binary'
	type: 'custom-bin'
	// tuple type with 2 members
	lst: [StartUnboundedBin | FullyBoundedBin, StopUnboundedBin | FullyBoundedBin]
}

export type ContinuousNumericQ = MinBaseQ & {
	mode: 'continuous'
	// TODO: do not use a boolean, convert to a `transform: 'zscore' | ...` option
	convert2ZScore?: boolean
	//scale?: string
	// todo below: q.type is expected to be undefined for now,
	// but may be used later like in other q.modes,
	// making type optional here makes NumericQ operations/conditions
	// work consistently within the TermWrapper union type
	type?: undefined
}

export type SplineNumericQ = MinBaseQ & {
	mode: 'spline'
	knots: {
		value: number
	}[]
	// todo below: q.type is expected to be undefined for now,
	// but may be used later like in other q.modes,
	// making type optional here makes NumericQ operations/conditions
	// work consistently within the TermWrapper union type
	type?: undefined
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

export type NumTWRegularBin = BaseTW & {
	type: 'NumTWRegularBin'
	term: NumericTerm
	q: RegularNumericBinConfig
}

export type NumTWCustomBin = BaseTW & {
	type: 'NumTWCustomBin'
	term: NumericTerm
	q: CustomNumericBinConfig
}

export type NumTWBinaryBin = BaseTW & {
	type: 'NumTWBinaryBin'
	term: NumericTerm
	q: BinaryNumericQ
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

export type NumTWTypes = NumTWRegularBin | NumTWCustomBin | NumTWBinary | NumTWCont | NumTWSpline
export type NumTWDiscreteTypes = NumTWRegularBin | NumTWCustomBin //| NumTWBinary

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

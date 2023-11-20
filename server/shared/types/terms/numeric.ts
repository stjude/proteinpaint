import { Term } from './term'

/**
 *
 * @param start ....
 * @params stop
 */
export type StartUnboundedBin = {
	startunbounded: true
	stop: number
	stopinclusive?: boolean
	stopunbounded?: false
}

export type StopUnboundedBin = {
	start: number
	stopunbounded: true
	startinclusive?: boolean
	startunbounded?: false
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
}

export type RegularNumericBinConfig = {
	type: 'regular-bin'
	//regular-sized bins
	bin_size: number
	// first_bin.stop is always required
	first_bin: StartUnboundedBin | FullyBoundedBin

	// if last_bin?.start is set, then a fixed last bin is used; otherwise it's not fixed and computed from data
	last_bin?: StopUnboundedBin | FullyBoundedBin
}

export type CustomNumericBinConfig = {
	type: 'custom-bin'
	lst: (StartUnboundedBin | FullyBoundedBin | StopUnboundedBin)[]
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

type PresetNumericBins = {
	default: RegularNumericBinConfig | CustomNumericBinConfig
	less: RegularNumericBinConfig | CustomNumericBinConfig
	label_offset?: number
	label_offset_ignored?: boolean
	rounding?: string
}

export type NumericTerm = Term & {
	id: string
	type: 'integer' | 'float'
	bins: PresetNumericBins
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

export type DiscreteNumericQ = BinnedNumericQ & {
	mode: 'discrete'
}

// TODO: test with live code that defines an actual binary q object
export type BinaryNumericQ = {
	mode: 'binary'
	type: 'custom-bin'
	// tuple type with 2 members
	lst: [StartUnboundedBin | FullyBoundedBin, StopUnboundedBin | FullyBoundedBin]
}

export type ContinuousNumericQ = {
	mode: 'continuous'
	//scale?: string
}

export type SplineNumericQ = {
	mode: 'spline'
	knots: {
		value: number
	}[]
}

export type NumericTW = {
	term: NumericTerm
	q: DiscreteNumericQ | BinaryNumericQ | ContinuousNumericQ | SplineNumericQ
}

import { TermWrapper, BaseQ, Term } from '../termdb'
import { TermSettingInstance, InstanceDom } from '../termsetting'

/*
--------EXPORTED--------
NumericQ
NumericTW
BrushEntry
DensityData
NumberObj
NumericTermSettingInstance

*/

export type NumericQ = BaseQ & {
	// termType: 'numeric' | 'float' | 'integer' | 'regression',
	preferredBins?: string
	termtype: string
	//regular-sized bins
	bin_size: number
	startinclusive?: boolean
	stopinclusive?: boolean
	first_bin?: {
		startunbounded?: boolean
		stop?: number
	}
	last_bin?: {
		start?: number
		stopunbounded?: boolean
	}
	modeBinaryCutoffType: 'normal' | 'percentile'
	modeBinaryCutoffPercentile?: number
	//density
	knots: any //[]?
	//binary
	scale?: number //0.1 | 0.01 | 0.001
	//discrete
	rounding: string
}

export type NumericTW = TermWrapper & {
	q: NumericQ
}

type NumObjRangeEntry = any //{}

export type BrushEntry = {
	//No documentation!
	orig: string
	range: {
		start: number
		stop: number
	}
	init: () => void
}

export type DensityData = {
	maxvalue: number
	minvalue: number
}

type PlotSize = {
	width: number
	height: number
	xpad: number
	ypad: number
}

export type NumberObj = {
	binsize_g?: any //dom element??
	brushes: BrushEntry[]
	custom_bins_q: any
	density_data: DensityData
	no_density_data: true
	plot_size: PlotSize
	ranges?: NumObjRangeEntry[]
	svg: any
	xscale: any
}

type NumericalBins = {
	label_offset?: number
	label_offset_ignored?: boolean
	rounding?: string
	default: NumericQ
	less: NumericQ
}

type NumericTerm = Term & {
	id: string
	bins: NumericalBins
	densityNotAvailable?: boolean //Not used?
}

type NumericDom = InstanceDom & {
	bins_div?: any
	bin_size_input: any
	bins_table?: any
	boundaryInclusionDiv: any
	boundaryInput?: any
	custom_knots_div: any
	customKnotsInput: any
	first_stop_input: any
	knots_div: any
	knot_select_div: any
	last_radio_auto: any
	last_start_input: any
}

export type NumericTermSettingInstance = TermSettingInstance & {
	dom: NumericDom
	num_obj: Partial<NumberObj>
	numqByTermIdModeType: any
	q?: Partial<NumericQ>
	term: NumericTerm
	//Methods
	renderBinLines: (self: any, q: NumericQ) => void
}

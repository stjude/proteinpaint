import { TermWrapper, BaseQ } from './termdb'
import { TermSettingInstance, InstanceDom } from './termsetting'

/*
--------EXPORTED--------
NumericQ
NumericTW

*/

export type NumericQ = BaseQ & {
	termType: 'numeric' | 'float' | 'integer'
	preferredBins?: string
	termtype?: string
	//regular-sized bins
	bin_size?: number
	startinclusive?: boolean
	stopinclusive?: boolean
	first_bin?: {
		startunbounded: boolean
		stop: number
	}
	last_bin?: {
		start: number
		stopunbounded: boolean
	}
	modeBinaryCutoffType?: 'normal' | 'percentile'
	modeBinaryCutoffPercentile?: number
	//binary
	scale?: number //0.1 | 0.01 | 0.001
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

type DensityData = {
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
	density_data: DensityData
	no_density_data?: true
	plot_size: PlotSize
	ranges?: NumObjRangeEntry[]
	svg?: any
	xscale?: any
}

type NumericDom = InstanceDom & { knots_div: any }

export type NumericTermSettingInstance = TermSettingInstance & {
	num_obj: NumberObj
	dom: NumericDom
	q: NumericQ
}

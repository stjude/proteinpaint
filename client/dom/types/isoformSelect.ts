import type { Div } from '../../types/d3'

export type GeneModel = {
	isoform: string
	chr: string
	start: number
	stop: number
	isdefault?: boolean
	hidden?: boolean
	strand?: string
	exon: number[][]
	cdslen?: number
	coding?: number[][]
	utr3?: number[][]
	utr5?: number[][]
}

export type ExonRegion = {
	chr: string
	bstart: number
	bstop: number
	start: number
	stop: number
	reverse: boolean
	width?: number
}

export type IsoformTerm = {
	isoform: string
	gene: string
	name: string
	type: string
}

export type IsoformSelectOpts = {
	holder: Div
	allgm: GeneModel[]
	onSelect: (selected: GeneModel) => void
	usegm?: GeneModel
	maxHeight?: number
	scrollThreshold?: number
}

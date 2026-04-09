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
	/** Single-select: called when a row is clicked */
	onSelect?: (selected: GeneModel) => void
	/** Multi-select: called when submit is clicked */
	onMultiSelect?: (selected: GeneModel[]) => void
	/** Enable multi-select mode with checkboxes and submit button */
	multiSelect?: boolean
	/** Currently active gene model, highlighted in single-select mode */
	usegm?: GeneModel
	/** Pre-checked isoform IDs (multi-select only) */
	selectedIsoforms?: Set<string>
	/** Text for the submit button (multi-select only, default "Submit") */
	submitLabel?: string
	maxHeight?: number
	scrollThreshold?: number
}

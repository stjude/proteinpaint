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

/** Member term within a custom isoform termCollection */
export type IsoformCollectionMember = {
	id: string
	name: string
	type: 'isoformExpression'
	isoform: string
}

/** Custom termCollection created from multi-select isoform selection */
export type IsoformCollectionTerm = {
	type: 'termCollection'
	isCustom: true
	memberType: 'numeric'
	name: string
	termlst: IsoformCollectionMember[]
	propsByTermId: Record<string, any>
	isleaf: true
}

type IsoformSelectBase = {
	holder: Div
	allgm: GeneModel[]
	maxHeight?: number
	scrollThreshold?: number
}

/** a breakpoint to mark on the isoformRangeSelect canvas. .samplecount is only used to
 * scale the height of the mark and to sum up the samples of a selected range */
export type BreakpointMarker = {
	pos: number
	samplecount?: number
}

/** genomic range selected in isoformRangeSelect, same shape as BreakpointRange of a tvs */
export type SelectedRange = {
	chr: string
	start: number
	stop: number
}

export type IsoformRangeSelectOpts = {
	holder: Div
	/** isoforms of the gene. those hidden or on another chr are not displayed */
	allgm: GeneModel[]
	/** chr of the gene, the returned range is on it */
	chr: string
	/** breakpoints to mark, e.g. those of a gene of a fusion event */
	markers: BreakpointMarker[]
	/** range to start with, e.g. the one already registered on the tvs being edited */
	range?: { start: number; stop: number }
	/** width in px of the graph column, default 400 */
	pxwidth?: number
	/** width in px of the isoform name column, default 110 */
	labelWidth?: number
	/** called with the selected range on apply, and with null when it is cleared */
	callback: (range: SelectedRange | null) => void
}

/** maps genomic position to px and back, over a linear scale of a chr region.
 * on the minus strand the scale is flipped, so that the gene reads 5' to 3' */
export type LinearScale = {
	chr: string
	/** first and last position of the scale, the gene models and markers padded */
	start: number
	stop: number
	reverse: boolean
	pxwidth: number
	/** px per bp */
	exonsf: number
	/** single region covering the scale, for sketchGmsum() */
	rglst: ExonRegion[]
	pos2px: (pos: number) => number
	px2pos: (px: number) => number
}

export type IsoformSelectOpts =
	| (IsoformSelectBase & {
			multiSelect?: false
			onSelect: (selected: GeneModel) => void
			usegm?: GeneModel
	  })
	| (IsoformSelectBase & {
			multiSelect: true
			onMultiSelect: (selected: GeneModel[]) => void
			selectedIsoforms?: Set<string>
			/** returns the submit button text for the current number of checked isoforms */
			getSubmitLabel?: (selectedCount: number) => string
	  })

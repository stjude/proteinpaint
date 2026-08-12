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

/** how the isoform structure is laid out, and how positions map to px over it.
 *
 * 'genomic': one linear scale over the whole locus, introns at their real width. A genomic
 *   sv breaks mostly in introns (e.g. the two BCR breakpoint clusters of BCR::ABL1 sit in
 *   introns), so intronic space has to be kept to place a range within it.
 *
 * 'rna': the exon structure collapsed, introns as fixed narrow gaps (see allgm2sum). A rna
 *   fusion joins transcripts at exon boundaries, so intronic space is only noise between
 *   the exons the breakpoints actually fall on. A position off the exon structure is drawn
 *   at the nearest exon edge, and a range dragged over it snaps to exon edges; the range
 *   itself is still genomic, and still matches events by position. */
export type ScaleMode = 'rna' | 'genomic'

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
	/** layout of the isoform structure, default 'genomic' */
	mode?: ScaleMode
	/** called with the selected range on apply, and with null when it is cleared */
	callback: (range: SelectedRange | null) => void
}

/** a pair of breakpoints of one sv/fusion event, one on each of the two genes it joins.
 * .samplecount is the number of samples having an event of this pair, and scales the
 * strength of the line drawn between the two positions */
export type BreakpointLink = {
	/** breakpoint on the gene of the top track */
	selfPos: number
	/** breakpoint on the gene of the bottom track */
	partnerPos: number
	samplecount?: number
}

/** one of the two genes charted by isoformPairRangeSelect() */
export type PairTrack = {
	/** name of the gene, labels the track */
	gene: string
	/** chr of the gene, isoforms of another chr are not displayed */
	chr: string
	allgm: GeneModel[]
	/** range already registered on this gene */
	range?: { start: number; stop: number }
}

export type IsoformPairRangeSelectOpts = {
	holder: Div
	/** gene of the term, charted as the top track. its range is context only: it is
	 * highlighted and dims the links failing it, but is not editable here */
	self: PairTrack
	/** partner gene of the event, charted as the bottom track. the selected range is on it */
	partner: PairTrack
	/** breakpoint pairs, drawn as lines between the two tracks */
	links: BreakpointLink[]
	/** width in px of the graph column, default 400 */
	pxwidth?: number
	/** width in px of the isoform name column, default 110 */
	labelWidth?: number
	/** layout of the isoform structure of both tracks, default 'genomic' */
	mode?: ScaleMode
	/** called with the selected range on apply, and with null when it is cleared */
	callback: (range: SelectedRange | null) => void
}

/** maps genomic position to px and back, over the layout of a chr region.
 * on the minus strand the scale is flipped, so that the gene reads 5' to 3' */
export type LinearScale = {
	chr: string
	mode: ScaleMode
	/** whether the scale covers a window of the gene rather than the whole of it, i.e. the
	 * exons the breakpoints fall on and their context. only ever true in 'rna' mode */
	zoomed: boolean
	/** first and last position of the scale. in 'genomic' mode the gene models and markers
	 * padded, in 'rna' mode the extent of the exons laid out, which is a window of the gene
	 * when zoomed */
	start: number
	stop: number
	reverse: boolean
	pxwidth: number
	/** px per bp within an exon */
	exonsf: number
	/** regions to sketch a gene model over, for sketchGmsum(): one covering the whole scale
	 * in 'genomic' mode, one per merged exon in 'rna' mode */
	rglst: ExonRegion[]
	/** px between two regions of rglst, 0 in 'genomic' mode. NOTE pass this to sketchGmsum()
	 * as its intronw, or a sketch will not line up with the marks over it */
	intronpx: number
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

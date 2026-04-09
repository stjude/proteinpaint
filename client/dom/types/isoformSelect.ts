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
	type: 'float'
	isoform: string
	dataType: string
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
			submitLabel?: string
	  })

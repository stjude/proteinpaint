import type { Elem } from '../../types/d3'
import type { DMRSettings } from './settings/Settings'
import type { DmrDiagnostic } from '#types'

/** Config shape passed via plot_create from VolcanoInteractions */
export type DmrConfig = {
	chartType: 'dmr'
	id: string
	headerText: string
	group1: { sample: string }[]
	group2: { sample: string }[]
	group1Name?: string
	group2Name?: string
	settings: { dmr: DMRSettings }
	/** Set by onBlockCoordinateChange when user pans/zooms the genome browser */
	coordinateOverride?: { chr: string; start: number; stop: number }
}

export type DmrDom = {
	header: Elem
	holder: Elem
	loadingOverlay: Elem
	error: Elem
	loading: Elem
	diagnosticPanel: Elem
}

export type BedItem = {
	chr: string
	start: number
	stop: number
	color: string
}

export type LegendRow = {
	label: string
	items: [string, string][]
}

export type DmrViewData = {
	tklst: any[]
	legendRows: LegendRow[]
	diagnostic?: DmrDiagnostic
	dmrs?: { start: number; stop: number; direction: string; min_smoothed_fdr: number }[]
	dmrBedItems: BedItem[]
}

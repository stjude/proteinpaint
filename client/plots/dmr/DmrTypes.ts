import type { Elem } from '../../types/d3'
import type { DMRSettings } from './settings/Settings'

/** Config shape passed via plot_create from VolcanoInteractions */
export type DmrConfig = {
	chartType: 'dmr'
	id: string
	headerText: string
	geneName: string
	promoterId?: string
	group1: { sample: string }[]
	group2: { sample: string }[]
	group1Name?: string
	group2Name?: string
	settings: { dmr: DMRSettings }
}

export type DmrDom = {
	header: Elem
	holder: Elem
	rerunBar: Elem
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

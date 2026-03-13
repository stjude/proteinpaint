import type { Elem } from '../../types/d3'
import type { DMRSettings } from './settings/Settings'

/** Config shape passed via plot_create from VolcanoInteractions */
export type DmrConfig = {
	chartType: 'dmr'
	id: string
	headerText: string
	genome: string
	dslabel: string
	geneName: string
	promoterId?: string
	group1: { sample: string }[]
	group2: { sample: string }[]
	settings: { dmr: DMRSettings }
}

export type DmrDom = {
	header: Elem
	holder: Elem
	error: Elem
	loading: Elem
}

export type Dmr = {
	chr: string
	start: number
	stop: number
	direction: 'hyper' | 'hypo'
	probability: number
}

export type DmrResult = {
	error?: string
	dmrs?: Dmr[]
}

export type BedItem = {
	chr: string
	start: number
	stop: number
	color: string
}

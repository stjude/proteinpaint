import type { Elem, SvgG, SvgSvg } from '../../types/d3'

export type GpdmOpts = {
	/** DOM element to render into */
	holder: Elem
	/** Genome build name */
	genome: string
	/** Dataset label */
	dslabel: string
	/** Genomic region */
	chr: string
	start: number
	stop: number
	/** Gene name for display */
	geneName: string
	/** Promoter ID for display */
	promoterId?: string
	/** Samples in group 1 (control) */
	group1: { sampleId: number | string; sample: string }[]
	/** Samples in group 2 (case) */
	group2: { sampleId: number | string; sample: string }[]
	/** Group labels */
	group1Name: string
	group2Name: string
	/** Optional annotations */
	annotations?: GpdmAnnotationInput[]
}

export type GpdmAnnotationInput = {
	name: string
	start: number
	end: number
	base_methylation?: number
	length_scale_bp?: number
}

export type GpdmDmrEntry = {
	chr: string
	start: number
	stop: number
	width: number
	max_delta_beta: number
	probability: number
}

export type GpdmGridData = {
	positions: number[]
	group_a_mean: number[]
	group_a_lower: number[]
	group_a_upper: number[]
	group_b_mean: number[]
	group_b_lower: number[]
	group_b_upper: number[]
	difference_mean: number[]
	difference_lower: number[]
	difference_upper: number[]
	posterior_prob: number[]
}

export type GpdmResponseData = {
	status: 'ok'
	dmrs: GpdmDmrEntry[]
	naive_dmrs: GpdmDmrEntry[]
	grid: GpdmGridData
	metadata: {
		n_probes: number
		n_samples_group1: number
		n_samples_group2: number
		region: string
	}
}

export type GpdmDom = {
	holder: Elem
	error: Elem
	wait: Elem
	content: Elem
}

export type GpdmPanelDom = {
	svg: SvgSvg
	gpFitG: SvgG
	diffG: SvgG
	probG: SvgG
	dmrG: SvgG
}

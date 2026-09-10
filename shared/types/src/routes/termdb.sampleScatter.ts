import type { Filter } from '../index.ts'

//TermWrapper defined in client/types/terms/tw.ts
//Do not use #types TermWrapper here as it will be deprecated
export type TermdbSampleScatterRequest = {
	genome: string
	dslabel: string
	colorTW?: any //TermWrapper
	shapeTW?: any //TermWrapper
	divideByTW?: any //TermWrapper
	scaleDotTW?: any //TermWrapper
	coordTWs?: any[] //TermWrapper[]
	plotName?: string
	filter?: Filter
	filter0?: any
	chartType?: string
	singleCellPlot?: any
	colorColumn?: any
	excludeOutliers?: boolean
}

export type ScatterSample = {
	category: string
	sample?: string
	/** real db sample id. Absent on reference-cloud dots, and also dropped from cohort dots when the request
	 * is not authorized to display sample ids (see anonymizeSampleIds) — so its presence is NOT a reliable
	 * cohort-vs-reference test; use isRef for that. */
	sampleId?: number | string
	/** set by the server (markRefDots) for every dot: true = reference-cloud dot (rendered small/unlabeled,
	 * no sample actions), false = cohort dot. Derived from sampleId presence BEFORE any anonymization, so the
	 * client can classify/size/label dots even when a denied request has dropped the sampleId. */
	isRef?: boolean
	info?: { [index: string]: any }
	shape: string
	x: number
	y: number
	z: number
	geneExp?: number
}

export type ColorObject = { color: string; sampleCount: number; key: string }
export type ColorLegendEntry = [string, ColorObject]
export type ColorMap = { [index: string]: ColorObject }

export type ShapeObject = { shape: number; sampleCount: number; key: string }
export type ShapeLegendEntry = [string, ShapeObject]
export type ShapeMap = { [index: string]: ShapeObject }

type ScatterResult = {
	[index: string]: {
		colorLegend: ColorLegendEntry[]
		shapeLegend: ShapeLegendEntry[]
		colorMap?: ColorMap
		samples?: ScatterSample[]
		src?: string
	}
}

export type TermdbSampleScatterResponse = {
	range: { xMin: number; xMax: number; yMin: number; yMax: number }
	result: ScatterResult
}

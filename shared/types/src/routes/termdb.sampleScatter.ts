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
	/** real db sample id (or a non-numeric anonymous surrogate when the request may not display sample ids) */
	sampleId?: number | string
	/** set by the server (anonymizeSampleIds) when this cohort sample's id has been anonymized. The client
	 * uses it to gate all sample-specific actions and grouping, since the surrogate sampleId cannot resolve
	 * back to a real sample. */
	hideSampleId?: boolean
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

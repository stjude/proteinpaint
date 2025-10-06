import type { RoutePayload } from './routeApi.ts'

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
	filter?: any
	filter0?: any
	__protected__?: any // auth token for accessing protected data
}

export type ScatterSample = {
	category: string
	sample: string
	info: { [index: string]: any }
	shape: string
	x: number
	y: number
	z: number
}

type ColorObject = { color: string; sampleCount: number; key: string }
export type ColorLegendEntry = [string, ColorObject]
export type ColorMap = { [index: string]: ColorObject }

type ShapeObject = { shape: number; sampleCount: number; key: string }
export type ShapeLegendEntry = [string, ShapeObject]
export type ShapeMap = { [index: string]: ShapeObject }

type ScatterResult = {
	[index: string]: {
		colorLegend: ColorLegendEntry[]
		colorMap: ColorMap
		samples: ScatterSample[]
		shapeLegend: ShapeLegendEntry[]
		shapeMap: ShapeMap
	}
}

export type TermdbSampleScatterlResponse = {
	range: { xMin: number; xMax: number; yMin: number; yMax: number }
	result: ScatterResult
}

export const termdbSampleScatterPayload: RoutePayload = {
	request: {
		typeId: 'TermdbSampleScatterRequest'
	},
	response: {
		typeId: 'TermdbSampleScatterResponse'
	}
}

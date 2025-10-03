import type { RoutePayload } from './routeApi.ts'
import type { TermWrapper } from 'src/terms/tw.ts'

export type TermdbSampleScatterRequest = {
	genome: string
	dslabel: string
	colorTW?: TermWrapper
	shapeTW?: TermWrapper
	divideByTW?: TermWrapper
	scaleDotTW?: TermWrapper
	coordTWs?: TermWrapper[]
	plotName?: string
	filter?: any
	filter0?: any
	__protected__?: any // auth token for accessing protected data
}

type ScatterSample = {
	category: string
	sample: string
	info: { [index: string]: any }
	shape: number
	x: number
	y: number
	z: number
}

type ScatterResult = {
	[index: string]: {
		colorMap: { [index: string]: { color: number; sampleCount: number; key: string } }[]
		colorLegend: [string, { color: number; sampleCount: number; key: string }][]
		samples: ScatterSample[]
		shapeMap: [string, { shape: number; sampleCount: number; key: string }][]
		shapeLegend: { [index: string]: { shape: number; sampleCount: number; key: string } }[]
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

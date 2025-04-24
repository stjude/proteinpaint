export type DataResult = {
	colorLegend: any[]
	shapeLegend: any[]
	colorMap: { [key: string]: any }
	shapeMap: { [key: string]: any }
	samples: any[]
}

export type DataRange = {
	xMin: number
	xMax: number
	yMin: number
	yMax: number
}

type AxisTermLabel = {
	x: number
	y: number
	label: string
}

type AxisSectionLabel = AxisTermLabel & {
	rotate: boolean
}

type RowSectionLine = {
	x: number
	y1: number
	y2: number
}

type ColSectionLine = {
	y: number
	x1: number
	x2: number
}

type DotTipEntry = {
	label: string
	value: string | number
	/** A swatch of this color is shown before the label, as a reference to a slice of a pie */
	color?: string
}

export type AggMatrixPieSlicePosition = {
	key: string
	label: string
	color: string
	count: number
	/** SVG path of the slice, centered on the dot */
	path: string
}

export type AggMatrixPiePosition = {
	/** Pixels */
	radius: number
	n: number
	slices: AggMatrixPieSlicePosition[]
}

export type PieLegendEntry = { key: string; label: string; color: string; hidden: boolean }

export type AggMatrixDotPosition = {
	x: number
	y: number
	size: number
	color: string | number
	row: string
	rowSection: string
	column: string
	colSection: string
	tipData: DotTipEntry[]
	/** Flag to indicate whether data is available for both
	 * gradient and size. If false, tooltip is disabled. */
	hasData: boolean
	/** When present, the dot is drawn as a pie instead of a circle */
	pie?: AggMatrixPiePosition
}

type PlotDimensions = {
	svg: {
		width: number
		height: number
	}
	rowLabels: {
		x: number
		y: number
	}
	colLabels: {
		x: number
		y: number
	}
}

export type AggMatrixViewData = {
	plotDim: PlotDimensions
	rowLabels: AxisTermLabel[]
	colLabels: AxisTermLabel[]
	rowSectionLabels: AxisSectionLabel[]
	colSectionLabels: AxisSectionLabel[]
	rowSectionLines: RowSectionLine[]
	colSectionLines: ColSectionLine[]
	dotPositions: AggMatrixDotPosition[]
	/** Slices of every pie, in order of first appearance. Empty when there are no pies. */
	pieLegend: { title: string; entries: PieLegendEntry[] }
	/** False when every dot is a pie, as a gradient is never applied to a pie. Then there is no color scale. */
	hasColorScale: boolean
	colorScale: {
		scale: (value: number) => string | number
		absMin: number
		absMax: number
	}
}

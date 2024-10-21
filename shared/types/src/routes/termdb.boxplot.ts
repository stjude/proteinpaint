export type BoxPlotRequest = {
	//TOOD: define request
	tw: any
}

export type BoxPlotResponse = {
	plots: BoxPlotEntry[]
	absMin: number
	absMax: number
}

export type BoxPlotEntry = {
	/** TODO: Add comments */
	boxplot: {
		w1: number
		w2: number
		p05: number
		p25: number
		p50: number
		p75: number
		p95: number
		iqr: number
		out: { value: number }[]
	}
	label: string
	plotValueCount: number
	value: number[]
	/** Lowest min for the scale domain */
	min: number
	/** Highest max for the scale domain */
	max: number
}

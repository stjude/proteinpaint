export type BoxPlotRequest = {
	//TOOD: define request
	tw: any
}

export type BoxPlotResponse = {
	plots: BoxPlotEntry[]
	/** Absolute min value for all plots */
	absMin: number
	/** Absolute max value for all plots */
	absMax: number
	/** Longest label length for all plots */
	maxLabelLgth: number
}

export type BoxPlotEntry = {
	boxplot: BoxPlotData
	/** Label to show */
	label: string
	// /** Number of samples */
	// plotValueCount: number
	/** TODO: Is this needed? */
	values: number[]
	/** Lowest min for the scale domain */
	min: number
	/** Highest max for the scale domain */
	max: number
}

export type BoxPlotData = {
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

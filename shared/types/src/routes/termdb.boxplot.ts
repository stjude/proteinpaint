export type BoxPlotRequest = {
	//TOOD: define request
	tw: any
	genome: string
	dslabel: string
	divideTw?: any
	filter: any
	filter0: any
}

export type BoxPlotResponse = {
	/** Absolute min value for all plots */
	absMin?: number
	/** Absolute max value for all plots */
	absMax?: number
	/** Longest label length for all plots */
	maxLabelLgth: number
	plots: BoxPlotEntry[]
}

type BoxPlotEntry = {
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

type BoxPlotData = {
	/** Min/1st whisker value */
	w1: number
	/** Max/2nd whisker value */
	w2: number
	/** 5% */
	p05: number
	/** 25% */
	p25: number
	/** 50% */
	p50: number
	/** 75% */
	p75: number
	/** 95% */
	p95: number
	/** Interquartile region */
	iqr: number
	/** Outliers */
	out: { value: number }[]
}

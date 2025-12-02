export interface MutationWaterfallDatum {
	chr: string
	position: number
	logDistance: number

	type?: string           
	sample?: string          
	samples?: string[]       
}

export interface MutationWaterfallLogRange {
	min: number
	max: number
}

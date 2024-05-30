/** Note */
export type DERequest = {
	genome: string
	dslabel: string
	samplelst: any // {number[] number[]} // Determine the correct type of this variable later to ensure type-safety
	min_count: number
	min_total_count: number
	method?: string
}

export type DEResponse = {
	data: string // Name of pathway
	sample_size1: number // Original p-value
	sample_size2: number // Adjusted p-value
	method: string // Method used
}

export type SnpRequest = {
	/** name of genome */
	genome: string
} & (
	| {
			/** if true, query bigbed file by coordinate */
			byCoord: true | 1
			chr: string
			ranges: {
				start: number
				stop: number
			}[]
			/** if provided will only return snps with matching alleles */
			alleleLst: string[]
	  }
	| {
			/** if true, query bigbed file by rs id */
			byName: true | 1
			lst: string[]
	  }
)

export type SnpResponse = any

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only

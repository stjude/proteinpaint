export type HicdataRequest = {
	/** Value is the 1st parameter of straw tool, and can only use these specific strings but not anything else. */
	matrixType: 'observed' | 'expected' | 'oe'
	/** HiC file path from tp/ */
	file?: string
	/** Remote HiC file URL */
	url?: string // FIXME use ts to enforce that either file or url must be given, abort if none is given
	/** Position of first locus, in the format of chr:start:stop */
	pos1: string
	/** Position of second locus, in the format of chr:start:stop */
	pos2: string // portal code must validate pos1 and pos2 values, to prevent xxx:456-321
	/** Resolution */
	resolution: number
	/** If is in fragment resolution */
	isfrag?: boolean
	/** Normalization method for the queried data */
	nmeth: string
	/** Minimum value cutoff */
	mincutoff: number
}

/** array of 3 numbers */
export type Item = [
	/** position 1 */
	number,
	/** position 2 */
	number,
	/** inter-loci contact value */
	number
]

export type HicdataResponse = {
	error?: string
	items: Item[]
}

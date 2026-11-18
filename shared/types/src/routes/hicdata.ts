import type { FileORURL } from '../fileOrUrl.ts'

export type BaseHicRequest = FileORURL & {
	/** Value relates to the 1st parameter of straw tool, which accepts 'observed', 'expected', 'oe', 'norm', and 'distance' */
	matrixType: 'observed' | 'expected' | 'oe' | 'log(oe)'
	/** Either a base pair or fragment resolution calculated from the array*/
	resolution: number
	/** Normalization method, an option read from the file or NONE */
	nmeth: string
}

export type HicdataRequest = BaseHicRequest & {
	/** Position of first locus, in the format of chr:start:stop; not used when pairs[] is given */
	pos1?: string
	/** Position of second locus, in the format of chr:start:stop; not used when pairs[] is given */
	pos2?: string // portal code must validate pos1 and pos2 values, to prevent xxx:456-321
	/** A batch of [pos1, pos2] position pairs, each in the same format as pos1 and pos2, to query in one request.
	 * When given, the response has pairs[] instead of items[] */
	pairs?: [string, string][]
	/** If is in fragment resolution */
	isfrag?: boolean
	/** Minimum value cutoff */
	mincutoff?: number
}

/** Item typed for documentation/explanation purposes*/
export type XYZCoord = [
	/** position 1, x coordinate */
	number,
	/** position 2, y coordinate */
	number,
	/** inter-loci contact value */
	number
]

export type HicdataResponse = {
	/** Error message to display on the client, if applicable */
	error?: string
	/** data of a single pos1/pos2 request */
	items?: XYZCoord[]
	/** data of a batch request, in the same order as the requested pairs[] */
	pairs?: HicdataPairResult[]
}

export type HicdataPairResult = {
	/** the data of the pair, which is empty when the pair has an error or is skipped */
	items: XYZCoord[]
	/** the straw error of this pair, or that the pair alone has more data points than a batch response may have */
	error?: string
	/** true when the pair was not returned because the response reached its limit of data points;
	 * the pair may be requested again in another batch */
	skipped?: boolean
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only

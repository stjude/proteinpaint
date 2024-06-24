import { FileORURL } from '../fileOrUrl'

/******** Types are for the hicdata and hicgenome endpoints ********/

type BaseHicRequest = FileORURL & {
	/** Value relates to the 1st parameter of straw tool, which accepts 'observed', 'expected', 'oe', 'norm', and 'distance' */
	matrixType: 'observed' | 'expected' | 'oe' | 'log(oe)'
	/** Either a base pair or fragment resolution calculated from the array*/
	resolution: number
	/** Normalization method, an option read from the file or NONE */
	nmeth: string
}

export type HicdataRequest = BaseHicRequest & {
	/** Position of first locus, in the format of chr:start:stop */
	pos1: string
	/** Position of second locus, in the format of chr:start:stop */
	pos2: string // portal code must validate pos1 and pos2 values, to prevent xxx:456-321
	/** If is in fragment resolution */
	isfrag?: boolean
	/** Minimum value cutoff */
	mincutoff?: number
}

/** Item typed for documentation/explanation purposes*/
export type Item = [
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
	items: Item[]
}

export type HicGenomeRequest = BaseHicRequest & {
	/** Entire chromosome list read from the file (see hicstate) */
	chrlst: string[]
	/** window location */
	embedder: string
	/** whether or not the file contains 'chr' for the chromosomes */
	nochr: boolean
}

export type HicGenomeResponse = {
	data: {
		/** First chromosome */
		lead: string
		/** Second chromosome */
		follow: string
		items: Item[]
	}[]
	/** Error message to display on the client, if applicable */
	error?: string
}

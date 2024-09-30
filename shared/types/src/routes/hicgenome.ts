import type { BaseHicRequest, Item } from './hicdata.ts'

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

import type { BaseHicRequest, XYZCoord } from './hicdata.ts'

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
		items: XYZCoord[]
	}[]
	/** Error message to display on the client, if applicable */
	error?: string
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
// The example below will not work in github CI where only termdb test
export const hicGenomePayloadExample = {
	examples: [
		{
			request: {
				body: {
					embedder: 'localhost',
					url: 'https://proteinpaint.stjude.org/ppdemo/hg19/hic/hic_demo.hic',
					matrixType: 'observed',
					nmeth: 'NONE',
					pos1: '3',
					pos2: '2',
					resolution: 1000000
				} // satisfies HicGenomeRequest // TODO: fix the type or example
			},
			response: {
				header: { status: 200 }
			}
		}
	]
}

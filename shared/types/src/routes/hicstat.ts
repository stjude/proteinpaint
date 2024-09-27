type HicstatRequestWithFile = {
	/** HiC file path from tp/ */
	file: string
	/** If file is provided, url should not be provided. Checked in validation type */
	url?: never
}

type HicstatRequestWithUrl = {
	/** If url is provided, file should not be provided. Checked in validation type */
	file?: never
	/** Remote HiC file URL */
	url: string
}

export type HicstatRequest = HicstatRequestWithFile | HicstatRequestWithUrl

/** Checks if a file or url is present before proceeding */
type RequireFileOrUrl<T> = T extends HicstatRequestWithFile | HicstatRequestWithUrl
	? T
	: { error: 'Either "file" or "url" must be provided' }

export type HicstatRequestWithValidation = RequireFileOrUrl<HicstatRequest>

export type HicstatResponse = {
	/** Version number pulled from the header. Only hic versions 7-9 are acceptable */
	version: 7 | 8 | 9
	/**genome identifer */
	'Genome ID': string
	/** k:v of chrs and a position */
	Chromosomes: {
		/** Index of chr 1 through 22 */
		[index: number]: number
		All: number
		X: number
		Y: number
		M: number
	}
	/** Orders Chromosomes keys (see above) */
	chrorder: number[]
	/** bins for base pair resolutions */
	'Base pair-delimited resolutions': number[]
	/** bins for fragment resolutions */
	'Fragment-delimited resolutions': number[]
	normalization: string[]
}

export type HicstatRequest = {
	/** HiC file path from tp/ */
	file?: string
	/** Remote HiC file URL */
	url?: string // FIXME use ts to enforce that either file or url must be given, abort if none is given
}

type Normalization = 'VC' | 'VC_SQRT' | 'KR' | 'NONE'

export type HicstatResponse = {
	error?: string
	/** Only versions 7-9 are acceptable */
	version: 7 | 8 | 9
	'Genome ID': string
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
	'Base pair-delimited resolutions': number[]
	'Fragment-delimited resolutions': number[]
	normalization: Normalization[]
}

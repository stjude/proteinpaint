import { Normalization } from '#shared/types/routes/hicstat.ts'

export type HicstrawArgs = {
	jwt: any
	/** HiC file path from tp/ */
	file?: string
	/** Remote HiC file URL */
	url?: string
	pos1: string
	pos2: string
	/** Normalization method for the queried data */
	nmeth: Normalization
	resolution: number
	isfrag?: boolean
}

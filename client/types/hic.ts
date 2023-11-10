import { BaseTrackArgs } from './tracks.ts'
import { Normalization } from '#shared/types/routes/hicstat.ts'

type SharedArgs = {
	/** HiC file path from tp/ */
	file?: string
	/** Remote HiC file URL */
	url?: string
}

type RestrictionEnzyme = 'Dpnll' | 'EcoRl' | 'Hindlll' | 'MboI' | 'Ncol'

export type HicRunProteinPaintTrackArgs = BaseTrackArgs &
	SharedArgs & {
		/** Specifies the track type
		 * TODO: maybe move 'type' to BaseBlockArgs
		 */
		type: 'hicstraw'
		name: string
		percentile_max: number
		mincutoff: number
		/** Indicates whether the tip of the track points up or down */
		pyramidup: number | boolean
		enzyme: RestrictionEnzyme
		/** Normalization method for the queried data */
		normalizationmethod: Normalization
	}

export type HicstrawArgs = SharedArgs & {
	jwt: any
	pos1: string
	pos2: string
	/** Normalization method for the queried data */
	nmeth: Normalization
	resolution: number
	isfrag?: boolean
}

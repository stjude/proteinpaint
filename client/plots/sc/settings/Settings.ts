import type { SCSample } from '../SCTypes'

export type SCSettings = {
	sc: {
		columns: {
			/** Defined column name for 'sample' column*/
			sample: string
		}
		/** Active item chosen by the user */
		item: SCSample | undefined
		groupBy: 'none' | 'sample' | 'plot'
	}
	hierCluster: {
		unit: string
		yDendrogramHeight: number
		clusterSamples: boolean
	}
}

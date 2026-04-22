import type { SCSample } from '../SCTypes'

export const GroupByOptions = ['none', 'sample', 'plot'] as const

export type SCSettings = {
	sc: {
		columns: {
			/** Defined column name for 'sample' column*/
			sample: string
		}
		/** Active item chosen by the user */
		item: SCSample | undefined
		groupBy: (typeof GroupByOptions)[number]
	}
	hierCluster: {
		unit: string
		yDendrogramHeight: number
		clusterSamples: boolean
	}
}

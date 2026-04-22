import type { SCSample } from '../SCTypes'

export const GroupByOptions = ['none', 'sample', 'plot'] as const

export type Settings = {
	sc: SCSettings
	hierCluster: {
		unit: string
		yDendrogramHeight: number
		clusterSamples: boolean
	}
}

export type SCSettings = {
	columns: {
		/** Defined column name for 'sample' column*/
		sample: string
	}
	/** Active item chosen by the user */
	item: SCSample | undefined
	groupBy: (typeof GroupByOptions)[number]
}

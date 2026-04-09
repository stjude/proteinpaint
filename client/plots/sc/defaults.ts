import { getGEunit } from '#tw/geneExpression'
import type { SCSettings } from './SCTypes'

/** Define all subplot settings here */
export function getDefaultSCAppSettings(overrides = {}, app): SCSettings {
	const defaults = {
		sc: {
			columns: {
				// TODO: Implement ds specific column name
				sample: 'Sample'
			},
			item: undefined
		},
		hierCluster: {
			unit: getGEunit(app.vocabApi),
			yDendrogramHeight: 0,
			clusterSamples: false
		}
	}
	return Object.assign(defaults, overrides)
}

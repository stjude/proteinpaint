import { getGEunit } from '#tw/geneExpression'
import type { Settings } from './Settings'

/** Define all subplot settings here */
export function getDefaultSCAppSettings(overrides = {}, app): Settings {
	const defaults: Settings = {
		sc: {
			columns: {
				// TODO: Implement ds specific column name
				sample: 'Sample'
			},
			item: undefined,
			groupBy: 'sample'
		},
		hierCluster: {
			unit: getGEunit(app.vocabApi),
			yDendrogramHeight: 0,
			clusterSamples: false
		}
	}
	return Object.assign(defaults, overrides)
}

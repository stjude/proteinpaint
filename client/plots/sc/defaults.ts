/** Define all subplot settings here */
export function getDefaultSCAppSettings(overrides = {}, app) {
	const defaults = {
		sc: {
			columns: {
				// TODO: Implement ds specific column name
				sample: 'Sample'
			},
			item: undefined
		},
		hierCluster: {
			unit: app.vocabApi.termdbConfig.queries.geneExpression?.unit || 'Gene Expression',
			yDendrogramHeight: 0,
			clusterSamples: false
		}
	}
	return Object.assign(defaults, overrides)
}

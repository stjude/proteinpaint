export function getDefaultSCAppSettings(overrides = {}, app) {
	const defaults = {
		sc: {
			columns: {
				sample: 'Sample'
			},
			sample: undefined
		},
		hierClusterUnit: app.vocabApi.termdbConfig.queries.geneExpression?.unit || 'Gene Expression',
		hierCluster: {
			yDendrogramHeight: 0,
			clusterSamples: false
		}
	}
	return Object.assign(defaults, overrides)
}

import tape from 'tape'
import { getPlotConfig } from '../matrix.config'
import { getMatrixRequestOpts } from '../matrix.data'

const app = { vocabApi: { termdbConfig: { hasSampleAncestry: true } } }

async function getConfig(settings = {}, appWithTermdbConfig = app) {
	return getPlotConfig({ settings: { matrix: settings } }, appWithTermdbConfig)
}

tape('matrix sample mapping default and legacy root setting', async test => {
	const defaultConfig = await getConfig()
	test.equal(defaultConfig.settings.matrix.sampleMapping, 'parentToChildren', 'defaults to parent-to-children mapping')

	const noAncestryConfig = await getConfig({}, { vocabApi: { termdbConfig: { hasSampleAncestry: false } } })
	test.equal(
		noAncestryConfig.settings.matrix.sampleMapping,
		null,
		'disables mapping when sample ancestry is unavailable'
	)

	const legacyConfig = await getConfig({ mapChildren2Root: true })
	test.equal(legacyConfig.settings.matrix.sampleMapping, 'childrenToParent', 'migrates legacy root mapping')
	test.notOk('mapChildren2Root' in legacyConfig.settings.matrix, 'removes the legacy setting')

	const configWithBothSettings = await getConfig({
		mapChildren2Root: true,
		sampleMapping: 'parentToChildren'
	})
	test.equal(configWithBothSettings.settings.matrix.sampleMapping, 'parentToChildren', 'prefers the new setting')
	test.end()
})

tape('matrix request uses sample mapping only for ancestry-enabled datasets', async test => {
	const state = {
		filter: {},
		filter0: {},
		config: { settings: { matrix: { maxGenes: 50 } } }
	}
	const config = {
		termgroups: [],
		settings: { matrix: { sampleMapping: 'childrenToParent' } }
	}
	const matrix = {
		chartType: 'matrix',
		app: { vocabApi: { termdbConfig: { hasSampleAncestry: true } } }
	}

	test.equal(
		getMatrixRequestOpts.call(matrix, state, config).sampleMapping,
		'childrenToParent',
		'passes the selected mapping to the request'
	)
	matrix.chartType = 'hierCluster'
	test.equal(
		getMatrixRequestOpts.call(matrix, state, config).sampleMapping,
		'childrenToParent',
		'passes the selected mapping for hierarchical clustering'
	)

	matrix.app.vocabApi.termdbConfig.hasSampleAncestry = false
	const optsWithoutAncestry = getMatrixRequestOpts.call(matrix, state, config)
	test.notOk('sampleMapping' in optsWithoutAncestry, 'omits sample mapping when sample ancestry is unavailable')
	test.end()
})

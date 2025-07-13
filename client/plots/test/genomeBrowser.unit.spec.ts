import tape from 'tape'
import { computeBlockModeFlag } from '#plots/genomeBrowser.js'

/* 
Tests:

computeBlockModeFlag()
*/

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/genomebrowser -***-')
	test.end()
})

const config: any = {
	geneSearchResult: {}
}

const vocabApi: any = {
	termdbConfig: {
		queries: {
			//gbRestrictMode
		}
	}
}

tape('computeBlockModeFlag()', test => {
	console.log('priority 1: with override f(config,true)')

	config.blockIsProteinMode = undefined
	computeBlockModeFlag(config, true)
	test.equal(config.blockIsProteinMode, true, 'override from undefined to true')

	config.blockIsProteinMode = false
	computeBlockModeFlag(config, true)
	test.equal(config.blockIsProteinMode, true, 'override from false to true')

	config.blockIsProteinMode = true
	computeBlockModeFlag(config, false)
	test.equal(config.blockIsProteinMode, false, 'override from true to false')

	console.log('priority 2: no override and has default f(config)')

	config.blockIsProteinMode = false
	computeBlockModeFlag(config)
	test.equal(config.blockIsProteinMode, false, 'remains false')

	config.blockIsProteinMode = true
	computeBlockModeFlag(config)
	test.equal(config.blockIsProteinMode, true, 'remains true')

	console.log('priority 3: no override and default, auto compute f(config, null, vocabApi)')
	delete config.blockIsProteinMode // MUST delete flag before every of following test
	computeBlockModeFlag(config, null, vocabApi)
	test.equal(config.blockIsProteinMode, false, 'no gbRestrictMode, no geneSearchResult, auto set to false')

	delete config.blockIsProteinMode
	config.geneSearchResult.geneSymbol = 'xx'
	computeBlockModeFlag(config, null, vocabApi)
	test.equal(config.blockIsProteinMode, true, 'no gbRestrictMode, has gene symbol, auto set to true')

	delete config.blockIsProteinMode
	vocabApi.termdbConfig.queries.gbRestrictMode = 'protein'
	computeBlockModeFlag(config, null, vocabApi)
	test.equal(config.blockIsProteinMode, true, 'gbRestrictMode=protein, auto set to true')

	delete config.blockIsProteinMode
	vocabApi.termdbConfig.queries.gbRestrictMode = 'genomic'
	computeBlockModeFlag(config, null, vocabApi)
	test.equal(config.blockIsProteinMode, false, 'gbRestrictMode=genomic, auto set to false')

	delete config.blockIsProteinMode
	vocabApi.termdbConfig.queries.gbRestrictMode = 'invalid'
	test.throws(
		function () {
			computeBlockModeFlag(config, null, vocabApi)
		},
		/unknown gbRestrictMode/,
		'throws on unknown gbRestrictMode'
	)

	test.end()
})

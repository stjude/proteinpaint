import tape from 'tape'
import { computeBlockModeFlag } from '#plots/gb/GB.ts'

/* 
Tests:

computeBlockModeFlag()
*/

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/genomeBrowser -***-')
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
	// MUST delete flag before every of following test
	delete config.blockIsProteinMode
	computeBlockModeFlag(config, vocabApi)
	test.equal(config.blockIsProteinMode, false, 'no gbRestrictMode, no geneSearchResult, auto set to false')

	delete config.blockIsProteinMode
	config.geneSearchResult.geneSymbol = 'xx'
	computeBlockModeFlag(config, vocabApi)
	test.equal(config.blockIsProteinMode, true, 'no gbRestrictMode, has gene symbol, auto set to true')

	delete config.blockIsProteinMode
	vocabApi.termdbConfig.queries.gbRestrictMode = 'protein'
	computeBlockModeFlag(config, vocabApi)
	test.equal(config.blockIsProteinMode, true, 'gbRestrictMode=protein, auto set to true')

	delete config.blockIsProteinMode
	vocabApi.termdbConfig.queries.gbRestrictMode = 'genomic'
	computeBlockModeFlag(config, vocabApi)
	test.equal(config.blockIsProteinMode, false, 'gbRestrictMode=genomic, auto set to false')

	delete config.blockIsProteinMode
	vocabApi.termdbConfig.queries.gbRestrictMode = 'invalid'
	test.throws(
		function () {
			computeBlockModeFlag(config, vocabApi)
		},
		/unknown gbRestrictMode/,
		'throws on unknown gbRestrictMode'
	)

	test.end()
})

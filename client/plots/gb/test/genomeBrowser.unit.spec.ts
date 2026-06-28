import tape from 'tape'
import { computeBlockModeFlag } from '../GB.ts'
import { getBlockState } from '../interactions/Interactions.ts'

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

tape('getBlockState()', test => {
	const blockInstance: any = {
		rglst: [
			{
				chr: 'chr1',
				bstart: 0,
				bstop: 1000,
				start: 10,
				stop: 100,
				width: 250,
				reverse: true,
				unused: 'skip'
			},
			{ chr: 'chr2', start: 20, stop: 200 }
		],
		startidx: 0,
		stopidx: 1,
		regionspace: 10,
		gmmode: 'genomic',
		coord: { reverse: false }
	}
	const state = getBlockState(blockInstance, [{ chr: 'chr3', start: 30, stop: 300 }])
	test.deepEqual(
		state,
		{
			rglst: [
				{ chr: 'chr1', start: 10, stop: 100, bstart: 0, bstop: 1000, width: 250, reverse: true },
				{ chr: 'chr2', start: 20, stop: 200 }
			],
			startidx: 0,
			stopidx: 1,
			regionspace: 10,
			gmmode: 'genomic',
			coordReverse: false
		},
		'copies serializable block range state'
	)

	test.deepEqual(
		getBlockState(null, [{ chr: 'chr3', start: 30, stop: 300 }]),
		{ rglst: [{ chr: 'chr3', start: 30, stop: 300 }] },
		'falls back to callback rglst'
	)

	test.equal(getBlockState(null, []), null, 'returns null without rglst')
	test.end()
})

import type { AppApi } from '#rx'
import tape from 'tape'
import { ListSamples } from '../ListSamples'
import { getBoxPlotMockData } from '#plots/boxplot/test/mockBoxPlotData.ts'
import { vocabInit } from '#termdb/vocabulary'

/*
Tests:
    - ListSamples.getData()
*/

/*************************
 reusable helper functions
**************************/

function getTestApp(_opts, genome = 'hg38-test', dslabel = 'TermdbTest') {
	const state = Object.assign({}, _opts.state, {
		vocab: { route: 'termdb', genome, dslabel },
		termfilter: {}
	})
	const app: any = {
		getState() {
			return state
		},
		opts: { state }
	}
	const vocabApi = vocabInit({ app, state })
	app.vocabApi = vocabApi

	return app as AppApi
}

/**************
 test section
***************/

tape('\n', function (test) {
	test.comment('-***- dom/summary/ListSamples -***-')
	test.end()
})

tape('ListSamples.getData()', async test => {
	test.timeoutAfter(1000)

	const { mockConfig2, mockPlot1 } = getBoxPlotMockData()
	const opts: any = {
		state: {
			plots: [mockConfig2]
		}
	}
	const mockApp = getTestApp({ state: opts.state })
	const listSamples = new ListSamples(mockApp, mockApp.getState().termfilter, mockConfig2, mockPlot1 as any)

	const data = await listSamples.getData()
	test.true(
		typeof data == 'object' && data.lst && data.refs && data.samples,
		'Should return correct sample data object from getData() with a list, references, and verbose sample info'
	)

	test.end()
})

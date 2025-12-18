import type { AppApi } from '#rx'
import tape from 'tape'
import { ListSamples } from '../interactions/ListSamples'
import { getBoxPlotMockData } from './mockBoxPlotData'
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
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/boxplot/interactions/ListSamples -***-')
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
	test.ok(data, 'Should return data from getData()')

	test.end()
})

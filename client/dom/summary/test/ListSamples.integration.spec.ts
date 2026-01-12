import type { AppApi } from '#rx'
import tape from 'tape'
import { ListSamples } from '../ListSamples'
import { getBoxPlotMockData } from '#plots/boxplot/test/mockBoxPlotData.ts'
import { vocabInit } from '#termdb/vocabulary'
import { getGeneVariantTw } from '../../../test/testdata/data.ts'

/*
Tests:
    - ListSamples.getData() for term=diaggrp and term2=sex returns the correct data object
	- ListSamples.getData() for term=gene exp and term2=gene variant returns the correct data object
*/

/*************************
 reusable helper functions
**************************/

function getTestApp(_opts, genome = 'hg38-test', dslabel = 'TermdbTest') {
	const state = Object.assign({}, _opts.state, {
		vocab: { route: 'termdb', genome, dslabel },
		termfilter: {},
		termdbConfig: { queries: {} }
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

async function getNewListSamples(opts: any = {}) {
	const { mockConfig1, mockPlot1, mockFilter } = getBoxPlotMockData()
	const config = opts.config || mockConfig1
	const plot = opts.plot || mockPlot1

	const mockState: any = {
		plots: [config],
		termfilter: { filter: mockFilter }
	}
	const mockApp = getTestApp({ state: mockState })

	const start = opts.start ?? null
	const end = opts.end ?? null

	const listSamples = new ListSamples(mockApp, mockState.termfilter, config, plot, start, end)

	return { listSamples, config, plot, mockApp, mockState }
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/boxplot/interactions/ListSamples -***-')
	test.end()
})

tape('ListSamples.getData() for term=diaggrp and term2=sex returns the correct data object', async test => {
	test.timeoutAfter(1000)

	const { listSamples } = await getNewListSamples()

	const data = await listSamples.getData()
	test.true(
		typeof data == 'object' && data.lst && data.refs && data.samples,
		'Should return correct sample data object from getData() with a list, references, and verbose sample info'
	)
	test.end()
})

tape('ListSamples.getData() for term=gene exp and term2=gene variant returns the correct data object', async test => {
	test.timeoutAfter(1000)
	const mockTerm2: any = getGeneVariantTw()
	mockTerm2.$id = 'term2'
	const mockConfig = {
		term: {
			term: { gene: 'TP53', name: 'TP53 FPKM', type: 'geneExpression' },
			q: { mode: 'continuous' },
			$id: 'term1'
		},
		term2: mockTerm2,
		bins: {
			term1: {},
			term2: {}
		}
	}
	const mockPlot = {
		seriesId: 'TP53 SNV/indel Mutated (somatic)',
		chartId: ''
	}

	const { listSamples } = await getNewListSamples({ config: mockConfig, plot: mockPlot, start: 0, end: 40 })
	const data = await listSamples.getData()
	test.equal(data.lst.length, 96, 'Should return 96 samples matching gene exp and gene variant filter')
	test.true(data.refs.byTermId[mockConfig.term.$id], 'Should reference the gene expression term')
	test.true(data.refs.byTermId[mockConfig.term2.$id], 'Should reference the gene variant term')

	test.end()
})

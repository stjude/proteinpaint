import type { AppApi } from '#rx'
import tape from 'tape'
import { ListSamples } from '../ListSamples'
import { getBoxPlotMockData } from '#plots/boxplot/test/mockBoxPlotData.ts'
import { vocabInit } from '#termdb/vocabulary'
import { getGeneVariantTw, getSamplelstTw } from '../../../test/testdata/data.ts'
import { termjson } from '../../../test/testdata/termjson'

/*
Tests:
	- ListSamples.getData() for term=numeric returns the correct data object
	- ListSamples.getData() for term=gene exp returns the correct data object
	- ListSamples.getData() for term=gene variant returns the correct data object
    - ListSamples.getData() for term=numeric and term2=categorical returns the correct data object
	- ListSamples.getData() for term=gene exp (continuous) and term2=gene variant returns the correct data object
	- ListSamples.getData() for term=gene variant and term2=gene exp (continuous) returns the correct data object
	- ListSamples.getData() for term=numeric and term2=samplelst returns the correct data object
	- ListSamples.getData() for term=numeric and term2=survival returns the correct data object
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
	const config = opts.config || Object.assign(mockConfig1, { bins: { term1: {}, term2: {} } })
	const plot = opts.plot || mockPlot1

	const mockState: any = {
		plots: [config],
		termfilter: { filter: mockFilter }
	}
	const mockApp = getTestApp({ state: mockState })
	const mockBins = opts.bins || { term1: {}, term2: {} }

	const start = opts.start ?? null
	const end = opts.end ?? null

	const listSamples = new ListSamples(mockApp, mockState.termfilter, config, plot, mockBins, start, end)

	return { listSamples, config, plot, mockApp, mockState }
}

/**************
 test section
***************/

tape('\n', function (test) {
	test.comment('-***- dom/summary/ListSamples -***-')
	test.end()
})

tape('ListSamples.getData() for term=numeric returns the correct data object', async test => {
	test.timeoutAfter(1000)

	const mockConfig = {
		term: {
			term: JSON.parse(JSON.stringify(termjson['agedx'])),
			q: { mode: 'continuous' },
			$id: 'term1'
		}
	}
	const mockBins = { term1: {} }
	const mockPlot = { seriesId: 'All samples', chartId: '' }

	const { listSamples } = await getNewListSamples({
		config: mockConfig,
		plot: mockPlot,
		bins: mockBins,
		start: 0,
		end: 40
	})
	const data = await listSamples.getData()

	test.true(
		typeof data == 'object' && data.lst && data.refs && data.samples,
		'Should return data object from getData() with a list, references, and sample info'
	)
	const expected = 97
	test.equal(data.lst.length, expected, `Should return ${expected} samples matching numeric term filter`)
	test.true(data.refs.byTermId[mockConfig.term.$id], 'Should reference the only numeric term')

	test.end()
})

tape('ListSamples.getData() for term=gene exp returns the correct data object', async test => {
	test.timeoutAfter(1000)
	const mockConfig = {
		term: {
			term: { gene: 'TP53', name: 'TP53 FPKM', type: 'geneExpression' },
			q: { mode: 'continuous' },
			$id: 'term1'
		}
	}
	const mockBins = { term1: {} }
	const mockPlot = { seriesId: 'TP53 SNV/indel Mutated (somatic)', chartId: '' }

	const { listSamples } = await getNewListSamples({
		config: mockConfig,
		plot: mockPlot,
		bins: mockBins,
		start: 0,
		end: 40
	})
	const data = await listSamples.getData()

	test.true(
		typeof data == 'object' && data.lst && data.refs && data.samples,
		'Should return data object from getData() with a list, references, and sample info'
	)
	const expected = 96
	test.equal(data.lst.length, expected, `Should return ${expected} samples matching gene expression term filter`)
	test.true(data.refs.byTermId[mockConfig.term.$id], 'Should reference the only gene expression term')

	test.end()
})

tape('ListSamples.getData() for term=gene variant returns the correct data object', async test => {
	test.timeoutAfter(1000)
	const mockTerm: any = getGeneVariantTw()
	mockTerm.$id = 'term2'
	const mockConfig = { term: mockTerm }
	const mockBins = { term1: {} }
	const mockPlot = { seriesId: 'TP53 SNV/indel Mutated (somatic)', chartId: '' }

	const { listSamples } = await getNewListSamples({
		config: mockConfig,
		plot: mockPlot,
		bins: mockBins,
		start: 0,
		end: 40
	})
	const data = await listSamples.getData()

	test.true(
		typeof data == 'object' && data.lst && data.refs && data.samples,
		'Should return data object from getData() with a list, references, and sample info'
	)
	const expected = 100
	test.equal(data.lst.length, expected, `Should return ${expected} samples matching gene variant term filter`)
	test.true(data.refs.byTermId[mockConfig.term.$id], 'Should reference the only gene variant term')

	test.end()
})

tape('ListSamples.getData() for term=numeric and term2=categorical returns the correct data object', async test => {
	test.timeoutAfter(1000)

	const mockConfig = {
		term: { term: JSON.parse(JSON.stringify(termjson['agedx'])), q: { mode: 'continuous' }, $id: 'term1' },
		term2: { term: JSON.parse(JSON.stringify(termjson['sex'])), q: {}, $id: 'term2' }
	}
	const mockBins = { term1: {}, term2: {} }
	const mockPlot = { key: 'Female', seriesId: '2', chartId: '' }

	const { listSamples, config } = await getNewListSamples({ config: mockConfig, plot: mockPlot, bins: mockBins })
	const data = await listSamples.getData()

	test.true(
		typeof data == 'object' && data.lst && data.refs && data.samples,
		'Should return data object from getData() with a list, references, and sample info'
	)
	const expected = 58
	test.equal(
		data.lst.length,
		expected,
		`Should return ${expected} samples matching numeric term and categorical term filter`
	)
	test.true(data.refs.byTermId[config.term.$id], 'Should reference the numeric term')
	test.true(data.refs.byTermId[config.term2.$id], 'Should reference the categorical term')

	test.end()
})

tape(
	'ListSamples.getData() for term=gene exp (continuous) and term2=gene variant returns the correct data object',
	async test => {
		test.timeoutAfter(1000)
		const mockTerm2: any = getGeneVariantTw()
		mockTerm2.$id = 'term2'
		const mockConfig = {
			term: {
				term: { gene: 'TP53', name: 'TP53 FPKM', type: 'geneExpression' },
				q: { mode: 'continuous' },
				$id: 'term1'
			},
			term2: mockTerm2
		}
		const mockBins = { term1: {}, term2: {} }
		const mockPlot = {
			seriesId: 'TP53 SNV/indel Mutated (somatic)',
			chartId: ''
		}

		const { listSamples } = await getNewListSamples({
			config: mockConfig,
			plot: mockPlot,
			bins: mockBins,
			start: 0,
			end: 40
		})
		const data = await listSamples.getData()

		test.true(
			typeof data == 'object' && data.lst && data.refs && data.samples,
			'Should return data object from getData() with a list, references, and sample info'
		)
		const expected = 96
		test.equal(
			data.lst.length,
			expected,
			`Should return ${expected} samples matching gene exp term and gene variant term filter`
		)
		test.true(data.refs.byTermId[mockConfig.term.$id], 'Should reference the gene expression term')
		test.true(data.refs.byTermId[mockConfig.term2.$id], 'Should reference the gene variant term')

		test.end()
	}
)

tape(
	'ListSamples.getData() for term=gene variant and term2=gene exp (continuous) returns the correct data object',
	async test => {
		test.timeoutAfter(1000)
		const mockTerm: any = getGeneVariantTw()
		mockTerm.$id = 'term1'
		const mockConfig = {
			term: mockTerm,
			term2: {
				term: { gene: 'TP53', name: 'TP53 FPKM', type: 'geneExpression' },
				q: { mode: 'continuous' },
				$id: 'term2'
			}
		}
		const mockPlot = {
			seriesId: 'TP53 SNV/indel Mutated (somatic)',
			chartId: ''
		}
		const mockBins = { term1: {}, term2: {} }

		const { listSamples } = await getNewListSamples({
			config: mockConfig,
			plot: mockPlot,
			bins: mockBins,
			start: 0,
			end: 40
		})
		const data = await listSamples.getData()

		test.true(
			typeof data == 'object' && data.lst && data.refs && data.samples,
			'Should return data object from getData() with a list, references, and sample info'
		)
		const expected = 96
		test.equal(
			data.lst.length,
			expected,
			`Should return ${expected} samples matching gene variant term and gene expression term filter`
		)
		test.true(data.refs.byTermId[mockConfig.term.$id], 'Should reference the gene variant term')
		test.true(data.refs.byTermId[mockConfig.term2.$id], 'Should reference the gene expression term')

		test.end()
	}
)

tape('ListSamples.getData() for term=numeric and term2=samplelst returns the correct data object', async test => {
	test.timeoutAfter(1000)
	const mockTerm2: any = getSamplelstTw()
	mockTerm2.$id = 'term2'
	const mockConfig = {
		term: { term: JSON.parse(JSON.stringify(termjson['agedx'])), q: { mode: 'continuous' }, $id: 'term1' },
		term2: mockTerm2
	}
	const mockBins = { term1: {}, term2: {} }
	const mockPlot = {
		seriesId: 'Group 1',
		chartId: ''
	}

	const { listSamples } = await getNewListSamples({
		config: mockConfig,
		plot: mockPlot,
		bins: mockBins,
		start: -2,
		end: 25
	})
	const data = await listSamples.getData()

	test.true(
		typeof data == 'object' && data.lst && data.refs && data.samples,
		'Should return data object from getData() with a list, references, and sample info'
	)
	const expected = 13
	test.equal(
		data.lst.length,
		expected,
		`Should return ${expected} samples matching numeric term and samplelst term filter`
	)
	test.true(data.refs.byTermId[mockConfig.term.$id], 'Should reference the numeric term')
	test.true(data.refs.byTermId[mockConfig.term2.$id], 'Should reference the samplelst term')

	test.end()
})

tape('ListSamples.getData() for term=numeric and term2=survival returns the correct data object', async test => {
	test.timeoutAfter(1000)

	const mockConfig = {
		term: {
			term: JSON.parse(JSON.stringify(termjson['agedx'])),
			q: { mode: 'continuous', hiddenValues: {} },
			$id: 'term1'
		},
		term2: {
			term: {
				id: 'efs',
				type: 'survival',
				name: 'Event-free survival',
				values: [
					{ key: '0', label: 'No Event' },
					{ key: '1', label: 'Event Occurred' }
				]
			},
			$id: 'term2',
			q: {}
		}
	}
	const mockPlot = {
		key: 'No Event',
		seriesId: '0',
		chartId: ''
	}

	const { listSamples } = await getNewListSamples({
		config: mockConfig,
		plot: mockPlot,
		bins: { term1: {}, term2: {} }
	})
	const data = await listSamples.getData()

	test.true(
		typeof data == 'object' && data.lst && data.refs && data.samples,
		'Should return data object from getData() with a list, references, and sample info'
	)
	const expected = 10
	test.equal(
		data.lst.length,
		expected,
		`Should return ${expected} samples matching numeric term and survival term filter`
	)
	test.true(data.refs.byTermId[mockConfig.term.$id], 'Should reference the numeric term')
	test.true(data.refs.byTermId[mockConfig.term2.$id], 'Should reference the survival term')

	test.end()
})

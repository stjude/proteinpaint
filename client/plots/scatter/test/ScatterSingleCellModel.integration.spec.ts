import tape from 'tape'
import { ScatterSingleCellModel } from '../model/ScatterSingleCellModel.ts'
import { getMockSingleCellScatter } from './mockScatterData.ts'

tape('\n', function (test) {
	test.comment('-***- plots/scatter/model/ScatterSingleCellModel integration -***-')
	test.end()
})

tape('initData loads the single-cell result and initializes the chart', async function (test) {
	test.timeoutAfter(100)
	const seen: any = {}
	const scatter: any = getMockSingleCellScatter({
		app: {
			vocabApi: {
				getScatterSingleCellPlotData: async (reqOpts, signal) => {
					seen.reqOpts = reqOpts
					seen.signal = signal
					return {
						result: {
							Default: {
								samples: [
									{ sampleId: 'c1', x: 1, y: 2, category: 'Default', geneExp: 1 },
									{ sampleId: 'c2', x: 3, y: 4, category: 'Default', geneExp: 3 }
								],
								colorLegend: [['Default', { color: '#abcdef' }]],
								shapeLegend: [['circle', { shape: 0 }]]
							}
						},
						range: { xMin: 0, xMax: 10, yMin: 0, yMax: 10, geMin: 1, geMax: 3 }
					}
				},
				addGroup: async () => undefined
			},
			isAbortError: () => false
		}
	})
	const model = new ScatterSingleCellModel(scatter)

	await model.initData()

	test.equal(seen.signal, 'signal', 'Should pass the abort signal to the request.')
	test.equal(seen.reqOpts.singleCellPlot, scatter.config.singleCellPlot, 'Should request the configured single-cell plot payload.')
	test.equal(model.charts.length, 1, 'Should create one chart from the response.')
	test.equal(model.charts[0].id, 'Default', 'Should name the chart using the server response key.')
	test.equal(model.range.xMax, 10, 'Should store the server-supplied range.')
	test.ok(model.charts[0].ranges, 'Should initialize axis ranges after chart creation.')
	test.end()
})

tape('initData throws when the response contains an error payload', async function (test) {
	test.timeoutAfter(100)
	const scatter: any = getMockSingleCellScatter({
		app: {
			vocabApi: {
				getScatterSingleCellPlotData: async () => ({ error: 'bad request' }),
				addGroup: async () => undefined
			},
			isAbortError: () => false
		}
	})
	const model = new ScatterSingleCellModel(scatter)

	try {
		await model.initData()
		test.fail('Should reject when the API responds with an error payload.')
	} catch (e: any) {
		test.equal(e.message, 'bad request', 'Should surface the server error message.')
	}
	test.end()
})

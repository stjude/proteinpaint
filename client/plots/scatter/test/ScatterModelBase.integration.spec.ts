import tape from 'tape'
import { ScatterModelBase } from '../model/ScatterModelBase.ts'
import { getMockScatter, getMockChart } from './mockScatterData.ts'

class TestScatterModelBase extends ScatterModelBase {
	getDataRequestOpts() {
		return {}
	}
	async initData() {
		return
	}
}

tape('\n', function (test) {
	test.comment('-***- plots/scatter/model/ScatterModelBase integration -***-')
	test.end()
})

tape('addGroup records the plot id and calls the server-side group API', async function (test) {
	test.timeoutAfter(100)
	const seen: any = {}
	const scatter: any = getMockScatter({
		id: 'scatter-42',
		app: {
			vocabApi: {
				addGroup: async (group: any) => {
					seen.group = group
					return group
				}
			}
		}
	})
	const model = new TestScatterModelBase(scatter)
	const group = { name: 'My group', items: [{ sampleId: 's1' }] }

	await model.addGroup(group)

	test.equal(seen.group.plotId, 'scatter-42', 'Should attach the current plot id before sending the group.')
	test.equal(seen.group.name, 'My group', 'Should pass the original group metadata along to the API.')
	test.end()
})

tape('processData calls the lowess fetch for regression and sorts subcharts by configured order', async function (test) {
	test.timeoutAfter(100)
	const seen: any = {}
	const scatter: any = getMockScatter({
		config: {
			term0: {
				term: {
					values: {
						k1: { label: 'Chart-B', order: 2 },
						k2: { label: 'Chart-A', order: 1 }
					}
				}
			}
		},
		settings: { regression: 'Lowess' },
		vocabApi: {
			getLowessCurve: async ({ coords }) => {
				seen.coords = coords
				return [{ x: 1, y: 1 }, { x: 2, y: 2 }]
			}
		}
	})
	const model = new TestScatterModelBase(scatter)
	const chartA: any = getMockChart({
		id: 'Chart-A',
		data: { samples: [{ sampleId: 'sa' }] },
		cohortSamples: [
			{ sampleId: 'a1', x: 1, y: 1 },
			{ sampleId: 'a2', x: 2, y: 2 },
			{ sampleId: 'a3', x: 3, y: 3 }
		],
		xAxisScale: (n: number) => n,
		yAxisScale: (n: number) => n,
		ranges: { xMin: 0, xMax: 5, yMin: 0, yMax: 5, zMin: 0, zMax: 1, scaleMin: 0, scaleMax: 1, geMin: 0, geMax: 1 }
	})
	const chartB: any = getMockChart({
		id: 'Chart-B',
		data: { samples: [{ sampleId: 'sb' }] },
		cohortSamples: [
			{ sampleId: 'b1', x: 1, y: 2 },
			{ sampleId: 'b2', x: 2, y: 3 },
			{ sampleId: 'b3', x: 3, y: 4 }
		],
		xAxisScale: (n: number) => n,
		yAxisScale: (n: number) => n,
		ranges: { xMin: 0, xMax: 5, yMin: 0, yMax: 5, zMin: 0, zMax: 1, scaleMin: 0, scaleMax: 1, geMin: 0, geMax: 1 }
	})
	model.charts = [chartB, chartA]

	await model.processData()

	test.equal(model.charts[0].id, 'Chart-A', 'Should sort charts by configured term0 order before processing.')
	test.ok(Array.isArray(seen.coords.X), 'Should send the lowess X coordinates to the server.')
	test.ok(Array.isArray(seen.coords.Y), 'Should send the lowess Y coordinates to the server.')
	test.equal(model.charts[0].regressionCurve.length, 2, 'Should store the server response on the chart.')
	test.end()
})

import tape from 'tape'
import { ScatterModel, getCoordinate } from '../model/scatterModel.ts'
import { getDefaultScatterSettings } from '../settings/defaults.ts'

/** Tests:
 *  - getDataRequestOpts builds expected request payload
 *  - createChart converts legends to Map and sets is2DLarge for large cohort
 *  - initRanges honors user scale caps and global min/max settings
 *  - getOpacity, getStrokeWidth, getShape and getCoordinates return expected values
 *  - getScale and transform support fixed and data-driven sizing
 *  - getColor supports categorical and continuous clamping
 *  - initAxes applies continuous colorScale modes: auto, fixed, percentile
 *  - processData sorts charts and computes polynomial regression curve
 *  - getCoordinate returns value as coordinate when min and max are null
 *  - getCoordinate returns value when value is within min and max
 *  - getCoordinate returns min as coordinate when value smaller than min
 *  - getCoordinate returns max as coordinate when value greater than max
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/scatter/model/scatterModel -***-')
	test.end()
})

function getMockScatter(overrides: any = {}) {
	const base = {
		id: 'scatter-1',
		type: 'sampleScatter',
		parentId: null,
		zoom: 1,
		config: {
			name: 'plot-name',
			term: { term: { id: 'agedx', type: 'numeric' } },
			term2: { term: { id: 'TP53 FPKM', type: 'geneExpression' } },
			settings: {
				sampleScatter: {
					colorScaleMode: 'auto',
					colorScaleMinFixed: 0,
					colorScaleMaxFixed: 100,
					colorScalePercentile: 50
				}
			}
		},
		state: { termfilter: { filter: {}, filter0: {} } },
		settings: getDefaultScatterSettings()
	}
	return {
		...base,
		...overrides,
		config: { ...base.config, ...(overrides.config || {}) },
		state: { ...base.state, ...(overrides.state || {}) },
		settings: { ...base.settings, ...(overrides.settings || {}) }
	}
}

function getMockChart(overrides: any = {}) {
	const base = {
		id: 'chart-1',
		data: { samples: [] as any[] },
		cohortSamples: [] as any[],
		shapeLegend: new Map([['circle', { shape: 0 }]]),
		colorLegend: new Map([
			['Default', { color: '#ccc' }],
			['A', { color: '#f00' }]
		]),
		ranges: {
			xMin: 0,
			xMax: 100,
			yMin: 0,
			yMax: 100,
			zMin: 0,
			zMax: 10,
			scaleMin: 10,
			scaleMax: 20,
			geMin: 1,
			geMax: 5
		}
	}
	return { ...base, ...overrides }
}

tape('getDataRequestOpts builds expected request payload', function (test) {
	test.timeoutAfter(100)
	const scatter: any = getMockScatter({
		parentId: 'parent',
		config: {
			colorTW: { q: { mode: 'continuous' } },
			shapeTW: { term: { id: 'shape' } },
			scaleDotTW: { term: { id: 'scale' } },
			term0: { id: 'divide' },
			colorColumn: 'myColorColumn'
		}
	})
	const model = new ScatterModel(scatter)
	const opts: any = model.getDataRequestOpts()

	test.deepEqual(opts.coordTWs, [scatter.config.term, scatter.config.term2], 'Should include coordinate term wrappers.')
	test.equal(opts.name, scatter.config.name, 'Should include plot name.')
	test.equal(opts.chartType, scatter.type, 'Should include chart type.')
	test.equal(opts.filter, scatter.state.termfilter.filter, 'Should use the state filter when parentId is present.')
	test.ok(opts.filter0, 'Should include filter0 when present.')
	test.equal(opts.colorColumn, 'myColorColumn', 'Should include colorColumn.')
	test.equal(opts.divideByTW, scatter.config.term0, 'Should include divideByTW.')
	test.equal(opts.scaleDotTW.q.mode, 'continuous', 'Should force continuous mode for scaleDotTW.')
	test.end()
})

tape('createChart converts legends to Map and sets is2DLarge for large cohort', function (test) {
	test.timeoutAfter(100)
	const scatter: any = getMockScatter()
	const model = new ScatterModel(scatter)
	const manySamples = Array.from({ length: 20001 }, (_, i) => ({ sampleId: 's' + i, x: i, y: i, z: 0 }))
	model.charts = [] //made in initData(), create here to test createChart() in isolation
	model.createChart('A', {
		samples: manySamples,
		colorLegend: [['A', { color: '#f00' }]],
		shapeLegend: [['circle', { shape: 0 }]]
	} as any)

	test.equal(model.is2DLarge, true, 'Should set is2DLarge when the cohort sample cutoff is exceeded.')
	test.equal(model.charts.length, 1, 'Should create one chart.')
	test.equal(model.charts[0].colorLegend instanceof Map, true, 'Should create colorLegend as a Map.')
	test.equal(model.charts[0].shapeLegend instanceof Map, true, 'Should create shapeLegend as a Map.')
	test.end()
})

tape('initRanges honors user scale caps and global min/max settings', async function (test) {
	test.timeoutAfter(100)
	const scatter: any = getMockScatter({
		settings: {
			minXScale: 5,
			maxXScale: 50,
			minYScale: null,
			maxYScale: null,
			useGlobalMinMax: true
		}
	})
	const model = new ScatterModel(scatter)
	model.range = { xMin: -100, xMax: 100, yMin: -200, yMax: 200 }
	model.charts = [
		getMockChart({
			data: {
				samples: [
					{ sampleId: 's1', x: 10, y: 20, z: 1, scale: 3, geneExp: 9 },
					{ sampleId: 's2', x: 12, y: 18, z: 4, scale: 5, geneExp: 2 }
				]
			}
		}) as any
	]

	await model.initRanges()
	const ranges: any = model.charts[0].ranges

	test.equal(ranges.xMin, 5, 'Should use the explicit xMin setting cap.')
	test.equal(ranges.xMax, 50, 'Should use the explicit xMax setting cap.')
	test.equal(ranges.yMin, -200, 'Should use global yMin when enabled and no cap is set.')
	test.equal(ranges.yMax, 200, 'Should use global yMax when enabled and no cap is set.')
	test.equal(ranges.zMin, 1, 'Should compute zMin from samples.')
	test.equal(ranges.zMax, 4, 'Should compute zMax from samples.')
	test.equal(ranges.scaleMin, 3, 'Should compute scaleMin from samples.')
	test.equal(ranges.scaleMax, 5, 'Should compute scaleMax from samples.')
	test.equal(ranges.geMin, 2, 'Should compute gene expression minimum from samples.')
	test.equal(ranges.geMax, 9, 'Should compute gene expression maximum from samples.')
	test.end()
})

tape('getOpacity, getStrokeWidth, getShape and getCoordinates return expected values', function (test) {
	test.timeoutAfter(100)
	const scatter: any = getMockScatter()
	const model = new ScatterModel(scatter)
	const chart: any = getMockChart()
	chart.xAxisScale = (n: number) => n + 1
	chart.yAxisScale = (n: number) => n + 2

	const sample = { sampleId: 's1', sample: 'Alpha', x: 1, y: 2, shape: 'circle' }
	test.equal(model.getOpacity(sample), 0.6, 'Should return configured opacity for a visible sample.')
	test.equal(model.getStrokeWidth(sample), 1, 'Should return normal stroke width for a visible sample.')

	model.filterSampleStr = 'alp'
	test.equal(model.getOpacity(sample), 1.2, 'Should return highlighted opacity for a search-hit sample.')
	test.equal(model.getStrokeWidth(sample), 2, 'Should return thicker stroke width for a search-hit sample.')

	test.equal(
		model.getOpacity({ sampleId: 's2', sample: 'Beta', hidden: { category: true } }),
		0,
		'Should return zero opacity for a hidden sample.'
	)
	test.equal(
		model.getStrokeWidth({ sampleId: 's2', sample: 'Beta', hidden: { category: true } }),
		0,
		'Should return no stroke width for a hidden sample.'
	)
	test.equal(model.getOpacity({ x: 0, y: 0 }), 0.6, 'Should return reference opacity based on the showRef setting.')

	const shape = model.getShape(chart, sample)
	test.ok(!!shape, 'Should return a valid shape entry.')

	scatter.settings.minXScale = 2
	scatter.settings.maxYScale = 1
	const coords = model.getCoordinates(chart, { x: 1, y: 2 })
	test.deepEqual(coords, { x: 3, y: 3 }, 'Should clamp coordinates and transform them with axis scales.')
	test.end()
})

tape('getScale and transform support fixed and data-driven sizing', function (test) {
	test.timeoutAfter(100)
	const scatter: any = getMockScatter()
	const model = new ScatterModel(scatter)
	const chart: any = getMockChart({
		xAxisScale: (n: number) => n,
		yAxisScale: (n: number) => n
	})

	const sample = { sampleId: 's1', sample: 'Alpha', x: 10, y: 10, scale: 15 }
	const ref = { x: 10, y: 10, scale: 15 }

	const s = scatter.settings

	test.equal(
		model.getScale(chart, sample),
		s.maxShapeSize / sample.scale,
		'Should use settings.size for sample size when not data-driven.'
	)
	test.equal(
		model.getScale(chart, ref),
		s.maxShapeSize / ref.scale,
		'Should use settings.refSize for reference size when not data-driven.'
	)

	scatter.config.scaleDotTW = { q: { mode: 'continuous' } }
	scatter.settings.scaleDotOrder = 'Ascending'
	test.equal(model.getScale(chart, sample), 0.75, 'Should map ascending order scale to the min-to-max size range.')

	scatter.settings.scaleDotOrder = 'Descending'
	test.equal(model.getScale(chart, sample), 0.75, 'Should map descending order scale to the max-to-min size range.')

	model.is2DLarge = true
	scatter.zoom = 2
	test.equal(model.getScale(chart, sample), 1.5, 'Should apply the zoom multiplier to size in large 2D mode.')

	model.filterSampleStr = 'alp'
	test.equal(model.getScale(chart, sample), 3, 'Should boost scale for a search-hit sample.')
	test.equal(
		model.getScale(chart, { ...sample, sample: 'Other' }),
		1.2000000000000002,
		'Should reduce scale for a non-hit sample.'
	)

	const transform = model.transform(chart, sample)
	test.ok(transform.includes('translate('), 'Should return a translated SVG transform.')
	test.ok(transform.includes('scale('), 'Should return a scaled SVG transform.')
	test.end()
})

tape('getColor supports categorical and continuous clamping', function (test) {
	test.timeoutAfter(100)
	const scatter: any = getMockScatter({
		config: {
			colorTW: { q: { mode: 'continuous' }, term: { type: 'categorical' } }
		}
	})
	const model = new ScatterModel(scatter)
	const chart: any = getMockChart({
		colorGenerator: ((v: number) => `rgb(${v},0,0)`) as any
	})
	chart.colorGenerator.domain = () => [10, 20]

	test.equal(
		model.getColor({ sampleId: 's1', category: 5 }, chart),
		'rgb(10,0,0)',
		'Should clamp continuous values below the domain to the minimum.'
	)
	test.equal(
		model.getColor({ sampleId: 's1', category: 25 }, chart),
		'rgb(20,0,0)',
		'Should clamp continuous values above the domain to the maximum.'
	)
	test.equal(
		model.getColor({ sampleId: 's1', category: 12 }, chart),
		'rgb(12,0,0)',
		'Should pass through continuous values within the domain.'
	)
	test.equal(
		model.getColor({ category: 'Default' }, chart),
		'#ce768e',
		'Should use the scatter default color for the Default category.'
	)
	test.equal(
		model.getColor({ category: 'A' }, chart),
		'#f00',
		'Should use the color legend mapping for categorical values.'
	)
	test.end()
})

tape('initAxes applies continuous colorScale modes: auto, fixed, percentile', function (test) {
	test.timeoutAfter(100)
	const scatter: any = getMockScatter({
		config: {
			colorTW: {
				q: { mode: 'continuous' },
				term: { type: 'categorical', continuousColorScale: { minColor: '#000000', maxColor: '#ffffff' } }
			}
		}
	})
	const model = new ScatterModel(scatter)
	const chart: any = getMockChart({
		id: 'chart-1',
		data: { samples: [{ sampleId: 's1' }] },
		cohortSamples: [{ category: 1 }, { category: 3 }, { category: 5 }, { category: 9 }]
	})

	const assertRange = (mode: string, expectedMin: number, expectedMax: number, msg: string) => {
		scatter.config.settings.sampleScatter.colorScaleMode = mode
		model.initAxes(chart)
		test.equal(chart.currentColorRange.min, expectedMin, `Should set ${msg} minimum.`)
		test.equal(chart.currentColorRange.max, expectedMax, `Should set ${msg} maximum.`)
	}

	assertRange('auto', 1, 9, 'the auto mode full-range')

	scatter.config.settings.sampleScatter.colorScaleMinFixed = -10
	scatter.config.settings.sampleScatter.colorScaleMaxFixed = 50
	assertRange('fixed', -10, 50, 'the fixed mode configured-range')

	scatter.config.settings.sampleScatter.colorScalePercentile = 50
	assertRange('percentile', 1, 5, 'the percentile mode percentile-range')
	test.end()
})

tape('processData sorts charts and computes polynomial regression curve', async function (test) {
	test.timeoutAfter(100)
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
		settings: { regression: 'Polynomial' }
	})
	const model = new ScatterModel(scatter)
	const chartA: any = getMockChart({
		id: 'Chart-A',
		data: { samples: [{ sampleId: 'sa' }] },
		cohortSamples: [
			{ sampleId: 'a1', x: 1, y: 1 },
			{ sampleId: 'a2', x: 2, y: 2 },
			{ sampleId: 'a3', x: 3, y: 4 },
			{ sampleId: 'a4', x: 4, y: 5 }
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
			{ sampleId: 'b3', x: 3, y: 3 },
			{ sampleId: 'b4', x: 4, y: 4 }
		],
		xAxisScale: (n: number) => n,
		yAxisScale: (n: number) => n,
		ranges: { xMin: 0, xMax: 5, yMin: 0, yMax: 5, zMin: 0, zMax: 1, scaleMin: 0, scaleMax: 1, geMin: 0, geMax: 1 }
	})

	model.charts = [chartB, chartA]
	await model.processData()

	test.equal(model.charts[0].id, 'Chart-A', 'Should sort charts by configured term0 order.')
	test.ok(Array.isArray(model.charts[0].regressionCurve), 'Should set polynomial regression curve output.')
	test.end()
})

tape('getCoordinate returns value as coordinate when min and max are null', function (test) {
	test.timeoutAfter(100)
	const value = 5
	const min = null
	const max = null
	const result = getCoordinate(value, min, max)
	test.equal(result, value, 'Should return the value when min and max are null.')
	test.end()
})

tape('getCoordinate returns value when value is within min and max', function (test) {
	test.timeoutAfter(100)
	const value = 50
	const min = 10
	const max = 100
	const result = getCoordinate(value, min, max)
	test.equal(result, value, 'Should return the value when it is within min and max.')
	test.end()
})

tape('getCoordinate returns min as coordinate when value smaller than min', function (test) {
	test.timeoutAfter(100)
	const value = 5
	const min = 10
	const max = 100
	const result = getCoordinate(value, min, max)
	test.equal(result, min, 'Should return min when value is less than min.')
	test.end()
})

tape('getCoordinate returns max as coordinate when value greater than max', function (test) {
	test.timeoutAfter(100)
	const value = 105
	const min = 10
	const max = 100
	const result = getCoordinate(value, min, max)
	test.equal(result, max, 'Should return max when value is greater than max.')
	test.end()
})

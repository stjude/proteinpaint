import tape from 'tape'
import { SINGLECELL_GENE_EXPRESSION } from '#types'
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

function getModel(overrides: any = {}) {
	return new TestScatterModelBase(getMockScatter(overrides) as any)
}

tape('\n', function (test) {
	test.comment('-***- plots/scatter/model/ScatterModelBase -***-')
	test.end()
})

tape('createChart converts legends into Maps and flags large cohort data', function (test) {
	test.timeoutAfter(100)
	const model = getModel()
	const largeSamples = Array.from({ length: 20001 }, (_, i) => ({ sampleId: 's' + i, x: i, y: i, z: 0 }))
	model.charts = []
	model.createChart('A', {
		samples: largeSamples,
		colorLegend: [['A', { color: '#f00' }]],
		shapeLegend: [['circle', { shape: 0 }]]
	} as any)

	test.equal(model.is2DLarge, true, 'Should set is2DLarge when cohort samples exceed the cutoff.')
	test.equal(model.charts.length, 1, 'Should create a single chart entry.')
	test.equal(model.charts[0].colorLegend instanceof Map, true, 'Should convert the color legend to a Map.')
	test.equal(model.charts[0].shapeLegend instanceof Map, true, 'Should convert the shape legend to a Map.')
	test.end()
})

tape('initRanges honors user caps and global min/max overrides', async function (test) {
	test.timeoutAfter(100)
	const model = getModel({
		settings: {
			minXScale: 5,
			maxXScale: 50,
			minYScale: null,
			maxYScale: null,
			useGlobalMinMax: true
		}
	})
	model.range = { xMin: -100, xMax: 100, yMin: -200, yMax: 200, geMin: 1, geMax: 5 } as any
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

	test.equal(ranges.xMin, 5, 'Should cap the xMin to the explicit user setting.')
	test.equal(ranges.xMax, 50, 'Should cap the xMax to the explicit user setting.')
	test.equal(ranges.yMin, -200, 'Should honor the global yMin when no local cap is set.')
	test.equal(ranges.yMax, 200, 'Should honor the global yMax when no local cap is set.')
	test.equal(ranges.zMin, 1, 'Should compute zMin from sample values.')
	test.equal(ranges.zMax, 4, 'Should compute zMax from sample values.')
	test.equal(ranges.scaleMin, 3, 'Should compute the minimum scale.')
	test.equal(ranges.scaleMax, 5, 'Should compute the maximum scale.')
	test.equal(ranges.geMin, 2, 'Should compute the minimum gene expression value.')
	test.equal(ranges.geMax, 9, 'Should compute the maximum gene expression value.')
	test.end()
})

tape('getOpacity, getStrokeWidth, getShape, and getCoordinates behave as expected', function (test) {
	test.timeoutAfter(100)
	const model = getModel()
	const chart: any = getMockChart()
	chart.xAxisScale = (n: number) => n + 1
	chart.yAxisScale = (n: number) => n + 2
	const sample = { sampleId: 's1', sample: 'Alpha', x: 1, y: 2, shape: 'circle' }

	test.equal(model.getOpacity(sample), 0.6, 'Should return the configured opacity for a visible sample.')
	test.equal(model.getStrokeWidth(sample), 1, 'Should return a normal stroke width by default.')

	model.filterSampleStr = 'alp'
	test.equal(model.getOpacity(sample), 1.2, 'Should boost opacity for a matching filtered sample.')
	test.equal(model.getStrokeWidth(sample), 2, 'Should thicken stroke width for a matched sample.')
	test.equal(model.getOpacity({ sampleId: 's2', sample: 'Beta', hidden: { category: true } }), 0, 'Should hide category-hidden samples.')
	test.equal(model.getStrokeWidth({ sampleId: 's2', sample: 'Beta', hidden: { category: true } }), 0, 'Should emit no stroke width for hidden samples.')
	test.equal(model.getOpacity({ x: 0, y: 0, isRef: true }), 0.6, 'Should use reference opacity settings for ref markers.')
	test.ok(!!model.getShape(chart, sample), 'Should resolve a valid svg shape for the sample.')

	const coords = model.getCoordinates(chart, { x: 1, y: 2 })
	test.deepEqual(coords, { x: 2, y: 4 }, 'Should apply the axis transform to the clamped coordinates.')
	test.end()
})

tape('getScale and transform support fixed and data-driven sizing', function (test) {
	test.timeoutAfter(100)
	const model = getModel()
	const chart: any = getMockChart({ xAxisScale: (n: number) => n, yAxisScale: (n: number) => n })
	const sample = { sampleId: 's1', sample: 'Alpha', x: 10, y: 10, scale: 15 }
	const ref = { x: 10, y: 10, scale: 15, isRef: true }
	const settings = model.scatter.settings

	test.equal(model.getScale(chart, sample), settings.maxShapeSize / sample.scale, 'Should use settings.size with data-driven sizing disabled.')
	test.equal(model.getScale(chart, ref), settings.maxShapeSize / ref.scale, 'Should use settings.refSize for reference points.')

	model.scatter.config.scaleDotTW = { q: { mode: 'continuous' } }
	model.scatter.settings.scaleDotOrder = 'Ascending'
	test.equal(model.getScale(chart, sample), 0.75, 'Should map ascending scale values across the configured size range.')

	model.scatter.settings.scaleDotOrder = 'Descending'
	test.equal(model.getScale(chart, sample), 0.75, 'Should map descending scale values across the configured size range.')

	model.is2DLarge = true
	model.scatter.zoom = 2
	test.equal(model.getScale(chart, sample), 1.5, 'Should apply the zoom multiplier for large 2D plots.')

	model.filterSampleStr = 'alp'
	test.equal(model.getScale(chart, sample), 3, 'Should enlarge the scale for a matching filtered sample.')
	test.equal(model.getScale(chart, { ...sample, sample: 'Other' }), 1.2000000000000002, 'Should shrink non-matching sample scale under the filter.')

	const transform = model.transform(chart, sample)
	test.ok(transform.includes('translate('), 'Should produce a translate transform.')
	test.ok(transform.includes('scale('), 'Should produce a scale transform.')
	test.end()
})

tape('getColor supports categorical and continuous clamping', function (test) {
	test.timeoutAfter(100)
	const model = getModel({
		config: { colorTW: { q: { mode: 'continuous' }, term: { type: 'categorical' } } }
	})
	const chart: any = getMockChart({
		colorGenerator: ((v: number) => `rgb(${v},0,0)`) as any
	})
	chart.colorGenerator.domain = () => [10, 20]

	test.equal(model.getColor({ sampleId: 's1', category: 5 }, chart), 'rgb(10,0,0)', 'Should clamp low continuous values to the minimum range.')
	test.equal(model.getColor({ sampleId: 's1', category: 25 }, chart), 'rgb(20,0,0)', 'Should clamp high continuous values to the maximum range.')
	test.equal(model.getColor({ sampleId: 's1', category: 12 }, chart), 'rgb(12,0,0)', 'Should use the value directly within the range.')
	test.equal(model.getColor({ category: 'Default', isRef: true }, chart), '#ce768e', 'Should use the scatter default color for the Default reference category.')
	test.equal(model.getColor({ category: 'A', isRef: true }, chart), '#f00', 'Should use the color legend mapping for categorical reference values.')
	test.end()
})

tape('initColorDefaults seeds gradient colors for continuous color maps', function (test) {
	test.timeoutAfter(100)
	const model = getModel({
		config: { colorTW: { term: { type: SINGLECELL_GENE_EXPRESSION } } },
		settings: { defaultColor: '#123456', noExpColor: '#f5f5f5', expColor: '#ff000d' }
	})

	model.initColorDefaults('Default')
	test.equal(model.scatter.config.startColor.Default, '#f5f5f5', 'Should use the no-exp color for gene-expression start gradients.')
	test.equal(model.scatter.config.stopColor.Default, '#ff000d', 'Should use the exp color for gene-expression stop gradients.')

	const baseModel = getModel({
		config: { colorTW: { term: { type: 'numeric' } } },
		settings: { defaultColor: '#123456' }
	})
	baseModel.initColorDefaults('A')
	test.ok(typeof baseModel.scatter.config.startColor.A === 'string', 'Should create a default start color for non-gene-expression gradient maps.')
	test.ok(typeof baseModel.scatter.config.stopColor.A === 'string', 'Should create a default stop color for non-gene-expression gradient maps.')
	test.end()
})

tape('initAxes applies color scale modes and date axis orientation', function (test) {
	test.timeoutAfter(100)
	const model = getModel({
		config: {
			colorTW: {
				q: { mode: 'continuous' },
				term: { type: 'categorical', continuousColorScale: { minColor: '#000000', maxColor: '#ffffff' } }
			}
		}
	})
	const chart: any = getMockChart({
		id: 'chart-1',
		data: { samples: [{ sampleId: 's1' }] },
		cohortSamples: [{ category: 1 }, { category: 3 }, { category: 5 }, { category: 9 }]
	})
	const assertRange = (mode: string, expectedMin: number, expectedMax: number, label: string) => {
		model.scatter.config.settings.sampleScatter.colorScaleMode = mode
		model.initAxes(chart)
		test.equal(chart.currentColorRange.min, expectedMin, `Should set the ${label} minimum.`)
		test.equal(chart.currentColorRange.max, expectedMax, `Should set the ${label} maximum.`)
	}

	assertRange('auto', 1, 9, 'auto mode full range')
	model.scatter.config.settings.sampleScatter.colorScaleMinFixed = -10
	model.scatter.config.settings.sampleScatter.colorScaleMaxFixed = 50
	assertRange('fixed', -10, 50, 'fixed mode configured range')
	model.scatter.config.settings.sampleScatter.colorScalePercentile = 50
	assertRange('percentile', 1, 5, 'percentile mode range')

	const dateModel = getModel({
		config: {
			term: { term: { id: 'agedx', type: 'integer' } },
			term2: { term: { id: 'visitdate', type: 'date' } }
		}
	})
	const dateChart: any = getMockChart({
		id: 'date-chart',
		data: { samples: [{ sampleId: 's1', x: 5, y: 2010 }] },
		ranges: {
			xMin: 0,
			xMax: 20,
			yMin: 2000,
			yMax: 2020,
			zMin: 0,
			zMax: 10,
			scaleMin: 10,
			scaleMax: 20,
			geMin: 1,
			geMax: 5
		}
	})
	dateModel.initAxes(dateChart)
	const [top, bottom] = dateChart.yAxisScaleTime.range()
	test.ok(bottom > top, 'Should keep SVG y growth downward for date axes.')
	const lateDate = new Date(2019, 0, 1)
	const earlyDate = new Date(2001, 0, 1)
	test.ok(dateChart.yAxisScaleTime(lateDate) < dateChart.yAxisScaleTime(earlyDate), 'Should render later dates above earlier dates.')
	test.end()
})
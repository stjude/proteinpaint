import test from 'tape'
import discoDefaults from '#plots/disco/defaults.ts'
import Reference from '#plots/disco/chromosome/Reference.ts'
import CnvArcsMapper from '#plots/disco/cnv/CnvArcsMapper.ts'
import DataMapper from '#plots/disco/data/DataMapper.ts'
import { CnvRenderingType } from '#plots/disco/cnv/CnvRenderingType.ts'
import { CnvType } from '#plots/disco/cnv/CnvType.ts'
import { dtitd, mclass, mclassitd } from '#shared/common.js'
import { CnvHeatmapRenderer } from '#plots/disco/cnv/CnvHeatmapRenderer.ts'

const overriders = { padAngle: 0.0 }
const settings = discoDefaults(overriders)

const sampleName = 'Sample'
const chromosomesOrder = ['chr1', 'chr2']
const chromosomes = {
	chr1: 100,
	chr2: 100
}

const reference = new Reference(settings, chromosomesOrder, chromosomes)

const rawData = [
	{
		chr: 'chr1',
		dt: 4,
		start: 0,
		stop: 100,
		value: -1
	},
	{
		chr: 'chr2',
		dt: 4,
		start: 0,
		stop: 100,
		value: 6
	}
]

const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)

const data = dataHolder.cnvData
const cnvArcsMapper = new CnvArcsMapper(
	10,
	5,
	settings,
	'Sample',
	reference,
	dataHolder.percentilePositive,
	dataHolder.percentileNegative,
	dataHolder.cappedCnvMaxAbsValue,
	dataHolder.cnvMaxPercentileAbs,
	'Unit',
	CnvRenderingType.bar
)
const arcs = cnvArcsMapper.map(data)

test('CnvArcsMapper.map() should return an array of CnvArc objects', t => {
	t.equal(arcs.length, 2, 'Number of arcs should be equal to the number of data items')

	const arc0 = arcs[0]
	const arc1 = arcs[1]

	t.equal(arc0.startAngle, 0, 'Arc 0 has start angle which is 0')
	t.equal(arc0.endAngle, Math.PI, 'Arc 0 has end angle which is PI')
	t.equal(arc0.innerRadius, 11.5, 'Arc 0 has inner radius 11.5')
	t.equal(arc0.outerRadius, 12.5, 'Arc 0 has outer radius 12.5')

	t.equal(arc1.startAngle, Math.PI, 'Arc 1 has startAngle which is PI')
	t.equal(arc1.endAngle, 2 * Math.PI, 'Arc 1 has endAngle which is 2*PI')
	t.equal(arc1.innerRadius, 12.5, 'Arc 1 has inner radius 12.5')
	t.equal(arc1.outerRadius, 15, 'Arc 1 has outer radius 15')

	t.end()
})

test('CnvArcsMapper.map() renders ITD across the full CNV ring width', t => {
	const itdData = new DataMapper(settings, reference, sampleName, []).map([
		{ chr: 'chr1', dt: dtitd, class: mclassitd, start: 25, stop: 30 }
	]).cnvData
	const mapper = new CnvArcsMapper(10, 5, settings, sampleName, reference, 0, 0, 0, 0, 'Unit', CnvRenderingType.bar)
	const itdArc = mapper.map(itdData)[0]

	t.equal(itdArc.dt, dtitd, 'Arc retains the ITD data type')
	t.equal(itdArc.innerRadius, 10, 'ITD starts at the CNV ring inner radius')
	t.equal(itdArc.outerRadius, 15, 'ITD spans the full CNV ring width')
	t.equal(itdArc.color, mclass[mclassitd].color, 'ITD uses the shared ITD color')
	t.equal(
		new CnvHeatmapRenderer().getColor(itdArc.color, Number.NaN, itdArc.dt),
		mclass[mclassitd].color,
		'Heatmap rendering preserves the ITD color'
	)
	t.equal(mapper.cnvClassMap.get(CnvType.ITD)?.value, 1, 'ITD count is added to the CNV legend')
	t.end()
})

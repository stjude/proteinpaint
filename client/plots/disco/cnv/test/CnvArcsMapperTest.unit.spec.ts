import test from 'tape'
import discoDefaults from '#plots/disco/defaults.ts'
import Reference from '#plots/disco/chromosome/Reference.ts'
import CnvArcsMapper from '#plots/disco/cnv/CnvArcsMapper.ts'
import DataMapper from '#plots/disco/data/DataMapper.ts'
import { CnvRenderingType } from '#plots/disco/cnv/CnvRenderingType.ts'

const overriders = { padAngle: 0.0 }
const settings = discoDefaults(overriders)

const sampleName = 'Sample'
const chromosomes = {
	chr1: 100,
	chr2: 100
}

const reference = new Reference(settings, chromosomes)

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

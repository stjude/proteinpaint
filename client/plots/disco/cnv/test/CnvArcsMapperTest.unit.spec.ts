import test from 'tape'
import discoDefaults from '#plots/disco/defaults.ts'
import Reference from '#plots/disco/chromosome/Reference.ts'
import CnvArcsMapper from '#plots/disco/cnv/CnvArcsMapper.ts'
import DataMapper from '#plots/disco/data/DataMapper.ts'

const overriders = { rings: { labelLinesInnerRadius: 10, labelsToLinesDistance: 5, labelsToLinesGap: 2 } }
const settings = discoDefaults(overriders)

const sampleName = 'Sample'
const chromosomes = {
	chr1: 100,
	chr2: 150
}

const reference = new Reference(settings, chromosomes)

test('CnvArcsMapper.map() should return an array of CnvArc objects', t => {
	const cnvArcsMapper = new CnvArcsMapper(10, 5, settings, 'Sample', reference)
	const rawData = [
		{
			chr: 'chr1',
			dt: 4,
			start: 105,
			stop: 110,
			value: 0.0101
		}
	]

	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)

	const data = dataHolder.cnvData

	console.log('dataHolder.cnvData', dataHolder.cnvData)

	const arcs = cnvArcsMapper.map(data)

	t.equal(Array.isArray(arcs), true, 'Returned value should be an array')
	t.equal(arcs.length, data.length, 'Number of arcs should be equal to the number of data items')

	arcs.forEach((arc, i) => {
		t.equal(typeof arc.startAngle, 'number', `Arc ${i + 1} should have a numeric startAngle`)
		t.equal(typeof arc.endAngle, 'number', `Arc ${i + 1} should have a numeric endAngle`)
		t.equal(typeof arc.innerRadius, 'number', `Arc ${i + 1} should have a numeric innerRadius`)
		t.equal(typeof arc.outerRadius, 'number', `Arc ${i + 1} should have a numeric outerRadius`)
		t.equal(typeof arc.color, 'string', `Arc ${i + 1} should have a color`)
		t.equal(typeof arc.chr, 'string', `Arc ${i + 1} should have a chr`)
		t.equal(typeof arc.start, 'number', `Arc ${i + 1} should have a numeric start`)
		t.equal(typeof arc.stop, 'number', `Arc ${i + 1} should have a numeric stop`)
		t.equal(typeof arc.value, 'number', `Arc ${i + 1} should have a numeric value`)
		t.equal(typeof arc.unit, 'string', `Arc ${i + 1} should have a unit`)
	})

	t.end()
})

// Add more test cases as needed

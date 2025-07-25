import test from 'tape'
import Reference from '#plots/disco/chromosome/Reference.ts'
import SnvArcsMapper from '#plots/disco/snv/SnvArcsMapper.ts'
import DataMapper from '#plots/disco/data/DataMapper.ts'
import discoDefaults from '#plots/disco/defaults.ts'
import { dtsnvindel } from '#shared/common.js'

const overriders = { padAngle: 0.0 }
const settings = discoDefaults(overriders)

// TODO - Fix this test if chr is length 100
const sampleName = 'Sample'
const chromosomesOrder = ['chr1', 'chr2']
const chromosomes = {
	chr1: 100000,
	chr2: 100000
}

const reference = new Reference(settings, chromosomesOrder, chromosomes)
const snvArcsMapper = new SnvArcsMapper(10, 10, sampleName, reference)

test('SnvArcsMapper.map() should return an array of SnvArc objects', t => {
	const rawData = [
		{
			dt: dtsnvindel,
			chr: 'chr1',
			position: 0,
			gene: 'gene1',
			class: 'M',
			mname: 'mname'
		},
		{
			dt: dtsnvindel,
			chr: 'chr2',
			position: 0,
			gene: 'gene2',
			class: 'M',
			mname: 'mname'
		}
	]

	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)
	const snvArcs = snvArcsMapper.map(dataHolder.snvRingDataMap)

	// TODO - Calculate 0.1 instead of hardcoding it
	t.equal(snvArcs.length, 2, 'Number of SnvArcs should be equal to the number of data items')
	t.equal(snvArcs[0].startAngle, 0, 'Start angle for position 0 on chr1 should be 0')
	t.equal(snvArcs[0].endAngle, 0.1, 'End angle for position 0 on chr1 should be 0.1')
	t.equal(snvArcs[1].startAngle, Math.PI, 'Start angle for position 0 on chr2 should be Math.PI')
	t.equal(snvArcs[1].endAngle, Math.PI + 0.1, 'End angle for position 0 on chr2 should be Math.PI + 0.1')

	t.end()
})

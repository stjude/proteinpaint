import test from 'tape'
import Reference from '#plots/disco/chromosome/Reference.ts'
import DataMapper from '#plots/disco/data/DataMapper.ts'
import NonExonicSnvArcsMapper from '#plots/disco/snv/NonExonicSnvArcsMapper.ts'
import discoDefaults from '#plots/disco/defaults.ts'
import { dtsnvindel } from '#shared/common.js'

/*
Tests:
	NonExonicSnvArcsMapper.map() should return SnvArc objects from SNV input
*/

// ───── Setup ─────

const overriders = { padAngle: 0.0 }
const settings = discoDefaults(overriders)

const sampleName = 'Sample'
const chromosomes = {
	chr1: 1000,
	chr2: 1000
}

const reference = new Reference(settings, chromosomes)
const nonExonicSnvArcsMapper = new NonExonicSnvArcsMapper(10, 10, sampleName, reference)

// ───── Test Banner ─────
test('\n', function (t) {
	t.pass('-***- disco/snv/NonExonicSnvArcsMapper -***-')
	t.end()
})

// ───── Test ─────
test('NonExonicSnvArcsMapper.map() should return expected arc structure', t => {
	const rawData = [
		{
			dt: dtsnvindel,
			chr: 'chr1',
			position: 0,
			gene: 'gene1',
			class: 'M',
			mname: 'm1'
		},
		{
			dt: dtsnvindel,
			chr: 'chr2',
			position: 0,
			gene: 'gene2',
			class: 'M',
			mname: 'm2'
		}
	]

	// Use DataMapper to create the dataHolder from raw SNV data
	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)

	// Call the mapper
	const flatData = [...dataHolder.snvRingDataMap.values()].flat()
	const arcs = nonExonicSnvArcsMapper.map(flatData)

	// Check length matches input
	t.equal(arcs.length, 2, 'Should return one arc per SNV data entry')

	// Calculate expected arc width (1 / innerRadius = 0.1)
	const onePxArcAngle = 1 / 10

	// First arc on chr1
	t.equal(arcs[0].startAngle, 0 - onePxArcAngle, 'chr1 arc startAngle should be 0 - onePxArcAngle')
	t.equal(arcs[0].endAngle, 0 + onePxArcAngle, 'chr1 arc endAngle should be 0 + onePxArcAngle')

	// Second arc on chr2 (starts at Math.PI)
	t.equal(arcs[1].startAngle, Math.PI - onePxArcAngle, 'chr2 arc startAngle should be π - onePxArcAngle')
	t.equal(arcs[1].endAngle, Math.PI + onePxArcAngle, 'chr2 arc endAngle should be π + onePxArcAngle')

	t.end()
})

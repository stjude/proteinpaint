import test from 'tape'
import Reference from '#plots/disco/chromosome/Reference.ts'
import FusionMapper from '#plots/disco/fusion/FusionMapper.ts'
import DataMapper from '#plots/disco/data/DataMapper.ts'
import discoDefaults from '#plots/disco/defaults.ts'
import { dtfusionrna } from '#shared/common.js'

const overriders = { padAngle: 0.0 }
const settings = discoDefaults(overriders)

const sampleName = 'Sample'
const chromosomes = {
	chr1: 100,
	chr2: 100
}

const reference = new Reference(settings, chromosomes)
const fusionMapper = new FusionMapper(10, sampleName, reference)

test('FusionMapper.map() should return an array of Fusion objects', t => {
	const rawData = [
		{
			dt: dtfusionrna,
			chrA: 'chr1',
			posA: 1,
			geneA: 'gene1',
			chrB: 'chr2',
			posB: 50,
			geneB: 'gene2'
		},
		{
			dt: dtfusionrna,
			chrA: 'chr2',
			posA: 1,
			geneA: 'gene3',
			chrB: 'chr2',
			posB: 100,
			geneB: 'gene4'
		}
	]

	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)

	const fusions = fusionMapper.map(dataHolder.fusionData)

	t.equal(fusions.length, 0, 'Number of fusions should be equal to the number of data items')
	t.equal(fusions[0].source.startAngle, -0.01, 'Start angle for position 0 on chr1 should be 0')
	t.equal(
		fusions[0].target.endAngle,
		(3 / 2) * Math.PI + 0.01,
		'End angle for position 100 on chr2 should be: 2 * Math.PI 3/2 * Math.PI + 0.01'
	)
	t.equal(fusions[1].source.startAngle, Math.PI - 0.01, 'Start angle for position 0 on chr2 should be Math.PI - 0.01')
	t.equal(
		fusions[1].target.endAngle,
		2 * Math.PI + 0.01,
		'End angle for position 100 on chr2 should be 2 * Math.PI + 0.01'
	)

	t.end()
})

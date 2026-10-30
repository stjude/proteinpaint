import test from 'tape'
import Reference from '#plots/disco/chromosome/Reference.ts'
import FusionMapper from '#plots/disco/fusion/FusionMapper.ts'
import { getOverlappingFusions } from '#plots/disco/fusion/FusionRenderer.ts'
import DataMapper from '#plots/disco/data/DataMapper.ts'
import discoDefaults from '#plots/disco/defaults.ts'
import { dtfusionrna, dtsv } from '#shared/common.js'

const overriders = { padAngle: 0.0 }
const settings = discoDefaults(overriders)

const sampleName = 'Sample'
const chromosomesOrder = ['chr1', 'chr2']
const chromosomes = {
	chr1: 100,
	chr2: 100
}

const reference = new Reference(settings, chromosomesOrder, chromosomes)
const fusionMapper = new FusionMapper(10, sampleName, reference)

test('FusionMapper.map() should return an array of Fusion objects', t => {
	const rawData = [
		{
			dt: dtfusionrna,
			chrA: 'chr1',
			posA: 0,
			strandA: '-',
			geneA: 'gene1',
			chrB: 'chr2',
			posB: 50,
			strandB: '+',
			geneB: 'gene2',
			eventImage: 'gene1_gene2'
		},
		{
			dt: dtsv,
			chrA: 'chr2',
			posA: 0,
			geneA: 'gene3',
			chrB: 'chr2',
			posB: 100,
			geneB: 'gene4'
		}
	]

	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)

	const fusions = fusionMapper.map(dataHolder.fusionData)

	t.equal(fusions.length, 2, 'Number of fusions should be equal to the number of data items')
	t.deepEqual(
		fusions.map(f => f.dt),
		[dtfusionrna, dtsv],
		'preserves each event type'
	)
	t.deepEqual([fusions[0].source.strand, fusions[0].target.strand], ['-', '+'], 'preserves both breakpoint strands')
	t.deepEqual(
		fusions.map(f => f.eventImageValue),
		['gene1_gene2', undefined],
		'preserves the optional event image value'
	)
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

test('getOverlappingFusions() should group ribbons drawn on top of each other', t => {
	const rawData = [
		{ dt: dtfusionrna, chrA: 'chr1', posA: 10, geneA: 'gene1', chrB: 'chr2', posB: 50, geneB: 'gene2' },
		{ dt: dtfusionrna, chrA: 'chr1', posA: 10, geneA: 'gene1', chrB: 'chr2', posB: 50.1, geneB: 'gene2' },
		{ dt: dtfusionrna, chrA: 'chr2', posA: 50, geneA: 'gene2', chrB: 'chr1', posB: 10, geneB: 'gene1' },
		{ dt: dtfusionrna, chrA: 'chr1', posA: 90, geneA: 'gene3', chrB: 'chr2', posB: 10, geneB: 'gene4' }
	]
	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)
	const fusions = fusionMapper.map(dataHolder.fusionData)

	t.deepEqual(
		getOverlappingFusions(fusions, fusions[0]),
		fusions.slice(0, 3),
		'Should include ribbons overlapping in either orientation and exclude distant ones'
	)
	t.deepEqual(getOverlappingFusions(fusions, fusions[3]), [fusions[3]], 'A distant ribbon should only match itself')
	t.end()
})

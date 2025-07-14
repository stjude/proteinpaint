import test from 'tape'
import DataMapper from '#plots/disco/data/DataMapper.ts'
import Reference from '#plots/disco/chromosome/Reference.ts'
import discoDefaults from '#plots/disco/defaults.ts'
import { dtsv } from '#shared/common.js'

/*
Test:
    DataMapper.map() should skip fusion/SV entries with invalid chrA/chrB
*/

// ───── Setup ─────

const settings = discoDefaults({
	Disco: {
		cnvCapping: 2,
		prioritizeGeneLabelsByGeneSets: false,
		cnvPercentile: 0.8
	},
	rings: {}
})

const chromosomes = { chr1: 1000, chr2: 1000 }
const reference = new Reference(settings, chromosomes)

const dataMapper = new DataMapper(settings, reference, 'SampleA', [])

const fusionInput = [
	{
		dt: dtsv,
		chrA: 'chrUnknown',
		chrB: 'chr2',
		geneA: 'FAKE1',
		geneB: 'TP53',
		posA: 123,
		posB: 456
	},
	{
		dt: dtsv,
		chrA: 'chr1',
		chrB: 'chrBogus',
		geneA: 'FAKE2',
		geneB: 'BRCA2',
		posA: 789,
		posB: 999
	},
	{
		dt: dtsv,
		chrA: 'chr1',
		chrB: 'chr2',
		geneA: 'ALK',
		geneB: 'EML4',
		posA: 11111,
		posB: 22222
	}
]

const result = dataMapper.map(fusionInput)

test('\n', function (t) {
	t.pass('-***- disco/data/DataMapper -***-')
	t.end()
})

test('DataMapper.map() skips fusion entries with unknown chromosomes', t => {
        t.equal(result.fusionData.length, 1, 'Only valid fusion with known chromosomes should be included')
        t.equal(result.fusionData[0].geneA, 'ALK', 'Valid fusion geneA should be ALK')
        t.equal(result.fusionData[0].geneB, 'EML4', 'Valid fusion geneB should be EML4')
		t.equal(result.invalidDataInfo?.count ?? 0, 2, 'Two invalid entries should be recorded')
        t.end()
})

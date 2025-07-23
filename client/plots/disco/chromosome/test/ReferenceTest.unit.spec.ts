import test from 'tape'
import discoDefaults from '#plots/disco/defaults.ts'
import Reference from '../Reference'
import { hg38 } from '../../../../test/testdata/genomes'

/*
Tests:
	- Reference class initializes correctly
*/

// ───── Mock Settings ─────

const overriders = {
	padAngle: 0.01,
	chromosomeInnerRadius: 90,
	chromosomeWidth: 10
}
const settings = discoDefaults(overriders)
const chromosomesOrder = ['chr1', 'chr2']

// Mock chromosome sizes (normally coming from genome data)
const chromosomes = {
	chr1: hg38.majorchr.chr1,
	chr2: hg38.majorchr.chr2,
	chr3: hg38.majorchr.chr3
}

// ───── Header ─────
test('\n', function (t) {
	t.comment('-***- client/plots/disco/chromosome/reference.ts -***-')
	t.end()
})

// ───── Unit Tests ─────
test('Reference class initializes correctly', t => {
	const reference = new Reference(settings, chromosomesOrder, chromosomes)

	//Check that all chromosome keys are recorded in order
	t.equal(reference.chromosomesOrder.length, 3, 'should imclude all chromosome keys')
	t.deepEqual(reference.chromosomesOrder, ['chr1', 'chr2', 'chr3'], 'Chromosome order should match input keys')

	// Check that totalSize matches the sum of the chromosome sizes
	const expectedTotalSize = chromosomes.chr1 + chromosomes.chr2 + chromosomes.chr3
	t.equal(reference.totalSize, expectedTotalSize, 'Total size should match sum of chromosome sizes')
	t.equal(reference.totalSize, expectedTotalSize, 'Total size should match sum of chromosome sizes')

	// Verify totalPadAngle is calculated correctly
	const expectedPadAngle = 3 * overriders.padAngle
	t.equal(reference.totalPadAngle, expectedPadAngle, 'Total pad angle should be padAngle times number of chromosomes')

	// Check that totalChromosomesAngle is correctly derived
	const expectedTotalChromosomeAngle = 2 * Math.PI - expectedPadAngle
	t.equal(reference.totalChromosomesAngle, expectedTotalChromosomeAngle, 'Total chromosome angle should be correct')

	// Ensure the correct number of Chromosome objects were created
	t.equal(reference.chromosomes.length, 3, 'Should generate 3 Chromosome objects')

	// Validate the angles and radius properties on each Chromosome
	reference.chromosomes.forEach((chr, i) => {
		t.ok(chr.startAngle < chr.endAngle, `Chromosome ${i} startAngle should be less than endAngle`)
		t.ok(chr.innerRadius === overriders.chromosomeInnerRadius, `Chromosome ${i} inner radius should match setting`)
		t.ok(
			chr.outerRadius === overriders.chromosomeInnerRadius + overriders.chromosomeWidth,
			`Chromosome ${i} outer radius should match setting`
		)
	})

	t.end()
})

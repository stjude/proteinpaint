import test from 'tape'

// Contains default visualization settings for the disco plot,
// such as arc radii and spacing between tracks.
// Red represents copy number variation (CNV); gray indicates loss of heterozygosity (LOH).
import discoDefaults from '#plots/disco/defaults.ts'

// Manages chromosome sizes and provides coordinate transformations
// (from base pairs to radians) for disco plot rendering.
import Reference from '#plots/disco/chromosome/Reference.ts'

// Converts LOH data into arc objects suitable for visual rendering.
import LohArcMapper from '#plots/disco/loh/LohArcMapper.ts'

// Filters and organizes data by type (e.g., CNV, LOH) into structured groups.
import DataMapper from '#plots/disco/data/DataMapper.ts'

// Overrides default pad angle between arcs (removes gaps).
const overriders = { padAngle: 0.0 }

// Generates the full settings object, incorporating custom overrides.
const settings = discoDefaults(overriders)

// Represents the label used to identify the sample (not a data type like `dt`).
const sampleName = 'sample'

// Defines chromosome lengths in base pairs.
// Each chromosome is assigned 100 units; since a circle spans 0 to 2π,
// this maps each chromosome to π radians.
const chromosomes = {
	chr1: 100,
	chr2: 100
}

// Initializes a genome reference object with chromosome definitions
// and logic to convert base pair positions to angles.
const reference = new Reference(settings, chromosomes)

test('LohArcMapper.map() should return an array of LohArc objects', function (t) {
	const rawData = [
		// Each object denotes a region of LOH,
		// in this case spanning the full length of each chromosome.
		{
			chr: 'chr1',
			dt: 10, // 10 = LOH data type
			start: 0,
			stop: 100
		},
		{
			chr: 'chr2',
			dt: 10,
			start: 0,
			stop: 100
		}
	]

	// Maps raw data into structured form by type (e.g., LOH, CNV).
	// Fourth argument likely relates to gene prioritization/highlighting—left empty here.
	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)

	// Extracts only the LOH-related data for visualization.
	const data = dataHolder.lohData

	const lohArcMapper = new LohArcMapper(
		10, // inner radius
		5, // radial thickness
		sampleName,
		reference
	)

	// Converts LOH data into visual arc objects.
	const arcs = lohArcMapper.map(data)

	t.equal(arcs.length, 2, 'Should return one arc per LOH segment')
	const arc0 = arcs[0]
	const arc1 = arcs[1]

	// Verify angles and radii for arc on chr1
	t.equal(arc0.startAngle, 0, 'Arc 0 start angle should be 0')
	t.equal(arc0.endAngle, Math.PI, 'Arc 0 end angle should be π')
	t.ok(arc0.innerRadius >= 10, 'Arc 0 inner radius should be at least 10')
	t.ok(arc0.outerRadius > arc0.innerRadius, 'Arc 0 outer radius should be greater than inner')

	// Verify angles and radii for arc on chr2
	t.equal(arc1.startAngle, Math.PI, 'Arc 1 start angle should be π')
	t.equal(arc1.endAngle, 2 * Math.PI, 'Arc 1 end angle should be 2π')
	t.ok(arc1.innerRadius >= 10, 'Arc 1 inner radius should be at least 10')
	t.ok(arc1.outerRadius > arc1.innerRadius, 'Arc 1 outer radius should be greater than inner')

	t.end()
})

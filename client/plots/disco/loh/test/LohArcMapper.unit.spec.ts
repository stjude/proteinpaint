//Victor LP
//Hello thank you for reviewing this I have written some comments, please
//feel free to correct me.
import test from 'tape'
//From what I can discoDefaults has default vizualisations settings
//like the radii space between arcs of of the 'disco' where data is vizualised
//Red is for copy number variaion and gray for loss of heterozygosity
import discoDefaults from '#plots/disco/defaults.ts'

//Contains chromosome sizes and transforms base pair coordinates to coordinates
//radians for the disco plot visualisation.
import Reference from '#plots/disco/chromosome/Reference.ts'

//Takes LOH data and converts into drawable arc objects
import LohArcMapper from '#plots/disco/loh/LohArcMapper.ts'

//Filters data by data type (dt) and organises to groups
//like lohData and cnvData
import DataMapper from '#plots/disco/data/DataMapper.ts'

//Removes gaps between arches
const overriders = { padAngle: 0.0 }

//This is passed into classes that need plot configuration
const settings = discoDefaults(overriders)

//I think the name sample is just a label
// not a data type like dt: 4 for cnv
const sampleName = 'sample'

//I think this this a dictionary with the lenght of the chromosomes,
// I assume 100 base pairs
//A circle is 0-2(pi) so each chromosome here would be (pi) in arc lenght
const chromosomes = {
	chr1: 100,
	chr2: 100
}

//This is a genome object that 'know' the chromosomes (chr1 and 2)
//their lenght and how to convert genome coordinates (start-end) into start
//and end angle
const reference = new Reference(settings, chromosomes)

test('LohArcMapper.map() should return an array of LohArc objects', function (t) {
	const rawData = [
		//Each object represents a regeon of loss of heterozygosity
		//each entry in this case spans the full lenght of the chromosome
		{
			chr: 'chr1',
			dt: 10, //DataType for LOH
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

	//Takes data and splits into lohData, cnvData, and so on depending on dt
	//computes scaling values.
	//has structured ready to plot data
	//No clue about the 4th parameter for gene prioritization so i just put an empty list
	//Maybe it highlights a UI element to show genes of interest
	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)

	//gets only LOH processed data for LohArcMapper.map()
	const data = dataHolder.lohData

	const lohArcMapper = new LohArcMapper(
		10,
		5,
		//LohArcMapper does not take settings as a parameter? cnvArcsMapper takes both settings and reference

		sampleName,
		reference
	)

	//Takes organized data and returns array of arcs
	const arcs = lohArcMapper.map(data)

	t.equal(arcs.length, 2, 'Should return one arc per LOH segment')
	const arc0 = arcs[0]
	const arc1 = arcs[1]

	//Tests the start and end in radians, 0 and (pi).
	t.equal(arc0.startAngle, 0, 'Arc 0 start angle should be 0')
	t.equal(arc0.endAngle, Math.PI, 'Arc 0 end angle should be π')
	//gave inner radius of 10 when creating arcMapper, this makes sure
	//that radius is not smaller than 10
	t.ok(arc0.innerRadius >= 10, 'Arc 0 inner radius should be at least 10')
	//check outer radious is larger than inner
	t.ok(arc0.outerRadius > arc0.innerRadius, 'Arc 0 outer radius should be greater than inner')

	//simmilar to above but for arc 2
	t.equal(arc1.startAngle, Math.PI, 'Arc 1 start angle should be π')
	t.equal(arc1.endAngle, 2 * Math.PI, 'Arc 1 end angle should be 2π')
	t.ok(arc1.innerRadius >= 10, 'Arc 1 inner radius should be at least 10')
	t.ok(arc1.outerRadius > arc1.innerRadius, 'Arc 1 outer radius should be greater than inner')

	t.end()
})

/**************
 test sections
***************/

//tape('\n', function (test) {
//	test.pass('-***- plots/disco/loh/LohArcMapper -***-')
//	test.end()
//})

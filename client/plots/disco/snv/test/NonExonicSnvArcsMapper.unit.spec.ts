import test from 'tape'
import NonExonicSnvArcsMapper from '../NonExonicSnvArcsMapper.ts'

/*
Tests:
    NonExonicSnvArcsMapper maps SNV data into correctly structured arc objects
*/

// Define reusable values so test messages can update dynamically
const labelColor = '#ff0000'
const labelText = 'missense'

// Mock Reference object simulating a genome with one chromosome (chr1)
const mockReference = {
	chromosomesOrder: ['chr1'],
	chromosomes: [
		{
			startAngle: 0,
			endAngle: Math.PI,
			size: 1000
		}
	]
}

// Mock mutation data (SNV)
const arcData = [
	{
		mClass: 'mockClass',
		position: 500,
		chr: 'chr1',
		sampleName: 'SampleX',
		gene: 'TP53',
		mname: 'm1'
	}
]

// Mock MLabel singleton using the dynamic color and label
const mockMlabel = {
	mockClass: {
		color: labelColor,
		label: labelText
	}
}

// Patch MLabel singleton
import MLabel from '#plots/disco/label/MLabel.ts'
MLabel.getInstance = () => ({
	mlabel: mockMlabel
})

// Type cast for reference
import type Reference from '#plots/disco/chromosome/Reference.ts'
const ref = mockReference as unknown as Reference

// Section banner
test('\n', function (t) {
	t.pass('-***- disco/NonExonicSnvArcsMapper -***-')
	t.end()
})

// Test block
test('NonExonicSnvArcsMapper maps data to SnvArc correctly', t => {
	const mapper = new NonExonicSnvArcsMapper(100, 20, 'SampleX', ref)
	const arcs = mapper.map(arcData as any)

	t.equal(arcs.length, 1, 'Should return one arc')
	const arc = arcs[0]

	const expectedAngle =
		(ref.chromosomes[0].endAngle - ref.chromosomes[0].startAngle) * (arcData[0].position / ref.chromosomes[0].size)

	// Calculate the start angle allowing a small margin of error to account for floater point math
	t.ok(Math.abs(arc.startAngle - (expectedAngle - 1 / 100)) < 1e-6, 'Start angle should be correctly calculated')
	t.ok(Math.abs(arc.endAngle - (expectedAngle + 1 / 100)) < 1e-6, 'End angle should be correctly calculated')

	t.equal(arc.color, labelColor, `Should assign color to arc correctly from MLabel, color should be ${labelColor}`)
	t.equal(arc.text, arcData[0].gene, `Should assign gene name to arc, gene should be ${arcData[0].gene}`)
	t.equal(arc.dataClass, labelText, `Should assign data class label from MLabel, label should be ${labelText}`)
	t.equal(arc.mname, arcData[0].mname, `Should assign mutation name correctly, should be ${arcData[0].mname}`)
	t.equal(arc.chr, arcData[0].chr, `Should assign chromosome correctly, should be ${arcData[0].chr}`)
	t.equal(arc.pos, arcData[0].position, `Should assign position correctly, should be ${arcData[0].position}`)
	t.deepEqual(
		arc.sampleName,
		[arcData[0].sampleName],
		`Should assign sample name in array form, should be [${arcData[0].sampleName}]`
	)

	t.end()
})

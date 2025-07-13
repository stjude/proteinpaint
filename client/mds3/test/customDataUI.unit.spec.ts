import tape from 'tape'
import { parseMutation, parseFusion, parseCnv, parsePositionFromGm, parseInputPosition } from '../customdata.inputui.js'

/* Tests
 - parseMutation()
 - parseFusion()
 - parseCnv()
 - parsePositionFromGm()
 - parsePosition()
*/

const mockBlock = {
	genome: {
		name: 'hg19'
	},
	usegm: {
		name: 'TP53',
		isoform: 'NM_000546',
		chr: 'chr17',
		coding: [
			[7676520, 7676594],
			[7676381, 7676403],
			[7675993, 7676272],
			[7675052, 7675236],
			[7674858, 7674971],
			[7674180, 7674290],
			[7673700, 7673837],
			[7673534, 7673608],
			[7670608, 7670715],
			[7669608, 7669690]
		],
		codingstart: 7669608,
		codingstop: 7676594,
		exon: [
			[7687376, 7687490],
			[7676520, 7676622],
			[7676381, 7676403],
			[7675993, 7676272],
			[7675052, 7675236],
			[7674858, 7674971],
			[7674180, 7674290],
			[7673700, 7673837],
			[7673534, 7673608],
			[7670608, 7670715],
			[7668420, 7669690]
		],
		start: 7668420,
		stop: 7687490,
		strand: '-'
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- mds3/customdata.inputui -***-')
	test.end()
})

tape('parseMutation()', function (test) {
	test.timeoutAfter(100)

	let input: string[], expected: any, message: string
	const mlst = []
	const selecti = 2

	//Invalid mutation class
	input = ['MyMutation', '7674903', 'abc', 'sample1']
	message = `Should throw for invalid mutation class`
	try {
		parseMutation(input, mlst, selecti, mockBlock)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	//Missing name
	input = ['', '7674903', 'M', 'sample1']
	message = `Should throw for missing mutation name`
	try {
		parseMutation(input, mlst, selecti, mockBlock)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	//With sample name
	input = ['c.215C>G', 'chr17:7579472', 'M', 'sample1']
	parseMutation(input, mlst, selecti, mockBlock)
	expected = {
		class: 'M',
		dt: 1,
		isoform: 'NM_000546',
		mname: 'c.215C>G',
		chr: 'chr17',
		pos: 7579471,
		sample: 'sample1'
	}
	test.deepEqual(mlst[mlst.length - 1], expected, 'Should return correct mutation object with supplied sample name')

	//No sample name
	input = ['c.215C>G', 'chr17:7579472', 'I']
	parseMutation(input, mlst, selecti, mockBlock)
	expected = {
		class: 'I',
		dt: 1,
		isoform: 'NM_000546',
		mname: 'c.215C>G',
		chr: 'chr17',
		pos: 7579471
	}
	test.deepEqual(mlst[mlst.length - 1], expected, 'Should return correct mutation object without a sample property')

	test.end()
})

tape('parseFusion()', async function (test) {
	test.timeoutAfter(100)
	let input: string[], message: string
	const mlst = []
	const selecti = 2

	input = []
	message = `Should throw for missing gene 1`
	try {
		await parseFusion(input, mlst, selecti, mockBlock)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	input = ['PAX5']
	message = `Should throw for missing gene 2`
	try {
		await parseFusion(input, mlst, selecti, mockBlock)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	input = ['PAX5', '', '37002646', 'JAK2', 'NM_004972', '5081726']
	message = `Should throw for missing isoform 1`
	try {
		await parseFusion(input, mlst, selecti, mockBlock)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	input = ['PAX5', 'NM_016734', '37002646', 'JAK2', '', '5081726']
	message = `Should throw for missing isoform 2`
	try {
		await parseFusion(input, mlst, selecti, mockBlock)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	input = ['PAX5', 'NM_016734', '', 'JAK2', 'NM_004972', '']
	message = `Should throw for missing position 1`
	try {
		await parseFusion(input, mlst, selecti, mockBlock)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	input = ['PAX5', 'NM_016734', '37002646', 'JAK2', 'NM_004972', '']
	message = `Should throw for missing position 2`
	try {
		await parseFusion(input, mlst, selecti, mockBlock)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	test.end()
})

tape('parseCnv()', function (test) {
	test.timeoutAfter(100)

	let input: string[], expected: any
	const mlst = []
	const selecti = 2

	//Invalid value
	input = ['7674902', '7674903', 'abc', 'sample1']
	const message = `Should throw for CNV value not being a number`
	try {
		parseCnv(input, mlst, selecti, mockBlock)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	//With sample name
	input = ['7578785', '7608909', '-1', 'sample1']
	parseCnv(input, mlst, selecti, mockBlock)
	expected = {
		chr: 'chr17',
		dt: 4,
		value: -1,
		class: 'CNV_loss',
		sample: 'sample1',
		start: 7578784,
		stop: 7608908
	}
	test.deepEqual(mlst[mlst.length - 1], expected, 'Should return correct CNV loss object with supplied sample name')

	//No sample name
	input = ['7578785', '7608909', '-1']
	parseCnv(input, mlst, selecti, mockBlock)
	expected = {
		chr: 'chr17',
		dt: 4,
		value: -1,
		class: 'CNV_loss',
		start: 7578784,
		stop: 7608908
	}
	test.deepEqual(mlst[mlst.length - 1], expected, 'Should return correct CNV loss object withot a sample property')

	test.end()
})

tape('parsePositionFromGm()', function (test) {
	test.timeoutAfter(100)

	let selecti: number, str: string, result: (number | string)[], message: string

	//Codon tests
	selecti = 0
	message = `Should throw for the position not being a number`
	try {
		str = 'abc'
		result = parsePositionFromGm(selecti, str, mockBlock.usegm)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	str = 'chr17:7675519'
	result = parsePositionFromGm(selecti, str, mockBlock.usegm)
	test.true(
		result[0] == mockBlock.usegm.chr && result[1] == 7669608,
		`Should return the chromosome from the gene and correct position for a codon`
	)

	message = `Should throw because cannot convert codon to genomic position`
	try {
		str = '55211628.7'
		result = parsePositionFromGm(selecti, str, mockBlock.usegm)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	//RNA position tests
	selecti = 1
	str = '7675519'
	result = parsePositionFromGm(selecti, str, mockBlock.usegm)
	test.true(
		result[0] == mockBlock.usegm.chr && result[1] == 7668420,
		`Should return the chromosome from the gene and correct position for a genomic position`
	)

	message = `Should throw because cannot convert RNA position to genomic position`
	try {
		str = '55211628.1'
		result = parsePositionFromGm(selecti, str, mockBlock.usegm)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	//Genomic position tests
	selecti = 2
	str = 'chr17:7675519'
	result = parsePositionFromGm(selecti, str, mockBlock.usegm)
	test.true(
		result[0] == mockBlock.usegm.chr && result[1] == 7675518,
		`Should return the chromosome from the gene and correct position for a genomic position`
	)

	test.end()
})

tape('parsePosition()', function (test) {
	test.timeoutAfter(100)

	let str: string, chr: string, result: number

	//Position only
	str = '7668421'
	chr = 'chr17'
	result = parseInputPosition(str, chr)
	test.true(result == 7668421 && typeof result == 'number', 'Should return the position as a number')

	//Chromosome and position
	str = 'chr17:7668421'
	result = parseInputPosition(str, chr)
	test.true(
		result == 7668421 && typeof result == 'number',
		'Should remove "chr17:" and only return the position as a number'
	)

	//Mismatched chromosome
	const message = 'Should throw for user input chromosome mismatching the gene chromosome'
	try {
		chr = 'chr14'
		result = parseInputPosition(str, chr)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	test.end()
})

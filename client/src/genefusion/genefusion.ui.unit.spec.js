import tape from 'tape'
import { parseFusionLine } from './genefusion.ui.js'

/****************
Tests

- parseFusionLine tests
	valid format 1 (basic 4 fields per gene)
	valid format 2 (with isoform - 5 fields per gene)
	mixed format (gene1 with isoform, gene2 without)
	missing double colon separator
	wrong number of genes (not exactly 2)
	invalid number of fields per gene (not 4 or 5)
	empty required fields
	non-numeric position
	invalid strand values
	whitespace handling

*****************/

tape('\n', function (test) {
	test.comment('-***- genefusion.ui.js parsing -***-')
	test.end()
})

/**************
parseFusionLine tests
***************/

tape('valid format 1 (basic 4 fields per gene)', function (test) {
	test.timeoutAfter(100)
	const line = 'PAX5,chr9,37002646,-::JAK2,chr9,5081726,+'
	const [gene1, gene2] = parseFusionLine(line)
	
	test.equal(gene1.length, 4, 'gene1 should have 4 fields')
	test.equal(gene1[0], 'PAX5', 'gene1 symbol should be PAX5')
	test.equal(gene1[1], 'chr9', 'gene1 chromosome should be chr9')
	test.equal(gene1[2], '37002646', 'gene1 position should be 37002646')
	test.equal(gene1[3], '-', 'gene1 strand should be -')
	
	test.equal(gene2.length, 4, 'gene2 should have 4 fields')
	test.equal(gene2[0], 'JAK2', 'gene2 symbol should be JAK2')
	test.equal(gene2[1], 'chr9', 'gene2 chromosome should be chr9')
	test.equal(gene2[2], '5081726', 'gene2 position should be 5081726')
	test.equal(gene2[3], '+', 'gene2 strand should be +')
	
	test.end()
})

tape('valid format 2 (with isoform - 5 fields per gene)', function (test) {
	test.timeoutAfter(100)
	const line = 'RUNX1,chr21,36206706,-,NM_001754::MECOM,chr3,169099311,+,NM_004991'
	const [gene1, gene2] = parseFusionLine(line)
	
	test.equal(gene1.length, 5, 'gene1 should have 5 fields')
	test.equal(gene1[0], 'RUNX1', 'gene1 symbol should be RUNX1')
	test.equal(gene1[1], 'chr21', 'gene1 chromosome should be chr21')
	test.equal(gene1[2], '36206706', 'gene1 position should be 36206706')
	test.equal(gene1[3], '-', 'gene1 strand should be -')
	test.equal(gene1[4], 'NM_001754', 'gene1 isoform should be NM_001754')
	
	test.equal(gene2.length, 5, 'gene2 should have 5 fields')
	test.equal(gene2[0], 'MECOM', 'gene2 symbol should be MECOM')
	test.equal(gene2[1], 'chr3', 'gene2 chromosome should be chr3')
	test.equal(gene2[2], '169099311', 'gene2 position should be 169099311')
	test.equal(gene2[3], '+', 'gene2 strand should be +')
	test.equal(gene2[4], 'NM_004991', 'gene2 isoform should be NM_004991')
	
	test.end()
})

tape('mixed format (gene1 with isoform, gene2 without)', function (test) {
	test.timeoutAfter(100)
	const line = 'PAX5,chr9,37002646,-,NM_016734::JAK2,chr9,5081726,+'
	const [gene1, gene2] = parseFusionLine(line)
	
	test.equal(gene1.length, 5, 'gene1 should have 5 fields')
	test.equal(gene1[4], 'NM_016734', 'gene1 should have isoform')
	test.equal(gene2.length, 4, 'gene2 should have 4 fields')
	
	test.end()
})

tape('whitespace handling', function (test) {
	test.timeoutAfter(100)
	const line = '  PAX5 , chr9 , 37002646 , - :: JAK2 , chr9 , 5081726 , +  '
	const [gene1, gene2] = parseFusionLine(line)
	
	test.equal(gene1[0], 'PAX5', 'gene1 symbol should be trimmed')
	test.equal(gene1[1], 'chr9', 'gene1 chromosome should be trimmed')
	test.equal(gene2[0], 'JAK2', 'gene2 symbol should be trimmed')
	
	test.end()
})

tape('missing double colon separator', function (test) {
	test.timeoutAfter(100)
	const line = 'PAX5,chr9,37002646,-JAK2,chr9,5081726,+'
	
	try {
		parseFusionLine(line)
		test.fail('should throw error for missing "::"')
	} catch (error) {
		test.ok(error.message.includes('must contain exactly two genes'), 'should throw appropriate error')
	}
	
	test.end()
})

tape('wrong number of genes (more than 2)', function (test) {
	test.timeoutAfter(100)
	const line = 'PAX5,chr9,37002646,-::JAK2,chr9,5081726,+::GENE3,chr1,1000,+'
	
	try {
		parseFusionLine(line)
		test.fail('should throw error for more than 2 genes')
	} catch (error) {
		test.ok(error.message.includes('must contain exactly two genes'), 'should throw appropriate error')
	}
	
	test.end()
})

tape('invalid number of fields per gene (too few)', function (test) {
	test.timeoutAfter(100)
	const line = 'PAX5,chr9,37002646::JAK2,chr9,5081726,+'
	
	try {
		parseFusionLine(line)
		test.fail('should throw error for invalid field count')
	} catch (error) {
		test.ok(error.message.includes('must have 4 or 5 fields'), 'should throw appropriate error')
	}
	
	test.end()
})

tape('invalid number of fields per gene (too many)', function (test) {
	test.timeoutAfter(100)
	const line = 'PAX5,chr9,37002646,-,NM_016734,extra::JAK2,chr9,5081726,+'
	
	try {
		parseFusionLine(line)
		test.fail('should throw error for invalid field count')
	} catch (error) {
		test.ok(error.message.includes('must have 4 or 5 fields'), 'should throw appropriate error')
	}
	
	test.end()
})

tape('empty required fields (gene symbol)', function (test) {
	test.timeoutAfter(100)
	const line = ',chr9,37002646,-::JAK2,chr9,5081726,+'
	
	try {
		parseFusionLine(line)
		test.fail('should throw error for empty gene symbol')
	} catch (error) {
		test.ok(error.message.includes('gene symbol, chromosome, position, and strand are required'), 'should throw appropriate error')
	}
	
	test.end()
})

tape('empty required fields (chromosome)', function (test) {
	test.timeoutAfter(100)
	const line = 'PAX5,,37002646,-::JAK2,chr9,5081726,+'
	
	try {
		parseFusionLine(line)
		test.fail('should throw error for empty chromosome')
	} catch (error) {
		test.ok(error.message.includes('gene symbol, chromosome, position, and strand are required'), 'should throw appropriate error')
	}
	
	test.end()
})

tape('non-numeric position', function (test) {
	test.timeoutAfter(100)
	const line = 'PAX5,chr9,notanumber,-::JAK2,chr9,5081726,+'
	
	try {
		parseFusionLine(line)
		test.fail('should throw error for non-numeric position')
	} catch (error) {
		test.ok(error.message.includes('position must be a positive integer'), 'should throw appropriate error')
	}
	
	test.end()
})

tape('partial numeric position (e.g., 123abc)', function (test) {
	test.timeoutAfter(100)
	const line = 'PAX5,chr9,123abc,-::JAK2,chr9,5081726,+'
	
	try {
		parseFusionLine(line)
		test.fail('should throw error for partial numeric position')
	} catch (error) {
		test.ok(error.message.includes('position must be a positive integer'), 'should throw appropriate error')
	}
	
	test.end()
})

tape('negative position', function (test) {
	test.timeoutAfter(100)
	const line = 'PAX5,chr9,-100,-::JAK2,chr9,5081726,+'
	
	try {
		parseFusionLine(line)
		test.fail('should throw error for negative position')
	} catch (error) {
		test.ok(error.message.includes('position must be'), 'should throw appropriate error')
	}
	
	test.end()
})

tape('zero position (not valid for 1-based coordinates)', function (test) {
	test.timeoutAfter(100)
	const line = 'PAX5,chr9,0,-::JAK2,chr9,5081726,+'
	
	try {
		parseFusionLine(line)
		test.fail('should throw error for zero position')
	} catch (error) {
		test.ok(error.message.includes('greater than 0'), 'should throw appropriate error for 1-based coordinates')
	}
	
	test.end()
})

tape('invalid strand value (not + or -)', function (test) {
	test.timeoutAfter(100)
	const line = 'PAX5,chr9,37002646,*::JAK2,chr9,5081726,+'
	
	try {
		parseFusionLine(line)
		test.fail('should throw error for invalid strand')
	} catch (error) {
		test.ok(error.message.includes('strand must be "+" or "-"'), 'should throw appropriate error')
	}
	
	test.end()
})

tape('real-world example: BCR-ABL1 fusion', function (test) {
	test.timeoutAfter(100)
	const line = 'BCR,chr22,23524427,+::ABL1,chr9,133729449,+'
	const [gene1, gene2] = parseFusionLine(line)
	
	test.equal(gene1[0], 'BCR', 'gene1 symbol should be BCR')
	test.equal(gene2[0], 'ABL1', 'gene2 symbol should be ABL1')
	test.equal(gene1[3], '+', 'gene1 strand should be +')
	test.equal(gene2[3], '+', 'gene2 strand should be +')
	
	test.end()
})

tape('real-world example: ZCCHC7-PAX5 fusion', function (test) {
	test.timeoutAfter(100)
	const line = 'ZCCHC7,chr9,37257786,-::PAX5,chr9,37024824,-'
	const [gene1, gene2] = parseFusionLine(line)
	
	test.equal(gene1[0], 'ZCCHC7', 'gene1 symbol should be ZCCHC7')
	test.equal(gene2[0], 'PAX5', 'gene2 symbol should be PAX5')
	test.equal(gene1[3], '-', 'gene1 strand should be -')
	test.equal(gene2[3], '-', 'gene2 strand should be -')
	
	test.end()
})

tape('real-world example with isoforms: PAX5-JAK2 fusion', function (test) {
	test.timeoutAfter(100)
	const line = 'PAX5,chr9,37002646,-,NM_016734::JAK2,chr9,5081726,+,NM_004972'
	const [gene1, gene2] = parseFusionLine(line)
	
	test.equal(gene1[0], 'PAX5', 'gene1 symbol should be PAX5')
	test.equal(gene1[4], 'NM_016734', 'gene1 isoform should be NM_016734')
	test.equal(gene2[0], 'JAK2', 'gene2 symbol should be JAK2')
	test.equal(gene2[4], 'NM_004972', 'gene2 isoform should be NM_004972')
	
	test.end()
})

tape('empty isoform field is allowed in parsing', function (test) {
	test.timeoutAfter(100)
	const line = 'PAX5,chr9,37002646,-,::JAK2,chr9,5081726,+,NM_004972'
	const [gene1, gene2] = parseFusionLine(line)
	
	// The parsing should succeed even with empty isoform
	test.equal(gene1[0], 'PAX5', 'gene1 symbol should be PAX5')
	test.equal(gene1[4], '', 'gene1 isoform should be empty string')
	test.equal(gene2[4], 'NM_004972', 'gene2 isoform should be NM_004972')
	
	// Note: The createFusionVariant() function will filter out empty isoforms
	// when creating the variant object, so empty isoforms won't be included
	// in the final custom_variants structure
	
	test.end()
})

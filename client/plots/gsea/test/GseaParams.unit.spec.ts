import tape from 'tape'
import {
	isValidGseaParams,
	isProteomeDAPGseaParams,
	isScctGseaParams,
	isOtherTermTypesGseaParams
} from '../model/GseaParams'

/*
Tests:
	- isProteomeDAPGseaParams: valid object
	- isProteomeDAPGseaParams: missing genome
	- isProteomeDAPGseaParams: missing dslabel
	- isProteomeDAPGseaParams: missing dapParams
	- isProteomeDAPGseaParams: dapParams is null
	- isProteomeDAPGseaParams: dapParams is not an object
	- isProteomeDAPGseaParams: missing dapParams.organism
	- isProteomeDAPGseaParams: missing dapParams.assay
	- isProteomeDAPGseaParams: missing dapParams.cohort
	- isProteomeDAPGseaParams: wrong type for dapParams.organism
	- isProteomeDAPGseaParams: wrong type for dapParams.assay
	- isProteomeDAPGseaParams: wrong type for dapParams.cohort
	- isProteomeDAPGseaParams: wrong type for genome
	- isProteomeDAPGseaParams: wrong type for dslabel
	- isProteomeDAPGseaParams: null value
	- isProteomeDAPGseaParams: undefined value
	- isProteomeDAPGseaParams: non-object value
	- isScctGseaParams: valid object
	- isScctGseaParams: missing genome
	- isScctGseaParams: missing genes array
	- isScctGseaParams: missing fold_change array
	- isScctGseaParams: missing genes_length
	- isScctGseaParams: genes array with non-string
	- isScctGseaParams: fold_change array with non-number
	- isScctGseaParams: wrong type for genes_length
	- isScctGseaParams: empty arrays
	- isScctGseaParams: null value
	- isScctGseaParams: non-object value
	- isOtherTermTypesGseaParams: valid object
	- isOtherTermTypesGseaParams: missing genome
	- isOtherTermTypesGseaParams: missing cacheId
	- isOtherTermTypesGseaParams: missing daRequest
	- isOtherTermTypesGseaParams: missing genes_length
	- isOtherTermTypesGseaParams: missing dslabel
	- isOtherTermTypesGseaParams: wrong type for genome
	- isOtherTermTypesGseaParams: wrong type for cacheId
	- isOtherTermTypesGseaParams: wrong type for genes_length
	- isOtherTermTypesGseaParams: wrong type for dslabel
	- isOtherTermTypesGseaParams: daRequest can be any type
	- isOtherTermTypesGseaParams: null value
	- isOtherTermTypesGseaParams: non-object value
	- isValidGseaParams: valid ProteomeDAPGseaParams
	- isValidGseaParams: valid ScctGseaParams
	- isValidGseaParams: valid OtherTermTypesGseaParams
	- isValidGseaParams: invalid object
	- isValidGseaParams: null value
	- isValidGseaParams: undefined value
	- isValidGseaParams: non-object value
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/gsea/model/GseaParams -***-')
	test.end()
})

/***************************
 isProteomeDAPGseaParams
***************************/

tape('isProteomeDAPGseaParams: valid object', function (test) {
	const valid = {
		genome: 'hg38',
		dslabel: 'test-dataset',
		dapParams: { organism: 'human', assay: 'rna', cohort: 'cohort1' }
	}
	test.ok(isProteomeDAPGseaParams(valid), 'should return true for valid ProteomeDAPGseaParams')
	test.end()
})

tape('isProteomeDAPGseaParams: missing genome', function (test) {
	const invalid = {
		dslabel: 'test-dataset',
		dapParams: { organism: 'human', assay: 'rna', cohort: 'cohort1' }
	}
	test.notOk(isProteomeDAPGseaParams(invalid), 'should return false when genome is missing')
	test.end()
})

tape('isProteomeDAPGseaParams: missing dslabel', function (test) {
	const invalid = {
		genome: 'hg38',
		dapParams: { organism: 'human', assay: 'rna', cohort: 'cohort1' }
	}
	test.notOk(isProteomeDAPGseaParams(invalid), 'should return false when dslabel is missing')
	test.end()
})

tape('isProteomeDAPGseaParams: missing dapParams', function (test) {
	const invalid = {
		genome: 'hg38',
		dslabel: 'test-dataset'
	}
	test.notOk(isProteomeDAPGseaParams(invalid), 'should return false when dapParams is missing')
	test.end()
})

tape('isProteomeDAPGseaParams: wrong type for genome', function (test) {
	const invalid = {
		genome: 123,
		dslabel: 'test-dataset',
		dapParams: { organism: 'human', assay: 'rna', cohort: 'cohort1' }
	}
	test.notOk(isProteomeDAPGseaParams(invalid), 'should return false when genome is not a string')
	test.end()
})

tape('isProteomeDAPGseaParams: wrong type for dslabel', function (test) {
	const invalid = {
		genome: 'hg38',
		dslabel: 123,
		dapParams: { organism: 'human', assay: 'rna', cohort: 'cohort1' }
	}
	test.notOk(isProteomeDAPGseaParams(invalid), 'should return false when dslabel is not a string')
	test.end()
})

tape('isProteomeDAPGseaParams: null value', function (test) {
	test.notOk(isProteomeDAPGseaParams(null), 'should return false for null')
	test.end()
})

tape('isProteomeDAPGseaParams: undefined value', function (test) {
	test.notOk(isProteomeDAPGseaParams(undefined), 'should return false for undefined')
	test.end()
})

tape('isProteomeDAPGseaParams: non-object value', function (test) {
	test.notOk(isProteomeDAPGseaParams('string'), 'should return false for string')
	test.notOk(isProteomeDAPGseaParams(123), 'should return false for number')
	test.notOk(isProteomeDAPGseaParams(true), 'should return false for boolean')
	test.end()
})

/***************************
 isScctGseaParams
***************************/

tape('isScctGseaParams: valid object', function (test) {
	const valid = {
		genome: 'hg38',
		genes: ['BRCA1', 'TP53', 'MYC'],
		fold_change: [2.5, -1.8, 3.2],
		genes_length: 3
	}
	test.ok(isScctGseaParams(valid), 'should return true for valid ScctGseaParams')
	test.end()
})

tape('isScctGseaParams: missing genome', function (test) {
	const invalid = {
		genes: ['BRCA1', 'TP53'],
		fold_change: [2.5, -1.8],
		genes_length: 2
	}
	test.notOk(isScctGseaParams(invalid), 'should return false when genome is missing')
	test.end()
})

tape('isScctGseaParams: missing genes array', function (test) {
	const invalid = {
		genome: 'hg38',
		fold_change: [2.5, -1.8],
		genes_length: 2
	}
	test.notOk(isScctGseaParams(invalid), 'should return false when genes array is missing')
	test.end()
})

tape('isScctGseaParams: missing fold_change array', function (test) {
	const invalid = {
		genome: 'hg38',
		genes: ['BRCA1', 'TP53'],
		genes_length: 2
	}
	test.notOk(isScctGseaParams(invalid), 'should return false when fold_change array is missing')
	test.end()
})

tape('isScctGseaParams: missing genes_length', function (test) {
	const invalid = {
		genome: 'hg38',
		genes: ['BRCA1', 'TP53'],
		fold_change: [2.5, -1.8]
	}
	test.notOk(isScctGseaParams(invalid), 'should return false when genes_length is missing')
	test.end()
})

tape('isScctGseaParams: genes array with non-string', function (test) {
	const invalid = {
		genome: 'hg38',
		genes: ['BRCA1', 123, 'MYC'],
		fold_change: [2.5, -1.8, 3.2],
		genes_length: 3
	}
	test.notOk(isScctGseaParams(invalid), 'should return false when genes array contains non-string')
	test.end()
})

tape('isScctGseaParams: fold_change array with non-number', function (test) {
	const invalid = {
		genome: 'hg38',
		genes: ['BRCA1', 'TP53', 'MYC'],
		fold_change: [2.5, 'not-a-number', 3.2],
		genes_length: 3
	}
	test.notOk(isScctGseaParams(invalid), 'should return false when fold_change array contains non-number')
	test.end()
})

tape('isScctGseaParams: wrong type for genes_length', function (test) {
	const invalid = {
		genome: 'hg38',
		genes: ['BRCA1', 'TP53'],
		fold_change: [2.5, -1.8],
		genes_length: '2'
	}
	test.notOk(isScctGseaParams(invalid), 'should return false when genes_length is not a number')
	test.end()
})

tape('isScctGseaParams: empty arrays', function (test) {
	const valid = {
		genome: 'hg38',
		genes: [],
		fold_change: [],
		genes_length: 0
	}
	test.ok(isScctGseaParams(valid), 'should return true for empty arrays with genes_length=0')
	test.end()
})

tape('isScctGseaParams: null value', function (test) {
	test.notOk(isScctGseaParams(null), 'should return false for null')
	test.end()
})

tape('isScctGseaParams: non-object value', function (test) {
	test.notOk(isScctGseaParams('string'), 'should return false for string')
	test.notOk(isScctGseaParams(123), 'should return false for number')
	test.end()
})

/***************************
 isOtherTermTypesGseaParams
***************************/

tape('isOtherTermTypesGseaParams: valid object', function (test) {
	const valid = {
		genome: 'hg38',
		cacheId: 'cache-123',
		daRequest: { some: 'data' },
		genes_length: 42,
		dslabel: 'dataset-label'
	}
	test.ok(isOtherTermTypesGseaParams(valid), 'should return true for valid OtherTermTypesGseaParams')
	test.end()
})

tape('isOtherTermTypesGseaParams: missing genome', function (test) {
	const invalid = {
		cacheId: 'cache-123',
		daRequest: { some: 'data' },
		genes_length: 42,
		dslabel: 'dataset-label'
	}
	test.notOk(isOtherTermTypesGseaParams(invalid), 'should return false when genome is missing')
	test.end()
})

tape('isOtherTermTypesGseaParams: missing cacheId', function (test) {
	const invalid = {
		genome: 'hg38',
		daRequest: { some: 'data' },
		genes_length: 42,
		dslabel: 'dataset-label'
	}
	test.notOk(isOtherTermTypesGseaParams(invalid), 'should return false when cacheId is missing')
	test.end()
})

tape('isOtherTermTypesGseaParams: missing daRequest', function (test) {
	const invalid = {
		genome: 'hg38',
		cacheId: 'cache-123',
		genes_length: 42,
		dslabel: 'dataset-label'
	}
	test.notOk(isOtherTermTypesGseaParams(invalid), 'should return false when daRequest is missing')
	test.end()
})

tape('isOtherTermTypesGseaParams: missing genes_length', function (test) {
	const invalid = {
		genome: 'hg38',
		cacheId: 'cache-123',
		daRequest: { some: 'data' },
		dslabel: 'dataset-label'
	}
	test.notOk(isOtherTermTypesGseaParams(invalid), 'should return false when genes_length is missing')
	test.end()
})

tape('isOtherTermTypesGseaParams: missing dslabel', function (test) {
	const invalid = {
		genome: 'hg38',
		cacheId: 'cache-123',
		daRequest: { some: 'data' },
		genes_length: 42
	}
	test.notOk(isOtherTermTypesGseaParams(invalid), 'should return false when dslabel is missing')
	test.end()
})

tape('isOtherTermTypesGseaParams: wrong type for genome', function (test) {
	const invalid = {
		genome: 123,
		cacheId: 'cache-123',
		daRequest: { some: 'data' },
		genes_length: 42,
		dslabel: 'dataset-label'
	}
	test.notOk(isOtherTermTypesGseaParams(invalid), 'should return false when genome is not a string')
	test.end()
})

tape('isOtherTermTypesGseaParams: wrong type for cacheId', function (test) {
	const invalid = {
		genome: 'hg38',
		cacheId: 123,
		daRequest: { some: 'data' },
		genes_length: 42,
		dslabel: 'dataset-label'
	}
	test.notOk(isOtherTermTypesGseaParams(invalid), 'should return false when cacheId is not a string')
	test.end()
})

tape('isOtherTermTypesGseaParams: wrong type for genes_length', function (test) {
	const invalid = {
		genome: 'hg38',
		cacheId: 'cache-123',
		daRequest: { some: 'data' },
		genes_length: '42',
		dslabel: 'dataset-label'
	}
	test.notOk(isOtherTermTypesGseaParams(invalid), 'should return false when genes_length is not a number')
	test.end()
})

tape('isOtherTermTypesGseaParams: wrong type for dslabel', function (test) {
	const invalid = {
		genome: 'hg38',
		cacheId: 'cache-123',
		daRequest: { some: 'data' },
		genes_length: 42,
		dslabel: 123
	}
	test.notOk(isOtherTermTypesGseaParams(invalid), 'should return false when dslabel is not a string')
	test.end()
})

tape('isOtherTermTypesGseaParams: daRequest can be any type', function (test) {
	const validWithNull = {
		genome: 'hg38',
		cacheId: 'cache-123',
		daRequest: null,
		genes_length: 42,
		dslabel: 'dataset-label'
	}
	test.ok(isOtherTermTypesGseaParams(validWithNull), 'should return true when daRequest is null')

	const validWithString = {
		genome: 'hg38',
		cacheId: 'cache-123',
		daRequest: 'string-value',
		genes_length: 42,
		dslabel: 'dataset-label'
	}
	test.ok(isOtherTermTypesGseaParams(validWithString), 'should return true when daRequest is a string')
	test.end()
})

tape('isOtherTermTypesGseaParams: null value', function (test) {
	test.notOk(isOtherTermTypesGseaParams(null), 'should return false for null')
	test.end()
})

tape('isOtherTermTypesGseaParams: non-object value', function (test) {
	test.notOk(isOtherTermTypesGseaParams('string'), 'should return false for string')
	test.notOk(isOtherTermTypesGseaParams(123), 'should return false for number')
	test.end()
})

/***************************
 isValidGseaParams
***************************/

tape('isValidGseaParams: valid ProteomeDAPGseaParams', function (test) {
	const valid = {
		genome: 'hg38',
		dslabel: 'test-dataset',
		dapParams: { organism: 'human', assay: 'rna', cohort: 'cohort1' }
	}
	test.ok(isValidGseaParams(valid), 'should return true for valid ProteomeDAPGseaParams')
	test.end()
})

tape('isValidGseaParams: valid ScctGseaParams', function (test) {
	const valid = {
		genome: 'hg38',
		genes: ['BRCA1', 'TP53'],
		fold_change: [2.5, -1.8],
		genes_length: 2
	}
	test.ok(isValidGseaParams(valid), 'should return true for valid ScctGseaParams')
	test.end()
})

tape('isValidGseaParams: valid OtherTermTypesGseaParams', function (test) {
	const valid = {
		genome: 'hg38',
		cacheId: 'cache-123',
		daRequest: { some: 'data' },
		genes_length: 42,
		dslabel: 'dataset-label'
	}
	test.ok(isValidGseaParams(valid), 'should return true for valid OtherTermTypesGseaParams')
	test.end()
})

tape('isValidGseaParams: invalid object', function (test) {
	const invalid = {
		some: 'random',
		data: 123
	}
	test.notOk(isValidGseaParams(invalid), 'should return false for object matching none of the types')
	test.end()
})

tape('isValidGseaParams: null value', function (test) {
	test.notOk(isValidGseaParams(null), 'should return false for null')
	test.end()
})

tape('isValidGseaParams: undefined value', function (test) {
	test.notOk(isValidGseaParams(undefined), 'should return false for undefined')
	test.end()
})

tape('isValidGseaParams: non-object value', function (test) {
	test.notOk(isValidGseaParams('string'), 'should return false for string')
	test.notOk(isValidGseaParams(123), 'should return false for number')
	test.notOk(isValidGseaParams([]), 'should return false for array')
	test.end()
})

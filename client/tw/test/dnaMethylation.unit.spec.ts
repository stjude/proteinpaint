import tape from 'tape'
import { DnaMethylationBase, getDNAMethUnit, getDNAMethTermName } from '../dnaMethylation.ts'
import { DNA_METHYLATION } from '#shared/terms.js'

/*************************
 reusable helper functions
**************************/

const mockVocabApi = {
	termdbConfig: {
		queries: {
			dnaMethylation: {
				unit: 'Configured Beta Value',
				promoter: { unit: 'Configured M-value' }
			}
		}
	}
}

const mockVocabApiNoUnit = {
	termdbConfig: {
		queries: {
			dnaMethylation: {}
		}
	}
}

function getValidRawTerm(overrides: any = {}) {
	return {
		type: DNA_METHYLATION,
		chr: 'chr1',
		start: 100,
		stop: 200,
		genomicFeatureType: 'gene',
		...overrides
	}
}

function getOpts(vocabApi = mockVocabApi) {
	return { vocabApi: vocabApi as any } as any
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- tw/dnaMethylation -***-')
	test.end()
})

tape('getDNAMethUnit() should return configured unit for gene type', test => {
	test.equal(
		getDNAMethUnit('gene', mockVocabApi as any),
		'Configured Beta Value',
		'Should return configured unit from termdbConfig for gene'
	)
	test.equal(
		getDNAMethUnit('gene', mockVocabApiNoUnit as any),
		'Average Beta Value',
		'Should fallback to default unit for gene when config is missing'
	)
	test.end()
})

tape('getDNAMethUnit() should return configured unit for promoter type', test => {
	test.equal(
		getDNAMethUnit('promoter', mockVocabApi as any),
		'Configured M-value',
		'Should return configured promoter unit from termdbConfig'
	)
	test.equal(
		getDNAMethUnit('promoter', mockVocabApiNoUnit as any),
		'Average M-value',
		'Should fallback to default promoter unit when config is missing'
	)
	test.end()
})

tape('getDNAMethUnit() should return default unit for unknown genomicFeatureType', test => {
	test.equal(
		getDNAMethUnit('region', mockVocabApi as any),
		'Average Beta Value',
		'Should return default unit for region type'
	)
	test.equal(
		getDNAMethUnit('enhancer', mockVocabApi as any),
		'Average Beta Value',
		'Should return default unit for enhancer type'
	)
	test.end()
})

tape('getDNAMethTermName() should format name for promoter type', test => {
	const term = getValidRawTerm({ genomicFeatureType: 'promoter', id: 'chr1:100-200', unit: 'Average M-value' })
	test.equal(
		getDNAMethTermName(term as any),
		'Promoter Average M-value (chr1:100-200)',
		'Should format promoter name with unit and id'
	)
	test.end()
})

tape('getDNAMethTermName() should format name for gene type', test => {
	const term = getValidRawTerm({
		genomicFeatureType: 'gene',
		featureName: 'TP53',
		id: 'chr1:100-200',
		unit: 'Average Beta Value'
	})
	test.equal(
		getDNAMethTermName(term as any),
		'TP53 - Promoter Average Beta Value (chr1:100-200)',
		'Should format gene name with featureName, unit, and id'
	)
	test.end()
})

tape('getDNAMethTermName() should format name for default type', test => {
	const term = getValidRawTerm({ genomicFeatureType: 'region', id: 'chr1:100-200', unit: 'Average Beta Value' })
	test.equal(
		getDNAMethTermName(term as any),
		'chr1:100-200 Average Beta Value',
		'Should format default name with id and unit'
	)
	test.end()
})

tape('getDNAMethTermName() should use termUnit fallback when term.unit is missing', test => {
	const term = getValidRawTerm({ genomicFeatureType: 'region', id: 'chr1:100-200', unit: undefined })
	test.equal(
		getDNAMethTermName(term as any, 'Fallback Unit'),
		'chr1:100-200 Fallback Unit',
		'Should use termUnit parameter when term.unit is missing'
	)
	test.end()
})

tape('validate() should throw on invalid terms', test => {
	test.throws(
		() => DnaMethylationBase.validate(null as any),
		/Term is missing or not an object/,
		'Should throw when term is not an object'
	)

	test.throws(
		() => DnaMethylationBase.validate({ type: 'categorical' } as any),
		/Incorrect term.type='categorical'/,
		'Should throw when term.type is incorrect'
	)

	test.throws(
		() => DnaMethylationBase.validate(getValidRawTerm({ chr: undefined }) as any),
		/Incomplete coordinate/,
		'Should throw when chr is missing'
	)

	test.throws(
		() => DnaMethylationBase.validate(getValidRawTerm({ start: undefined }) as any),
		/Incomplete coordinate/,
		'Should throw when start is missing'
	)

	test.throws(
		() => DnaMethylationBase.validate(getValidRawTerm({ stop: undefined }) as any),
		/Incomplete coordinate/,
		'Should throw when stop is missing'
	)

	test.throws(
		() => DnaMethylationBase.validate(getValidRawTerm({ genomicFeatureType: undefined }) as any),
		/Missing term.genomicFeatureType/,
		'Should throw when genomicFeatureType is missing'
	)

	test.doesNotThrow(
		() => DnaMethylationBase.validate(getValidRawTerm() as any),
		'Should accept valid dnaMethylation term'
	)

	test.end()
})

tape('fill() should populate id, unit, and name when missing', async test => {
	const term = getValidRawTerm({ id: undefined, name: undefined, unit: undefined })
	await DnaMethylationBase.fill(term as any, getOpts())

	test.equal(term.id, 'chr1:100-200', 'Should set id from chr:start-stop')
	test.equal(term.unit, 'Configured Beta Value', 'Should set unit from vocabApi')
	test.ok(term.name, 'Should set a name')
	test.end()
})

tape('fill() should not overwrite existing id and name', async test => {
	const term = getValidRawTerm({ id: 'custom-id', name: 'Custom Name' })
	await DnaMethylationBase.fill(term as any, getOpts())

	test.equal(term.id, 'custom-id', 'Should preserve existing id')
	test.equal(term.name, 'Custom Name', 'Should preserve existing name')
	test.end()
})

tape('constructor should set fields from term and opts', test => {
	const term = getValidRawTerm({ id: undefined, name: undefined, unit: undefined })
	const x = new DnaMethylationBase(term as any, getOpts())

	test.equal(x.id, 'chr1:100-200', 'Should generate id from coordinates')
	test.equal(x.unit, 'Configured Beta Value', 'Should set unit from vocabApi')
	test.ok(x.name, 'Should generate a name')
	test.end()
})

tape('constructor should preserve explicit term fields', test => {
	const term = getValidRawTerm({
		id: 'my-id',
		name: 'My Name',
		unit: 'My Unit'
	})
	const x = new DnaMethylationBase(term as any, getOpts())

	test.equal(x.id, 'my-id', 'Should preserve explicit id')
	test.equal(x.name, 'My Name', 'Should preserve explicit name')
	test.equal(x.unit, 'My Unit', 'Should preserve explicit unit')
	test.end()
})

tape('constructor should throw on invalid term', test => {
	test.throws(
		() => new DnaMethylationBase({ type: 'categorical' } as any, getOpts()),
		/Incorrect term.type='categorical', expecting 'dnaMethylation'/,
		'Should throw on invalid term type'
	)
	test.end()
})

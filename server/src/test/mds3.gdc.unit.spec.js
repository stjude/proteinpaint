import tape from 'tape'
import { flattenCaseByFields, parseGdcCnvFile } from '../mds3.gdc.js'
import { dtcnv, dtloh } from '#shared/common.js'

tape('\n', function (test) {
	test.comment('-***- src/mds3.gdc.specs specs -***-')
	test.end()
})

tape('flattenCaseByFields(): single diagnoses entry', test => {
	const tw = { term: { id: 'case.diagnoses.age_at_diagnosis' } }
	// hit = an entry in /cases response.hits[]
	const hit = {
		//id: 'xxxYYY',
		//submitter_id: 'abc-123',
		diagnoses: [
			{
				age_at_diagnosis: 10,
				submitter_id: 'abc-123-DIAG'
				//diagnosis_is_primary_disease: true
			}
		]
	}

	const sample = {}
	flattenCaseByFields(sample, hit, tw)
	test.deepEqual(sample, { 'case.diagnoses.age_at_diagnosis': 10 }, 'should flatten nested case data')
	test.end()
})

// see https://gdc-ctds.atlassian.net/browse/SV-2770
tape('flattenCaseByFields(): multiple diagnoses entries', test => {
	const tw = { term: { id: 'case.diagnoses.age_at_diagnosis' } }
	// hit = an entry in /cases response.hits[]
	const hit = {
		//id: 'xxxYYY',
		//submitter_id: 'abc-123',
		diagnoses: [
			{
				age_at_diagnosis: 10,
				submitter_id: 'abc-123-DIAG',
				diagnosis_is_primary_disease: false
			},
			{
				age_at_diagnosis: 20,
				submitter_id: 'abc-123-DIAG',
				diagnosis_is_primary_disease: true
			}
		]
	}

	const sample = {}
	flattenCaseByFields(sample, hit, tw)
	test.deepEqual(sample, { 'case.diagnoses.age_at_diagnosis': 20 }, 'should flatten nested case data')
	test.end()
})

tape("parseGdcCnvFile(): segment-mean file stamps valueType='segmean'", test => {
	// snp-array "Masked Copy Number Segment" format: 6 cols, chr without "chr" prefix
	const text = [
		'GDC_Aliquot\tChromosome\tStart\tEnd\tNum_Probes\tSegment_Mean',
		'aliquot1\t1\t1000\t2000\t50\t0.8',
		'aliquot1\t17\t3000\t4000\t60\t-0.6'
	].join('\n')

	const mlst = parseGdcCnvFile(text)
	test.equal(mlst.length, 2, 'two cnv segments parsed')
	test.deepEqual(
		mlst[0],
		{ dt: dtcnv, chr: 'chr1', start: 1000, stop: 2000, value: 0.8, valueType: 'segmean' },
		"first segment carries valueType 'segmean' and chr prefix added"
	)
	test.ok(
		mlst.every(m => m.dt === dtcnv && m.valueType === 'segmean'),
		'every segment is dtcnv with segmean valueType'
	)
	test.end()
})

tape("parseGdcCnvFile(): copy-number file stamps valueType='copyNumber' and emits LOH", test => {
	// allele-specific "Allele-specific Copy Number Segment" format: 7 cols (total/major/minor)
	const text = [
		'GDC_Aliquot\tChromosome\tStart\tEnd\tCopy_Number\tMajor_Copy_Number\tMinor_Copy_Number',
		'aliquot1\tchr1\t1000\t2000\t3\t2\t1', // total=3, minor!=0 => no loh
		'aliquot1\tchr2\t5000\t6000\t2\t2\t0' // total=2>0, minor=0 & major>0 => strict one-allele loss => loh
	].join('\n')

	const mlst = parseGdcCnvFile(text)
	const cnvs = mlst.filter(m => m.dt === dtcnv)
	const lohs = mlst.filter(m => m.dt === dtloh)

	test.equal(cnvs.length, 2, 'two cnv segments parsed')
	test.ok(
		cnvs.every(m => m.valueType === 'copyNumber'),
		"every cnv segment carries valueType 'copyNumber'"
	)
	test.equal(cnvs[0].value, 3, 'cnv value is the total copy number')
	test.equal(lohs.length, 1, 'one LOH event emitted for strict one-allele loss')
	test.notOk('valueType' in lohs[0], 'LOH event is not stamped with a cnv valueType')
	test.equal(lohs[0].segmean, 0.5, 'LOH event keeps its hardcoded segmean')
	test.end()
})

tape('parseGdcCnvFile(): unknown header throws', test => {
	test.throws(
		() => parseGdcCnvFile('Some\tUnexpected\tHeader\nfoo\tbar\tbaz'),
		/unknown CNV file header line/,
		'rejects an unrecognized header line'
	)
	test.end()
})

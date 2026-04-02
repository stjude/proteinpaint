import tape from 'tape'
import { flattenCaseByFields } from '../mds3.gdc.js'

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

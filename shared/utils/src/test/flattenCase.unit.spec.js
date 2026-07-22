import tape from 'tape'
import { flattenCaseByFields } from '../flattenCase.js'

tape('\n', function (test) {
	test.comment('-***- shared/flattenCase specs -***-')
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

// a non-diagnoses array-valued path (e.g. treatments) is collected into a Set by query(); it must be
// reduced to a single scalar before returning, else a raw Set leaks to callers and serializes to {}.
// this conversion was dropped by the SV-2770 diagnoses rework; guards against dropping it again.
tape('flattenCaseByFields(): multi-valued field reduces to a deterministic scalar, not a Set', test => {
	const tw = { term: { id: 'case.treatments.therapeutic_agent', type: 'categorical' } }
	const hit = { treatments: [{ therapeutic_agent: 'DrugB' }, { therapeutic_agent: 'DrugA' }] }

	const sample = {}
	flattenCaseByFields(sample, hit, tw)

	const v = sample['case.treatments.therapeutic_agent']
	test.notOk(v instanceof Set, 'value is not left as a Set')
	test.equal(typeof v, 'string', 'value is a scalar')
	test.equal(v, 'DrugA', 'multiple values reduce to the deterministic (sorted-first) value')

	// order-independence: reversed input yields the same result
	const sample2 = {}
	flattenCaseByFields(sample2, { treatments: [{ therapeutic_agent: 'DrugA' }, { therapeutic_agent: 'DrugB' }] }, tw)
	test.equal(sample2['case.treatments.therapeutic_agent'], 'DrugA', 'result is independent of input order')

	test.end()
})

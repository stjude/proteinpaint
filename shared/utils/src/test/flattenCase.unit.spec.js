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

/* gdc declares diagnoses.diagnosis_is_primary_disease as a "keyword" field: /cases coerces it to a
json boolean, but /ssm_occurrences (what the mds3 lollipop loads from) returns the raw "true"/"false"
string. comparing it to a boolean literal made the decision tree bail out and blanked EVERY term of
the case -- 23% of samples on some lollipops -- so both representations must behave identically. */
tape('flattenCaseByFields(): diagnosis_is_primary_disease as "true"/"false" strings', test => {
	const tw = { term: { id: 'case.diagnoses.age_at_diagnosis' } }
	// hit = an entry in /ssm_occurrences response.hits[], which stringifies the flag
	const hit = {
		diagnoses: [
			{ age_at_diagnosis: 10, submitter_id: 'abc-123-DIAG2', diagnosis_is_primary_disease: 'false' },
			{ age_at_diagnosis: 20, submitter_id: 'abc-123-DIAG', diagnosis_is_primary_disease: 'true' }
		]
	}

	const sample = {}
	flattenCaseByFields(sample, hit, tw)
	test.deepEqual(
		sample,
		{ 'case.diagnoses.age_at_diagnosis': 20 },
		'string flag selects the primary diagnosis, same as the boolean flag'
	)
	test.end()
})

// a bailout of the diagnoses decision tree must not prevent unrelated terms from being assigned;
// blanking case.project.project_id is what produced a false "Controlled" access label in the
// mds3 sample table, since may_add_projectAccess() keys off that value
tape('flattenCaseByFields(): undecidable diagnoses does not blank non-diagnoses terms', test => {
	// two entries, neither flagged primary -> the decision tree cannot pick one
	const hit = {
		project: { project_id: 'TCGA-UCEC' },
		disease_type: 'Adenomas and Adenocarcinomas',
		diagnoses: [
			{ age_at_diagnosis: 10, submitter_id: 'abc-123-DIAG2', diagnosis_is_primary_disease: 'false' },
			{ age_at_diagnosis: 20, submitter_id: 'abc-123-DIAG', diagnosis_is_primary_disease: 'false' }
		]
	}

	const sample = {}
	for (const id of ['case.diagnoses.age_at_diagnosis', 'case.project.project_id', 'case.disease_type']) {
		flattenCaseByFields(sample, hit, { term: { id } })
	}

	test.equal(sample['case.project.project_id'], 'TCGA-UCEC', 'project_id is assigned')
	test.equal(sample['case.disease_type'], 'Adenomas and Adenocarcinomas', 'disease_type is assigned')
	test.notOk('case.diagnoses.age_at_diagnosis' in sample, 'the undecidable diagnoses term is left unset')
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

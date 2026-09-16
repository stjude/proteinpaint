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

// see https://gdc-ctds.atlassian.net/browse/SV-2821
// filter0 admits a case when ANY diagnosis is in range, so the case must be binned by a diagnosis
// that satisfies the filter -- even a non-primary one -- and not by the primary diagnosis, which may
// fall in a different bin. this is the TCGA-MN-A4N1 case from the report: a 52.5y non-primary
// diagnosis matched a 50-60y cohort filter, but the 60.06y primary diagnosis wrongly binned it as >60y.
// filter0 shape carrying an age_at_diagnosis range [18263, 21915): only the 19175 (non-primary)
// diagnosis of TCGA-MN-A4N1 qualifies, not the 21939 (primary) one
const ageRangeFilter0 = {
	op: 'and',
	content: [
		{ op: '>=', content: { field: 'cases.diagnoses.age_at_diagnosis', value: 18263 } },
		{ op: '<', content: { field: 'cases.diagnoses.age_at_diagnosis', value: 21915 } }
	]
}

tape('flattenCaseByFields(): filter0 age range selects the in-range diagnosis over the primary', test => {
	const tw = { term: { id: 'case.diagnoses.age_at_diagnosis' } }
	const hit = {
		diagnoses: [
			{ age_at_diagnosis: 19175, submitter_id: 'TCGA-MN-A4N1_diagnosis2', diagnosis_is_primary_disease: false },
			{ age_at_diagnosis: 21939, submitter_id: 'TCGA-MN-A4N1_diagnosis', diagnosis_is_primary_disease: true }
		]
	}

	const sample = {}
	flattenCaseByFields(sample, hit, tw, 1, { filter0: ageRangeFilter0 })
	test.deepEqual(
		sample,
		{ 'case.diagnoses.age_at_diagnosis': 19175 },
		'the in-range non-primary diagnosis is chosen, aligning the summary with filter0'
	)
	test.end()
})

// filter0 can constrain primary_diagnosis instead of / as well as age; the matching diagnosis wins
tape('flattenCaseByFields(): filter0 primary_diagnosis set selects the matching diagnosis', test => {
	const tw = { term: { id: 'case.diagnoses.age_at_diagnosis' } }
	const hit = {
		diagnoses: [
			{
				age_at_diagnosis: 19175,
				primary_diagnosis: 'Squamous cell carcinoma, NOS',
				diagnosis_is_primary_disease: false
			},
			{ age_at_diagnosis: 21939, primary_diagnosis: 'Adenocarcinoma, NOS', diagnosis_is_primary_disease: true }
		]
	}
	const filter0 = {
		op: 'and',
		content: [
			{ op: 'in', content: { field: 'cases.diagnoses.primary_diagnosis', value: ['Squamous cell carcinoma, NOS'] } }
		]
	}

	const sample = {}
	flattenCaseByFields(sample, hit, tw, 1, { filter0 })
	test.deepEqual(
		sample,
		{ 'case.diagnoses.age_at_diagnosis': 19175 },
		'the diagnosis whose primary_diagnosis matches filter0 is chosen'
	)
	test.end()
})

// the nested and/or operators must be preserved when compiling the predicate. flattening the tree
// into one AND would require a diagnosis to satisfy BOTH branches of an OR at once -> match nothing
// -> wrongly fall back to the primary diagnosis and re-bin the case outside the cohort condition.
tape('flattenCaseByFields(): filter0 OR of diagnoses leaves matches either branch', test => {
	const tw = { term: { id: 'case.diagnoses.age_at_diagnosis' } }
	const hit = {
		diagnoses: [
			{
				age_at_diagnosis: 19175,
				primary_diagnosis: 'Squamous cell carcinoma, NOS',
				diagnosis_is_primary_disease: false
			},
			{ age_at_diagnosis: 21939, primary_diagnosis: 'Adenocarcinoma, NOS', diagnosis_is_primary_disease: true }
		]
	}
	// primary_diagnosis in [Squamous...] OR primary_diagnosis in [Small cell...]:
	// the non-primary Squamous diagnosis (19175) satisfies the first branch and must be chosen
	const filter0 = {
		op: 'or',
		content: [
			{ op: 'in', content: { field: 'cases.diagnoses.primary_diagnosis', value: ['Squamous cell carcinoma, NOS'] } },
			{ op: 'in', content: { field: 'cases.diagnoses.primary_diagnosis', value: ['Small cell carcinoma'] } }
		]
	}

	const sample = {}
	flattenCaseByFields(sample, hit, tw, 1, { filter0 })
	test.deepEqual(
		sample,
		{ 'case.diagnoses.age_at_diagnosis': 19175 },
		'a diagnosis matching either OR branch is chosen (tree structure preserved, not AND-flattened)'
	)
	test.end()
})

// a `not` group negates its wrapped sub-filter; the diagnosis NOT excluded by it must be chosen.
// without not-group handling the node compiles to null -> default selection -> the primary diagnosis
tape('flattenCaseByFields(): filter0 not-group negation selects the non-excluded diagnosis', test => {
	const tw = { term: { id: 'case.diagnoses.age_at_diagnosis' } }
	const hit = {
		diagnoses: [
			{
				age_at_diagnosis: 19175,
				primary_diagnosis: 'Squamous cell carcinoma, NOS',
				diagnosis_is_primary_disease: false
			},
			{ age_at_diagnosis: 21939, primary_diagnosis: 'Adenocarcinoma, NOS', diagnosis_is_primary_disease: true }
		]
	}
	// NOT(primary_diagnosis in [Adenocarcinoma]) -> the Squamous (non-primary, 19175) diagnosis qualifies
	const filter0 = {
		op: 'not',
		content: { op: 'in', content: { field: 'cases.diagnoses.primary_diagnosis', value: ['Adenocarcinoma, NOS'] } }
	}

	const sample = {}
	flattenCaseByFields(sample, hit, tw, 1, { filter0 })
	test.deepEqual(
		sample,
		{ 'case.diagnoses.age_at_diagnosis': 19175 },
		'the diagnosis not excluded by the negation is chosen'
	)
	test.end()
})

// GDC expresses an isnot categorical constraint as a leaf-level `exclude` (NOT IN); the diagnosis
// that is not excluded must be chosen. Before exclude/!= were handled, the leaf matched nothing and
// the case fell back to the primary diagnosis.
tape('flattenCaseByFields(): filter0 leaf-level exclude selects the non-excluded diagnosis', test => {
	const tw = { term: { id: 'case.diagnoses.age_at_diagnosis' } }
	const hit = {
		diagnoses: [
			{
				age_at_diagnosis: 19175,
				primary_diagnosis: 'Squamous cell carcinoma, NOS',
				diagnosis_is_primary_disease: false
			},
			{ age_at_diagnosis: 21939, primary_diagnosis: 'Adenocarcinoma, NOS', diagnosis_is_primary_disease: true }
		]
	}
	const filter0 = {
		op: 'and',
		content: [
			{ op: 'exclude', content: { field: 'cases.diagnoses.primary_diagnosis', value: ['Adenocarcinoma, NOS'] } }
		]
	}

	const sample = {}
	flattenCaseByFields(sample, hit, tw, 1, { filter0 })
	test.deepEqual(
		sample,
		{ 'case.diagnoses.age_at_diagnosis': 19175 },
		'exclude (NOT IN) selects the diagnosis whose value is not in the excluded set'
	)
	test.end()
})

// a non-diagnosis branch inside an OR must not turn a sibling diagnosis branch into a mandatory
// constraint. "(diagnosis=A OR primary_site=lung) AND age<60": a returned lung case whose only
// under-60 diagnosis is not A must still be binned by that under-60 diagnosis, not fall back to an
// over-60 primary. (Flattening/dropping the case-level branch would compile this to diagnosis=A AND
// age<60, match nothing, and re-bin the case outside the cohort.)
tape('flattenCaseByFields(): case-level OR branch does not force a sibling diagnosis constraint', test => {
	const tw = { term: { id: 'case.diagnoses.age_at_diagnosis' } }
	const hit = {
		diagnoses: [
			{
				age_at_diagnosis: 19000,
				primary_diagnosis: 'Squamous cell carcinoma, NOS',
				diagnosis_is_primary_disease: false
			},
			{ age_at_diagnosis: 22000, primary_diagnosis: 'Adenocarcinoma, NOS', diagnosis_is_primary_disease: true }
		]
	}
	const filter0 = {
		op: 'and',
		content: [
			{
				op: 'or',
				content: [
					{ op: 'in', content: { field: 'cases.diagnoses.primary_diagnosis', value: ['Adenocarcinoma, NOS'] } },
					{ op: 'in', content: { field: 'cases.primary_site', value: ['bronchus and lung'] } }
				]
			},
			{ op: '<', content: { field: 'cases.diagnoses.age_at_diagnosis', value: 21915 } }
		]
	}

	const sample = {}
	flattenCaseByFields(sample, hit, tw, 1, { filter0 })
	test.deepEqual(
		sample,
		{ 'case.diagnoses.age_at_diagnosis': 19000 },
		'the under-60 diagnosis is chosen even though it is not the primary_diagnosis named in the OR'
	)
	test.end()
})

// a diagnosis the filter DEFINITELY admits (TRI_TRUE) must be preferred over one only possibly
// admitted via an unevaluated case-level leaf (TRI_UNKNOWN). "diagnosis=A OR primary_site=lung" on a
// non-lung case: the non-primary diagnosis A is a definite match, the primary diagnosis B is only
// UNKNOWN -- the case must be summarized by A, not by B. Collapsing the tri-state to a boolean would
// let diagnosisSort pick the UNKNOWN primary B.
tape('flattenCaseByFields(): definite (TRUE) match is preferred over an UNKNOWN primary diagnosis', test => {
	const tw = { term: { id: 'case.diagnoses.age_at_diagnosis' } }
	const hit = {
		diagnoses: [
			{ age_at_diagnosis: 19000, primary_diagnosis: 'A', diagnosis_is_primary_disease: false },
			{ age_at_diagnosis: 22000, primary_diagnosis: 'B', diagnosis_is_primary_disease: true }
		]
	}
	const filter0 = {
		op: 'or',
		content: [
			{ op: 'in', content: { field: 'cases.diagnoses.primary_diagnosis', value: ['A'] } },
			{ op: 'in', content: { field: 'cases.primary_site', value: ['bronchus and lung'] } }
		]
	}

	const sample = {}
	flattenCaseByFields(sample, hit, tw, 1, { filter0 })
	test.deepEqual(
		sample,
		{ 'case.diagnoses.age_at_diagnosis': 19000 },
		'the definite match A is chosen over the possibly-admitted primary diagnosis B'
	)
	test.end()
})

// a diagnosis satisfying a non-age constraint (primary_diagnosis) must be selectable even when its
// age_at_diagnosis is null -- the evaluator, not a blanket null-age drop, decides selection (SV-2821)
tape('flattenCaseByFields(): non-age constraint selects a diagnosis with null age', test => {
	const tw = { term: { id: 'case.diagnoses.primary_diagnosis' } }
	const hit = {
		diagnoses: [
			{
				age_at_diagnosis: null,
				primary_diagnosis: 'Squamous cell carcinoma, NOS',
				diagnosis_is_primary_disease: false
			},
			{ age_at_diagnosis: 20000, primary_diagnosis: 'Adenocarcinoma, NOS', diagnosis_is_primary_disease: true }
		]
	}
	const filter0 = {
		op: 'and',
		content: [
			{ op: 'in', content: { field: 'cases.diagnoses.primary_diagnosis', value: ['Squamous cell carcinoma, NOS'] } }
		]
	}

	const sample = {}
	flattenCaseByFields(sample, hit, tw, 1, { filter0 })
	test.deepEqual(
		sample,
		{ 'case.diagnoses.primary_diagnosis': 'Squamous cell carcinoma, NOS' },
		'the null-age diagnosis matching the cohort primary_diagnosis is chosen, not dropped'
	)
	test.end()
})

// when no diagnosis satisfies filter0, fall back to the deterministic SV-2770 selection so behavior
// is unchanged for cases the cohort filter matched for a non-diagnoses reason (e.g. primary_site)
tape('flattenCaseByFields(): filter0 falls back to the primary diagnosis when none matches', test => {
	const tw = { term: { id: 'case.diagnoses.age_at_diagnosis' } }
	const hit = {
		diagnoses: [
			{ age_at_diagnosis: 10, submitter_id: 'abc-123-DIAG2', diagnosis_is_primary_disease: false },
			{ age_at_diagnosis: 20, submitter_id: 'abc-123-DIAG', diagnosis_is_primary_disease: true }
		]
	}

	const sample = {}
	// no diagnosis falls in [18263, 21915) -> default selection (the primary, 20) is used
	flattenCaseByFields(sample, hit, tw, 1, { filter0: ageRangeFilter0 })
	test.deepEqual(sample, { 'case.diagnoses.age_at_diagnosis': 20 }, 'falls back to the primary diagnosis')
	test.end()
})

// a filter0 with no diagnoses-scoped constraint must not change the default SV-2770 selection
tape('flattenCaseByFields(): filter0 without a diagnoses constraint leaves default selection intact', test => {
	const tw = { term: { id: 'case.diagnoses.age_at_diagnosis' } }
	const hit = {
		diagnoses: [
			{ age_at_diagnosis: 10, submitter_id: 'abc-123-DIAG2', diagnosis_is_primary_disease: false },
			{ age_at_diagnosis: 20, submitter_id: 'abc-123-DIAG', diagnosis_is_primary_disease: true }
		]
	}
	const filter0 = { op: 'and', content: [{ op: 'in', content: { field: 'cases.primary_site', value: ['lung'] } }] }

	const sample = {}
	flattenCaseByFields(sample, hit, tw, 1, { filter0 })
	test.deepEqual(sample, { 'case.diagnoses.age_at_diagnosis': 20 }, 'primary diagnosis is chosen as usual')
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

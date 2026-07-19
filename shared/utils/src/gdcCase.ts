/*
Flattens a GDC /cases-shaped case object onto a flat sample{} keyed by dotted term id,
e.g. case.diagnoses.age_at_diagnosis -> sample['case.diagnoses.age_at_diagnosis'].

Lives in the shared package because it has two consumers in two different repos: the GDC
dataset (ppgdc) and the MMRF dataset (ppmmrf, itself an MMRF-COMMPASS GDC project). It used
to reach ppmmrf by injection through the server's dsHelpers; that stopped being possible when
the GDC query code moved out of the server package.

Prior to consolidating here there were three copies, two of which had drifted -- notably one
that predated the SV-2770 deterministic-diagnosis fix and picked an arbitrary Set element.
Keep this the single definition.
*/

/*
examples of terms from termdb as below, note the dot-delimited value of term id
{
    id: 'case.disease_type',
    name: 'Disease type',
    isleaf: true,
    type: 'categorical'
}
{
  id: 'case.project.project_id',
  name: 'Project id',
  groupsetting: { inuse: false },
  isleaf: true,
  type: 'categorical',
  parent_id: 'case.project',
  included_types: [ 'categorical' ],
  child_types: []
}
{
  id: 'case.diagnoses.age_at_diagnosis',
  name: 'Age at diagnosis',
  isleaf: true,
  parent_id: 'diagnoses',
  type: 'integer'
}


example of a case returned by GDC api (/ssm_occurrences/ query)

case {
  primary_site: 'Hematopoietic and reticuloendothelial systems',
  disease_type: 'Plasma Cell Tumors',
  observation: [ { sample: [Object] }, { sample: [Object] } ],
  case_id: 'cd91e38c-1d2a-4534-8765-bfb9f0541338',
  project: { project_id: 'MMRF-COMMPASS' },
  diagnoses: [ { age_at_diagnosis: 32171 } ],
  demographic: {
    ethnicity: 'not hispanic or latino',
    gender: 'male',
    race: 'white'
  }
}

the sample-specific values for terms come in 3 formats:

	term1: case.disease_type
	in case{}: disease_type: 'value'

	term2: case.project.project_id
	in case{}: project: { project_id: 'value' }

	term3: case.diagnoses.age_at_diagnosis
	in case{}: diagnoses: [ { age_at_diagnosis: int } ]

this function "flattens" case{} to make the sample obj for easier use later
{
	'case.disease_type': 'value',
	'case.project.project_id': 'value',
	'case.diagnoses.age_at_diagnosis': [ int ]
}

the flattening is done by splitting term id, and some hardcoded logic

args:
- sample: object to assign new pp term id key-value pairs to
- caseObj: object returned by gdc api
- tw: {term:{id}}
- startIdx:
	start with caseObj as "current" root
	default is 1 as fields[0]='case', and caseObj is already the "case", so start from i=1
	if caseObj data is returned by /cases/, use 0

todo unit test
*/
export function flattenCaseByFields(sample, caseObj, tw, startIdx = 1) {
	if (Array.isArray(caseObj.diagnoses)) {
		// There may be multiple diagnosis entries, choose only one for summary plot,
		// but the selected entry must be deterministic and always render the same plot
		// for a given diagnoses array with entries in assumed arbitrary, random order.
		// See https://gdc-ctds.atlassian.net/browse/SV-2770
		const diagnoses = caseObj.diagnoses.filter(diagnosisFilter)
		if (!diagnoses.length) return
		if (diagnoses.length > 1) {
			// there should be either exactly 1 diagnoses entry that is primary disease,
			// or all of the diagnoses entries have undefined primary disease since
			// it was not in the requested fieldset (as required if diagnoses.age_at_diagnosis
			// or primary_disease are also requested)
			if (diagnoses.filter(diagnosisIsPrimaryDisease).length !== 1 && diagnoses.filter(primaryDiseasesIsDefined).length)
				return
		}
		diagnoses.sort(diagnosisSort)
		caseObj.diagnoses = diagnoses[0]
	}

	const fields = tw.term.id.split('.')
	query(fields, sample, tw, caseObj, startIdx)

	/* done searching; if available, a new value is now assigned to sample[term.id]
	if value is a Set, convert to array
	hardcoded to use set to dedup values (e.g. chemo drug from multiple treatments)

	*** quick fix!! ***
	downstream mds3 code does not handle array value well.
	return 1st value for those to work; later can change back when array values can be handled
	4/1/2026: for diagnoses terms, the decision tree from https://gdc-ctds.atlassian.net/browse/SV-2770
						is implemented using diagnosisFilter() and diagnosisIsPrimaryDisease()
	*/

	if (tw.term.id in sample) {
		// a valid value is set, if tw.q defines binning or groupsetting, convert the value
		if (tw.term.type == 'categorical') {
			const v = mayApplyGroupsetting(sample[tw.term.id], tw)
			if (v) sample[tw.term.id] = v
		}

		/*
		reason...

		} else if (tw.term.type == 'integer' || tw.term.type == 'float') {
			*/
	}
}

/* helper function query()

e.g. "case.AA.BB.CC"
begin with query( case{}, 1 )
	--> found case.AA{}
	query( AA{}, 2 )
		--> found AA.BB{}
		query( BB{}, 3)
			--> found BB.CC, assign BB.CC to sample[case.AA.BB.CC]

e.g. "case.diagnoses.age_at_diagnosis"
begin with query( case{}, 1 ):
	--> found case.diagnoses, is array
	for(diagnosis of array) {
		query( diagnosis, 2 )
			--> found diagnosis.age_at_diagnosis=int
				collect int value to sample[case.diagnoses.age_at_diagnosis]
	}

recursion is used to advance i and when current is array, to loop through it
*/
function query(fields, sample, tw, current, i) {
	const field = fields[i]
	if (i == fields.length - 1) {
		// i is at the end of fields[], sample attr key is term.id
		if (sample[tw.term.id] instanceof Set) {
			sample[tw.term.id].add(current[field])
		} else {
			sample[tw.term.id] = current[field]
		}
		return
	}
	// i is not at the end of fields[], advance to next "root"
	const next = current[field]
	if (next == undefined) {
		// no more values, unable to assign term.id value to sample
		return
	}
	if (Array.isArray(next)) {
		// next is array, initiate set to collect values from all array elements
		sample[tw.term.id] = new Set()
		// recurse through each array element
		for (const n of next) {
			query(fields, sample, tw, n, i + 1)
		}
		return
	}
	// advance i and recurse
	query(fields, sample, tw, next, i + 1)
}

// see the decision tree in https://gdc-ctds.atlassian.net/browse/SV-2770
function diagnosisFilter(d) {
	// strict equality, undefined and other non-null empty values are not matched,
	// so this condition will not be applied if age_at_diagnosis or primary_diagnosis
	// was not added to the requested fieldset
	if (d.age_at_diagnosis === null) return false
	// as of 4/1/2026, 14 CPTAC cases have diagnoses entries that all match the condition below;
	// it looks like the GDC API does not return these samples when the fieldset is diagnoses.*,
	// but will still filter here nonetheless
	if (d.diagnosis_is_primary_disease === false) return false
	return true
}

// see the decision tree in https://gdc-ctds.atlassian.net/browse/SV-2770
// this filter is meant to be applied ONLY when there are multiple diagnoses[] entries,
// it's okay for a single-entry diagnoses[] to have diagnosis_is_primary_disease === null
function diagnosisIsPrimaryDisease(d) {
	return d.diagnosis_is_primary_disease === true
}

function primaryDiseasesIsDefined(d) {
	return d.diagnosis_is_primary_disease !== undefined
}

function diagnosisSort(a, b) {
	if (a.diagnosis_is_primary_disease) return -1
	if (b.diagnosis_is_primary_disease) return 1
	if (a.age_at_diagnosis === null && b.age_at_diagnosis === null) {
		// submitter_id are guaranteed to be different between 2 entries,
		// with the suffix being DIAG, relapse, etc
		return a.submitter_id < b.submitter_id ? -1 : 1
	}
	if (a.age_at_diagnosis === null) return 1
	if (b.age_at_diagnosis === null) return -1
	if (a.age_at_diagnosis < b.age_at_diagnosis) return -1
	if (a.age_at_diagnosis > b.age_at_diagnosis) return 1
	// submitter_id's are guaranteed to be different between 2 entries,
	// with the suffix being DIAG, relapse, etc
	return a.submitter_id < b.submitter_id ? -1 : 1
}

function mayApplyGroupsetting(v, tw) {
	if (tw.q?.type == 'custom-groupset') {
		if (!Array.isArray(tw.q?.customset?.groups)) throw 'q.customset.groups is not array'
		for (const group of tw.q.customset.groups) {
			if (!Array.isArray(group.values)) throw 'group.values[] not array from tw.q.customset.groups'
			if (group.values.findIndex(i => i.key == v) != -1) {
				// value "v" is in this group
				return group.name
			}
		}
	}
	if (tw.q?.type == 'predefined-groupset') {
		if (!Number.isInteger(tw.q.predefined_groupset_idx)) throw 'q.predefined_groupset_idx is not an integer'
		if (!tw.term.groupsetting?.lst?.length) throw 'term.groupsetting.lst is empty'
		for (const group of tw.term.groupsetting.lst[tw.q.predefined_groupset_idx]) {
			if (!Array.isArray(group.values)) throw 'group.values[] not array from tw.term.groupsetting.lst[]'
			if (group.values.findIndex(i => i.key == v) != -1) {
				// value "v" is in this group
				return group.name
			}
		}
	}
}

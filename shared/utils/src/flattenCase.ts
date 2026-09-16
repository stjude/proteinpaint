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
- opts.filter0:
	the GDC cohort filter. When it constrains diagnoses -- e.g. an age_at_diagnosis range and/or a
	primary_diagnosis set -- the case is binned by a diagnosis that satisfies those constraints, so
	the summary aligns with the cohort filter. filter0 admits a case when ANY of its diagnoses is in
	range, but the GDC API does not prune the returned diagnoses[] (nested sub-docs always come back
	in full), so the matching diagnosis is picked here. See https://gdc-ctds.atlassian.net/browse/SV-2821.
	When filter0 has no diagnoses constraint, or no diagnosis satisfies it, the deterministic SV-2770
	selection is used.
*/
export function flattenCaseByFields(sample, caseObj, tw, startIdx = 1, opts: { filter0?: any } = {}) {
	const fields = tw.term.id.split('.')

	/* the diagnoses decision tree below only governs terms whose value is read out of diagnoses[];
	it must not be allowed to abort terms that have nothing to do with diagnoses (case.project.project_id,
	case.disease_type, case.demographic.*, ...). this function is called once per tw, so an unscoped
	bailout blanked every term of a case, which in the mds3 sample table surfaced as empty Disease type/
	Primary site cells and -- via the missing case.project.project_id -- a bogus "Controlled" access label */
	if (fields.includes('diagnoses') && Array.isArray(caseObj.diagnoses)) {
		// There may be multiple diagnosis entries, choose only one for summary plot.
		const chosen = chooseDiagnosis(caseObj.diagnoses, getDiagnosisMatcher(opts.filter0))
		if (!chosen) return
		caseObj.diagnoses = chosen
	}

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

	// query() collects array-valued paths into a Set to dedup (e.g. a drug from multiple treatments).
	// downstream mds3 code and JSON serialization don't handle Set/array values (a Set serializes to
	// {}), so reduce to a single deterministic value. diagnoses arrays are collapsed to one entry
	// above, so this only affects other array-valued paths. (This conversion was dropped by the
	// SV-2770 diagnoses rework and is restored here.)
	if (sample[tw.term.id] instanceof Set) {
		sample[tw.term.id] = [...sample[tw.term.id]].filter(v => v !== null).sort(basicSort)[0]
	}

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

/* diagnosis_is_primary_disease must never be compared to a boolean literal!
gdc declares it as a "keyword" (string) field -- see /cases/_mapping, whose facet buckets are
keyed "true"/"false". the /cases endpoint happens to coerce it to a json boolean on output, but
/ssm_occurrences returns the raw string, so `=== true`/`=== false` silently failed on every case
loaded by the mds3 lollipop. these two helpers accept either representation. */
function isPrimaryDisease(d) {
	const v = d.diagnosis_is_primary_disease
	return v === true || v === 'true'
}
function isNotPrimaryDisease(d) {
	const v = d.diagnosis_is_primary_disease
	return v === false || v === 'false'
}

/* pick the single diagnosis entry to represent the case.

matcher (optional): a predicate identifying diagnoses that satisfy the cohort filter's diagnoses
constraints (see getDiagnosisMatcher). When present, the case is represented by a matching diagnosis
-- even a non-primary one -- so the summary aligns with the filter (SV-2821): filter0 admits a case
if ANY of its diagnoses matches, but the default SV-2770 rule bins by the primary diagnosis, which
may fall outside the cohort's constraint. When no diagnosis matches (or no matcher is given), fall
back to the deterministic SV-2770 selection, so behavior is unchanged for the non-cohort-filtered case.

returns the chosen diagnosis entry, or undefined when the selection is undecidable (caller then
leaves the term unset rather than blanking unrelated terms of the case). */
function chooseDiagnosis(allDiagnoses, matcher) {
	if (matcher) {
		// diagnosisFilter(d, matcher) keeps a diagnosis satisfying the cohort constraint regardless
		// of primary-disease status; among those the SV-2770 sort still gives a deterministic pick
		const matched = allDiagnoses.filter(d => diagnosisFilter(d, matcher))
		if (matched.length) {
			matched.sort(diagnosisSort)
			return matched[0]
		}
		// no diagnosis satisfies the cohort constraint -> fall through to the default selection
	}

	// deterministic default: same plot for a given diagnoses[] regardless of entry order.
	// See https://gdc-ctds.atlassian.net/browse/SV-2770
	const diagnoses = allDiagnoses.filter(d => diagnosisFilter(d))
	if (!diagnoses.length) return undefined
	if (diagnoses.length > 1) {
		// there should be either exactly 1 diagnoses entry that is primary disease,
		// or all of the diagnoses entries have undefined primary disease since
		// it was not in the requested fieldset (as required if diagnoses.age_at_diagnosis
		// or primary_disease are also requested)
		if (diagnoses.filter(diagnosisIsPrimaryDisease).length !== 1 && diagnoses.filter(primaryDiseasesIsDefined).length)
			return undefined
	}
	diagnoses.sort(diagnosisSort)
	return diagnoses[0]
}

/* SV-2821: read the diagnoses-scoped value constraints out of a GDC cohort filter (filter0) and
return a predicate testing whether a single diagnosis entry satisfies all of them; null when filter0
constrains no diagnoses field, so chooseDiagnosis uses the default SV-2770 selection. Handles the
age_at_diagnosis range and a primary_diagnosis set -- any leaf whose field is "*.diagnoses.<key>".
Parsing is memoized per filter0 object, since flattenCaseByFields runs once per case per term. */
const filter0MatcherCache = new WeakMap<object, ((d: any) => boolean) | null>()
function getDiagnosisMatcher(filter0) {
	// cache hit first: the hot path is repeat calls with the same filter0 over re.data.hits[].
	// WeakMap.has/get tolerate a null/undefined/primitive key (return false/undefined, no throw),
	// so the object guard below is only needed to protect the .set() further down
	if (filter0MatcherCache.has(filter0)) return filter0MatcherCache.get(filter0)!
	if (!filter0 || typeof filter0 != 'object') return null
	const leaves: Array<{ op: string; key: string; value: any }> = []
	collectDiagnosisLeaves(filter0, leaves)
	const matcher = leaves.length ? (d: any) => leaves.every(l => evalDiagnosisLeaf(l, d)) : null
	filter0MatcherCache.set(filter0, matcher)
	return matcher
}

/* the diagnoses sub-field names a filter0 references (e.g. 'age_at_diagnosis'), so a caller building
a GDC /cases or /ssm_occurrences fields[] can ensure they are fetched even when they are not a
requested term -- otherwise the matcher sees undefined and the case falls back to default selection. */
export function diagnosisFilter0Fields(filter0): string[] {
	const leaves: Array<{ op: string; key: string; value: any }> = []
	collectDiagnosisLeaves(filter0, leaves)
	return [...new Set(leaves.map(l => l.key))]
}

function collectDiagnosisLeaves(node, out) {
	if (!node || typeof node != 'object') return
	if (Array.isArray(node.content) && (node.op == 'and' || node.op == 'or')) {
		for (const c of node.content) collectDiagnosisLeaves(c, out)
		return
	}
	const field = node.content?.field
	if (typeof field != 'string') return
	// GDC fields carry a "cases." or "case." prefix, e.g. "cases.diagnoses.age_at_diagnosis"
	const m = field.match(/(?:^|\.)diagnoses\.(.+)$/)
	if (!m) return
	out.push({ op: node.op, key: m[1], value: node.content.value })
}

function evalDiagnosisLeaf(l, d) {
	const v = d?.[l.key]
	if (v === undefined || v === null) return false
	// membership / equality: works for a string field such as primary_diagnosis tested against
	// filter0's value[] set (Array) -- or a scalar value via loose equality
	if (l.op == 'in') return Array.isArray(l.value) ? l.value.includes(v) : v == l.value
	if (l.op == '=' || l.op == '==') return v == l.value
	// remaining ops are numeric range bounds (e.g. age_at_diagnosis in days). filter0 is not
	// type-checked, so a non-numeric bound or value would silently fall into JS string comparison;
	// require both to be numbers, else treat as non-matching (safe fallback to default selection)
	if (typeof v != 'number' || typeof l.value != 'number') return false
	if (l.op == '>=') return v >= l.value
	if (l.op == '>') return v > l.value
	if (l.op == '<=') return v <= l.value
	if (l.op == '<') return v < l.value
	return false // unknown op: cannot confirm a match -> treat as non-matching (safe fallback)
}

// see the decision tree in https://gdc-ctds.atlassian.net/browse/SV-2770
// matcher (optional, SV-2821): when the cohort filter constrains diagnoses, it replaces the
// primary-disease requirement below -- keep a diagnosis iff it satisfies the cohort constraint, so a
// non-primary diagnosis that put the case in the cohort is not discarded (see getDiagnosisMatcher)
function diagnosisFilter(d, matcher?) {
	// strict equality, undefined and other non-null empty values are not matched,
	// so this condition will not be applied if age_at_diagnosis or primary_diagnosis
	// was not added to the requested fieldset
	if (d.age_at_diagnosis === null) return false
	if (matcher) return matcher(d)
	// as of 4/1/2026, 14 CPTAC cases have diagnoses entries that all match the condition below;
	// it looks like the GDC API does not return these samples when the fieldset is diagnoses.*,
	// but will still filter here nonetheless
	if (isNotPrimaryDisease(d)) return false
	return true
}

// see the decision tree in https://gdc-ctds.atlassian.net/browse/SV-2770
// this filter is meant to be applied ONLY when there are multiple diagnoses[] entries,
// it's okay for a single-entry diagnoses[] to have diagnosis_is_primary_disease === null
function diagnosisIsPrimaryDisease(d) {
	return isPrimaryDisease(d)
}

function primaryDiseasesIsDefined(d) {
	return d.diagnosis_is_primary_disease !== undefined
}

function diagnosisSort(a, b) {
	// must use the helper and not a truthy test: the string "false" is truthy
	if (isPrimaryDisease(a)) return -1
	if (isPrimaryDisease(b)) return 1
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

// deterministic comparator for reducing a multi-valued Set to a single value; works for the
// string and numeric values GDC term fields carry
function basicSort(a: any, b: any) {
	return a < b ? -1 : a > b ? 1 : 0
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

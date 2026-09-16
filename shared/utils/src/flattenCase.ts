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
		const chosen = chooseDiagnosis(caseObj.diagnoses, getDiagnosisEvaluator(opts.filter0), caseObj)
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

evalDiagnosis (optional): the tri-state evaluator of the cohort filter's diagnoses conditions (see
getDiagnosisEvaluator). When present, the case is represented by a diagnosis the filter admits -- even
a non-primary one -- so the summary aligns with the filter (SV-2821): filter0 admits a case if ANY of
its diagnoses matches, but the default SV-2770 rule bins by the primary diagnosis, which may fall
outside the cohort's constraint.

The tri-state is preserved through selection: a diagnosis the filter definitely admits (TRI_TRUE) is
preferred over one that is only possibly-admitted (TRI_UNKNOWN, i.e. a case-level leaf it depends on was
not fetched). Collapsing both to "matched" and letting diagnosisSort decide would let an UNKNOWN primary
diagnosis win over the TRUE diagnosis that actually admitted the case. UNKNOWN candidates are used only
when no definite match exists; when neither exists (or no evaluator is given), fall back to the
deterministic SV-2770 selection. caseObj is passed so the evaluator can resolve case-level leaves.

returns the chosen diagnosis entry, or undefined when the selection is undecidable (caller then
leaves the term unset rather than blanking unrelated terms of the case). */
function chooseDiagnosis(allDiagnoses, evalDiagnosis, caseObj) {
	if (evalDiagnosis) {
		const trueMatches: any[] = [],
			unknownMatches: any[] = []
		for (const d of allDiagnoses) {
			const t = evalDiagnosis(d, caseObj)
			if (t === TRI_TRUE) trueMatches.push(d)
			else if (t === TRI_UNKNOWN) unknownMatches.push(d)
		}
		// prefer definite matches; only consider possibly-admitted (UNKNOWN) diagnoses when there are none
		const pool = trueMatches.length ? trueMatches : unknownMatches
		if (pool.length) {
			pool.sort(diagnosisSort)
			return pool[0]
		}
		// no diagnosis is consistent with the cohort filter -> fall through to the default selection
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

/* SV-2821: compile a GDC cohort filter (filter0) into a tri-state evaluator (d, caseObj) => tri of its
conditions for one diagnosis entry of a case; null when filter0 constrains no diagnoses field, so
chooseDiagnosis uses the default SV-2770 selection. Handles the age_at_diagnosis range and a
primary_diagnosis set -- any leaf whose field is "*.diagnoses.<key>".

The whole boolean structure is preserved via Kleene 3-valued logic (see compileFilter0Tri), not
flattened: a diagnosis leaf evaluates against the diagnosis, a case-level leaf (e.g. primary_site)
evaluates against caseObj, and only an absent (unfetched) case-level field stays UNKNOWN. The evaluator
returns TRI_TRUE (filter admits this diagnosis), TRI_UNKNOWN (undecidable -- a case-level field was not
available) or TRI_FALSE (not admitted). chooseDiagnosis prefers TRI_TRUE over TRI_UNKNOWN so a diagnosis
the filter definitely admits is never outranked by a merely-possible one. Memoized per filter0 object,
since flattenCaseByFields runs once per case per term.

For the case-level evaluation to be exact rather than UNKNOWN, the GDC getters project the fields
filter0 references (filter0Fields) so caseObj carries them. */
const TRI_TRUE = 1,
	TRI_FALSE = 0,
	TRI_UNKNOWN = -1
const filter0EvalCache = new WeakMap<object, ((d: any, caseObj: any) => number) | null>()
function getDiagnosisEvaluator(filter0) {
	// cache hit first: the hot path is repeat calls with the same filter0 over re.data.hits[].
	// WeakMap.has/get tolerate a null/undefined/primitive key (return false/undefined, no throw),
	// so the object guard below is only needed to protect the .set() further down
	if (filter0EvalCache.has(filter0)) return filter0EvalCache.get(filter0)!
	if (!filter0 || typeof filter0 != 'object') return null
	// no diagnoses-scoped leaf anywhere -> no diagnosis-level constraint; return null so chooseDiagnosis
	// uses the default SV-2770 selection (which includes its undecidable-diagnoses bail)
	const leaves: Array<{ op: string; key: string; value: any }> = []
	collectDiagnosisLeaves(filter0, leaves)
	const evalTree = leaves.length ? compileFilter0Tri(filter0) : null
	filter0EvalCache.set(filter0, evalTree)
	return evalTree
}

/* compile one filter0 node into (d, caseObj) => tri-state (TRI_TRUE|TRI_FALSE|TRI_UNKNOWN), evaluated
with Kleene 3-valued logic. A diagnoses-scoped leaf resolves against the diagnosis d; a case-level leaf
(e.g. primary_site) resolves against caseObj -- TRUE/FALSE when that field is present, UNKNOWN only when
it is absent (not fetched or genuinely missing). Evaluating case-level leaves is what disambiguates
mixed OR branches: for "(diagnosis=A AND primary_site=lung) OR (diagnosis=B AND primary_site=brain)" on
a brain case, branch 1 resolves FALSE (site!=lung) and only the diagnosis-B branch admits the case, so
B is chosen rather than an arbitrary UNKNOWN. Preserving UNKNOWN through and/or/not still handles a
case-level field that was not fetched. */
function compileFilter0Tri(node): (d: any, caseObj: any) => number {
	if (!node || typeof node != 'object') return () => TRI_UNKNOWN
	const op = node.op
	if (op == 'or' && Array.isArray(node.content)) {
		const kids = node.content.map(compileFilter0Tri)
		return (d: any, caseObj: any) => {
			let res = TRI_FALSE
			for (const k of kids) {
				const v = k(d, caseObj)
				if (v == TRI_TRUE) return TRI_TRUE // OR with a true child is true
				if (v == TRI_UNKNOWN) res = TRI_UNKNOWN
			}
			return res
		}
	}
	if (op == 'and' && Array.isArray(node.content)) {
		// case-level leaf children are evaluated together against the case so that constraints sharing a
		// nested array (e.g. samples.sample_type and samples.portions.x) are correlated to the SAME element
		// at every level (GDC same-nested-object semantics), not satisfied independently across elements.
		// Other children -- sub-groups, not-nodes, diagnoses leaves -- compile independently.
		const caseLeaves: any[] = []
		const kids: Array<(d: any, caseObj: any) => number> = []
		for (const c of node.content) {
			const info = caseLevelLeafInfo(c)
			if (info) caseLeaves.push(info)
			else kids.push(compileFilter0Tri(c))
		}
		if (caseLeaves.length) kids.push((_d: any, caseObj: any) => evalLeavesInScope(caseObj, caseLeaves))
		return (d: any, caseObj: any) => {
			let res = TRI_TRUE
			for (const k of kids) {
				const v = k(d, caseObj)
				if (v == TRI_FALSE) return TRI_FALSE // AND with a false child is false
				if (v == TRI_UNKNOWN) res = TRI_UNKNOWN
			}
			return res
		}
	}
	if (op == 'not') {
		// content may be a single node or an array of nodes (implicitly AND-ed) before negating
		const inner = Array.isArray(node.content)
			? compileFilter0Tri({ op: 'and', content: node.content })
			: compileFilter0Tri(node.content)
		return (d: any, caseObj: any) => {
			const v = inner(d, caseObj)
			return v == TRI_UNKNOWN ? TRI_UNKNOWN : v == TRI_TRUE ? TRI_FALSE : TRI_TRUE
		}
	}
	// leaf
	const field = node.content?.field
	if (typeof field != 'string') return () => TRI_UNKNOWN
	// GDC fields carry a "cases." or "case." prefix, e.g. "cases.diagnoses.age_at_diagnosis"
	const dm = field.match(/(?:^|\.)diagnoses\.(.+)$/)
	if (dm) {
		const key = dm[1]
		// only a direct diagnosis sub-field (e.g. age_at_diagnosis, primary_diagnosis) is supported.
		// a dotted descendant (e.g. treatments.treatment_type) sits under a nested array; a literal
		// lookup cannot read it and GDC's nested matching is not replicated here, so treat it as UNKNOWN
		// (undecidable) rather than a false match that would wrongly force the SV-2770 fallback.
		if (key.includes('.')) return () => TRI_UNKNOWN
		const leaf = { op, key, value: node.content.value }
		return (d: any) => (evalDiagnosisLeaf(leaf, d) ? TRI_TRUE : TRI_FALSE)
	}
	// case-level leaf: strip the leading "cases."/"case." segment and resolve against caseObj, descending
	// into any array along the path and testing membership over its values (see collectPathValues)
	const cm = field.match(/^cases?\.(.+)$/)
	const segs = (cm ? cm[1] : field).split('.')
	const leafOp = op,
		leafValue = node.content.value
	return (d: any, caseObj: any) => {
		const values: any[] = []
		collectPathValues(caseObj, segs, 0, values)
		if (!values.length) return TRI_UNKNOWN // field not fetched / absent -> undecidable
		return caseLeafMatch(values, leafOp, leafValue) ? TRI_TRUE : TRI_FALSE
	}
}

/* every field a filter0 references, trimmed of the leading "cases."/"case." segment (relative to the
case object), e.g. 'diagnoses.age_at_diagnosis' or 'primary_site'. A GDC getter adds these to its
fields[] (with its endpoint's prefix) so caseObj carries both the diagnoses fields the diagnosis
selection tests AND the case-level fields getDiagnosisEvaluator resolves -- otherwise those read as
undefined and selection loses precision (or falls back). */
export function filter0Fields(filter0): string[] {
	const out: string[] = []
	collectFilter0Fields(filter0, out)
	return [...new Set(out)]
}

function collectFilter0Fields(node, out) {
	if (!node || typeof node != 'object') return
	if (Array.isArray(node.content) && (node.op == 'and' || node.op == 'or')) {
		for (const c of node.content) collectFilter0Fields(c, out)
		return
	}
	if (node.op == 'not') {
		if (Array.isArray(node.content)) for (const c of node.content) collectFilter0Fields(c, out)
		else collectFilter0Fields(node.content, out)
		return
	}
	const field = node.content?.field
	if (typeof field != 'string') return
	const m = field.match(/^cases?\.(.+)$/)
	out.push(m ? m[1] : field)
}

// used only by getDiagnosisEvaluator's gate: does filter0 reference a SUPPORTED (direct) diagnoses
// sub-field leaf? A dotted descendant (e.g. diagnoses.treatments.treatment_type) is not evaluable here
// (see compileFilter0Tri) so it must not, on its own, gate an evaluator into existence -- otherwise a
// treatments-only filter0 would build an all-UNKNOWN evaluator instead of using the default selection.
function collectDiagnosisLeaves(node, out) {
	if (!node || typeof node != 'object') return
	if (Array.isArray(node.content) && (node.op == 'and' || node.op == 'or')) {
		for (const c of node.content) collectDiagnosisLeaves(c, out)
		return
	}
	if (node.op == 'not') {
		if (Array.isArray(node.content)) for (const c of node.content) collectDiagnosisLeaves(c, out)
		else collectDiagnosisLeaves(node.content, out)
		return
	}
	const field = node.content?.field
	if (typeof field != 'string') return
	// GDC fields carry a "cases." or "case." prefix, e.g. "cases.diagnoses.age_at_diagnosis"
	const m = field.match(/(?:^|\.)diagnoses\.(.+)$/)
	if (!m || m[1].includes('.')) return // skip non-diagnoses and unsupported dotted descendants
	out.push({ op: node.op, key: m[1], value: node.content.value })
}

function evalDiagnosisLeaf(l, d) {
	return evalLeafOp(l.op, l.value, d?.[l.key])
}

/* GDC keyword (string) fields match case-insensitively -- the portal lowercases filter values but the
API returns the original casing, e.g. filter "bronchus and lung" vs returned "Bronchus and lung". So an
exact compare here would wrongly reject a value the GDC server accepted; match strings case-insensitively
(numbers compare exactly). */
function looseEq(a, b) {
	if (typeof a == 'string' && typeof b == 'string') return a.toLowerCase() === b.toLowerCase()
	return a == b
}

/* evaluate one filter0 leaf operator: does actual value `v` satisfy `op` against filter value?
Shared by diagnoses leaves (v read off the diagnosis) and case-level leaves (v resolved off caseObj). */
function evalLeafOp(op, filterValue, v) {
	if (v === undefined || v === null) return false
	// membership / equality: works for a string field such as primary_diagnosis tested against
	// filter0's value[] set (Array) -- or a scalar value; string compares are case-insensitive (GDC)
	if (op == 'in') return Array.isArray(filterValue) ? filterValue.some(x => looseEq(x, v)) : looseEq(filterValue, v)
	if (op == '=' || op == '==') return looseEq(filterValue, v)
	// GDC leaf-level negation: 'exclude' is NOT IN, '!='/'<>' is not-equal. filter2GDCfilter() emits
	// these for an isnot tvs, and a portal filter0 can carry them directly. A missing value already
	// returned false above (conservative: a value we cannot verify is not treated as a match).
	if (op == 'exclude')
		return Array.isArray(filterValue) ? !filterValue.some(x => looseEq(x, v)) : !looseEq(filterValue, v)
	if (op == '!=' || op == '<>') return !looseEq(filterValue, v)
	// remaining ops are numeric range bounds (e.g. age_at_diagnosis in days). filter0 is not
	// type-checked, so a non-numeric bound or value would silently fall into JS string comparison;
	// require both to be numbers, else treat as non-matching (safe fallback to default selection)
	if (typeof v != 'number' || typeof filterValue != 'number') return false
	if (op == '>=') return v >= filterValue
	if (op == '>') return v > filterValue
	if (op == '<=') return v <= filterValue
	if (op == '<') return v < filterValue
	return false // unknown op: cannot confirm a match -> treat as non-matching (safe fallback)
}

/* collect the terminal scalar values of a dotted case-level path (leading "cases."/"case." already
stripped), descending into arrays along the way. e.g. "primary_site" -> ["Bronchus and lung"];
"samples.sample_type" over caseObj.samples[] -> ["Blood","Tumor"]. GDC cohort filters commonly point at
array-backed nested fields (samples, exposures, ...), so a leaf on such a path must be tested as
membership over ALL of the array's values, not read as a single scalar. Absent/empty -> [] (UNKNOWN). */
function collectPathValues(node, segs, i, out) {
	if (node == null) return
	if (Array.isArray(node)) {
		for (const el of node) collectPathValues(el, segs, i, out)
		return
	}
	if (i == segs.length) {
		if (typeof node != 'object') out.push(node) // terminal scalar
		return
	}
	if (typeof node != 'object') return
	collectPathValues(node[segs[i]], segs, i + 1, out)
}

/* does a case-level leaf match, given the values collected along its path within ONE scope (a single
array element when correlated, or the whole case otherwise)? Positive ops (in/=/range): satisfied if ANY
value matches. Negation (exclude/!=): GDC nested NOT-IN means NO value is in the set, so it is satisfied
only when none of the values matches. */
function caseLeafMatch(values, op, filterValue) {
	if (op == 'exclude') {
		const inSet = v => (Array.isArray(filterValue) ? filterValue.some(x => looseEq(x, v)) : looseEq(filterValue, v))
		return !values.some(inSet)
	}
	if (op == '!=' || op == '<>') return !values.some(v => looseEq(filterValue, v))
	return values.some(v => evalLeafOp(op, filterValue, v))
}

/* describe a filter0 node if it is a case-level leaf (a leaf whose field is not a diagnoses.* path),
returning the case-relative path segments (leading "cases."/"case." stripped). Returns null for groups,
not-nodes, diagnoses leaves and malformed nodes. */
function caseLevelLeafInfo(node) {
	if (!node || typeof node != 'object') return null
	if (node.op == 'and' || node.op == 'or' || node.op == 'not') return null
	const field = node.content?.field
	if (typeof field != 'string') return null
	if (/(?:^|\.)diagnoses\./.test(field)) return null // diagnoses leaf: evaluated against the diagnosis
	const cm = field.match(/^cases?\.(.+)$/)
	return { segs: (cm ? cm[1] : field).split('.'), op: node.op, value: node.content.value }
}

/* Evaluate an AND of case-level leaves against `scope`, correlating shared nested arrays at EVERY level
so constraints on the same nested object are satisfied by the same element -- e.g.
samples.portions.x=A AND samples.portions.y=B requires one sample with one portion that has both, not A
and B from different portions/samples. leaves[].segs are relative to `scope`. Tri-state: FALSE if any
segment group is FALSE, else UNKNOWN if any is undecidable (field absent / not fetched), else TRUE. */
function evalLeavesInScope(scope, leaves): number {
	if (scope == null || typeof scope != 'object' || Array.isArray(scope)) return TRI_UNKNOWN
	const byNext = new Map<string, any[]>()
	for (const leaf of leaves) {
		const seg = leaf.segs[0]
		if (!byNext.has(seg)) byNext.set(seg, [])
		byNext.get(seg)!.push(leaf)
	}
	let overall = TRI_TRUE
	for (const [seg, grp] of byNext) {
		const t = evalChildGroup(scope[seg], grp)
		if (t == TRI_FALSE) return TRI_FALSE
		if (t == TRI_UNKNOWN) overall = TRI_UNKNOWN
	}
	return overall
}

/* Evaluate the leaves under one segment (all grp[].segs[0] == that segment) against `child` = scope[seg].
When `child` is an array, correlate: SOME element satisfies ALL of them (terminal leaves as membership on
the element, deeper leaves recursed into it). A scalar/object child is a single element. */
function evalChildGroup(child, grp): number {
	if (child === undefined || child === null) return TRI_UNKNOWN
	const terminal: any[] = [],
		deeper: any[] = []
	for (const leaf of grp) {
		if (leaf.segs.length == 1) terminal.push(leaf)
		else deeper.push({ segs: leaf.segs.slice(1), op: leaf.op, value: leaf.value })
	}
	const elements = Array.isArray(child) ? child : [child]
	if (!elements.length) return TRI_UNKNOWN
	let anyUnknown = false
	for (const el of elements) {
		const t = evalElementAll(el, terminal, deeper)
		if (t == TRI_TRUE) return TRI_TRUE
		if (t == TRI_UNKNOWN) anyUnknown = true
	}
	return anyUnknown ? TRI_UNKNOWN : TRI_FALSE
}

// AND of terminal leaves (tested against `el`'s scalar values) and deeper leaves (recursed into `el`)
function evalElementAll(el, terminal, deeper): number {
	let overall = TRI_TRUE
	if (terminal.length) {
		const values: any[] = []
		collectPathValues(el, [], 0, values) // flatten el to its scalar value(s)
		for (const leaf of terminal) {
			const t = !values.length ? TRI_UNKNOWN : caseLeafMatch(values, leaf.op, leaf.value) ? TRI_TRUE : TRI_FALSE
			if (t == TRI_FALSE) return TRI_FALSE
			if (t == TRI_UNKNOWN) overall = TRI_UNKNOWN
		}
	}
	if (deeper.length) {
		const t = evalLeavesInScope(el, deeper)
		if (t == TRI_FALSE) return TRI_FALSE
		if (t == TRI_UNKNOWN) overall = TRI_UNKNOWN
	}
	return overall
}

// see the decision tree in https://gdc-ctds.atlassian.net/browse/SV-2770
// default SV-2770 selection filter, used only when filter0 has no diagnoses constraint; the cohort
// evaluator handles the filtered case in chooseDiagnosis, so a matcher never routes through here
function diagnosisFilter(d) {
	// strict equality, undefined and other non-null empty values are not matched,
	// so this condition will not be applied if age_at_diagnosis or primary_diagnosis
	// was not added to the requested fieldset
	if (d.age_at_diagnosis === null) return false
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

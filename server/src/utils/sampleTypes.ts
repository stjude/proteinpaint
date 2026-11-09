import { maySetMapParent2Children, getSampleTypes } from '#src/termdb.matrix.js'

/* The sample types a request or a term chose, e.g. in the sample type row of the genome browser, as
the dataset's sample type ids; undefined when none were chosen. An invalid
one is the request's error, so it is a 400. */
export function getTermSampleTypeIds(term: { sampleTypes?: any }, ds: any): number[] | undefined {
	if (term.sampleTypes == null) return
	const refuse = (message: string) => Object.assign(new Error(message), { status: 400 })
	if (!Array.isArray(term.sampleTypes)) throw refuse('sampleTypes must be an array')
	return term.sampleTypes.map(st => {
		const n = Number(st)
		if (!Number.isInteger(n) || !ds.cohort?.termdb?.sampleTypes?.[n]) throw refuse(`invalid sample type='${st}'`)
		return n
	})
}

/* For a query of sample-level data (e.g. a genome browser track): maps parent samples to their child samples, as
maySetMapParent2Children(q, ds, true) does, and keeps the sample types that q chose among those the mapping gives.
filter: the filter the query applies, when it is not q.filter, e.g. the filterObj of an mds3 track. q.filter is left
as it is.

- No choice: a query on cases (a filter, filter0 or term of a parent sample type) is mapped to the samples of those
  cases, and q.sampleTypes becomes the sample types the mapping gives. A query on samples alone is left as it is, so
  that its filter keeps the samples of any type it matches, as without the mapping.
- A choice: q.sampleTypes is the chosen types that the query's terms map to. A case term may map to some sample types
  only (its childSampleTypes, e.g. a call made on baseline samples), and is not read for the other ones. When none of
  the chosen types is among them, the query is not mapped: its case terms then match cases, not samples, and the
  chosen sample types keep no sample of them. */
export function mapParent2ChildrenWithSampleTypes(q: any, ds: any, filter = q.filter) {
	const chosen = getTermSampleTypeIds(q, ds)
	const mapped: any = { ...q, filter, sampleTypes: undefined }
	if (!chosen?.length && !isOnCases(mapped, ds)) return
	maySetMapParent2Children(mapped, ds, true)
	if (!chosen?.length) {
		if (mapped.mapParent2Children != null) q.mapParent2Children = mapped.mapParent2Children
		if (mapped.sampleTypes) q.sampleTypes = mapped.sampleTypes
		return
	}
	// a query without terms of any sample type gets none from the mapping, and keeps the chosen ones as they are
	const kept = mapped.sampleTypes ? chosen.filter(t => mapped.sampleTypes.includes(t)) : chosen
	q.mapParent2Children = kept.length ? mapped.mapParent2Children : false
	q.sampleTypes = kept.length ? kept : chosen
}

/* whether a query reads a term of a parent sample type (e.g. a patient-level term), whose annotations must be mapped
to the child samples that sample-level data is keyed by */
function isOnCases(q: any, ds: any): boolean {
	if (!ds.cohort?.termdb?.hasSampleAncestry) return false
	const sampleTypes = Object.values<any>(ds.cohort.termdb.sampleTypes || {})
	const isParent = (t: number) => sampleTypes.some(st => st.parent_id == t)
	return [...getSampleTypes(q, ds).sampleTypes].some(isParent)
}

import { maySetMapParent2Children } from '#src/termdb.matrix.js'

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

/* For a query of sample-level data (e.g. a genome browser track):
maps parent samples to their child samples, as maySetMapParent2Children(q, ds, true) does, and keeps the
sample types q chose. The mapping alone resets q.sampleTypes to the default ones whenever q has a filter.
filter: the filter the query applies, when it is not q.filter, e.g. the filterObj of an mds3 track. The mapping
reads the sample types of its terms, so that a filter on cases (a patient-level term) is mapped to their samples;
q.filter is left as it is. */
export function mapParent2ChildrenWithSampleTypes(q: any, ds: any, filter = q.filter) {
	const sampleTypes = getTermSampleTypeIds(q, ds)
	const mapped = { ...q, filter }
	maySetMapParent2Children(mapped, ds, true)
	if (mapped.mapParent2Children != null) q.mapParent2Children = mapped.mapParent2Children
	if (sampleTypes?.length) q.sampleTypes = sampleTypes
	else if (mapped.sampleTypes) q.sampleTypes = mapped.sampleTypes
}

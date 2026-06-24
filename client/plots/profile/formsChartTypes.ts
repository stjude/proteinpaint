/*
Derive a Templates domain's chart types from the database instead of a hand-listed config.

A domain's chart types are an emergent property of its multivalue children: each child question
term carries a `subtype` (e.g. 'YN Graph', 'Likert Graph') in the termdb, and a domain "offers" a
chart type when at least one child has the matching subtype. This is the same mechanism the
profileForms2 plot uses in init() to build its tabs; centralizing it here lets both Templates
pickers (forms2 tabs, forms3 matrix/list) read chart types from the DB so they can never drift from
the data — and a domain becomes multi-chart-type automatically once its children span two subtypes.

`subtype → display name` comes from profileFormsOptions (termdbConfig …profileForms2.options),
which also defines the canonical chart-type order.
*/

export type FormsOption = { name: string; subtype: string }

/*
Pure mapper: given the set of child subtypes present under a domain, return the chart-type display
names in canonical options order, including only types that actually have a child.
*/
export function subtypesToChartTypes(present: Set<string>, options: FormsOption[]): string[] {
	return options.filter(o => present.has(o.subtype)).map(o => o.name)
}

/*
For each domain id, load its multivalue children (vocabApi.getMultivalueTWs → cached server-side per
parent_id) and derive its chart-type names. Returns a Map keyed by domain id. Domains with no
subtype-bearing children map to an empty array.
*/
export async function getChartTypesByDomain(
	vocabApi: { getMultivalueTWs: (opts: { parent_id: string }) => Promise<{ term: { subtype?: string } }[]> },
	domainIds: string[],
	options: FormsOption[]
): Promise<Map<string, string[]>> {
	/*
	Demo override while the multi-chart-type data isn't in the db yet. Every domain currently has a
	single subtype, so there's no way to see how the Templates 3 picker lays out a domain that offers
	more than one chart type. To unblock that review, we force these two domains to expose every
	option as a button; every other domain still goes through the real db-derived list below
	(subtypesToChartTypes). Remove this block once a domain genuinely carries two subtypes.

	Note for whoever clicks through it: this only shapes the picker. The forms2 plot still builds its
	tabs from the actual db children, so opening the forced type lands on an empty tab — that's
	expected here; we're validating the picker UI, not a populated plot.
	*/
	const DEMO_MULTITYPE_DOMAINS = new Set([
		'FContext__National Context__Care Access and Utilization',
		'FWorkforce__Service Integration__Communication'
	])
	const entries = await Promise.all(
		domainIds.map(async id => {
			const twLst = await vocabApi.getMultivalueTWs({ parent_id: id })
			const present = new Set<string>()
			for (const tw of twLst) if (tw.term.subtype) present.add(tw.term.subtype)
			const types = DEMO_MULTITYPE_DOMAINS.has(id) ? options.map(o => o.name) : subtypesToChartTypes(present, options)
			return [id, types] as const
		})
	)
	return new Map(entries)
}

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
	TEMP DEMO (revert before commit): force these domains to look multi-chart-type in the Templates 3
	picker WITHOUT touching the db — they get every option as a button. The real per-domain derivation
	is the `subtypesToChartTypes(present, options)` line below; this only overrides the demo ids.
	Caveat: the forms2 plot still builds its tabs from real db children, so clicking the mocked type
	opens a plot whose tab has no data — this demos the picker UI, not a fully-populated plot.
	*/
	const TEMP_MULTITYPE = new Set([
		'FContext__National Context__Care Access and Utilization',
		'FWorkforce__Service Integration__Communication'
	])
	const entries = await Promise.all(
		domainIds.map(async id => {
			const twLst = await vocabApi.getMultivalueTWs({ parent_id: id })
			const present = new Set<string>()
			for (const tw of twLst) if (tw.term.subtype) present.add(tw.term.subtype)
			const types = TEMP_MULTITYPE.has(id) ? options.map(o => o.name) : subtypesToChartTypes(present, options)
			return [id, types] as const
		})
	)
	return new Map(entries)
}

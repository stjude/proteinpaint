/* The colours the user picked for the two groups, carried through to every plot launched from a
differential analysis.

Groups get their colour in the group picker, and that colour is what the reader has already learned
the groups by -- on the picker, on the sample-count line, and on the volcano's axis labels. A
downstream plot that re-colours them makes the reader re-learn which group is which at every hop,
and silently invites reading a green curve in one panel as the same thing as a green curve in
another. */

/** Per-group colour from the samplelst term, or undefined where the term carries none.
 *
 * Undefined rather than a fallback on purpose: the receiving plot has its own tuned defaults, and
 * substituting an arbitrary colour here would override them with something no one chose. Callers
 * spread the result, so an absent colour leaves the default in place. */
export function groupColors(config: any): { group1?: string; group2?: string } {
	const g = config?.samplelst?.groups
	if (!g?.length) return {}
	const values = config?.tw?.term?.values
	/* Two places carry the same colour: the samplelst term keyed by group name, and the group
	itself. getSamplelstTW writes both from the picker, so either is correct -- reading both means a
	caller holding only one of the shapes still gets the colours. */
	const pick = (i: number) => values?.[g[i]?.name]?.color || g[i]?.color
	const out: { group1?: string; group2?: string } = {}
	const c1 = pick(0)
	const c2 = pick(1)
	if (c1) out.group1 = c1
	if (c2) out.group2 = c2
	return out
}

/** The hidden groups of the overlay term of a violin plot, by plot label: a plot is hidden when its label is a key.
 * termsetting adds a hidden uncomputable value to q.hiddenValues by its key, which is changed to its label here,
 * so that the client, which does not render a hidden plot, and the server, which does not test it, agree. */
export function getViolinHiddenValues(tw: any): Record<string, number> {
	const hidden: Record<string, number> = { ...(tw?.q?.hiddenValues || {}) }
	for (const [k, v] of Object.entries(tw?.term?.values || {}) as [string, any][]) {
		if (v?.uncomputable && hidden[k]) {
			// deleted before it is set, so that a label that is the same as its key stays hidden
			delete hidden[k]
			hidden[v.label] = 1
		}
	}
	return hidden
}

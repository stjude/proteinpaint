/** Build a validated Mass 'summary' (barchart) plot config for one or two dictionary term ids.
 * Deliberately independent of server/src/chat/ (that module backs the AI chat feature, which is
 * not reliable enough to depend on for this POC): this resolves term ids directly against
 * ds.cohort.termdb.q — the same termdb query API the rest of the server uses — and hand-assembles
 * the plot config itself, instead of going through the chat pipeline's resolveToPlotState().
 *
 * Validation is still the core principle: an id that doesn't resolve to a real dictionary term on
 * this ds throws, so the MCP tool can never hand the agent an invented plot config. */

function termToTw(term: any) {
	return { id: term.id, type: term.type, q: { mode: 'discrete' } }
}

export function resolveSummaryPlot(ds: any, term1Id: string, term2Id?: string) {
	const term1 = ds.cohort.termdb.q.termjsonByOneid(term1Id)
	if (!term1) throw new Error(`Unknown term id: ${term1Id}`)

	const plot: any = { chartType: 'summary', childType: 'barchart', term: termToTw(term1) }
	if (term2Id) {
		const term2 = ds.cohort.termdb.q.termjsonByOneid(term2Id)
		if (!term2) throw new Error(`Unknown term id: ${term2Id}`)
		plot.term2 = termToTw(term2)
	}
	return { type: 'plot', plot }
}

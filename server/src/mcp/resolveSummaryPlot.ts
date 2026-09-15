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

/* ─────────────────────────────────────────────────────────────────────────
 * TASK 4 (VIOLIN PLOT SUPPORT) — SHELVED, IN PROGRESS. Not wired up anywhere
 * (mcpCreateSummaryPlot.ts still calls the 3-arg resolveSummaryPlot above;
 * toolServer.ts's create_summary_plot tool was never touched for this).
 *
 * Goal: let resolveSummaryPlot build either a barchart or violin config, via
 * a new childType parameter. Violin's rule (from scaffold2state.ts's
 * isValidSubplot, read early in this project): needs TWO terms (not
 * optional), and at least one must be numeric (type 'float'/'integer'),
 * with that term getting q.mode:'continuous' instead of 'discrete'.
 *
 * Known bugs in this draft, not yet fixed — read before resuming:
 * 1. The "violin requires two terms" check only lives inside `if (term2Id)`,
 *    so it can never fire for the exact case it's meant to catch (term2Id
 *    missing entirely). Needs to be its own check, outside/before that
 *    block: `if (childType === 'violin' && !term2Id) throw ...`
 * 2. `termToTw` here still only takes one argument and hardcodes
 *    mode:'discrete' — needs a second `mode` parameter so continuous mode
 *    is reachable at all.
 * 3. No numeric-type check exists yet (nothing validates "at least one term
 *    must be numeric" for violin, nothing decides continuous vs discrete
 *    per term).
 * 4. `childType: 'barchart'` in the returned plot is still hardcoded, not
 *    using the real childType parameter.
 *
export function resolveSummaryPlot(ds: any, childType: 'barchart'|'violin',term1Id: string, term2Id?: string) {
	const term1 = ds.cohort.termdb.q.termjsonByOneid(term1Id)
	if (!term1) throw new Error(`Unknown term id: ${term1Id}`)

	const plot: any = { chartType: 'summary', childType: 'barchart', term: termToTw(term1) }
	if (term2Id) {
		const term2 = ds.cohort.termdb.q.termjsonByOneid(term2Id)
		if(childType==='violin'){
			if(!term2) throw new Error('Violin plot requires two terms')
		}
		if (!term2) throw new Error(`Unknown term id: ${term2Id}`)
		plot.term2 = termToTw(term2)
	}
	return { type: 'plot', plot }
}
 * ───────────────────────────────────────────────────────────────────────── */

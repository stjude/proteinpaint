import type { BreakpointRange } from '#types'

/*
breakpoints of a sv/fusion event

an event has a breakpoint on the queried gene ("self") and one on each partner gene.
these are read both when tallying breakpoints for the term-editing UIs (see
routes/termdb.categories.ts) and when filtering samples by a breakpoint range (see
filterByItem() in mds3.init.js), so that the breakpoints charted in the UI are the
same ones the filter matches against

the event object here is a geneVariant value built by mayGetGeneVariantData():
	.chr/.pos    breakpoint on the queried gene
	.pairlst     points of the event, [{a,b}] for a 2-gene event
	.pairlstIdx  which point of pairlst[0] is on the queried gene, 0 for a{} and 1 for b{}
*/

/** a point of a sv/fusion event. .pos is missing when the event has no coordinate */
export type Breakpoint = { chr?: string; pos?: number; strand?: string; name?: string }

/* breakpoint positions of the svfusion byname text file are strings, unlike those of the
byrange file which are json numbers. convert to number so that positions of either file are
comparable and can be tallied by the same key. a missing or non-numeric value yields
undefined, i.e. an event lacking a breakpoint coordinate */
export function toBreakpointPos(v: any): number | undefined {
	if (v == null || v === '') return undefined
	const n = Number(v)
	return Number.isFinite(n) ? n : undefined
}

/** breakpoint of the event on the queried gene. .chr/.pos of the event are of the queried
 * gene (see mayGetGeneVariantData), so are usable regardless of the pairlst shape */
export function getSelfBreakpoint(m: any): Breakpoint {
	return { chr: m.chr, pos: m.pos }
}

/** breakpoints of the event on partner gene(s). an event of an unsupported shape (e.g. the
 * not-yet-implemented multi-gene pairlst, which also leaves .mname unset) has no
 * identifiable partner and yields none */
export function getPartnerBreakpoints(m: any): Breakpoint[] {
	if (!Array.isArray(m.pairlst) || m.pairlst.length != 1) return []
	const { a, b } = m.pairlst[0]
	if (m.pairlstIdx === 0) return b ? [b] : []
	if (m.pairlstIdx === 1) return a ? [a] : []
	return []
}

/** .start and .stop of the range are inclusive. a breakpoint on another chr, or one lacking
 * a position (possible for events of a svfusion byname query), is out of range */
export function isBreakpointInRange(point: Breakpoint | undefined, range: BreakpointRange): boolean {
	if (!point || point.chr != range.chr) return false
	if (!Number.isFinite(point.pos)) return false
	return (point.pos as number) >= range.start && (point.pos as number) <= range.stop
}

export function isSelfBreakpointInRange(m: any, range: BreakpointRange): boolean {
	return isBreakpointInRange(getSelfBreakpoint(m), range)
}

export function isPartnerBreakpointInRange(m: any, range: BreakpointRange): boolean {
	return getPartnerBreakpoints(m).some(pt => isBreakpointInRange(pt, range))
}

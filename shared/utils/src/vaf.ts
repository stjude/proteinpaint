/*
The read counts of an entry of the vafs[] of a mutation event, such as
{ id: 'tumor_DNA_WGS', altCount: 20, refCount: 24 }, read as Disco reads them (client/plots/disco/snv/vafTooltip.ts):
counts are integers or integer strings, and a totalCount, when given, takes the place of refCount.
*/

export type VafCounts = { altCount: number; totalCount: number }

/** the alt and total read counts of an entry of vafs[], or null for an entry without valid counts */
export function getVafCounts(v: any): VafCounts | null {
	const altCount = toCount(v?.altCount)
	if (altCount == null) return null
	if (v.totalCount != null) {
		const totalCount = toCount(v.totalCount)
		return totalCount != null && totalCount > 0 && totalCount >= altCount ? { altCount, totalCount } : null
	}
	const refCount = toCount(v.refCount)
	if (refCount == null || altCount + refCount <= 0) return null
	return { altCount, totalCount: altCount + refCount }
}

/** a read count: a non-negative integer, or a string of one */
function toCount(v: unknown): number | null {
	const n = typeof v == 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v
	return typeof n == 'number' && Number.isInteger(n) && n >= 0 ? n : null
}

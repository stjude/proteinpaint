import type { DiffMethEntry } from '#types'

/** Display label for a differential methylation promoter.
 *
 * promoter_id is built at ingest as `<gene>.p<n>_<chr>:<start>-<stop>` (or
 * `<gene>_<chr>:<start>-<stop>` when the gene has a single promoter) — see
 * utils/dnaMeth/build_promoter_matrix.py. It is an identifier, not a label: it
 * is the highlight key and the handle for the DMR drill-down, so it is never
 * rewritten, only formatted for display.
 *
 * Every place this is shown already has a separate Gene(s) column, making the
 * gene prefix pure duplication. What is left that a reader actually needs is
 * which TSS of the gene it is, plus a copy-pasteable region:
 *
 *   NKAP.p4_chrX:119943104-119945251  ->  p4 · chrX:119943104-119945251
 *
 * Coordinates are printed unformatted so the region can be copied straight into
 * a genome browser or a tabix query.
 *
 * Coordinates come from the entry's own chr/start/stop fields rather than by
 * re-parsing the id, so a gene symbol containing '_' or ':' cannot corrupt them.
 * Only the `p<n>` segment is recovered from the id, and only when the id really
 * has that shape — anything unexpected falls back to the raw id unchanged.
 */
export function formatPromoterLabel(d: Partial<DiffMethEntry> | undefined): string {
	if (!d) return ''
	const id = d.promoter_id || ''
	const { chr, start, stop } = d as DiffMethEntry
	// without coordinates there is nothing better to show than the id itself
	if (!chr || !Number.isFinite(start) || !Number.isFinite(stop)) return id

	const region = `${chr}:${start}-${stop}`

	/* Match the promoter index only when it sits immediately before the trailing
	   `_<chr>:<start>-<stop>`, so a gene literally named e.g. "ABC.p2" cannot be
	   mistaken for an index. Genes with one promoter carry no index at all. */
	const idx = id.match(/\.(p\d+)_[^_]*:\d+-\d+$/)
	return idx ? `${idx[1]} · ${region}` : region
}

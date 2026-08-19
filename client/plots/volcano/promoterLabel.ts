import type { DiffMethEntry } from '#types'

/** Display label for a differential methylation promoter.
 *
 * promoter_id is built at ingest as `<gene>.p<n>_<chr>:<start>-<stop>` (or
 * `<gene>_<chr>:<start>-<stop>` when the gene has a single promoter) — see
 * utils/dnaMeth/build_element_matrix.py. It is an identifier, not a label: it
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
/** Noun for the rows of a differential methylation result, for counts and column
 * headers: "35,584 DM promoters" is wrong when the run tested eQTM blocks.
 *
 * Derived from the selected element class rather than from the server response, so
 * it needs no extra plumbing: the picker already knows which class was requested,
 * and an absent or 'promoter' value is the legacy single-matrix case.
 *
 * Deliberately not a lookup keyed by every possible class name. Dataset configs can
 * declare arbitrary keys, so an unrecognised one falls back to the neutral
 * "elements" instead of mislabelling rows as promoters. Add a case here only for a
 * class whose singular/plural reads badly as the generic term.
 */
export function elementNoun(elementType?: string): { one: string; many: string } {
	switch (elementType) {
		case undefined:
		case '':
		case 'promoter':
			return { one: 'Promoter', many: 'promoters' }
		/* Two different promoter DEFINITIONS, deliberately given distinct nouns. 'promoter' is
		the TSS -1500/+500 window (Bibikova 2011 / Sandoval 2011 -- the 450K array's
		TSS1500+TSS200 categories); 'promoter_pls' is the ENCODE cCRE promoter-like element,
		~349 bp, i.e. the CpG-island core with the shores removed. They cover different numbers
		of genes and their hit counts are NOT comparable, so the UI must never call both
		"promoters". */
		case 'promoter_pls':
			return { one: 'cCRE promoter', many: 'cCRE promoters' }
		case 'eqtm_block':
			return { one: 'eQTM block', many: 'eQTM blocks' }
		case 'enhancer':
			return { one: 'Enhancer', many: 'enhancers' }
		/* Distal and proximal are separate ENCODE classes and separate hypotheses -- dELS are
		the intronic/intergenic enhancers where myeloma hypermethylation concentrates, pELS sit
		within 2 kb of a TSS and behave more promoter-like. There are 4.5x as many dELS, so their
		hit counts are not comparable to each other either. Naming them apart keeps a reader from
		reading two runs as the same analysis. */
		case 'enhancer_distal':
			return { one: 'Distal enhancer', many: 'distal enhancers' }
		case 'enhancer_proximal':
			return { one: 'Proximal enhancer', many: 'proximal enhancers' }
		default:
			return { one: 'Element', many: 'elements' }
	}
}

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

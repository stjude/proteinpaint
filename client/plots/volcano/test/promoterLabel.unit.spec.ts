import tape from 'tape'
import { formatPromoterLabel } from '../promoterLabel'

/*
Tests formatPromoterLabel(), which turns the ingest-generated promoter_id into a
readable label. The id shape is `<gene>.p<n>_<chr>:<start>-<stop>` (or without
the `.p<n>` when a gene has one promoter) — see
utils/dnaMeth/build_promoter_matrix.py.

The cases that matter are the ones where naive parsing would silently produce a
wrong region: gene symbols containing '.', '_' or ':' are real (e.g. MIR1-1HG-AS1,
HLA-DRB1, and GENCODE ids like ENSG00000288739).
*/

tape('formatPromoterLabel: multi-promoter gene keeps the index', t => {
	t.equal(
		formatPromoterLabel({
			promoter_id: 'NKAP.p4_chrX:119943104-119945251',
			chr: 'chrX',
			start: 119943104,
			stop: 119945251
		} as any),
		'p4 · chrX:119943104-119945251'
	)
	t.end()
})

tape('formatPromoterLabel: single-promoter gene has no index', t => {
	t.equal(
		formatPromoterLabel({
			promoter_id: 'TP53_chr17:7687490-7689490',
			chr: 'chr17',
			start: 7687490,
			stop: 7689490
		} as any),
		'chr17:7687490-7689490'
	)
	t.end()
})

tape('formatPromoterLabel: coordinates come from fields, not the id', t => {
	// a gene symbol carrying '_' and ':' must not corrupt the region
	t.equal(
		formatPromoterLabel({
			promoter_id: 'ODD_GENE:X.p2_chr1:100-200',
			chr: 'chr1',
			start: 100,
			stop: 200
		} as any),
		'p2 · chr1:100-200'
	)
	// a gene literally named like an index must not be read as one
	t.equal(
		formatPromoterLabel({
			promoter_id: 'ABC.p2_chr1:100-200',
			chr: 'chr1',
			start: 100,
			stop: 200
		} as any),
		'p2 · chr1:100-200',
		'trailing .p<n> before the region is the index'
	)
	t.end()
})

tape('formatPromoterLabel: falls back to the raw id without coordinates', t => {
	t.equal(formatPromoterLabel({ promoter_id: 'NKAP.p4_chrX:1-2' } as any), 'NKAP.p4_chrX:1-2')
	t.equal(formatPromoterLabel({ promoter_id: 'x', chr: 'chr1', start: NaN, stop: 2 } as any), 'x')
	t.end()
})

tape('formatPromoterLabel: handles missing input', t => {
	t.equal(formatPromoterLabel(undefined), '')
	t.equal(formatPromoterLabel({} as any), '')
	t.end()
})

tape('formatPromoterLabel: start of 0 is a valid coordinate', t => {
	// guard against a truthiness check on start
	t.equal(formatPromoterLabel({ promoter_id: 'G_chr1:0-500', chr: 'chr1', start: 0, stop: 500 } as any), 'chr1:0-500')
	t.end()
})

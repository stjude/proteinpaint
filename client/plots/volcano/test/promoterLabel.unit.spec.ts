import tape from 'tape'
import { formatPromoterLabel, elementNoun } from '../promoterLabel'

/*
Tests formatPromoterLabel(), which turns the ingest-generated promoter_id into a
readable label. The id shape is `<gene>.p<n>_<chr>:<start>-<stop>` (or without
the `.p<n>` when a gene has one promoter) — see
utils/dnaMeth/build_element_matrix.py.

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

tape('elementNoun: absent or promoter class reads as promoters', t => {
	// The legacy single-matrix case sends no element_type at all, so undefined and the
	// explicit 'promoter' must agree -- otherwise a pre-existing run relabels itself.
	t.deepEqual(elementNoun(undefined), { one: 'Promoter', many: 'promoters' })
	t.deepEqual(elementNoun(''), { one: 'Promoter', many: 'promoters' })
	t.deepEqual(elementNoun('promoter'), { one: 'Promoter', many: 'promoters' })
	t.end()
})

tape('elementNoun: eQTM blocks are not called promoters', t => {
	const n = elementNoun('eqtm_block')
	t.equal(n.many, 'eQTM blocks', 'count text says eQTM blocks')
	t.equal(n.one, 'eQTM block', 'column header says eQTM block')
	t.end()
})

tape('elementNoun: unknown class falls back to neutral, never to promoter', t => {
	// Dataset configs can declare arbitrary keys (allccre, cPLS, ...). Mislabelling those
	// rows as promoters would misreport what was tested, so the fallback is generic.
	for (const k of ['allccre', 'cPLS', 'something_new']) {
		const n = elementNoun(k)
		t.equal(n.many, 'elements', `${k} -> elements`)
		t.notEqual(n.many, 'promoters', `${k} is not mislabelled as promoters`)
	}
	t.end()
})

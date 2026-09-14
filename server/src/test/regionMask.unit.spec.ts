import tape from 'tape'
import { maskedFraction, resolveExcludeBeds, DM_DEFAULT_BLACKLISTS } from '#src/utils/regionMask.ts'

/*
test sections:

maskedFraction: accumulates every overlapping interval, including across many
maskedFraction: boundaries, no-overlap, and degenerate spans
resolveExcludeBeds: source selection by name
DM_DEFAULT_BLACKLISTS: the methylation subset, not every declared source
*/

/** The mask decides which DMRs a reader ever sees, so an undercount silently keeps artifacts. The
 * case that matters is a WIDE feature spanning MANY masked intervals — the chr1:143,184,605-
 * 143,276,149 block this was built for spans thousands of segmental duplication records, and an
 * implementation that checks only the neighbouring interval scores it near 0 and keeps it. */

tape('\n', t => {
	t.comment('-***- regionMask specs -***-')
	t.end()
})

tape('maskedFraction accumulates across many intervals', t => {
	// ten 50bp masked blocks on a 100bp pitch, so [0,1000) is exactly half masked
	const mask: [number, number][] = Array.from({ length: 10 }, (_, i) => [i * 100, i * 100 + 50])
	t.equal(maskedFraction(mask, 0, 1000), 0.5, 'sums all ten, not just the first')
	t.ok(maskedFraction(mask, 0, 1000) >= 0.5, 'and so is dropped at the default 0.5 threshold')
	t.equal(maskedFraction(mask, 0, 50), 1, 'a span inside one interval is fully masked')
	t.equal(maskedFraction(mask, 50, 100), 0, 'a span in a gap is unmasked')
	t.equal(maskedFraction(mask, 75, 125), 0.5, 'a span straddling a gap and a block')
	t.end()
})

tape('maskedFraction handles boundaries and degenerate input', t => {
	const mask: [number, number][] = [
		[100, 200],
		[300, 400]
	]
	t.equal(maskedFraction(mask, 0, 100), 0, 'abutting from the left does not overlap')
	t.equal(maskedFraction(mask, 200, 300), 0, 'abutting from the right does not overlap')
	t.equal(maskedFraction(mask, 150, 350), 0.5, 'spans two intervals and the gap between them')
	t.equal(maskedFraction(mask, 0, 1000), 0.2, 'starts before the first interval')
	t.equal(maskedFraction([], 0, 100), 0, 'an empty mask masks nothing')
	t.equal(maskedFraction(mask, 100, 100), 0, 'a zero-width span cannot divide by zero')
	t.end()
})

tape('resolveExcludeBeds selects declared sources by name', t => {
	const g = {
		blacklists: [
			{ name: 'ENCODE blacklist', file: '/tp/anno/bl.bed.gz' },
			{ name: 'Segmental duplications', file: '/tp/anno/sd.bed.gz' },
			{ name: 'Common germline CNVs (DGV)', file: '/tp/anno/dgv.bed.gz' }
		]
	}
	t.deepEqual(resolveExcludeBeds(g, undefined).length, 3, 'undefined => every declared source')
	t.deepEqual(resolveExcludeBeds(g, []), [], 'empty selection => no masking')
	t.deepEqual(
		resolveExcludeBeds(g, DM_DEFAULT_BLACKLISTS),
		['/tp/anno/bl.bed.gz', '/tp/anno/sd.bed.gz'],
		'the methylation default resolves to blacklist + segdups'
	)
	t.deepEqual(resolveExcludeBeds(g, ['nope']), [], 'unknown names are ignored, not thrown on')
	t.deepEqual(resolveExcludeBeds({}, undefined), [], 'a genome declaring none => []')
	t.end()
})

tape('the methylation default excludes DGV and assembly gaps', t => {
	/* Not a style preference: beta is a ratio of reads at a locus, so it is copy-number invariant
	and a germline CNV is not a methylation artifact. DGV was the largest single contributor to the
	four-source mask (429 of 566 chr1 DMRs), so including it would remove real data. */
	t.ok(DM_DEFAULT_BLACKLISTS.includes('ENCODE blacklist'), 'multi-mapping regions are masked')
	t.ok(DM_DEFAULT_BLACKLISTS.includes('Segmental duplications'), 'paralog pileups are masked')
	t.notOk(DM_DEFAULT_BLACKLISTS.includes('Common germline CNVs (DGV)'), 'germline CNVs are not')
	t.notOk(DM_DEFAULT_BLACKLISTS.includes('Assembly gaps'), 'gaps hold no CpGs, so masking them is a no-op')
	t.end()
})

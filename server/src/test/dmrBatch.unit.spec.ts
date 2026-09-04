import tape from 'tape'
import { mergeWindows, buildScanRegions } from '#src/routes/termdb.dmrBatch.ts'

/*
test sections:

mergeWindows: overlapping and abutting windows collapse, members are tracked, chromosomes stay separate
mergeWindows: input order does not matter; disjoint windows survive intact
*/

/** Unit tests for the batch DMR route's window merging. This is the piece with real branching,
 * and getting it wrong is silent: an unmerged pair calls the same underlying DMR twice, which
 * double-counts it in any width distribution built from the output. */

const w = (chr: string, start: number, stop: number) => ({ chr, start, stop })

tape('\n', t => {
	t.comment('-***- dmrBatch specs -***-')
	t.end()
})

tape('mergeWindows collapses overlaps and records which inputs merged', t => {
	/* 0 and 1 overlap; 2 abuts 1 exactly at its stop (start <= last.stop, so it joins); 3 is clear
	of them. Neighbouring elements from one hit list routinely sit this close and belong to the
	same DMR — that is the case this exists for. */
	const out = mergeWindows([w('chr1', 100, 500), w('chr1', 400, 900), w('chr1', 900, 1200), w('chr1', 5000, 5500)])
	const chr1 = out.get('chr1')!
	t.equal(chr1.length, 2, 'four inputs collapse to two windows')
	t.deepEqual({ start: chr1[0].start, stop: chr1[0].stop }, { start: 100, stop: 1200 }, 'merged window spans the run')
	t.deepEqual(chr1[0].members.sort(), [0, 1, 2], 'members name every input that merged in')
	t.deepEqual({ start: chr1[1].start, stop: chr1[1].stop }, { start: 5000, stop: 5500 }, 'disjoint window survives')
	t.deepEqual(chr1[1].members, [3], 'and carries its single member')
	t.end()
})

tape('mergeWindows keeps chromosomes separate and is order-independent', t => {
	// same coordinates on different chromosomes must never merge, however they arrive
	const shuffled = mergeWindows([w('chr2', 100, 500), w('chr1', 400, 900), w('chr1', 100, 500), w('chr2', 400, 900)])
	t.equal(shuffled.size, 2, 'two chromosomes')
	t.equal(shuffled.get('chr1')!.length, 1, 'chr1 pair merges despite arriving out of order')
	t.equal(shuffled.get('chr2')!.length, 1, 'chr2 pair merges independently')
	t.deepEqual(shuffled.get('chr1')![0].members.sort(), [1, 2], 'members are indices into the ORIGINAL request')
	t.deepEqual(shuffled.get('chr2')![0].members.sort(), [0, 3], 'and stay with their own chromosome')
	t.end()
})

tape('buildScanRegions turns chromosome names into whole-chromosome regions', t => {
	const genome = {
		name: 'hg38',
		chrlookup: {
			CHR20: { name: 'chr20', len: 64444167, major: true },
			CHR1: { name: 'chr1', len: 248956422, major: true }
		}
	}
	const out = buildScanRegions(genome, ['chr20', 'CHR1'])
	t.deepEqual(
		out,
		[
			{ chr: 'chr20', start: 0, stop: 64444167 },
			{ chr: 'chr1', start: 0, stop: 248956422 }
		],
		'each name becomes a region spanning the whole chromosome, in request order'
	)
	t.equal(out[1].chr, 'chr1', 'the lookup normalises casing to the genome’s own name')
	/* An unknown name must fail loudly. Returning nothing would produce an empty scan that looks
	like "no DMRs on that chromosome" rather than "that chromosome does not exist". */
	t.throws(() => buildScanRegions(genome, ['chr99']), /chr99/, 'an unknown chromosome names itself in the error')
	t.end()
})

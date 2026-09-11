import tape from 'tape'
import { domainBins, domainBinBp, DOMAIN_MAP_MIN_DMRS, DOMAIN_MAP_CLAMP } from '../interactions/domainMap'

/*
test sections:

domainBinBp: one bin width for the whole figure, taken from the longest chromosome
domainBins: DMRs land in the right chromosome and bin, by direction
domainBins: out-of-range and unknown-chromosome DMRs are not silently lost or thrown on
*/

/** The genome map is the only thing that answers "where" for a scan returning >100,000 DMRs, and
 * every claim read off it -- which territories run hyper, which run hypo -- is a claim about these
 * bin counts. A binning bug shifts a domain into its neighbour and nothing downstream notices. */

const dmr = (chr: string, start: number, direction: string) => ({ d: { chr, start, direction } })

tape('\n', t => {
	t.comment('-***- dmrBatch domain map specs -***-')
	t.end()
})

tape('domainBinBp derives one bin width from the longest chromosome', t => {
	// hg38 chr1: 50 bins of 5 Mb
	t.equal(domainBinBp(248956422), 5e6, 'chr1-length genome bins at 5 Mb')
	t.equal(domainBinBp(156040895), 3e6, 'an X-length longest chromosome bins at 3 Mb')
	t.equal(domainBinBp(10e6), 1e6, 'never finer than 1 Mb, however short the genome')
	t.equal(domainBinBp(1e6), 1e6, 'and a 1 Mb genome does not produce a zero-width bin')
	t.end()
})

tape('domainBins counts by chromosome, bin and direction', t => {
	const lens = { chr1: 20e6, chr2: 10e6 }
	const rows = [
		dmr('chr1', 0, 'hyper'),
		dmr('chr1', 999_999, 'hyper'),
		dmr('chr1', 1_000_000, 'hypo'),
		dmr('chr1', 19_999_999, 'hyper'),
		dmr('chr2', 0, 'hypo')
	]
	const b = domainBins(rows as any, ['chr1', 'chr2'], lens, 1e6)
	t.equal(b.get('chr1')!.length, 20, 'chr1 gets 20 bins of 1 Mb')
	t.equal(b.get('chr2')!.length, 10, 'chr2 gets 10')
	t.deepEqual(b.get('chr1')![0], [2, 0], 'both sub-1Mb DMRs land in bin 0, counted as hyper')
	t.deepEqual(b.get('chr1')![1], [0, 1], 'a DMR at exactly 1 Mb starts bin 1, and hypo is the second slot')
	t.deepEqual(b.get('chr1')![19], [1, 0], 'the last base of the chromosome lands in the last bin')
	t.deepEqual(b.get('chr2')![0], [0, 1], 'chromosomes are counted independently')
	t.equal(
		b.get('chr1')!.reduce((s, x) => s + x[0] + x[1], 0),
		4,
		'no DMR is counted twice'
	)
	t.end()
})

tape('domainBins keeps out-of-range DMRs and ignores unrequested chromosomes', t => {
	const lens = { chr1: 10e6 }
	/* A DMR past the declared length must not vanish: assemblies and annotation sources disagree
	on the final base, and a figure claiming to show every DMR must not quietly drop one. */
	const b = domainBins([dmr('chr1', 10_500_000, 'hyper'), dmr('chrY', 5, 'hyper')] as any, ['chr1'], lens, 1e6)
	t.deepEqual(b.get('chr1')![9], [1, 0], 'a DMR past the chromosome end clamps into the last bin')
	t.equal(b.has('chrY'), false, 'a chromosome that was not scanned gets no track')
	t.equal(
		b.get('chr1')!.reduce((s, x) => s + x[0] + x[1], 0),
		1,
		'and the unrequested one is dropped rather than misfiled'
	)
	t.end()
})

tape('map thresholds are the ones the caption states', t => {
	/* Both are printed in the figure caption, so a change here without a caption change would
	make the figure describe itself wrongly. */
	t.equal(DOMAIN_MAP_MIN_DMRS, 20, 'bins under 20 DMRs are faded')
	t.equal(Math.pow(2, DOMAIN_MAP_CLAMP), 8, 'bars clamp at 8x')
	t.end()
})

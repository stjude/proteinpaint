import { HYPER_COLOR, HYPO_COLOR } from '../../dmr/settings/defaults'
/* Where the changes are, and which way they go.
 *
 * A genome scan returns >100,000 DMRs; no table of them answers "where". Binning each chromosome
 * and plotting log2(hyper/hypo) per bin does. On MMRF NSD2-high it shows what the table cannot:
 * gains dominate nearly everywhere, yet hypomethylated territories persist INSIDE otherwise
 * hypermethylated chromosomes. That compartmentalisation is the reason to scan rather than drill.
 *
 * A RATIO, not a count, because DMR density tracks CpG and gene density -- a count map would
 * mostly redraw where the CpGs are. Both directions are called from the same probes in the same
 * bin, so dividing cancels whatever makes a bin DMR-rich and leaves only direction.
 *
 * +1 on each side (Laplace) so a bin with 44 hyper and 0 hypo gives a finite, comparable number
 * instead of Infinity, and a 2:0 bin does not outrank a 400:80 one. */
/** Below this a bin's ratio is noise: 3 hyper and 0 hypo is not a hypermethylated domain. Bins
 * under it are drawn faded rather than dropped, so a gap still reads as "no data here" rather than
 * "balanced here" -- those mean different things and a blank would conflate them. */
export const DOMAIN_MAP_MIN_DMRS = 20
/** log2 ratio at which a bar reaches full height. Without a clamp one 44:0 bin flattens the rest. */
export const DOMAIN_MAP_CLAMP = 3

/** One bin width for the WHOLE figure, taken from the longest chromosome, so a bar means the same
 * number of megabases on every track. Binning each chromosome to a fixed COUNT instead would make
 * chr21's bars six times finer than chr1's and the tracks silently incomparable. Rounded to a whole
 * Mb so the axis reads in round numbers on any genome. */
export function domainBinBp(maxLen: number) {
	return Math.max(1e6, Math.round(maxLen / 50 / 1e6) * 1e6)
}

/** Per-chromosome [hyper, hypo] counts per bin. Pure, so the binning is testable without a DOM. */
export function domainBins(
	rows: { d: { chr: string; start: number; direction: string } }[],
	chrs: string[],
	lens: Record<string, number>,
	binBp: number
) {
	const counts = new Map<string, [number, number][]>()
	for (const c of chrs)
		counts.set(
			c,
			Array.from({ length: Math.ceil(lens[c] / binBp) }, () => [0, 0] as [number, number])
		)
	for (const r of rows) {
		const b = counts.get(r.d.chr)
		if (!b) continue
		/* A DMR starting at or past the declared chromosome length lands in the last bin rather
		than off the end: assemblies and annotation sources do not always agree on the final base,
		and dropping such a DMR would silently lose it from a figure that claims to show all. */
		const i = Math.min(b.length - 1, Math.max(0, Math.floor(r.d.start / binBp)))
		b[i][r.d.direction == 'hyper' ? 0 : 1]++
	}
	return counts
}

export function domainMap(
	div: any,
	rows: { d: any; width: number }[],
	chrs: string[],
	lens: Record<string, number>,
	/** Called with the genomic span of a clicked bin. Makes the map navigable rather than only
	 * descriptive: the figure shows WHERE something happened, and the obvious next question is what
	 * is in there. Omitted, the bars are inert. */
	onBinClick?: (chr: string, start: number, stop: number) => void
) {
	const maxLen = Math.max(...chrs.map(c => lens[c]))
	const binBp = domainBinBp(maxLen)
	const MIN_DMRS = DOMAIN_MAP_MIN_DMRS
	const CLAMP = DOMAIN_MAP_CLAMP
	const counts = domainBins(rows, chrs, lens, binBp)

	const single = chrs.length == 1
	const padL = single ? 58 : 46
	const W = 940
	const track = W - padL - 8
	const half = single ? 45 : 15
	// 14px of clear air between tracks: at 7 a full-height up bar on one chromosome touched the
	// full-height down bar of the one above, and the pair read as a single tall bar
	const rowH = half * 2 + (single ? 34 : 14)
	const padT = 22
	const svg = div
		.append('svg')
		.attr('data-testid', 'sjpp-dmrBatch-domainMap')
		.attr('width', W)
		.attr('height', padT + chrs.length * rowH + 26)
	svg
		.append('text')
		.attr('x', padL)
		.attr('y', 12)
		.attr('font-size', 12)
		.attr('font-weight', 'bold')
		.attr('fill', '#333')
		.text(`${single ? chrs[0] : 'Genome'} methylation domains — log₂(hyper / hypo) per ${(binBp / 1e6).toFixed(0)} Mb`)

	chrs.forEach((c, ri) => {
		const bins = counts.get(c)!
		const mid = padT + ri * rowH + half
		// chromosomes drawn to scale against the longest, so track length is itself information
		const px = track * (lens[c] / maxLen)
		const bw = px / bins.length
		svg
			.append('text')
			.attr('x', padL - 6)
			.attr('y', mid + 3.5)
			.attr('text-anchor', 'end')
			.attr('font-size', single ? 11 : 10)
			.attr('fill', '#777')
			.text(single ? '' : c.replace('chr', ''))
		svg
			.append('line')
			.attr('x1', padL)
			.attr('x2', padL + px)
			.attr('y1', mid)
			.attr('y2', mid)
			.attr('stroke', '#ddd')
		/* Guide lines at the clamp, on every track. Without them a bar has no reference and a reader
		cannot tell a 2x territory from a 6x one -- the footnote's "clamped at 8x" says what full
		height means but not where full height is. Faint and dashed so they read as a scale rather
		than as data. */
		for (const sgn of [-1, 1]) {
			svg
				.append('line')
				.attr('x1', padL)
				.attr('x2', padL + px)
				.attr('y1', mid - sgn * half)
				.attr('y2', mid - sgn * half)
				.attr('stroke', '#bbb')
				.attr('stroke-width', 0.5)
				.attr('stroke-dasharray', '2,3')
				.attr('opacity', 0.7)
		}
		// labelled once, on the first track, so the scale is stated without repeating it 24 times
		if (ri == 0 && !single) {
			for (const sgn of [1, -1]) {
				svg
					.append('text')
					.attr('x', padL - 5)
					.attr('y', mid - sgn * half + (sgn > 0 ? 3 : 4))
					.attr('text-anchor', 'end')
					.attr('font-size', 8.5)
					.attr('fill', '#999')
					.text(`${Math.pow(2, CLAMP)}×`)
			}
		}
		bins.forEach((b, i) => {
			const n = b[0] + b[1]
			if (!n) return
			const lr = Math.log2((b[0] + 1) / (b[1] + 1))
			const v = (Math.max(-CLAMP, Math.min(CLAMP, lr)) / CLAMP) * half
			const rect = svg
				.append('rect')
				.attr('x', padL + i * bw)
				.attr('y', v >= 0 ? mid - v : mid)
				.attr('width', Math.max(0.7, bw - 0.4))
				.attr('height', Math.max(0.8, Math.abs(v)))
				.attr('fill', lr >= 0 ? HYPER_COLOR : HYPO_COLOR)
				.attr('opacity', n < MIN_DMRS ? 0.28 : 0.88)
			if (onBinClick) {
				/* A 5 Mb bin is a few pixels wide, so the rect alone is a hard target -- especially a
				short one near the baseline. An invisible full-height hit area over the whole bin makes
				the bar clickable at any height, including where the bar is a single pixel.

				Deliberately no cursor change: the cursor stays the page default here as everywhere
				else, and the footnote below says the segments are clickable instead. */
				svg
					.append('rect')
					.attr('x', padL + i * bw)
					.attr('y', mid - half)
					.attr('width', Math.max(0.7, bw - 0.4))
					.attr('height', half * 2)
					.attr('fill', 'transparent')
					.on('click', () => onBinClick(c, i * binBp, (i + 1) * binBp))
					.append('title')
					.text(`${c}:${(i * binBp) / 1e6}-${((i + 1) * binBp) / 1e6} Mb — click to list these DMRs`)
			}
			rect
				.append('title')
				.text(
					`${c}:${((i * binBp) / 1e6).toFixed(0)}-${(((i + 1) * binBp) / 1e6).toFixed(0)} Mb\n` +
						`${b[0].toLocaleString()} hyper / ${b[1].toLocaleString()} hypo` +
						(n < MIN_DMRS ? `\ntoo few DMRs (${n}) to read a ratio from` : ` — log₂ ratio ${lr.toFixed(2)}`)
				)
		})
		if (single) {
			for (const [val, lab] of [
				[CLAMP, `${Math.pow(2, CLAMP)}× hyper`],
				[-CLAMP, `${Math.pow(2, CLAMP)}× hypo`]
			] as [number, string][]) {
				svg
					.append('text')
					.attr('x', padL - 6)
					.attr('y', mid - (val / CLAMP) * half + (val > 0 ? 8 : -2))
					.attr('text-anchor', 'end')
					.attr('font-size', 10)
					.attr('fill', '#777')
					.text(lab)
			}
			const step = Math.max(1, Math.round(bins.length / 5))
			for (let i = 0; i < bins.length; i += step) {
				svg
					.append('text')
					.attr('x', padL + i * bw)
					.attr('y', mid + half + 14)
					.attr('font-size', 11)
					.attr('fill', '#555')
					.text(`${((i * binBp) / 1e6).toFixed(0)} Mb`)
			}
		}
	})
	svg
		.append('text')
		.attr('x', padL)
		.attr('y', padT + chrs.length * rowH + 16)
		.attr('font-size', 10)
		.attr('fill', '#999')
		.text(
			`up = hyper, down = hypo · clamped at ${Math.pow(2, CLAMP)}× · faded below ${MIN_DMRS} DMRs per bin` +
				(single ? '' : ' · chromosomes drawn to scale') +
				(onBinClick ? ' · click a segment to list its DMRs' : '')
		)
}

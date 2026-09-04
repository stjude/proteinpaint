import { dofetch3 } from '#common/dofetch'
import { renderTable, sayerror } from '#dom'
import { bplen } from '#shared/common.js'
import type { TermdbDmrBatchResponse, TermdbDmrBatchSuccessResponse } from '#types'

/* Drill a whole differential-methylation hit list to CpG resolution in one request.

The point is what the element-level volcano structurally cannot tell you: the SPATIAL SCALE of
each hit. An element is hypermethylated, fine -- but is the event the size of the element, or a
multi-kilobase block that merely contains it? Those are different biological claims, and on MMRF
NSD2-high the answer turned out to be the second (median DMR 3.6 kb against a 310 bp element).
One drill-down is an anecdote; the distribution over the whole hit list is a measurement.

Cheap because the server amortises the model fit across regions -- cost scales with chromosomes
touched, not regions requested. See server/src/routes/termdb.dmrBatch.ts. */

type Region = { chr: string; start: number; stop: number }

/** Pad each element before drilling. A DMR wider than the window would be clipped by it, so the
 * padding sets the largest event this can honestly report -- too tight and every width comes back
 * equal to the window, which looks like a result and is an artefact. */
const WINDOW_PAD = 10_000

/* Drop DMRs called from fewer CpGs than this. On an MMRF chr1 scan the 2-CpG calls carry the
LARGEST effect sizes (median |Δβ| 0.099 against 0.073 for 10-19 CpG calls) and yet split 51.5%
hyper / 48.5% hypo -- a coin flip, where calls with 10+ CpGs run 58% hyper. So the rows a
Δβ-sorted table puts on top are the ones with no directional signal in them. Five keeps 86% of
calls and all of the structure. Not zero by default, because "show everything" here means
"lead with the noise". */
const DEFAULT_MIN_CPGS = 5

export async function runDmrBatch(opts: {
	config: any
	vocab: { genome: string; dslabel: string }
	dots: any[]
	totalSignificant: number
	holder: any
	app: any
	/** Scan this chromosome end to end instead of drilling the hit list. The two modes share
	 * everything downstream; only what is asked for differs. */
	scanChromosome?: string
}) {
	const { config, vocab, dots, totalSignificant, holder, app, scanChromosome } = opts
	holder.selectAll('*').remove()
	const groups = config?.samplelst?.groups
	if (!groups || groups.length != 2) {
		sayerror(holder.append('div'), 'Two sample groups are required.')
		return
	}
	let regions: Region[] = []
	if (!scanChromosome) {
		regions = dots
			.filter(d => d.chr && Number.isFinite(d.start) && Number.isFinite(d.stop))
			.map(d => ({ chr: d.chr, start: Math.max(0, d.start - WINDOW_PAD), stop: d.stop + WINDOW_PAD }))
		if (!regions.length) {
			sayerror(holder.append('div'), 'No significant elements with coordinates to drill.')
			return
		}
	}

	let res: TermdbDmrBatchResponse
	try {
		res = (await dofetch3('termdb/dmrBatch', {
			body: {
				genome: vocab.genome,
				dslabel: vocab.dslabel,
				group1: groups[0].values,
				group2: groups[1].values,
				...(scanChromosome ? { scanChromosomes: [scanChromosome] } : { regions }),
				lambda: config.settings?.dmr?.lambda,
				fdr_cutoff: config.settings?.volcano?.pValue ? Math.pow(10, -config.settings.volcano.pValue) : undefined,
				element_type: config.settings?.volcano?.elementType
			}
		})) as TermdbDmrBatchResponse
	} catch (e: any) {
		sayerror(holder.append('div'), e?.message || String(e))
		return
	}
	if ('error' in res) {
		sayerror(holder.append('div'), res.error)
		return
	}
	render(res, { regions, totalSignificant, holder, config, app, scanChromosome })
}

function render(
	res: TermdbDmrBatchSuccessResponse,
	o: {
		regions: Region[]
		totalSignificant: number
		holder: any
		config: any
		app: any
		scanChromosome?: string
	}
) {
	const { holder } = o
	/* Every DMR, not the widest one per window. A drilled window usually holds exactly one, but a
	scanned chromosome holds thousands, and picking one per region would collapse a whole
	chromosome to a single row. Width is a property of DMRs, so the distribution is over DMRs in
	both modes. */
	const allRows = res.regions.flatMap(r => (r.dmrs || []).map(d => ({ r, d, width: d.stop - d.start })))

	/* The threshold is applied in the browser over the already-returned DMRs, so changing it
	redraws rather than refits. Every number below -- counts, direction split, width quantiles, the
	download and the table -- comes from the filtered set, and the summary states the threshold, so
	no figure here is ever read without knowing what it excludes. */
	let minCpgs = DEFAULT_MIN_CPGS
	const controls = holder.append('div').style('padding', '5px').style('font-size', '.95em')
	controls.append('span').text('Minimum CpGs per DMR: ')
	controls
		.append('input')
		.attr('type', 'number')
		.attr('min', 1)
		.attr('data-testid', 'sjpp-dmrBatch-minCpgs')
		.style('width', '60px')
		.property('value', minCpgs)
		.on('change', function (this: any) {
			const v = Number(this.value)
			if (!Number.isFinite(v) || v < 1) {
				this.value = minCpgs
				return
			}
			minCpgs = Math.floor(v)
			draw()
		})
	const content = holder.append('div')
	draw()

	function draw() {
		content.selectAll('*').remove()
		drawResults(res, o, content, allRows, minCpgs)
	}
}

function drawResults(
	res: TermdbDmrBatchSuccessResponse,
	o: {
		regions: Region[]
		totalSignificant: number
		holder: any
		config: any
		app: any
		scanChromosome?: string
	},
	holder: any,
	allRows: { r: any; d: any; width: number }[],
	minCpgs: number
) {
	const { totalSignificant, config, app, scanChromosome } = o
	const rows = allRows.filter(x => x.d.no_cpgs >= minCpgs)
	const widths = rows.map(x => x.width).sort((a, b) => a - b)
	const q = (p: number) => (widths.length ? widths[Math.floor(p * (widths.length - 1))] : 0)
	const hyper = rows.filter(x => x.d.direction == 'hyper').length
	const windowsWithDmr = res.regions.filter(r => r.dmrs?.length).length
	const anyElementRes = res.regions.some(r => r.elementResolution)

	const summary = holder.append('div').style('padding', '5px').style('font-size', '.95em')
	summary
		.append('div')
		.style('font-weight', 'bold')
		.text(
			scanChromosome
				? `${rows.length.toLocaleString()} DMRs on ${scanChromosome} ` +
						`(${hyper.toLocaleString()} hyper / ${(rows.length - hyper).toLocaleString()} hypo)`
				: `${rows.length.toLocaleString()} DMRs from ${windowsWithDmr.toLocaleString()} of ` +
						`${res.regions.length.toLocaleString()} windows ` +
						`(${hyper.toLocaleString()} hyper / ${(rows.length - hyper).toLocaleString()} hypo)`
		)
	/* No DMRs is a RESULT, not an empty state -- it is exactly what a negative control should
	return, and MMRF male-vs-female on chr7 returns it over 996,833 probes. So report the probe
	count, which is what makes the zero meaningful, and drop the width quantiles, which would
	otherwise read "median 0 bp (IQR 0-0)". */
	summary
		.append('div')
		.text(
			(rows.length
				? `DMR width median ${q(0.5).toLocaleString()} bp (IQR ${q(0.25).toLocaleString()}–${q(
						0.75
				  ).toLocaleString()}); `
				: 'No DMRs called — ') +
				`${res.chromosomes} chromosome model fits over ${res.totalProbesAnalyzed.toLocaleString()} probes`
		)
	const dropped = allRows.length - rows.length
	if (dropped) {
		summary
			.append('div')
			.style('color', '#777')
			.text(
				`Counting DMRs of ${minCpgs}+ CpGs; ${dropped.toLocaleString()} of ` +
					`${allRows.length.toLocaleString()} called DMRs fall below that and are excluded above.`
			)
	}
	/* Stated even when it dropped nothing, so "no artifact regions here" reads differently from
	"no mask was applied". These DMRs never reached the browser, so this is the only place their
	count can come from. */
	const rm = res.regionMask
	if (rm) {
		summary
			.append('div')
			.style('color', '#777')
			.text(
				`Artifact mask (${rm.sources.join(', ')}) removed ${rm.dmrsDropped.toLocaleString()} DMRs ` +
					`lying ${Math.round(rm.overlapFrac * 100)}%+ inside masked regions, before the counts above.`
			)
	}
	/* The backdrop every region result has to be read against. Measured over every value the model
	fits read, not over the requested regions, so it is independent of the result it qualifies.
	Shown next to the DMR counts because a reader who sees "326 hyper / 9 hypo" without knowing the
	whole genome moved will attribute all of it to the regions. */
	const gm = res.globalMethylation
	if (gm) {
		const g1 = config?.samplelst?.groups?.[0]?.name || 'group 1'
		const g2 = config?.samplelst?.groups?.[1]?.name || 'group 2'
		summary
			.append('div')
			.style('margin-top', '4px')
			.text(
				`Global methylation: ${g1} β ${gm.controlMeanBeta.toFixed(4)}, ${g2} β ${gm.caseMeanBeta.toFixed(4)} — ` +
					`shift ${gm.shift >= 0 ? '+' : ''}${gm.shift.toFixed(4)} over ${gm.valuesCounted.toLocaleString()} values. ` +
					`Part of every DMR's difference is this genome-wide shift rather than anything local.`
			)
	}
	/* The count actually drilled versus the count that was significant. The dots list is capped by
	maxInteractiveDots and the cap keeps the MOST significant rows, which are not direction-balanced
	-- so a truncated drill is a biased sample and must not be read as the whole hit list. */
	if (!scanChromosome && totalSignificant > o.regions.length) {
		summary
			.append('div')
			.style('color', '#a00')
			.text(
				`Drilled the top ${o.regions.length.toLocaleString()} of ${totalSignificant.toLocaleString()} significant ` +
					`elements — raise "Max interactive dots" above ${totalSignificant.toLocaleString()} to drill them all. ` +
					`The top of the ranking is not direction-balanced, so this subset is not representative.`
			)
	}
	if (anyElementRes) {
		summary
			.append('div')
			.style('color', '#a00')
			.text(
				'Some chromosomes fell back to the element matrix, so those rows are element resolution, not per-CpG — widths there are not comparable.'
			)
	}

	// nothing below this point has anything to draw without DMRs; a clustering button, an empty
	// domain map and a headers-only table all invite a click that cannot do anything
	if (!rows.length) return

	/* Only for a scan. A drill covers scattered windows chosen by a hit list, so a positional
	profile of it would map where the volcano's elements happen to be, not where methylation
	changes -- the same picture for any contrast run on the same element class. */
	if (scanChromosome) {
		const chrLen = app?.opts?.genome?.majorchr?.[scanChromosome]
		if (chrLen) domainMap(holder.append('div').style('padding', '5px'), rows, scanChromosome, chrLen)
	}
	widthHistogram(holder.append('div').style('padding', '5px'), rows)

	renderTable({
		div: holder.append('div'),
		columns: [
			{ label: 'DMR' },
			/* Formatted rather than a bar. Widths span four orders of magnitude on a scan (24 bp to
			100 kb on MMRF chr1) and the barplot column is a LINEAR scale, so the median 1.1 kb DMR
			drew as 1% of the axis -- every row below the top dozen was an identical sliver, and the
			shared axis crushed its own tick labels into an unreadable run of digits. The shape of the
			distribution is in the histogram above, where a log axis can carry it. */
			{ label: 'Width', align: 'right', nowrap: true },
			{ label: 'CpGs', align: 'right' },
			{ label: 'Direction' },
			{ label: 'Mean Δβ', align: 'right' }
		],
		rows: rows
			.sort((a, b) => b.width - a.width)
			.map(x => [
				{ value: `${x.d.chr}:${x.d.start.toLocaleString()}-${x.d.stop.toLocaleString()}` },
				{ value: bplen(x.width) },
				{ value: x.d.no_cpgs.toLocaleString() },
				{ value: x.d.direction },
				{ value: Number(x.d.meandiff?.toFixed(3)) }
			]),
		showLines: true,
		maxHeight: '30vh',
		download: { fileName: 'dmr-batch.tsv' }
	})
}

/* Where on the chromosome the changes are, and which way they go.
 *
 * A scan returns ~10,000 DMRs; no table of them answers "where". Binning the chromosome and
 * plotting log2(hyper/hypo) per bin does, and on MMRF chr1 it shows the thing the table cannot:
 * hyper and hypo occupy near-EXCLUSIVE megabase territories (1q42-44 runs 5:1 hyper, 85-90 Mb runs
 * 0.11), rather than being interleaved. That is a chromatin-compartment signature, and it is the
 * reason to scan a chromosome rather than drill a hit list.
 *
 * A RATIO, not a count, because DMR density tracks CpG density and gene density -- a raw count map
 * would mostly redraw where the CpGs are. Dividing hyper by hypo cancels that: both directions are
 * called from the same probes in the same bin, so whatever makes a bin DMR-rich affects both.
 *
 * +1 on each side (a Laplace/Haldane correction) so a bin with 44 hyper and 0 hypo produces a
 * finite, comparable number instead of Infinity -- and so a 2:0 bin does not outrank a 400:80 one. */
function domainMap(div: any, rows: { d: any; width: number }[], chr: string, chrLen: number) {
	const TARGET_BINS = 50
	// round the bin to a whole Mb so the axis reads in round numbers on every chromosome
	const binBp = Math.max(1e6, Math.round(chrLen / TARGET_BINS / 1e6) * 1e6)
	const nbins = Math.ceil(chrLen / binBp)
	const hyper = new Array(nbins).fill(0)
	const hypo = new Array(nbins).fill(0)
	for (const r of rows) {
		const i = Math.min(nbins - 1, Math.floor(r.d.start / binBp))
		;(r.d.direction == 'hyper' ? hyper : hypo)[i]++
	}
	/* Below this a bin's ratio is noise: 3 hyper and 0 hypo is not a hypermethylated domain. Drawn
	faded rather than dropped, so a gap in the map still reads as "no data here" rather than
	"balanced here" -- those mean different things and a blank would conflate them. */
	const MIN_DMRS = 20

	const barW = 12
	const gap = 1
	const half = 45
	// wide enough for the right-anchored "8x hyper" scale labels; at 42 the leading digit clipped
	const padL = 58
	const padT = 14
	const w = padL + nbins * (barW + gap) + 10
	const svg = div
		.append('svg')
		.attr('data-testid', 'sjpp-dmrBatch-domainMap')
		.attr('width', w)
		.attr('height', padT + half * 2 + 34)
	svg
		.append('text')
		.attr('x', padL)
		.attr('y', 10)
		.attr('font-size', 12)
		.attr('font-weight', 'bold')
		.attr('fill', '#333')
		.text(`${chr} methylation domains — log₂(hyper / hypo) per ${(binBp / 1e6).toFixed(0)} Mb`)
	const mid = padT + half
	// clamped so one extreme bin cannot flatten every other bar into invisibility
	const CLAMP = 3
	const y = (v: number) => (Math.max(-CLAMP, Math.min(CLAMP, v)) / CLAMP) * half

	for (let i = 0; i < nbins; i++) {
		const n = hyper[i] + hypo[i]
		if (!n) continue
		const lr = Math.log2((hyper[i] + 1) / (hypo[i] + 1))
		const bh = y(lr)
		const x = padL + i * (barW + gap)
		svg
			.append('rect')
			.attr('x', x)
			.attr('y', bh >= 0 ? mid - bh : mid)
			.attr('width', barW)
			.attr('height', Math.max(1, Math.abs(bh)))
			.attr('fill', lr >= 0 ? '#d95f02' : '#1b9e77')
			.attr('opacity', n < MIN_DMRS ? 0.25 : 0.85)
			.append('title')
			.text(
				`${chr}:${((i * binBp) / 1e6).toFixed(0)}-${(((i + 1) * binBp) / 1e6).toFixed(0)} Mb\n` +
					`${hyper[i].toLocaleString()} hyper / ${hypo[i].toLocaleString()} hypo` +
					(n < MIN_DMRS ? `\ntoo few DMRs (${n}) to read a ratio from` : ` — log₂ ratio ${lr.toFixed(2)}`)
			)
	}
	// zero line last, so it sits over the bars and the crossing point stays readable
	svg
		.append('line')
		.attr('x1', padL - 4)
		.attr('x2', w - 6)
		.attr('y1', mid)
		.attr('y2', mid)
		.attr('stroke', '#666')
	for (const [v, lab] of [
		[CLAMP, `${Math.pow(2, CLAMP)}× hyper`],
		[-CLAMP, `${Math.pow(2, CLAMP)}× hypo`]
	] as [number, string][]) {
		svg
			.append('text')
			.attr('x', padL - 6)
			.attr('y', mid - y(v) + (v > 0 ? 8 : -2))
			.attr('text-anchor', 'end')
			.attr('font-size', 10)
			.attr('fill', '#777')
			.text(lab)
	}
	// Mb ticks every ~10 bins, so the axis stays sparse whatever the chromosome length
	const step = Math.max(1, Math.round(nbins / 5))
	for (let i = 0; i < nbins; i += step) {
		svg
			.append('text')
			.attr('x', padL + i * (barW + gap))
			.attr('y', padT + half * 2 + 14)
			.attr('font-size', 11)
			.attr('fill', '#555')
			.text(`${((i * binBp) / 1e6).toFixed(0)} Mb`)
	}
	svg
		.append('text')
		.attr('x', padL)
		.attr('y', padT + half * 2 + 29)
		.attr('font-size', 10)
		.attr('fill', '#999')
		.text(`bars faded where a bin holds fewer than ${MIN_DMRS} DMRs`)
}

/* Width distribution on a log axis, split by direction.
 *
 * The panel exists to answer "what is the SPATIAL SCALE of these events", and on a scan that is a
 * question about a distribution of ~10,000 DMRs, not about any one row. A per-row linear bar
 * answers it for the top dozen and hides the rest; this shows the whole thing in the space of six
 * table rows. Log-binned because the widths are log-distributed -- linear bins put 95% of DMRs in
 * the first bucket and tell you nothing.
 *
 * Split by direction because that is where the surprise usually is: on MMRF chr1 the widest events
 * are overwhelmingly hyper, which a pooled histogram would average away. */
function widthHistogram(div: any, rows: { d: any; width: number }[]) {
	if (rows.length < 2) return
	const BINS_PER_DECADE = 3
	const lo = 1 // 10 bp
	const hi = 6 // 1 Mb, above any real DMR
	const nbins = (hi - lo) * BINS_PER_DECADE
	const bin = (w: number) =>
		Math.max(0, Math.min(nbins - 1, Math.floor((Math.log10(Math.max(w, 10)) - lo) * BINS_PER_DECADE)))
	const hyper = new Array(nbins).fill(0)
	const hypo = new Array(nbins).fill(0)
	for (const r of rows) (r.d.direction == 'hyper' ? hyper : hypo)[bin(r.width)]++
	// trim empty bins at both ends so the drawn range is the range the data actually occupies
	let first = 0
	let last = nbins - 1
	while (first < last && !hyper[first] && !hypo[first]) first++
	while (last > first && !hyper[last] && !hypo[last]) last--

	const barW = 14
	const gap = 2
	const h = 60
	const padL = 4
	const padB = 26
	const n = last - first + 1
	const max = Math.max(...hyper.slice(first, last + 1), ...hypo.slice(first, last + 1), 1)
	const svg = div
		.append('svg')
		.attr('data-testid', 'sjpp-dmrBatch-widthHist')
		.attr('width', padL + n * (barW * 2 + gap) + 40)
		.attr('height', h + padB)
	for (let i = first; i <= last; i++) {
		const x = padL + (i - first) * (barW * 2 + gap)
		for (const [j, [count, color]] of [
			[hyper[i], '#d95f02'],
			[hypo[i], '#1b9e77']
		].entries()) {
			const bh = ((count as number) / max) * h
			if (bh <= 0) continue
			svg
				.append('rect')
				.attr('x', x + j * barW)
				.attr('y', h - bh)
				.attr('width', barW - 1)
				.attr('height', bh)
				.attr('fill', color as string)
				.append('title')
				.text(
					`${(count as number).toLocaleString()} ${j == 0 ? 'hyper' : 'hypo'} DMRs, ` +
						`${bplen(Math.round(Math.pow(10, lo + i / BINS_PER_DECADE)))}–` +
						`${bplen(Math.round(Math.pow(10, lo + (i + 1) / BINS_PER_DECADE)))}`
				)
		}
		// label only whole decades, so the axis never crowds itself
		if ((i * 1) % BINS_PER_DECADE == 0) {
			svg
				.append('text')
				.attr('x', x)
				.attr('y', h + 14)
				.attr('font-size', 11)
				.attr('fill', '#555')
				.text(bplen(Math.pow(10, lo + i / BINS_PER_DECADE)))
		}
	}
	const legend = svg.append('g').attr('transform', `translate(${padL},${h + padB - 2})`)
	legend.append('rect').attr('width', 9).attr('height', 9).attr('y', -9).attr('fill', '#d95f02')
	legend.append('text').attr('x', 12).attr('font-size', 11).attr('fill', '#555').text('hyper')
	legend.append('rect').attr('x', 52).attr('width', 9).attr('height', 9).attr('y', -9).attr('fill', '#1b9e77')
	legend.append('text').attr('x', 64).attr('font-size', 11).attr('fill', '#555').text('hypo')
}

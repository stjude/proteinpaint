import { dofetch3 } from '#common/dofetch'
import { HYPER_COLOR, HYPO_COLOR } from '../../dmr/settings/defaults'
import { renderTable, downloadTable, sayerror } from '#dom'
import { bplen } from '#shared/common.js'
import type { TermdbDmrBatchResponse, TermdbDmrBatchSuccessResponse } from '#types'
import { domainMap } from './domainMap'
import { groupColors } from '../groupColors'

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

/* Rows actually put in the DOM. renderTable builds a <tr> per row with no virtualisation, so a
genome scan's 123,647 DMRs would be ~740,000 nodes and a frozen tab. The widest are kept because
that is the order the table already sorts in, the count shown is always the full one, and the
download button below emits every row -- so the cap costs visibility of the tail, not access to
it. */
const MAX_TABLE_ROWS = 1000

export async function runDmrBatch(opts: {
	config: any
	vocab: { genome: string; dslabel: string }
	dots: any[]
	totalSignificant: number
	holder: any
	app: any
	/** Scan these chromosomes end to end instead of drilling the hit list. The two modes share
	 * everything downstream; only what is asked for differs. One chromosome answers "what happened
	 * here"; the whole list answers "where did anything happen". */
	scanChromosomes?: string[]
	/** Score every DMR against matched intergenic background rather than against zero. */
	backgroundCorrection?: boolean
}) {
	const { config, vocab, dots, totalSignificant, holder, app, scanChromosomes, backgroundCorrection } = opts
	holder.selectAll('*').remove()
	const groups = config?.samplelst?.groups
	if (!groups || groups.length != 2) {
		sayerror(holder.append('div'), 'Two sample groups are required.')
		return
	}
	let regions: Region[] = []
	const scanning = !!scanChromosomes?.length
	if (!scanning) {
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
				...(scanning ? { scanChromosomes } : { regions }),
				backgroundCorrection,
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
	render(res, { regions, totalSignificant, holder, config, app, scanChromosomes })
}

function render(
	res: TermdbDmrBatchSuccessResponse,
	o: {
		regions: Region[]
		totalSignificant: number
		holder: any
		config: any
		app: any
		scanChromosomes?: string[]
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
	/** Set by clicking a bin in the genome map; narrows the table to that span. Kept beside
	 * minCpgs because both are view state over an unchanged result set, and both redraw rather
	 * than refetch. */
	let binFilter: { chr: string; start: number; stop: number } | null = null
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
		drawResults(res, o, content, allRows, minCpgs, binFilter, f => {
			binFilter = f
			draw()
		})
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
		scanChromosomes?: string[]
	},
	holder: any,
	allRows: { r: any; d: any; width: number }[],
	minCpgs: number,
	binFilter: { chr: string; start: number; stop: number } | null,
	setBinFilter: (f: { chr: string; start: number; stop: number } | null) => void
) {
	const { totalSignificant, config, app, scanChromosomes } = o
	const scanning = !!scanChromosomes?.length
	const oneChr = scanChromosomes?.length == 1 ? scanChromosomes[0] : undefined
	const rows = allRows.filter(x => x.d.no_cpgs >= minCpgs)
	/* The bin filter narrows the TABLE only. The map and the summary above keep describing the
	whole scan, so clicking a bin never makes the figure disagree with the numbers printed over it. */
	const tableRows = binFilter
		? rows.filter(x => x.d.chr == binFilter.chr && x.d.start < binFilter.stop && x.d.stop > binFilter.start)
		: rows
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
			scanning
				? `${rows.length.toLocaleString()} DMRs on ${oneChr || `${scanChromosomes!.length} chromosomes`} ` +
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
	/* The correction's own line, stated whether or not much survived. A survival rate is only
	readable against its denominator, so the unscored count is shown rather than folded away. */
	const bc = res.backgroundCorrection
	if (bc) {
		const denom = bc.scored
		summary
			.append('div')
			.style('font-weight', 'bold')
			.text(
				denom
					? `Matched background: ${bc.significant.toLocaleString()} of ${denom.toLocaleString()} scored DMRs ` +
							`(${((100 * bc.significant) / denom).toFixed(1)}%) move more than matched intergenic drift at p<0.05.`
					: 'Matched background: no DMR had enough background in its stratum to score.'
			)
		summary
			.append('div')
			.style('color', '#777')
			.text(
				`${bc.windows.toLocaleString()} intergenic windows sampled, matched on ${bc.matchedOn.join(' and ')}. ` +
					`Excess Δβ and its p are per-DMR columns below.`
			)
		/* An unscored DMR is not a failed one, and the distinction matters because the unscored are
		not a random sample. They are the widest and the most CpG-dense -- intergenic space holds few
		gaps wide enough for a 25kb window, and by construction holds NO CpG-dense regions at all,
		since islands and promoters are exactly what the exclusion removes. So the correction is
		structurally blind to two classes of region, and saying only "N unscored" would let a reader
		treat blank cells as non-significant ones. */
		if (bc.unscored)
			summary
				.append('div')
				.style('color', '#777')
				.text(
					`${bc.unscored.toLocaleString()} DMRs have no excess or p: their stratum held too little ` +
						`background. These are the widest and most CpG-dense regions — intergenic space has few ` +
						`gaps that wide and, by construction, no CpG islands — so a blank cell means "not testable ` +
						`this way", not "not significant".`
				)
	}
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
	if (!scanning && totalSignificant > o.regions.length) {
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
	if (scanning) {
		const lens = app?.opts?.genome?.majorchr || {}
		const present = scanChromosomes!.filter(c => lens[c] > 0)
		if (present.length)
			domainMap(holder.append('div').style('padding', '5px'), rows, present, lens, (chr, start, stop) =>
				setBinFilter({ chr, start, stop })
			)
	}
	widthHistogram(holder.append('div').style('padding', '5px'), rows)

	const tableCols = [
		{ label: 'DMR' },
		/* Formatted rather than a bar. Widths span four orders of magnitude on a scan (24 bp to
			100 kb on MMRF chr1) and the barplot column is a LINEAR scale, so the median 1.1 kb DMR
			drew as 1% of the axis -- every row below the top dozen was an identical sliver, and the
			shared axis crushed its own tick labels into an unreadable run of digits. The shape of the
			distribution is in the histogram above, where a log axis can carry it. */
		{ label: 'Width', align: 'right', nowrap: true },
		{ label: 'CpGs', align: 'right' },
		{ label: 'Direction' },
		{ label: 'Mean Δβ', align: 'right' },
		/* The column that makes a coordinate actionable. The element volcano gets gene names for
			free by testing pre-annotated elements, at the cost of coverage and of reporting every
			event at whatever width the annotation drew. Naming the scan's regions closes that gap
			without giving the extent back. */
		{ label: 'Genes' },
		// only meaningful when the correction ran; otherwise every cell would be blank
		...(res.backgroundCorrection
			? [
					{ label: 'Excess Δβ', align: 'right' },
					{ label: 'vs bg p', align: 'right' }
			  ]
			: [])
	]
	const toRow = (x: { d: any; width: number }) => [
		{ value: `${x.d.chr}:${x.d.start.toLocaleString()}-${x.d.stop.toLocaleString()}` },
		{ value: bplen(x.width) },
		{ value: x.d.no_cpgs.toLocaleString() },
		{ value: x.d.direction },
		{ value: Number(x.d.meandiff?.toFixed(3)) },
		{
			value: x.d.genes?.length
				? x.d.genes.join(', ') + (x.d.genesTruncated ? ` +${x.d.genesTruncated - x.d.genes.length} more` : '')
				: ''
		},
		...(res.backgroundCorrection
			? [
					{ value: x.d.excess == null ? '' : Number(x.d.excess.toFixed(3)) },
					{ value: x.d.bgP == null ? '' : Number(x.d.bgP.toPrecision(2)) }
			  ]
			: [])
	]
	const sorted = [...tableRows].sort((a, b) => b.width - a.width)
	const shown = sorted.slice(0, MAX_TABLE_ROWS)
	const tableDiv = holder.append('div')
	if (binFilter) {
		const bar = tableDiv.append('div').style('padding', '4px 5px').style('font-size', '.92em')
		bar
			.append('span')
			.text(
				`Showing ${sorted.length.toLocaleString()} DMRs in ${binFilter.chr}:` +
					`${(binFilter.start / 1e6).toFixed(0)}–${(binFilter.stop / 1e6).toFixed(0)} Mb. `
			)
		bar
			.append('button')
			.attr('class', 'sja_menuoption')
			.attr('data-testid', 'sjpp-dmrBatch-clearBin')
			.style('padding', '1px 6px')
			.text('Show all')
			.on('click', () => setBinFilter(null))
	}
	if (sorted.length > shown.length) {
		tableDiv
			.append('div')
			.style('padding', '4px 5px')
			.style('font-size', '.9em')
			.style('color', '#777')
			.text(
				`Showing the ${shown.length.toLocaleString()} widest of ${sorted.length.toLocaleString()} DMRs — ` +
					`the table is not virtualised and the full set would not render. Download gets all of them.`
			)
	}
	tableDiv
		.append('button')
		.attr('class', 'sja_menuoption')
		.attr('data-testid', 'sjpp-dmrBatch-download')
		.style('margin', '3px')
		.style('padding', '3px')
		.text(`Download all ${rows.length.toLocaleString()} DMRs`)
		// the FULL set, deliberately not the rendered subset
		.on('click', () => downloadTable(rows.map(toRow), tableCols, 'dmr-scan.tsv'))
	tableDiv
		.append('div')
		.style('padding', '2px 5px 4px')
		.style('font-size', '.9em')
		.style('color', '#777')
		.text(
			"Click a DMR's coordinates to open the region view — per-CpG values, group fits, the called DMRs and the cCRE track."
		)
	const cells = shown.map(toRow)
	renderTable({
		div: tableDiv.append('div'),
		columns: tableCols,
		rows: cells,
		showLines: true,
		maxHeight: '30vh'
	})
	/* Make the coordinate a link into the locus browser. This is the end of the drill: the map says
	WHERE, the table says WHAT GENE, and the browser says WHICH ELEMENTS -- at a scale where a cCRE
	is actually drawable. A cCRE is ~300bp, so across the genome figure it is 0.01 px; the only
	honest place to show element classes as a track is a locus. renderTable attaches each cell's
	<td> as __td for exactly this. */
	cells.forEach((row, i) => {
		const td = (row[0] as any).__td
		if (!td) return
		/* No cursor change and no link colour: the coordinates read as the same black as every other
		cell, and the note above the table says they can be clicked. An affordance that recolours one
		column makes the table look like it holds two kinds of value when it holds one. */
		td.attr('title', 'Click to open this region with its CpGs, fits and cCREs').on('click', () =>
			openLocus(shown[i].d, config, app, holder)
		)
	})
}

/** Pad the DMR before showing it. A DMR drawn edge to edge tells you nothing about whether it sits
 * inside a larger domain or ends where it does; half its width either side puts it in context. */
const LOCUS_PAD_FRACTION = 0.5
const LOCUS_MIN_PAD = 2000

/* Open the clicked DMR in the region view.
 *
 * Deliberately the existing DMR plot rather than a bare genome browser. A browser showed the cCREs
 * and the gene models, and a reader's first reaction was that the elements meant nothing without
 * context -- correctly, because the thing being explained was not on the screen. The DMR plot puts
 * the per-CpG group means, the LOESS fits, the significant CpGs and the called DMR spans on the
 * same axis as the genes, and the genome now declares the cCRE track that view switches on. So one
 * click gives the evidence, the call, and the annotation at one coordinate scale.
 *
 * structuredClone because rx freezes state: the group values come off the volcano's config, and
 * fillTermWrapper adds fields to whatever it is handed. */
function openLocus(d: any, config: any, app: any, holder: any) {
	const groups = config?.samplelst?.groups
	if (!groups || groups.length != 2) {
		sayerror(holder.append('div'), 'Two sample groups are required to open the region view.')
		return
	}
	const pad = Math.max(LOCUS_MIN_PAD, Math.round((d.stop - d.start) * LOCUS_PAD_FRACTION))
	const chrLen = app?.opts?.genome?.majorchr?.[d.chr]
	app.dispatch({
		type: 'plot_create',
		config: structuredClone({
			chartType: 'dmr',
			coordinateOverride: {
				chr: d.chr,
				start: Math.max(0, d.start - pad),
				stop: chrLen ? Math.min(chrLen, d.stop + pad) : d.stop + pad
			},
			group1: groups[0].values,
			group2: groups[1].values,
			group1Name: groups[0].name,
			group2Name: groups[1].name,
			/* Carry the picker's colours through. The reader has already learned which group is which
			from the swatches in the group menu and from the volcano's axis labels; recolouring them
			here would make them re-learn it at every hop. */
			settings: { colors: groupColors(config) }
		})
	})
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
			[hyper[i], HYPER_COLOR],
			[hypo[i], HYPO_COLOR]
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
	legend.append('rect').attr('width', 9).attr('height', 9).attr('y', -9).attr('fill', HYPER_COLOR)
	legend.append('text').attr('x', 12).attr('font-size', 11).attr('fill', '#555').text('hyper')
	legend.append('rect').attr('x', 52).attr('width', 9).attr('height', 9).attr('y', -9).attr('fill', HYPO_COLOR)
	legend.append('text').attr('x', 64).attr('font-size', 11).attr('fill', '#555').text('hypo')
}

import { dofetch3 } from '#common/dofetch'
import { Menu, table2col, addGeneSearchbox, axisstyle } from '#dom'
import { interpolateRdBu, schemeTableau10 } from 'd3-scale-chromatic'
import { legend_newrow } from '#src/block.legend'
import { makeDNAMethRegionTerm } from '#tw/dnaMethylation'
import {
	renderLocusHeatmap,
	initLocusHeatmapRows,
	type LocusHeatmapStat,
	type LocusHeatmapAnnotation,
	type LocusHeatmapModels
} from '../src/block.locusHeatmap'
import { HYPER_COLOR, HYPO_COLOR } from '#shared/dmrColors.js'
import { drawShareViolins, sharesOf, qText } from './usagePlot'
import { scaleLinear } from 'd3-scale'
import { axisTop } from 'd3-axis'
import type { MethylationLocusBin, MethylationLocusResponse, MethylationLocusSample } from '#types'

/* Block track of per-sample CpG methylation in the view range: samples are rows, CpG bins are columns.

tk.dslabel   required
tk.gene      optional; with it, each bin is correlated with the gene's expression (the rho row, within groups),
             expression is a column of bars, and samples can be sorted by it. On a dataset with isoform expression,
             the makeup of the gene's expression by isoform is a column of bars in parts
tk.groupTw   optional samplelst tw: a column of group colors, mean beta per group, and with two groups their difference
tk.dmrFile   optional, with two groups: the bedj file, in the server's cache, of the DMRs that a genome-wide scan of
             those groups called (DmrScanSummary.bedjFile). A row under the lines draws each DMR at its genomic extent.
tk.sortBy    'expression' | 'group' | 'beta' (mean beta in view) | 'share:<isoform>' (its share of the isoforms'
             expression, high to low, within each group when there are groups); default is the first one available
tk.violinHeight  px of a group's violin in the isoform and junction-start rows, default 14 (less for a figure)
tk.minColWidth   px, default 8: the view is cut into as many bins of equal CpG count as fit at this width, so the
             bins shrink on zooming in, down to one CpG per column
tk.filter, tk.filter0
tk.massApp   optional; with it and a gene, a click on a bin opens a violin of expression by the bin's methylation

Rows above the heatmap follow MEXPRESS (Koch et al. 2015, BMC Genomics), turned
so that the genome is horizontal. Data is from termdb/methylationLocus. */

type LocusData = Extract<MethylationLocusResponse, { bins: any }>
/** a line of the mean beta row: a group, or a third of the samples by expression */
type Series = { label: string; color: string; pick: (j: number) => boolean }
/** a DMR of the scan, as its bedj item names it */
type Dmr = { start: number; stop: number; hyper: boolean; delta: number; nCpg: number }

const groupColors = ['#1b9e77', '#d95f02', '#7570b3', '#e7298a']
// the usual methylation colors: blue unmethylated, white, red methylated
const betaColor = (b: number) => interpolateRdBu(1 - b)
const missingColor = '#bbb'
// the isoforms shown apart in the makeup of the gene's expression; the rest are one gray part
const maxIsoformParts = 5
const otherIsoformColor = '#ccc'
// the colors of an annotation's categories that its term gives none
const annotationColors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#17becf']
/* a sample whose isoforms sum to less (in their unit, e.g. TPM) has no makeup: near 0, a read or two decides a share,
e.g. FGFR3 outside t(4;14), whose shares then look like a strong difference in usage */
const minIsoformTotal = 1

export async function loadTk(tk: any, block: any) {
	block.tkcloakon(tk)
	// a pan during a request starts another: only the last one renders
	const loadId = (tk.loadId = (tk.loadId || 0) + 1)
	let error,
		height = 40
	try {
		if (!tk.dslabel) throw new Error('tk.dslabel is required')
		if (!tk.tip) init(tk, block)
		tk.tklabel.text(tk.gene ? `${tk.gene} methylation` : 'Methylation')
		tk.leftLabelMaxwidth = tk.tklabel.node().getBBox().width
		const rs = block.rglst.slice(block.startidx, block.stopidx + 1)
		const data: MethylationLocusResponse = await dofetch3('termdb/methylationLocus', {
			body: {
				genome: block.genome.name,
				dslabel: tk.dslabel,
				gene: tk.gene,
				// one span over the view; in a view of exons only, the introns between them are read too
				region: {
					chr: rs[0].chr,
					start: Math.min(...rs.map(r => r.start)),
					stop: Math.max(...rs.map(r => r.stop))
				},
				nbins: Math.max(1, Math.min(300, Math.floor(block.width / (tk.minColWidth || 8)))),
				filter: tk.filter,
				filter0: tk.filter0,
				sampleTypes: tk.sampleTypes,
				groupTw: tk.groupTw,
				annotationTw: tk.gene ? tk.annotationTw : undefined
			}
		})
		if (loadId != tk.loadId) return
		if ('error' in data) throw new Error(data.error)
		if (!data.bins.length) throw new Error('No CpG in view range')
		tk.data = data
		const dmrs = await loadDmrs(tk, block, data)
		if (loadId != tk.loadId) return
		tk.dmrs = dmrs
		height = render(tk, block)
	} catch (e: any) {
		if (loadId != tk.loadId) return
		error = e.message || e
		// nothing of the range before stays to be drawn again, e.g. by a change of sort
		delete tk.data
		delete tk.sortOptions
		renderLocusHeatmap(tk, block, { rows: [], cols: [], color: betaColor, missingColor })
	}
	tk.height_main = tk.toppad + height + tk.bottompad
	block.tkcloakoff(tk, { error })
	block.block_setheight()
	block.setllabel()
	// lets the host keep tk.gene and tk.sortBy, e.g. the genome browser plot in its state
	tk.callbackOnRender?.(tk, block)
}

/* The scan's DMRs in the view range, from its track file. Read with the block's bedj request, in data mode. Without
the file, or with a file that cannot be read, e.g. one gone from the cache, there are none (undefined) and no DMR row. */
async function loadDmrs(tk: any, block: any, data: LocusData): Promise<Dmr[] | undefined> {
	if (!tk.dmrFile || data.groups?.length != 2) return
	try {
		const res = await dofetch3('tkbedj', {
			method: 'POST',
			body: JSON.stringify({
				genome: block.genome.name,
				file: tk.dmrFile,
				isCache: true,
				getdata: true,
				rglst: [data.region]
			})
		})
		if (res.error) return
		const dmrs: Dmr[] = []
		for (const i of res.items || []) {
			// the item's own values; a file written before it carried them has them only in its name,
			// "Δβ -0.175, 10 CpGs, GENE ..."
			const m = i.delta_beta === undefined ? /^Δβ ([-+]?[\d.]+), (\d+) CpGs/.exec(i.name || '') : null
			const delta = i.delta_beta ?? (m ? Number(m[1]) : undefined)
			const nCpg = i.no_cpgs ?? (m ? Number(m[2]) : undefined)
			if (delta !== undefined && nCpg !== undefined)
				dmrs.push({ start: i.start, stop: i.stop, hyper: i.category == 'hyper', delta, nCpg })
		}
		return dmrs
	} catch (_e) {
		return
	}
}

function init(tk: any, block: any) {
	// the rows of the shared locus heatmap renderer, as the junction track has them
	initLocusHeatmapRows(tk)
	tk.tip = new Menu({ padding: '5px' })
	// the gene matches of the config menu, which stays open under it
	tk.geneTip = new Menu({ padding: '0px', parent_menu: tk.tkconfigtip.d.node() })
	tk.config_handle = block.maketkconfighandle(tk).on('click', () => configMenu(tk, block))
	if (block.legend) {
		const [tr, td] = legend_newrow(block, 'Methylation')
		tk.tr_legend = tr // block hides and removes it with the track
		tk.legendTd = td
	}
}

function configMenu(tk: any, block: any) {
	block.showtkconfigtip(tk)
	const div = tk.tkconfigtip.d.append('div').style('padding', '10px')
	const row1 = div.append('div').style('margin-bottom', '10px')
	row1.append('span').text('Gene for expression ')
	const setGene = (gene?: string) => {
		tk.gene = gene
		tk.tkconfigtip.hide()
		loadTk(tk, block)
	}
	// symbol or alias, any case; emptying the box and pressing Enter removes the gene
	const result = addGeneSearchbox({
		tip: tk.geneTip,
		genome: block.genome,
		row: row1,
		searchOnly: 'gene',
		geneSymbol: tk.gene,
		placeholder: 'none',
		hideHelp: true,
		// the box also calls back for the gene it is filled with
		callback: () => {
			if (result.geneSymbol != tk.gene) setGene(result.geneSymbol)
		},
		emptyInputCallback: () => setGene()
	})
	const row2 = div.append('div')
	row2.append('span').text('Sort samples by ')
	const select = row2.append('select').on('change', (event: any) => {
		tk.sortBy = event.target.value
		tk.tkconfigtip.hide()
		// same data and height: no request
		if (tk.data) render(tk, block)
		tk.callbackOnRender?.(tk, block)
	})
	for (const o of tk.sortOptions || [])
		select
			.append('option')
			.attr('value', o.key)
			.property('selected', o.key == tk.sortBy)
			.text(o.label)
	// a variable that annotates the rows, from the dictionary; read with the gene's expression, so with a gene only
	if (!tk.massApp || !tk.gene) return
	const row3 = div.append('div').style('margin-top', '10px')
	row3.append('span').text('Annotate rows by ')
	const pick = row3.append('div')
	const setAnnotation = (tw?: any) => {
		tk.annotationTw = tw
		tk.tkconfigtip.hide()
		loadTk(tk, block)
	}
	if (tk.annotationTw) {
		row3
			.insert('span', 'div')
			.style('font-weight', 'bold')
			.text(tk.annotationTw.term.name + ' ')
		row3
			.insert('button', 'div')
			.attr('type', 'button')
			.text('Remove')
			.on('click', () => setAnnotation())
	}
	pickTerm(tk, pick, (t: any) => {
		const term = t.term || t
		if (term.type == 'categorical' || term.type == 'condition') setAnnotation({ term, q: { type: 'values' } })
		else if (term.type == 'integer' || term.type == 'float') setAnnotation({ term, q: { mode: 'continuous' } })
		else pick.append('div').style('color', '#c00').text('Choose a categorical or numeric variable')
	})
}

/* the dictionary in a holder, for choosing a term */
async function pickTerm(tk: any, holder: any, callback: (t: any) => void) {
	const termdb = await import('#termdb/app')
	const state = tk.massApp.getState()
	termdb.appInit({
		holder: holder.append('div'),
		vocabApi: tk.massApp.vocabApi,
		state: {
			vocab: state.vocab,
			activeCohort: state.activeCohort,
			nav: { header_mode: 'search_only' },
			tree: { usecase: { target: 'summary', detail: 'term2' } }
		},
		tree: { click_term: callback }
	})
}

/* The rows' annotation, samples[].annotation of tk.annotationTw: a category's color (the term's, else one of
annotationColors in the order of the term's values), or a number's bar; the order a sort by it takes. undefined
without an annotation or without any value. */
export function annotationOf(tk: any, data: Pick<LocusData, 'samples'>) {
	const tw = tk.annotationTw
	if (!tw || !data.samples.some(s => s.annotation !== undefined)) return
	const term = tw.term
	const label = term.name || 'Annotation'
	if (term.type == 'integer' || term.type == 'float') {
		const v = data.samples.map(s => Number(s.annotation)).filter(Number.isFinite)
		const lo = Math.min(...v),
			span = Math.max(...v) - lo || 1
		return {
			label,
			legend: [[`${label}, lowest to highest`, '#555']] as [string, string][],
			rank: (s: MethylationLocusSample) => (Number.isFinite(Number(s.annotation)) ? Number(s.annotation) : Infinity),
			text: (s: MethylationLocusSample) => (s.annotation === undefined ? 'no value' : String(s.annotation)),
			column: (rows: MethylationLocusSample[]): LocusHeatmapAnnotation => ({
				label,
				colors: rows.map(() => '#555'),
				widths: rows.map(s =>
					Number.isFinite(Number(s.annotation)) ? 0.05 + (0.95 * (Number(s.annotation) - lo)) / span : 0
				)
			})
		}
	}
	// the term's order of its values, then any other value seen
	const keys = Object.keys(term.values || {})
	for (const s of data.samples)
		if (s.annotation !== undefined && !keys.includes(String(s.annotation))) keys.push(String(s.annotation))
	const seen = keys.filter(k => data.samples.some(s => String(s.annotation) == k))
	const colorOf = (k: string) => term.values?.[k]?.color || annotationColors[keys.indexOf(k) % annotationColors.length]
	const labelOf = (k: string) => term.values?.[k]?.label || k
	return {
		label,
		legend: seen.map(k => [labelOf(k), colorOf(k)]) as [string, string][],
		rank: (s: MethylationLocusSample) => (s.annotation === undefined ? Infinity : keys.indexOf(String(s.annotation))),
		text: (s: MethylationLocusSample) => (s.annotation === undefined ? 'no value' : labelOf(String(s.annotation))),
		column: (rows: MethylationLocusSample[]): LocusHeatmapAnnotation => ({
			label,
			colors: rows.map(s => (s.annotation === undefined ? '#fff' : colorOf(String(s.annotation))))
		})
	}
}

function render(tk: any, block: any): number {
	const data: LocusData = tk.data
	const { samples, region, unit, groups = [] } = data
	const hasGene = !!data.gene
	// left to right as the view runs
	const bins = block.rglst[block.startidx].reverse ? [...data.bins].reverse() : data.bins
	const values = tk.groupTw?.term?.values || {}
	const groupColor = (g: string) => values[g]?.color || groupColors[groups.indexOf(g)] || '#888'
	const series = getSeries(data, groupColor)
	const twoGroups = groups.length == 2
	const exprLabel = `${tk.gene} ${unit}`

	const annotation = annotationOf(tk, data)
	const isoforms = isoformParts(data)
	// each group's isoform makeup, and with two groups a test of each isoform's share between them
	const usage = isoforms ? isoformUsage(isoforms.shares, samples, groups) : undefined

	// rows are samples[] in the order of idx; everything else stays in the order of samples[]
	tk.sortOptions = [
		...(hasGene ? [{ key: 'expression', label: exprLabel }] : []),
		...(groups.length ? [{ key: 'group', label: 'Group' }] : []),
		{ key: 'beta', label: 'Mean β in view' },
		...(annotation ? [{ key: 'annotation', label: `${groups.length ? 'Group, then ' : ''}${annotation.label}` }] : []),
		// an isoform apart, not the rest of them
		...(isoforms?.ids || []).map(id => ({
			key: `share:${id}`,
			label: `${groups.length ? 'Group, then share' : 'Share'} of ${id}`
		}))
	]
	if (!tk.sortOptions.some((o: any) => o.key == tk.sortBy)) tk.sortBy = tk.sortOptions[0].key
	const idx = samples.map((_, j) => j)
	// the sort is stable: samples[] is ascending by expression, which stays the order inside a group
	if (tk.sortBy == 'group') {
		const gi = (j: number) => (samples[j].group === undefined ? groups.length : groups.indexOf(samples[j].group!))
		idx.sort((a, b) => gi(a) - gi(b))
	} else if (tk.sortBy == 'beta') {
		const mean = samples.map((_, j) => meanOf(bins.map(b => b.beta[j])) ?? -1)
		idx.sort((a, b) => mean[a] - mean[b])
	} else if (tk.sortBy.startsWith('share:') && isoforms) {
		// high to low, a sample without a makeup last; within each group, so that a switch shows as a gradient per group
		const k = isoforms.ids.indexOf(tk.sortBy.slice(6))
		const share = (j: number) => isoforms.shares[j][k] ?? -1
		const gi = (j: number) => (samples[j].group === undefined ? groups.length : groups.indexOf(samples[j].group!))
		idx.sort((a, b) => gi(a) - gi(b) || share(b) - share(a))
	} else if (tk.sortBy == 'annotation' && annotation) {
		// within each group, by the annotation's order; a sample without a value last
		const gi = (j: number) => (samples[j].group === undefined ? groups.length : groups.indexOf(samples[j].group!))
		idx.sort((a, b) => gi(a) - gi(b) || annotation.rank(samples[a]) - annotation.rank(samples[b]))
	}

	/* Mean β of each group, the gap between two groups shaded by direction as on the volcano and the DMR row: where
	the groups differ. Then ρ of methylation with the gene's expression, faded where q ≥ 0.05; with groups, within
	them, pooled (rhoWithin): across all samples a difference between the groups in both gives a strong ρ by itself
	(e.g. NSD2 across t(4;14)), while within them ρ says whether methylation moves with expression from patient to
	patient. */
	const stats: LocusHeatmapStat[] = []
	const means = series.map(sr => bins.map(b => seriesMean(b, sr)))
	stats.push({
		label: 'Mean β',
		domain: [0, 1],
		lines: series.map((sr, k) => ({ color: sr.color, values: means[k] })),
		...(twoGroups ? { fill: { values: [means[0], means[1]], colors: [HYPO_COLOR, HYPER_COLOR] } } : {})
	})
	if (hasGene) {
		const within = groups.length > 0
		const r = bins.map(b => (within ? { rho: b.rhoWithin, q: b.qWithin } : { rho: b.rho, q: b.q }))
		// to the largest |rho| in view in steps of 0.25, so that a locus of weak correlations still shows them
		const top = Math.max(0.25, Math.ceil(Math.max(...r.map(x => Math.abs(x.rho ?? 0))) * 4) / 4)
		stats.push({
			label: within ? `ρ with ${unit}, within groups` : `ρ with ${unit}`,
			domain: [-top, top],
			// one neutral color, so that color means methylation only
			bars: r.map(x => (x.rho === undefined ? null : { v: x.rho, color: '#333', opacity: x.q! < 0.05 ? 0.85 : 0.3 }))
		})
	}
	// the DMR that each bin is in: of several, the one with the largest difference
	const dmrs: Dmr[] = twoGroups ? tk.dmrs || [] : []
	const dmrOf = bins.map(
		b =>
			dmrs.filter(d => d.start <= b.stop && d.stop >= b.start).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))[0]
	)
	/* The DMRs themselves: each at its genomic extent under the lines, as a bed track draws an item, colored by
	direction. Clipped to the view; a DMR shorter than 2 px still shows. */
	const viewDmrs = dmrs.filter(d => d.stop >= region.start && d.start <= region.stop)
	/* px of a position; one at or past an end of the view is that end's edge, on the side that the view's orientation
	puts it, as seekcoord() can find no x at the view's bounds */
	const reverse = !!block.rglst[block.startidx].reverse
	const xAt = (pos: number) => {
		if (pos <= region.start) return reverse ? block.width : 0
		if (pos >= region.stop) return reverse ? 0 : block.width
		return block.seekcoord(region.chr, pos)[0]?.x
	}
	const intervals =
		tk.dmrs && twoGroups
			? {
					label: 'DMRs',
					items: viewDmrs.map(d => ({
						x0: xAt(d.start) ?? 0,
						x1: xAt(d.stop) ?? 0,
						color: d.hyper ? HYPER_COLOR : HYPO_COLOR
					})),
					onHover: (event: any, i: number) => {
						const d = viewDmrs[i]
						tk.tip.clear()
						const table = table2col({ holder: tk.tip.d })
						table.addRow('DMR', `${region.chr}:${d.start}-${d.stop}`)
						table.addRow('Direction', d.hyper ? `hyper in ${groups[1]}` : `hypo in ${groups[1]}`)
						table.addRow('Mean Δβ', round(d.delta))
						table.addRow('CpGs', d.nCpg)
						table.addRow('Length', `${(d.stop - d.start + 1).toLocaleString()} bp`)
						tk.tip.show(event.clientX, event.clientY)
					},
					onOut: () => tk.tip.hide()
			  }
			: undefined

	/* The isoforms of the share column, each at its genomic extent like the gene track draws it, in its color, with the
	share of the isoform per group on the right as in the usage plot: which isoform it is, where it starts, and how
	the groups use it, on one line. With groups only. */
	const models = [
		...(isoforms && usage ? [isoformRows(data, isoforms, usage, groupColor, xAt, tk)] : []),
		/* every start of the gene's transcripts that its junctions show, not only those of the isoforms above, which are
		the most expressed by isoform expression: a start used by few annotated isoforms can be the one that differs */
		...(groups.length ? [junctionRows(data, groups, groupColor, xAt, tk)].filter(m => m.rows.length) : [])
	]

	const annotations: LocusHeatmapAnnotation[] = []
	if (hasGene) {
		// log2(value+1), so that the many low values are not flattened to zero
		const logv = idx.map(j => Math.log2(samples[j].value! + 1))
		const maxv = Math.max(...logv) || 1
		annotations.push({ label: exprLabel, colors: idx.map(() => '#555'), widths: logv.map(v => v / maxv) })
	}
	if (isoforms)
		annotations.push({
			label: 'Isoform share',
			parts: idx.map(j => isoforms.shares[j].map((width, k) => ({ width, color: isoforms.colors[k] })))
		})
	if (groups.length)
		annotations.push({
			label: 'Group',
			colors: idx.map(j => (samples[j].group === undefined ? '#fff' : groupColor(samples[j].group!)))
		})
	if (annotation) annotations.push(annotation.column(idx.map(j => samples[j])))

	const nCpg = bins.reduce((n, b) => n + b.nCpg, 0)
	// off until the plot that a click on a bin opens works again; was hasGene && tk.massApp
	const canViolin = false
	const height = renderLocusHeatmap(tk, block, {
		rows: idx.map(j => samples[j].name),
		cols: bins.map(b => ({
			x: block.seekcoord(region.chr, (b.start + b.stop) / 2)[0]?.x,
			values: idx.map(j => b.beta[j])
		})),
		color: betaColor,
		missingColor,
		// sorted by group: a gap where the next group starts
		rowBreaks:
			tk.sortBy == 'group' || ((tk.sortBy.startsWith('share:') || tk.sortBy == 'annotation') && groups.length)
				? idx.flatMap((j, i) => (i && samples[j].group !== samples[idx[i - 1]].group ? [i] : []))
				: [],
		stats,
		annotations,
		intervals,
		models,
		note: [
			`${samples.length} samples`,
			nCpg == bins.length ? `${nCpg} CpGs` : `${bins.length} bins of ~${Math.round(nCpg / bins.length)} CpGs`
		],
		onHover: (event, col, row) => {
			const b = bins[col]
			/* the block's cursor bar on the genomic span of the bin, from where the bin's line ends: above that, the
			pointer's x is a column, which the renderer outlines */
			const x0 = block.seekcoord(region.chr, b.start)[0]?.x,
				x1 = block.seekcoord(region.chr, b.stop)[0]?.x
			if (x0 !== undefined && x1 !== undefined)
				block.cursorhlbar
					.attr('x', block.leftheadw + block.lpad + Math.min(x0, x1))
					.attr('width', Math.max(2, Math.abs(x1 - x0) + block.exonsf))
					.attr('y', tk.yoff + height)
					.attr('height', Math.max(0, block.totalheight() - tk.yoff - height))
			tk.tip.clear()
			const table = table2col({ holder: tk.tip.d })
			if (row >= 0) {
				const s = samples[idx[row]]
				table.addRow('Sample', s.name)
				if (hasGene) table.addRow(exprLabel, round(s.value!))
				if (s.group !== undefined) table.addRow('Group', s.group)
				if (annotation) table.addRow(annotation.label, annotation.text(s))
				if (isoforms)
					isoforms.labels.forEach((label, k) => {
						const share = isoforms.shares[idx[row]][k]
						if (share) table.addRow(label, `${Math.round(share * 100)}% of the isoforms' ${isoforms.unit}`)
					})
			}
			table.addRow(b.nCpg == 1 ? 'CpG' : 'Bin', `${region.chr}:${b.start}${b.nCpg == 1 ? '' : '-' + b.stop}`)
			if (b.nCpg > 1) table.addRow('CpGs', b.nCpg)
			if (row >= 0) table.addRow('β', b.beta[idx[row]] === null ? 'too few reads' : round(b.beta[idx[row]]!))
			if (hasGene && b.rhoWithin !== undefined)
				table.addRow('Spearman ρ, within groups', rhoText({ rho: b.rhoWithin, q: b.qWithin }))
			if (hasGene) table.addRow(groups.length ? 'Spearman ρ, all samples' : 'Spearman ρ', rhoText(b))
			for (const g of b.byGroup || []) table.addRow(`ρ in ${g.group}`, rhoText(g))
			for (const sr of series) {
				const m = seriesMean(b, sr)
				table.addRow(`Mean β, ${sr.label}`, m === null ? 'no data' : round(m))
			}
			if (twoGroups) {
				const d = diff(b, series)
				table.addRow('Δβ', d === null ? 'no data' : round(d))
			}
			const dmr = dmrOf[col]
			if (dmr) table.addRow('DMR', `${region.chr}:${dmr.start}-${dmr.stop}, Δβ ${round(dmr.delta)}, ${dmr.nCpg} CpGs`)
			if (canViolin) table.addRow('', 'Click for a violin plot')
			tk.tip.show(event.clientX, event.clientY)
		},
		onOut: () => {
			tk.tip.hide()
			// back to the full height for the block's own use of the bar
			block.cursorhlbar.attr('width', 0).attr('y', 0)
		},
		onClick: col => {
			if (!canViolin) return
			tk.tip.hide()
			launchViolin(tk, region.chr, bins[col])
		}
	})
	renderLegend(tk, data, series, isoforms, usage, annotation)
	return height
}

/* The makeup of the gene's expression by isoform: per sample, the share of the summed expression of the gene's
isoforms that each of the most expressed ones has, and the rest as one last part. undefined without isoform
expression, or with one isoform. A sample whose isoforms add up to less than minIsoformTotal, or that misses the value
of one, has no parts: its makeup is not known. */
export function isoformParts(data: {
	expressedIsoforms?: string[]
	samples: Pick<MethylationLocusSample, 'isoformValues'>[]
	isoformUnit?: string
}): { ids: string[]; labels: string[]; colors: string[]; shares: number[][]; unit: string } | undefined {
	const ids = data.expressedIsoforms || []
	// a sample with a value for every isoform: one whose makeup is known
	const complete = (v?: (number | null)[]): v is number[] =>
		!!v &&
		v.length == ids.length &&
		v.every(x => x !== null) &&
		(v as number[]).reduce((a, b) => a + b, 0) >= minIsoformTotal
	if (ids.length < 2 || !data.samples.some(s => complete(s.isoformValues))) return
	// the most expressed over the samples whose makeup is known
	const total = ids.map((_, k) =>
		data.samples.reduce((sum, s) => sum + (complete(s.isoformValues) ? s.isoformValues[k] : 0), 0)
	)
	const top = ids
		.map((_, k) => k)
		.sort((a, b) => total[b] - total[a])
		.slice(0, maxIsoformParts)
		.filter(k => total[k] > 0)
	if (!top.length) return
	const hasOther = ids.length > top.length
	return {
		// the isoforms shown apart, in the order of their parts; labels has the rest too
		ids: top.map(k => ids[k]),
		labels: [...top.map(k => ids[k]), ...(hasOther ? [`${ids.length - top.length} other isoforms`] : [])],
		colors: [...top.map((_, i) => schemeTableau10[i]), ...(hasOther ? [otherIsoformColor] : [])],
		shares: data.samples.map(s => {
			const v = s.isoformValues
			if (!complete(v)) return []
			const sum = v.reduce((a, b) => a + b, 0)
			const mine = top.map(k => v[k] / sum)
			return hasOther ? [...mine, Math.max(0, 1 - mine.reduce((a, b) => a + b, 0))] : mine
		}),
		// the isoforms' own unit, which a dataset sets apart from the gene's
		unit: data.isoformUnit || 'expression'
	}
}

/* Each group's isoform makeup: per part of isoformParts(), the mean share over the group's samples with a makeup. With
two groups, each part's shares in the two are compared by a Wilcoxon rank-sum test (normal approximation with tie and
continuity correction), BH-adjusted across the parts: differential usage, apart from how much of the gene each group
makes. undefined without groups. */
export function isoformUsage(
	shares: number[][],
	samples: { group?: string }[],
	groups: string[]
): { groups: { name: string; n: number; mean: number[] }[]; q?: (number | null)[] } | undefined {
	if (!groups.length) return
	const nParts = Math.max(0, ...shares.map(s => s.length))
	if (!nParts) return
	const of = groups.map(g => shares.filter((s, j) => s.length && samples[j].group === g))
	const out: { groups: { name: string; n: number; mean: number[] }[]; q?: (number | null)[] } = {
		groups: groups.map((name, i) => ({
			name,
			n: of[i].length,
			mean: Array.from({ length: nParts }, (_, k) =>
				of[i].length ? of[i].reduce((sum, s) => sum + s[k], 0) / of[i].length : 0
			)
		}))
	}
	if (groups.length == 2) {
		const p = Array.from({ length: nParts }, (_, k) =>
			rankSumP(
				of[0].map(s => s[k]),
				of[1].map(s => s[k])
			)
		)
		out.q = bh(p)
	}
	return out
}

/* two-sided p of a Wilcoxon rank-sum test of a against b, normal approximation with tie and continuity correction;
null with an empty group or no variation */
export function rankSumP(a: number[], b: number[]): number | null {
	const n1 = a.length,
		n2 = b.length,
		n = n1 + n2
	if (!n1 || !n2) return null
	const all = [...a.map(v => ({ v, g: 0 })), ...b.map(v => ({ v, g: 1 }))].sort((x, y) => x.v - y.v)
	// mid ranks of ties, and the tie term of the variance
	let r1 = 0,
		ties = 0
	for (let i = 0; i < n; ) {
		let j = i
		while (j + 1 < n && all[j + 1].v == all[i].v) j++
		const rank = (i + j + 2) / 2,
			t = j - i + 1
		for (let k = i; k <= j; k++) if (all[k].g == 0) r1 += rank
		ties += t * t * t - t
		i = j + 1
	}
	const u = r1 - (n1 * (n1 + 1)) / 2
	const sd = Math.sqrt(((n1 * n2) / 12) * (n + 1 - ties / (n * (n - 1))))
	if (!(sd > 0)) return null
	const z = Math.max(0, Math.abs(u - (n1 * n2) / 2) - 0.5) / sd
	return Math.min(1, 2 * normalUpper(z))
}

// P(Z > z) for a standard normal: erfc by W. J. Cody's rational approximation as in Numerical Recipes (erfcc), error < 1.2e-7
function normalUpper(z: number): number {
	const x = z / Math.SQRT2
	const t = 1 / (1 + 0.5 * x)
	const r =
		t *
		Math.exp(
			-x * x -
				1.26551223 +
				t *
					(1.00002368 +
						t *
							(0.37409196 +
								t *
									(0.09678418 +
										t *
											(-0.18628806 +
												t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
		)
	return r / 2
}

// Benjamini-Hochberg over the p-values that are not null
function bh(p: (number | null)[]): (number | null)[] {
	const idx = p.map((v, i) => i).filter(i => p[i] !== null)
	idx.sort((a, b) => p[b]! - p[a]!)
	const q: (number | null)[] = p.map(() => null)
	let running = 1
	idx.forEach((i, r) => {
		running = Math.min(running, (p[i]! * idx.length) / (idx.length - r))
		q[i] = running
	})
	return q
}

/* the lines of the mean beta row: the groups when there are any, else thirds of the samples by expression,
else all samples */
function getSeries(data: LocusData, groupColor: (group: string) => string): Series[] {
	const { samples, groups, unit } = data
	if (groups?.length) return groups.map(g => ({ label: g, color: groupColor(g), pick: j => samples[j].group === g }))
	if (!data.gene) return [{ label: 'all samples', color: '#333', pick: () => true }]
	// samples are in ascending order of expression
	const n = samples.length
	return [
		{ label: `low ${unit}`, color: '#bbb', from: 0, to: n / 3 },
		{ label: `mid ${unit}`, color: '#777', from: n / 3, to: (2 * n) / 3 },
		{ label: `high ${unit}`, color: '#000', from: (2 * n) / 3, to: n }
	].map(t => ({ label: t.label, color: t.color, pick: (j: number) => j >= t.from && j < t.to }))
}

function meanOf(values: (number | null)[]): number | null {
	let sum = 0,
		n = 0
	for (const v of values) {
		if (v === null) continue
		sum += v
		n++
	}
	return n ? sum / n : null
}

function seriesMean(bin: MethylationLocusBin, s: Series): number | null {
	return meanOf(bin.beta.filter((_, j) => s.pick(j)))
}

// the second series' mean beta minus the first's, as in the volcano
function diff(bin: MethylationLocusBin, series: Series[]): number | null {
	const a = seriesMean(bin, series[0]),
		b = seriesMean(bin, series[1])
	return a === null || b === null ? null : b - a
}

function renderLegend(
	tk: any,
	data: LocusData,
	series: Series[],
	isoforms?: ReturnType<typeof isoformParts>,
	usage?: ReturnType<typeof isoformUsage>,
	annotation?: ReturnType<typeof annotationOf>
) {
	if (!tk.legendTd) return
	tk.legendTd.selectAll('*').remove()
	const div = tk.legendTd.append('div').style('font-size', '.8em').style('padding', '5px')
	const item = (swatch: string, text: string) => {
		const s = div.append('span').style('margin-right', '15px').style('white-space', 'nowrap')
		s.append('span').attr('style', `display:inline-block;vertical-align:middle;margin-right:4px;${swatch}`)
		s.append('span').text(text)
	}
	const stops = [0, 0.25, 0.5, 0.75, 1].map(betaColor).join(',')
	item(`width:80px;height:12px;background:linear-gradient(to right,${stops})`, 'β 0 to 1')
	item(`width:12px;height:12px;background:${missingColor}`, 'too few reads')
	for (const s of series) item(`width:16px;height:2px;background:${s.color}`, `mean β, ${s.label}`)
	if (data.groups?.length == 2) {
		item(`width:12px;height:12px;background:${HYPER_COLOR};opacity:.35`, `${data.groups[1]} higher`)
		item(`width:12px;height:12px;background:${HYPO_COLOR};opacity:.35`, `${data.groups[1]} lower`)
	}
	if (tk.dmrs && data.groups?.length == 2) {
		item(`width:16px;height:8px;background:${HYPER_COLOR}`, 'hypermethylated DMR of the scan, at its length')
		item(`width:16px;height:8px;background:${HYPO_COLOR}`, 'hypomethylated DMR')
	}
	if (data.gene) item('width:12px;height:12px;background:#333;opacity:.3', 'ρ faded if q ≥ 0.05')
	if (data.gene) item('width:16px;height:6px;background:#555', `log2(${data.unit}+1)`)
	if (data.gene && data.groups?.length)
		item('', "ρ within groups: each group's ρ, pooled, so that a difference between the groups does not make one")
	if (isoforms) {
		const starts = new Map((data.isoforms || []).map(g => [g.isoform, g.strand == '-' ? g.stop : g.start]))
		item('', `share of the ${isoforms.unit} of the isoforms of ${tk.gene}:`)
		isoforms.labels.forEach((label, k) => {
			const start = starts.get(label)
			item(
				`width:12px;height:12px;background:${isoforms.colors[k]}`,
				// with its start, as isoforms that start apart can differ in the methylation there
				`${label}${start === undefined ? '' : ` (start ${data.region.chr}:${start + 1})`}` +
					// each group's mean share, and the test of the two
					(usage
						? `: ${usage.groups.map(g => `${Math.round(g.mean[k] * 100)}%`).join(' vs ')}` +
						  (usage.q?.[k] == null ? '' : `, q ${qText(usage.q[k]!)}`)
						: '')
			)
		})
		if (usage) {
			// the makeup of each group, as the column draws one sample's
			const box = div.append('div').style('margin-top', '4px')
			for (const g of usage.groups) {
				const row = box.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '6px')
				const bar = row.append('div').style('display', 'flex').style('width', '120px').style('height', '10px')
				g.mean.forEach((m, k) =>
					bar
						.append('div')
						.style('width', `${m * 100}%`)
						.style('background', isoforms.colors[k])
				)
				row.append('span').text(`${g.name}, mean of ${g.n} samples`)
			}
			if (usage.q)
				box.append('div').text('q: Wilcoxon rank-sum of the shares between the groups, BH across the isoforms')
		}
	}
	if (annotation) {
		item('', `${annotation.label}:`)
		for (const [label, color] of annotation.legend) item(`width:12px;height:12px;background:${color}`, label)
	}
}

/* Junction evidence of the isoforms' starts: per sample, the reads of an isoform's first junction (at its 5' end) over
those of a body junction most of the gene's transcripts have (response.junctions), the share of the gene's transcripts
that start where the isoform starts; it does not depend on assigning reads to transcripts that share most of their
exons, as isoform expression does. A sample with fewer than minReferenceReads reads of the body junction has none.
With two groups, each isoform's ratios are compared by rank-sum, BH across the isoforms with a first junction. */
const minReferenceReads = 10
export function junctionUsage(
	data: Pick<LocusData, 'samples' | 'junctions' | 'expressedIsoforms'>,
	ids: string[],
	groups: string[]
):
	| {
			/** per isoform of ids: its first junction, null for none */
			junction: ([number, number] | null)[]
			/** per isoform, per sample of data.samples: the ratio, null for none */
			ratio: (number | null)[][]
			/** per isoform, per group: the median reads of the first junction and of the body junction */
			reads: { first: number; reference: number }[][]
			q?: (number | null)[]
	  }
	| undefined {
	const J = data.junctions
	if (!J || !data.samples.some(s => s.junctionReads)) return
	const all = data.expressedIsoforms || []
	const median = (v: number[]) => {
		const s = [...v].sort((a, b) => a - b)
		return s.length ? s[Math.floor(s.length / 2)] : 0
	}
	const firstOf = ids.map(id => J.first[all.indexOf(id)] ?? null)
	const ratio = firstOf.map(f => (f === null ? data.samples.map(() => null) : junctionRatios(data, f)))
	const reads = firstOf.map(f =>
		groups.map(g => {
			const of = data.samples.filter(s => s.group === g && s.junctionReads)
			return {
				first: f === null ? 0 : median(of.map(s => s.junctionReads![f])),
				reference: median(of.map(s => s.junctionReads![J.reference]))
			}
		})
	)
	const out: ReturnType<typeof junctionUsage> = {
		junction: firstOf.map(f => (f === null ? null : J.keys[f])),
		ratio,
		reads
	}
	if (groups.length == 2) {
		const of = (k: number, g: string) =>
			ratio[k].filter((v, j) => v !== null && data.samples[j].group === g) as number[]
		out.q = bh(firstOf.map((f, k) => (f === null ? null : rankSumP(of(k, groups[0]), of(k, groups[1])))))
	}
	return out
}

/** per sample, the reads of junction keys[k] over the body junction's; null with fewer than minReferenceReads of it */
export function junctionRatios(data: Pick<LocusData, 'samples' | 'junctions'>, k: number): (number | null)[] {
	const ref = data.junctions!.reference
	return data.samples.map(s => {
		const r = s.junctionReads
		if (!r || r[ref] < minReferenceReads) return null
		return r[k] / r[ref]
	})
}

/* The starts of the gene's transcripts that its junctions show: each distinct first junction of an expressed isoform
but the body junction, with a median of at least minStartReads reads in some group, in genomic order; per start its
isoforms, ratios (junctionRatios), median reads per group of it and of the body junction, and with two groups the
rank-sum q of the ratios, BH across the starts. */
const minStartReads = 5
export function junctionStarts(data: Pick<LocusData, 'samples' | 'junctions' | 'expressedIsoforms'>, groups: string[]) {
	const J = data.junctions
	if (!J || !data.samples.some(s => s.junctionReads)) return []
	const ids = data.expressedIsoforms || []
	const median = (v: number[]) => {
		const s = [...v].sort((a, b) => a - b)
		return s.length ? s[Math.floor(s.length / 2)] : 0
	}
	const byKey = new Map<number, string[]>()
	J.first.forEach((f, i) => {
		if (f === null || f === J.reference) return
		if (!byKey.has(f)) byKey.set(f, [])
		byKey.get(f)!.push(ids[i])
	})
	const starts = [...byKey]
		.map(([k, isoforms]) => ({
			key: J.keys[k],
			isoforms,
			ratio: junctionRatios(data, k),
			reads: groups.map(g => {
				const of = data.samples.filter(s => s.group === g && s.junctionReads)
				return {
					start: median(of.map(s => s.junctionReads![k])),
					reference: median(of.map(s => s.junctionReads![J.reference]))
				}
			}),
			q: null as number | null
		}))
		.filter(st => st.reads.some(r => r.start >= minStartReads))
		.sort((a, b) => a.key[0] - b.key[0])
	if (groups.length == 2) {
		const of = (st: (typeof starts)[0], g: string) =>
			st.ratio.filter((v, j) => v !== null && data.samples[j].group === g) as number[]
		const q = bh(starts.map(st => rankSumP(of(st, groups[0]), of(st, groups[1]))))
		starts.forEach((st, i) => (st.q = q[i]))
	}
	return starts
}

/* The rows of junctionStarts(): each junction at its genomic extent, from its donor to its acceptor, and on the right
a violin per group of its ratio to the body junction, and its q */
function junctionRows(
	data: LocusData,
	groups: string[],
	groupColor: (g: string) => string,
	xAt: (pos: number) => number | undefined,
	tk: any
): LocusHeatmapModels {
	const violinH = tk.violinHeight || 14,
		colW = 130
	const starts = junctionStarts(data, groups)
	const groupOf = data.samples.map(s => s.group)
	const p95 = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length * 0.95)] ?? 0
	const top = Math.max(
		1,
		Math.ceil(Math.max(0, ...starts.map(st => p95(st.ratio.filter(v => v !== null) as number[]))) * 2) / 2
	)
	const x = scaleLinear().domain([0, top]).range([0, colW]).clamp(true)
	const px = (pos: number) => xAt(pos) ?? 0
	const ref = data.junctions?.keys[data.junctions.reference]
	return {
		label: 'Transcript starts (junctions)',
		headerHeight: 32,
		rowHeight: groups.length * (violinH + 2) + 6,
		rightWidth: colW + 62,
		rows: starts.map(st => ({
			label: `${st.key[0].toLocaleString()}-${st.key[1].toLocaleString()}`,
			color: '#555',
			line: [px(st.key[0]), px(st.key[1])],
			// the two ends, the donor and the acceptor
			exons: [
				[px(st.key[0]) - 1, px(st.key[0]) + 1],
				[px(st.key[1]) - 1, px(st.key[1]) + 1]
			]
		})),
		right: (rg, i) => {
			const st = starts[i]
			if (i == 0) {
				rg.append('text')
					.attr('y', -20)
					.attr('font-size', 10)
					.attr('font-weight', 'bold')
					.text('Junction ÷ body junction')
				axisstyle({
					axis: rg
						.append('g')
						.attr('transform', 'translate(0,-2)')
						.call(
							axisTop(x)
								.tickValues([0, top / 2, top])
								.tickFormat((v: any) => String(v))
								.tickSize(3)
						),
					color: '#555',
					fontsize: 9
				})
			}
			drawShareViolins(rg.append('g').attr('transform', 'translate(0,3)'), {
				groups: groups.map(g => ({
					color: groupColor(g),
					values: st.ratio.filter((v, j) => v !== null && groupOf[j] === g) as number[]
				})),
				x,
				h: violinH
			})
			if (st.q !== null)
				rg.append('text')
					.attr('x', colW + 6)
					.attr('y', 3 + (groups.length * (violinH + 2)) / 2)
					.attr('dominant-baseline', 'central')
					.attr('font-size', 10)
					.attr('font-weight', st.q < 0.05 ? 'bold' : 'normal')
					.text(`q ${qText(st.q)}`)
		},
		onHover: (event, i) => {
			const st = starts[i]
			tk.tip.clear()
			const table = table2col({ holder: tk.tip.d })
			table.addRow('Junction', `${data.region.chr}:${st.key[0]}-${st.key[1]}`)
			table.addRow(
				'First junction of',
				st.isoforms.length > 3
					? `${st.isoforms.slice(0, 3).join(', ')} and ${st.isoforms.length - 3} more`
					: st.isoforms.join(', ')
			)
			groups.forEach((g, gi) => {
				const r = st.reads[gi]
				table.addRow(`Median reads, ${g}`, `${r.start} this junction, ${r.reference} body junction`)
			})
			if (ref) table.addRow('Body junction', `${data.region.chr}:${ref[0]}-${ref[1]}`)
			if (st.q !== null) table.addRow('q', qText(st.q))
			tk.tip.show(event.clientX, event.clientY)
		},
		onOut: () => tk.tip.hide()
	}
}

/* The model rows of the isoforms shown apart in the share column: exons and span from the gene models of the response,
px by xAt(); on the right, per group, a violin of the isoform's share of isoform expression (./usagePlot.ts
drawShareViolins) and its q, and with junction data a violin of junctionUsage() and its q, each column under its title
and axis above the first row. */
function isoformRows(
	data: LocusData,
	isoforms: NonNullable<ReturnType<typeof isoformParts>>,
	usage: NonNullable<ReturnType<typeof isoformUsage>>,
	groupColor: (g: string) => string,
	xAt: (pos: number) => number | undefined,
	tk: any
): LocusHeatmapModels {
	const violinH = tk.violinHeight || 14,
		colW = 130,
		qW = 62
	const byId = new Map((data.isoforms || []).map(g => [g.isoform, g]))
	const groupOf = data.samples.map(s => s.group)
	// the isoforms with a model: not the gray part of the rest
	const ks = isoforms.ids.map((_, k) => k).filter(k => byId.has(isoforms.ids[k]))
	const junctions = junctionUsage(
		data,
		isoforms.ids,
		usage.groups.map(g => g.name)
	)
	// the junction ratio from 0 to the largest 95th percentile of the rows, in halves, at least 1
	const p95 = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length * 0.95)] ?? 0
	const jMax = junctions
		? Math.max(
				1,
				Math.ceil(Math.max(...ks.map(k => p95(junctions.ratio[k].filter(v => v !== null) as number[]))) * 2) / 2
		  )
		: 1
	const columns = [
		{
			title: `Share of isoform ${isoforms.unit}`,
			x: scaleLinear().domain([0, 1]).range([0, colW]),
			ticks: [0, 0.5, 1],
			format: (v: number) => `${v * 100}%`,
			values: (k: number, g: string) => sharesOf({ parts: isoforms, groupOf }, g, k),
			q: (k: number) => usage.q?.[k]
		},
		...(junctions
			? [
					{
						title: 'First junction ÷ body junction',
						x: scaleLinear().domain([0, jMax]).range([0, colW]).clamp(true),
						ticks: [0, jMax / 2, jMax],
						format: (v: number) => String(v),
						values: (k: number, g: string) =>
							junctions.ratio[k].filter((v, j) => v !== null && groupOf[j] === g) as number[],
						q: (k: number) => junctions.q?.[k]
					}
			  ]
			: [])
	]
	const px = (pos: number) => xAt(pos) ?? 0
	return {
		label: 'Isoforms',
		headerHeight: 32,
		rowHeight: usage.groups.length * (violinH + 2) + 6,
		rightWidth: columns.length * (colW + qW),
		rows: ks.map(k => {
			const g = byId.get(isoforms.ids[k])!
			return {
				label: isoforms.ids[k],
				color: isoforms.colors[k],
				line: [px(g.start), px(g.stop)],
				exons: (g.exon || []).map(([a, b]) => [px(a), px(b)])
			}
		}),
		right: (rg, i) => {
			const k = ks[i]
			columns.forEach((c, ci) => {
				const cg = rg.append('g').attr('transform', `translate(${ci * (colW + qW)},0)`)
				// the title and axis of the column, once, in the room above the first row
				if (i == 0) {
					cg.append('text').attr('y', -20).attr('font-size', 10).attr('font-weight', 'bold').text(c.title)
					axisstyle({
						axis: cg
							.append('g')
							.attr('transform', 'translate(0,-2)')
							.call(
								axisTop(c.x)
									.tickValues(c.ticks)
									.tickFormat((v: any) => c.format(v))
									.tickSize(3)
							),
						color: '#555',
						fontsize: 9
					})
				}
				drawShareViolins(cg.append('g').attr('transform', 'translate(0,3)'), {
					groups: usage.groups.map(gr => ({ color: groupColor(gr.name), values: c.values(k, gr.name) })),
					x: c.x,
					h: violinH
				})
				const q = c.q(k)
				if (q !== undefined && q !== null)
					cg.append('text')
						.attr('x', colW + 6)
						.attr('y', 3 + (usage.groups.length * (violinH + 2)) / 2)
						.attr('dominant-baseline', 'central')
						.attr('font-size', 10)
						.attr('font-weight', q < 0.05 ? 'bold' : 'normal')
						.text(`q ${qText(q)}`)
			})
		},
		onHover: (event, i) => {
			const k = ks[i]
			const g = byId.get(isoforms.ids[k])!
			tk.tip.clear()
			const table = table2col({ holder: tk.tip.d })
			table.addRow('Isoform', isoforms.ids[k])
			table.addRow('Start', `${data.region.chr}:${(g.strand == '-' ? g.stop : g.start) + 1} (${g.strand})`)
			for (const gr of usage.groups)
				table.addRow(`Mean share, ${gr.name}`, `${Math.round(gr.mean[k] * 100)}% of ${gr.n} samples`)
			const q = usage.q?.[k]
			if (q !== undefined && q !== null) table.addRow('q, share', qText(q))
			const j = junctions?.junction[k]
			if (junctions && j) {
				table.addRow('First junction', `${data.region.chr}:${j[0]}-${j[1]}`)
				const ref = data.junctions!.keys[data.junctions!.reference]
				usage.groups.forEach((gr, gi) => {
					const r = junctions.reads[k][gi]
					// the reads themselves: a ratio can fall because the body junction rises, as with an added transcript
					table.addRow(
						`Median reads, ${gr.name}`,
						`${r.first} first junction, ${r.reference} body junction (${data.region.chr}:${ref[0]}-${ref[1]})`
					)
				})
				const jq = junctions.q?.[k]
				if (jq !== undefined && jq !== null) table.addRow('q, junction', qText(jq))
			}
			tk.tip.show(event.clientX, event.clientY)
		},
		onOut: () => tk.tip.hide()
	}
}

/* the gene's expression split by this bin's methylation, in the summary violin */
function launchViolin(tk: any, chr: string, bin: MethylationLocusBin) {
	// with the sample types of the track, so that the violin has the samples of the heatmap
	const term2 = makeDNAMethRegionTerm({ chr, start: bin.start, stop: bin.stop }, tk.massApp.vocabApi, {
		sampleTypes: tk.sampleTypes,
		sampleTypeLabel: tk.sampleTypeLabel
	})
	tk.massApp.dispatch({
		type: 'plot_create',
		config: {
			chartType: 'summary',
			childType: 'violin',
			term: { q: { mode: 'continuous' }, term: { type: 'geneExpression', gene: tk.gene, name: tk.gene } },
			term2: { q: { mode: 'discrete' }, term: term2 },
			// the track's cohort: divided by its groups, which leaves out a sample in none, under the plot's own filter
			...(tk.groupTw ? { term0: structuredClone(tk.groupTw) } : {}),
			filter: tk.plotFilter
		}
	})
}

function rhoText(b: { rho?: number; q?: number }) {
	if (b.rho === undefined) return 'not tested'
	const q = b.q!
	// R reports a p-value below its floor (about 2e-16) as 0
	return `${round(b.rho)} (q ${q < 1e-16 ? '<1e-16' : q < 0.001 ? q.toExponential(1) : q.toFixed(3)})`
}

function round(v: number) {
	return Math.abs(v) >= 100 ? Math.round(v) : Number(v.toPrecision(3))
}

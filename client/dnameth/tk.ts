import { dofetch3 } from '#common/dofetch'
import { Menu, table2col, addGeneSearchbox } from '#dom'
import { interpolateRdBu, schemeTableau10 } from 'd3-scale-chromatic'
import { legend_newrow } from '#src/block.legend'
import { makeDNAMethRegionTerm } from '#tw/dnaMethylation'
import {
	renderLocusHeatmap,
	initLocusHeatmapRows,
	type LocusHeatmapStat,
	type LocusHeatmapAnnotation
} from '../src/block.locusHeatmap'
import { HYPER_COLOR, HYPO_COLOR } from '#shared/dmrColors.js'
import type { MethylationLocusBin, MethylationLocusResponse, MethylationLocusSample } from '#types'

/* Block track of per-sample CpG methylation in the view range: samples are rows, CpG bins are columns.

tk.dslabel   required
tk.gene      optional; with it, each bin is correlated with the gene's expression (the rho row, within groups),
             expression is a column of bars, and samples can be sorted by it. On a dataset with isoform expression,
             the makeup of the gene's expression by isoform is a column of bars in parts
tk.expression  'gene' (default) | 'isoform' | 'promoter', on a dataset with isoform expression: instead of the gene's
             expression, the usage of tk.isoform, or of its promoter (the transcripts that start near its start), as
             a share of the gene's transcript expression
tk.isoform   the isoform of the gene for 'isoform' and 'promoter'
tk.groupTw   optional samplelst tw: a column of group colors, mean beta per group, and with two groups their difference
tk.dmrFile   optional, with two groups: the bedj file, in the server's cache, of the DMRs that a genome-wide scan of
             those groups called (DmrScanSummary.bedjFile). A row marks the bins inside a DMR.
tk.sortBy    'expression' | 'group' | 'beta' (mean beta in view); default is the first one available
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
				...(tk.gene && tk.expression && tk.expression != 'gene'
					? { expression: tk.expression, isoform: tk.isoform }
					: {}),
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
				groupTw: tk.groupTw
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
	tk.tkconfigtip.clear().showunder(tk.config_handle.node())
	const div = tk.tkconfigtip.d.append('div').style('padding', '10px')
	const row1 = div.append('div').style('margin-bottom', '10px')
	row1.append('span').text('Gene for expression ')
	const setGene = (gene?: string) => {
		tk.gene = gene
		// a usage is of an isoform of the gene before
		delete tk.expression
		delete tk.isoform
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
	const data: LocusData | undefined = tk.data
	if (tk.gene && data?.expressedIsoforms?.length && data.isoforms) usageChoice(tk, block, div, data)
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
}

/* gene expression, or the usage of an isoform or of its promoter: the isoforms are listed by start, as the
promoter usage of isoforms that start together is the same */
function usageChoice(tk: any, block: any, div: any, data: LocusData) {
	const row = div.append('div').style('margin-bottom', '10px')
	const starts = new Map(data.isoforms!.map(g => [g.isoform, tssOf(g)]))
	const isoforms = [...data.expressedIsoforms!].sort((a, b) => starts.get(a)! - starts.get(b)!)
	const reload = () => {
		tk.tkconfigtip.hide()
		loadTk(tk, block)
	}
	row.append('span').text('Expression ')
	const by = row.append('select').on('change', (event: any) => {
		tk.expression = event.target.value
		if (tk.expression != 'gene' && !isoforms.includes(tk.isoform)) {
			// the default isoform when it has expression, else the first by start
			const d = data.isoforms!.find(g => g.isdefault && isoforms.includes(g.isoform))
			tk.isoform = d?.isoform || isoforms[0]
		}
		reload()
	})
	for (const [key, label] of [
		['gene', `${tk.gene} expression`],
		['isoform', 'isoform usage'],
		['promoter', 'promoter usage']
	])
		by.append('option')
			.attr('value', key)
			.property('selected', key == (tk.expression || 'gene'))
			.text(label)
	if (!tk.expression || tk.expression == 'gene') return
	row.append('span').text(' of ')
	const pick = row.append('select').on('change', (event: any) => {
		tk.isoform = event.target.value
		reload()
	})
	for (const id of isoforms)
		pick
			.append('option')
			.attr('value', id)
			.property('selected', id == tk.isoform)
			.text(`${id}, start ${data.region.chr}:${starts.get(id)! + 1}`)
}

// an isoform's transcription start, 0-based
const tssOf = (g: { strand: string; start: number; stop: number }) => (g.strand == '-' ? g.stop : g.start)

/* the name of what samples[].value is: the gene's expression, or a usage */
function valueLabel(tk: any, data: LocusData): string {
	const u = data.usage
	if (!u) return `${tk.gene} ${data.unit}`
	// short: it labels a narrow column; the legend says which isoform and which transcripts
	return u.by == 'isoform' ? 'Isoform usage' : 'Promoter usage'
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
	const exprLabel = valueLabel(tk, data)

	// rows are samples[] in the order of idx; everything else stays in the order of samples[]
	tk.sortOptions = [
		...(hasGene ? [{ key: 'expression', label: exprLabel }] : []),
		...(groups.length ? [{ key: 'group', label: 'Group' }] : []),
		{ key: 'beta', label: 'Mean β in view' }
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
	}

	/* Two rows. Mean β of each group, the gap between two groups shaded by direction as on the volcano and the DMR row:
	where the groups differ. Then ρ of methylation with the gene's expression, faded where q ≥ 0.05; with groups, within
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
	const xAt = (pos: number) => block.seekcoord(region.chr, Math.min(region.stop, Math.max(region.start, pos)))[0]?.x
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

	const annotations: LocusHeatmapAnnotation[] = []
	if (hasGene) {
		/* a usage as it is, a share from 0 to 1; an expression as log2(value+1), so that the many low values are not
		flattened to zero */
		const logv = idx.map(j => (data.usage ? samples[j].value! : Math.log2(samples[j].value! + 1)))
		const maxv = Math.max(...logv) || 1
		annotations.push({ label: exprLabel, colors: idx.map(() => '#555'), widths: logv.map(v => v / maxv) })
	}
	const isoforms = isoformParts(data)
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

	const nCpg = bins.reduce((n, b) => n + b.nCpg, 0)
	const canViolin = hasGene && tk.massApp
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
			tk.sortBy == 'group'
				? idx.flatMap((j, i) => (i && samples[j].group !== samples[idx[i - 1]].group ? [i] : []))
				: [],
		stats,
		annotations,
		intervals,
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
	renderLegend(tk, data, series, isoforms)
	return height
}

/* The makeup of the gene's expression by isoform: per sample, the share of the summed expression of the gene's
isoforms that each of the most expressed ones has, and the rest as one last part. undefined without isoform
expression, or with one isoform. A sample whose isoforms add up to nothing has no parts. */
export function isoformParts(data: {
	expressedIsoforms?: string[]
	samples: Pick<MethylationLocusSample, 'isoformValues'>[]
	unit?: string
	usage?: unknown
}): { labels: string[]; colors: string[]; shares: number[][]; unit: string } | undefined {
	const ids = data.expressedIsoforms || []
	if (ids.length < 2 || !data.samples.some(s => s.isoformValues)) return
	const total = ids.map((_, k) => data.samples.reduce((sum, s) => sum + (s.isoformValues?.[k] || 0), 0))
	// the most expressed over all samples first
	const top = ids
		.map((_, k) => k)
		.sort((a, b) => total[b] - total[a])
		.slice(0, maxIsoformParts)
		.filter(k => total[k] > 0)
	if (!top.length) return
	const hasOther = ids.length > top.length
	return {
		labels: [...top.map(k => ids[k]), ...(hasOther ? [`${ids.length - top.length} other isoforms`] : [])],
		colors: [...top.map((_, i) => schemeTableau10[i]), ...(hasOther ? [otherIsoformColor] : [])],
		shares: data.samples.map(s => {
			const v = s.isoformValues || []
			const sum = v.reduce((a, b) => a + b, 0)
			if (!sum) return []
			const mine = top.map(k => (v[k] || 0) / sum)
			return hasOther ? [...mine, Math.max(0, 1 - mine.reduce((a, b) => a + b, 0))] : mine
		}),
		// the unit of the isoforms' expression: the gene's, unless the track shows a usage in its place
		unit: data.usage || !data.unit ? 'expression' : data.unit
	}
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

function renderLegend(tk: any, data: LocusData, series: Series[], isoforms?: ReturnType<typeof isoformParts>) {
	if (!tk.legendTd) return
	tk.legendTd.selectAll('*').remove()
	const div = tk.legendTd.append('div').style('font-size', '.8em').style('padding', '5px')
	const item = (swatch: string, text: string) => {
		// a long item, such as a usage's description, wraps within its own box instead of running off the legend
		const s = div
			.append('span')
			.style('display', 'inline-block')
			.style('max-width', '420px')
			// the legend's cell does not wrap
			.style('white-space', 'normal')
			.style('vertical-align', 'top')
			.style('margin-right', '15px')
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
	const u = data.usage
	if (u) {
		const iso = data.isoforms?.find(g => g.isoform == u.isoform)
		const at = iso ? ` (start ${data.region.chr}:${tssOf(iso) + 1})` : ''
		item(
			'width:16px;height:6px;background:#555',
			u.by == 'isoform'
				? `${u.isoform}${at} usage: its share of the TPM of the ${u.ofTranscripts} transcripts of ${tk.gene}`
				: `${tk.gene} promoter usage: the share of the TPM of its ${u.ofTranscripts} transcripts from the ` +
						`${u.transcripts.length} that start within 300 bp of ${u.isoform}${at}`
		)
	} else if (data.gene) item('width:16px;height:6px;background:#555', `log2(${data.unit}+1)`)
	if (data.gene && data.groups?.length)
		item('', "ρ within groups: each group's ρ, pooled, so that a difference between the groups does not make one")
	if (isoforms) {
		const starts = new Map((data.isoforms || []).map(g => [g.isoform, tssOf(g)]))
		item('', `share of the ${isoforms.unit} of the isoforms of ${tk.gene}:`)
		isoforms.labels.forEach((label, k) => {
			const start = starts.get(label)
			item(
				`width:12px;height:12px;background:${isoforms.colors[k]}`,
				// with its start, as isoforms that start apart can differ in the methylation there
				`${label}${start === undefined ? '' : ` (start ${data.region.chr}:${start + 1})`}`
			)
		})
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

import { dofetch3 } from '#common/dofetch'
import { Menu, table2col, addGeneSearchbox } from '#dom'
import { interpolateRdBu } from 'd3-scale-chromatic'
import { legend_newrow } from '#src/block.legend'
import { makeDNAMethRegionTerm } from '#tw/dnaMethylation'
import { renderLocusHeatmap, type LocusHeatmapStat } from '../src/block.locusHeatmap'
import { HYPER_COLOR, HYPO_COLOR } from '#shared/dmrColors.js'
import type { MethylationLocusBin, MethylationLocusResponse } from '#types'

/* Block track of per-sample CpG methylation in the view range: samples are rows, CpG bins are columns.

tk.dslabel   required
tk.gene      optional; with it, each bin is correlated with the gene's expression (rho and -log10 q rows),
             expression is a column of bars, and samples can be sorted by it
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
the file, or with a file that is gone from the cache, there is no DMR row. */
async function loadDmrs(tk: any, block: any, data: LocusData): Promise<Dmr[]> {
	if (!tk.dmrFile || data.groups?.length != 2) return []
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
		return []
	}
}

function init(tk: any, block: any) {
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

	const stats: LocusHeatmapStat[] = []
	if (hasGene) {
		// to the largest |rho| in view, pooled or within a group, in steps of 0.25, so that a locus of weak correlations still shows them
		const rhos = bins.flatMap(b => [b.rho, ...(b.byGroup || []).map(g => g.rho)])
		const top = Math.max(0.25, Math.ceil(Math.max(...rhos.map(r => Math.abs(r ?? 0))) * 4) / 4)
		stats.push({
			label: `ρ with ${unit}`,
			domain: [-top, top],
			// one neutral color, so that blue and red mean beta only; faded when not significant
			bars: bins.map(b => (b.rho === undefined ? null : { v: b.rho, color: '#333', opacity: b.q! < 0.05 ? 0.85 : 0.3 }))
		})
		/* rho within each group, in a row of its own under the bars and on their scale: dots near 0 under a long
		bar mean the bar comes from the difference between the groups */
		if (groups.length)
			stats.push({
				label: 'ρ within a group',
				domain: [-top, top],
				dots: bins.flatMap((b, col) =>
					(b.byGroup || []).flatMap(g =>
						g.rho === undefined ? [] : [{ col, v: g.rho, color: groupColor(g.group), filled: g.q! < 0.05 }]
					)
				)
			})
	}
	if (hasGene) {
		// R reports a p-value below its floor as 0
		const v = bins.map(b => (b.q === undefined ? null : -Math.log10(Math.max(b.q, 1e-16))))
		stats.push({
			label: '-log10(q) of ρ',
			domain: [0, Math.max(2, Math.ceil(Math.max(...v.map(x => x ?? 0))))],
			bars: v.map(x => (x === null ? null : { v: x, color: '#555' }))
		})
	}
	stats.push({
		label: 'Mean β',
		domain: [0, 1],
		lines: series.map(s => ({ color: s.color, values: bins.map(b => seriesMean(b, s)) }))
	})
	if (twoGroups)
		stats.push({
			label: 'Δβ',
			domain: [-0.5, 0.5],
			bars: bins.map(b => {
				const d = diff(b, series)
				return d === null ? null : { v: d, color: betaColor(d > 0 ? 0.85 : 0.15) }
			})
		})
	// the DMR that each bin is in: of several, the one with the largest difference
	const dmrs: Dmr[] = twoGroups ? tk.dmrs || [] : []
	const dmrOf = bins.map(
		b =>
			dmrs.filter(d => d.start <= b.stop && d.stop >= b.start).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))[0]
	)
	if (tk.dmrFile && twoGroups)
		stats.push({
			label: 'DMR Δβ',
			domain: [-0.5, 0.5],
			bars: dmrOf.map(d => (d ? { v: d.delta, color: d.hyper ? HYPER_COLOR : HYPO_COLOR } : null))
		})

	const annotations: { label: string; colors: string[]; widths?: number[] }[] = []
	if (hasGene) {
		// log2(value+1), so that the many low values are not flattened to zero
		const logv = idx.map(j => Math.log2(samples[j].value! + 1))
		const maxv = Math.max(...logv) || 1
		annotations.push({ label: exprLabel, colors: idx.map(() => '#555'), widths: logv.map(v => v / maxv) })
	}
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
			}
			table.addRow(b.nCpg == 1 ? 'CpG' : 'Bin', `${region.chr}:${b.start}${b.nCpg == 1 ? '' : '-' + b.stop}`)
			if (b.nCpg > 1) table.addRow('CpGs', b.nCpg)
			if (row >= 0) table.addRow('β', b.beta[idx[row]] === null ? 'too few reads' : round(b.beta[idx[row]]!))
			if (hasGene) table.addRow('Spearman ρ', rhoText(b))
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
	renderLegend(tk, data, series)
	return height
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

function renderLegend(tk: any, data: LocusData, series: Series[]) {
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
	if (data.groups?.length == 2) item('', `Δβ = ${data.groups[1]} minus ${data.groups[0]}`)
	if (tk.dmrFile && data.groups?.length == 2) {
		item(`width:12px;height:12px;background:${HYPER_COLOR}`, 'bin in a hypermethylated DMR of the scan')
		item(`width:12px;height:12px;background:${HYPO_COLOR}`, 'in a hypomethylated DMR')
	}
	if (data.gene) item('width:12px;height:12px;background:#333;opacity:.3', 'ρ faded if q ≥ 0.05')
	if (data.gene) item('width:16px;height:6px;background:#555', `log2(${data.unit}+1)`)
	if (data.gene && data.groups?.length)
		item('width:7px;height:7px;background:#555;border-radius:50%', 'ρ within a group (faded if q ≥ 0.05)')
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

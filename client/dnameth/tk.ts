import { dofetch3 } from '#common/dofetch'
import { Menu, table2col, addGeneSearchbox } from '#dom'
import { interpolateRdBu } from 'd3-scale-chromatic'
import { legend_newrow } from '#src/block.legend'
import { makeDNAMethRegionTerm } from '#tw/dnaMethylation'
import { renderLocusHeatmap, type LocusHeatmapStat } from '../src/block.locusHeatmap'
import type { MethylationLocusBin, MethylationLocusResponse } from '#types'

/* Block track of per-sample CpG methylation in the view range: samples are rows, CpG bins are columns.

tk.dslabel   required
tk.gene      optional; with it, each bin is correlated with the gene's expression (rho and -log10 q rows),
             expression is a column of bars, and samples can be sorted by it
tk.groupTw   optional samplelst tw: a column of group colors, mean beta per group, and with two groups their difference
tk.sortBy    'expression' | 'group' | 'beta' (mean beta in view); default is the first one available
tk.minColWidth   px, default 8: the view is cut into as many bins of equal CpG count as fit at this width, so the
             bins shrink on zooming in, down to one CpG per column
tk.filter, tk.filter0
tk.massApp   optional; with it and a gene, a click on a bin opens a violin of expression by the bin's methylation

Rows above the heatmap follow the gene locus view after MEXPRESS (Koch et al. 2015, BMC Genomics), turned
so that the genome is horizontal. Data is from termdb/methylationLocus. */

type LocusData = Extract<MethylationLocusResponse, { bins: any }>
/** a line of the mean beta row: a group, or a third of the samples by expression */
type Series = { label: string; color: string; pick: (j: number) => boolean }

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
				groupTw: tk.groupTw
			}
		})
		if (loadId != tk.loadId) return
		if ('error' in data) throw new Error(data.error)
		if (!data.bins.length) throw new Error('No CpG in view range')
		tk.data = data
		height = render(tk, block)
	} catch (e: any) {
		if (loadId != tk.loadId) return
		error = e.message || e
		renderLocusHeatmap(tk, block, { rows: [], cols: [], color: betaColor, missingColor })
	}
	tk.height_main = tk.toppad + height + tk.bottompad
	block.tkcloakoff(tk, { error })
	block.block_setheight()
	block.setllabel()
	// lets the host keep tk.gene and tk.sortBy, e.g. the genome browser plot in its state
	tk.callbackOnRender?.(tk, block)
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
		render(tk, block)
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
		// to the largest |rho| in view, in steps of 0.25, so that a locus of weak correlations still shows them
		const top = Math.max(0.25, Math.ceil(Math.max(...bins.map(b => Math.abs(b.rho ?? 0))) * 4) / 4)
		stats.push({
			label: `ρ with ${unit}`,
			domain: [-top, top],
			// one neutral color, so that blue and red mean beta only; faded when not significant
			bars: bins.map(b =>
				b.rho === undefined ? null : { v: b.rho, color: '#333', opacity: b.q! < 0.05 ? 0.85 : 0.3 }
			),
			/* rho within each group over the bar of all samples: a dot near 0 on a long bar means the bar
			comes from the difference between the groups */
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
		stats,
		annotations,
		note: [
			`${samples.length} samples`,
			nCpg == bins.length ? `${nCpg} CpGs` : `${bins.length} bins of ~${Math.round(nCpg / bins.length)} CpGs`
		],
		onHover: (event, col, row) => {
			const b = bins[col]
			// the block's cursor bar on the genomic span of the bin
			const x0 = block.seekcoord(region.chr, b.start)[0]?.x,
				x1 = block.seekcoord(region.chr, b.stop)[0]?.x
			if (x0 !== undefined && x1 !== undefined)
				block.cursorhlbar
					.attr('x', block.leftheadw + block.lpad + Math.min(x0, x1))
					.attr('width', Math.max(2, Math.abs(x1 - x0) + block.exonsf))
					.attr('height', block.totalheight())
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
			if (canViolin) table.addRow('', 'Click for a violin plot')
			tk.tip.show(event.clientX, event.clientY)
		},
		onOut: () => {
			tk.tip.hide()
			block.cursorhlbar.attr('width', 0)
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
	if (data.gene) item('width:12px;height:12px;background:#333;opacity:.3', 'ρ faded if q ≥ 0.05')
	if (data.gene) item('width:16px;height:6px;background:#555', `log2(${data.unit}+1)`)
	if (data.gene && data.groups?.length)
		item('width:7px;height:7px;border:1px solid #555;border-radius:50%', 'ρ within a group (filled if q < 0.05)')
}

/* the gene's expression split by this bin's methylation, in the summary violin */
function launchViolin(tk: any, chr: string, bin: MethylationLocusBin) {
	const term2 = makeDNAMethRegionTerm({ chr, start: bin.start, stop: bin.stop }, tk.massApp.vocabApi, {})
	tk.massApp.dispatch({
		type: 'plot_create',
		config: {
			chartType: 'summary',
			childType: 'violin',
			term: { q: { mode: 'continuous' }, term: { type: 'geneExpression', gene: tk.gene, name: tk.gene } },
			term2: { q: { mode: 'discrete' }, term: term2 }
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

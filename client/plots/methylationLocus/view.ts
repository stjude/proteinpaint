import { pointer, select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { interpolateRdBu } from 'd3-scale-chromatic'
import { table2col } from '#dom/table2col'
import { sketchGene } from '../../dom/sketchGm'
import { exoncolor } from '#shared/common.js'
import type { MethylationLocusBin, MethylationLocusResponse } from '#types'

/* Gene locus view, after MEXPRESS (Koch et al. 2015, BMC Genomics): samples are columns sorted by
expression, CpG bins along the gene are rows, the gene is drawn vertically on the left with a line
from each row to its genomic span, and each row's correlation with expression is on the right.

Beta uses the usual methylation heatmap colors, blue (unmethylated) to white to red (methylated). The
rho bars are one neutral color, with the sign given by the side of zero, so blue and red mean beta only. */

export type LocusData = Extract<MethylationLocusResponse, { bins: any }>

export const colors = {
	beta: (b: number) => interpolateRdBu(1 - b),
	missing: '#bbb',
	rho: '#333'
}

const layout = {
	geneW: 150,
	rowH: 12,
	exprH: 40,
	groupH: 10,
	gap: 6,
	rhoW: 120,
	qW: 60,
	profW: 110,
	diffW: 80,
	colGap: 15,
	top: 30
}

/** a line of the profile column: a group, or a third of the samples by expression */
type Series = { label: string; color: string; pick: (j: number) => boolean }

export function drawLocus(
	holder: any,
	data: LocusData,
	tip: any,
	groupColor: (group: string) => string,
	onRowClick: (bin: MethylationLocusBin) => void
) {
	const { gene, samples, bins } = data
	// 5' at the top: on the minus strand the last bin holds the TSS
	const rows = gene.strand == '-' ? [...bins].reverse() : bins
	const hasGroup = samples.some(s => s.group !== undefined)
	const cw = Math.max(1, Math.min(8, Math.floor(900 / samples.length)))
	const heatW = cw * samples.length
	const x0 = layout.geneW
	const yExpr = layout.top + (hasGroup ? layout.groupH + layout.gap : 0)
	const y0 = yExpr + layout.exprH + layout.gap
	const heatH = rows.length * layout.rowH
	const series = getSeries(data, groupColor)
	// with two groups, their difference: the second minus the first, as in the volcano
	const twoGroups = data.groups?.length == 2
	const xProf = x0 + heatW + layout.colGap
	const xDiff = xProf + layout.profW + layout.colGap
	const xRho = twoGroups ? xDiff + layout.diffW + layout.colGap : xDiff
	// at least as wide as the legend, which does not shrink with the sample count
	const width = Math.max(xRho + layout.rhoW + layout.qW, x0 + 700)
	const height = y0 + heatH + 82

	const svg = holder.append('svg').attr('width', width).attr('height', height).style('font-family', 'Arial')

	svg
		.append('text')
		.attr('x', 0)
		.attr('y', 14)
		.attr('font-size', 14)
		.attr('font-weight', 'bold')
		.text(
			`${data.region.chr}:${data.region.start + 1}-${data.region.stop} · ` +
				`${samples.length} samples sorted by ${data.unit} · ${bins.length} CpG bins`
		)

	// group strip
	if (hasGroup) {
		const g = svg.append('g').attr('data-testid', 'sjpp-methylationLocus-group')
		g.selectAll('rect')
			.data(samples)
			.enter()
			.append('rect')
			.attr('x', (_, i) => x0 + i * cw)
			.attr('y', layout.top)
			.attr('width', cw)
			.attr('height', layout.groupH)
			.attr('fill', s => (s.group === undefined ? 'none' : groupColor(s.group)))
		label(svg, x0 - 6, layout.top + layout.groupH / 2, 'Group')
	}

	// expression bars, on log2(value+1) so that the many low values are not flattened to zero
	const logv = samples.map(s => Math.log2(s.value + 1))
	const ey = scaleLinear()
		.domain([0, Math.max(...logv) || 1])
		.range([0, layout.exprH])
	svg
		.append('g')
		.attr('data-testid', 'sjpp-methylationLocus-expression')
		.selectAll('rect')
		.data(logv)
		.enter()
		.append('rect')
		.attr('x', (_, i) => x0 + i * cw)
		.attr('y', v => yExpr + layout.exprH - ey(v))
		.attr('width', cw)
		.attr('height', v => ey(v))
		.attr('fill', '#555')
	label(svg, x0 - 6, yExpr + layout.exprH / 2, `log2(${data.unit}+1)`)

	// heatmap
	const cells: { bin: MethylationLocusBin; row: number; col: number }[] = []
	rows.forEach((bin, row) => bin.beta.forEach((_, col) => cells.push({ bin, row, col })))
	svg
		.append('g')
		.attr('data-testid', 'sjpp-methylationLocus-heatmap')
		.selectAll('rect')
		.data(cells)
		.enter()
		.append('rect')
		.attr('x', c => x0 + c.col * cw)
		.attr('y', c => y0 + c.row * layout.rowH)
		.attr('width', cw)
		.attr('height', layout.rowH)
		.attr('fill', c => {
			const b = c.bin.beta[c.col]
			return b === null ? colors.missing : colors.beta(b)
		})

	drawGene(svg, data, rows, y0)
	drawProfile(svg, rows, series, xProf, y0)
	if (twoGroups) drawDiff(svg, rows, series, xDiff, y0)

	// rho bars and q
	const rx = scaleLinear()
		.domain([-1, 1])
		.range([xRho, xRho + layout.rhoW])
	const rg = svg.append('g').attr('data-testid', 'sjpp-methylationLocus-rho')
	rg.append('line')
		.attr('x1', rx(0))
		.attr('x2', rx(0))
		.attr('y1', y0)
		.attr('y2', y0 + heatH)
		.attr('stroke', '#999')
	rows.forEach((bin, row) => {
		const y = y0 + row * layout.rowH
		if (bin.rho !== undefined) {
			const rho = bin.rho
			rg.append('rect')
				.attr('x', Math.min(rx(0), rx(rho)))
				.attr('y', y + 2)
				.attr('width', Math.abs(rx(rho) - rx(0)))
				.attr('height', layout.rowH - 4)
				.attr('fill', colors.rho)
				.attr('fill-opacity', bin.q! < 0.05 ? 0.85 : 0.3)
			rg.append('text')
				.attr('x', xRho + layout.rhoW + 6)
				.attr('y', y + layout.rowH / 2)
				.attr('dominant-baseline', 'central')
				.attr('font-size', 10)
				.text(fmtQ(bin.q!))
		}
		// rho within each group, over the bar of all samples: a dot near 0 under a long bar means the bar
		// comes from the difference between the groups
		for (const g of bin.byGroup || []) {
			if (g.rho === undefined) continue
			rg.append('circle')
				.attr('class', 'sjpp-methylationLocus-groupRho')
				.attr('cx', rx(g.rho))
				.attr('cy', y + layout.rowH / 2)
				.attr('r', 3.5)
				.attr('fill', g.q! < 0.05 ? groupColor(g.group) : 'white')
				.attr('stroke', groupColor(g.group))
		}
	})
	svg
		.append('text')
		.attr('x', rx(0))
		.attr('y', y0 - 4)
		.attr('text-anchor', 'middle')
		.attr('font-size', 11)
		.text('Spearman ρ')
	svg
		.append('text')
		.attr('x', xRho + layout.rhoW + 6)
		.attr('y', y0 - 4)
		.attr('font-size', 11)
		.text('q')
	axisLabels(svg, rx, [-1, 0, 1], y0 + heatH + 12)

	drawLegend(svg, x0, y0 + heatH + 30)
	drawSeriesLegend(svg, x0, y0 + heatH + 54, series, data)

	// one hit layer over the strips and heatmap: hover reads the column and row under the pointer,
	// so ~14,000 cells need no listeners of their own
	const hit = svg
		.append('rect')
		.attr('data-testid', 'sjpp-methylationLocus-hit')
		.attr('x', x0)
		.attr('y', layout.top)
		.attr('width', xRho + layout.rhoW - x0)
		.attr('height', y0 + heatH - layout.top)
		.attr('fill', 'transparent')
	const at = (event: any) => {
		const [mx, my] = pointer(event, svg.node())
		const col = mx < x0 + heatW ? Math.floor((mx - x0) / cw) : -1
		const row = my >= y0 ? Math.floor((my - y0) / layout.rowH) : -1
		return { col, row: row < rows.length ? row : -1 }
	}
	hit
		.on('mousemove', (event: any) => {
			const { col, row } = at(event)
			tip.clear()
			const table = table2col({ holder: tip.d })
			if (col >= 0) {
				const s = samples[col]
				table.addRow('Sample', s.name)
				table.addRow(data.unit, round(s.value))
				if (s.group !== undefined) table.addRow('Group', s.group)
			}
			if (row >= 0) {
				const b = rows[row]
				table.addRow('Bin', `${gene.chr}:${b.start}-${b.stop}`)
				table.addRow('CpGs', b.nCpg)
				if (col >= 0) table.addRow('β', b.beta[col] === null ? 'no data' : round(b.beta[col]!))
				table.addRow('Spearman ρ', b.rho === undefined ? 'not tested' : `${round(b.rho)} (q ${fmtQ(b.q!)})`)
				for (const g of b.byGroup || [])
					table.addRow(`ρ in ${g.group}`, g.rho === undefined ? 'not tested' : `${round(g.rho)} (q ${fmtQ(g.q!)})`)
				for (const sr of series) {
					const m = seriesMean(b, sr)
					table.addRow(`Mean β, ${sr.label}`, m === null ? 'no data' : round(m))
				}
				if (twoGroups) {
					const d = diff(b, series)
					table.addRow('Δβ', d === null ? 'no data' : round(d))
				}
				if (col < 0) table.addRow('', 'Click for a violin plot')
			}
			if (col < 0 && row < 0) return tip.hide()
			tip.show(event.clientX, event.clientY)
		})
		.on('mouseout', () => tip.hide())
		.on('click', (event: any) => {
			const { row } = at(event)
			if (row < 0) return
			tip.hide()
			onRowClick(rows[row])
		})
	return svg
}

/* the gene drawn top to bottom from 5' to 3' over the rows' height, as the gene browser sketches it
(sketchGene: coding exons full height, UTRs thinner, strand marks on introns), with a line from each
bin's genomic span to its row */
function drawGene(svg: any, data: LocusData, rows: MethylationLocusBin[], y0: number) {
	const { gene, region } = data
	const heatH = rows.length * layout.rowH
	const minus = gene.strand == '-'
	const gy = scaleLinear()
		.domain(minus ? [region.stop, region.start] : [region.start, region.stop])
		.range([y0, y0 + heatH])
	const gx = 70,
		w = 14 // thickness of the sketch
	const g = svg.append('g').attr('data-testid', 'sjpp-methylationLocus-gene')
	/* sketchGene draws left to right on a canvas, reversed on the minus strand so that 5' is on the left
	either way. Its strand marks follow the strand on a forward scale, so the sketch is given '+': as
	drawn, transcription runs left to right for both strands. The canvas goes into the svg as an image,
	so that the download keeps it, turned so that its left end is at the top. */
	const canvasHolder = select(document.createElement('div'))
	sketchGene(canvasHolder, { ...gene, strand: '+' }, heatH, w, region.start, region.stop, exoncolor, false, minus)
	const canvas = canvasHolder.select('canvas').node() as HTMLCanvasElement
	g.append('image')
		.attr('class', 'sjpp-methylationLocus-sketch')
		.attr('href', canvas.toDataURL())
		.attr('width', heatH)
		.attr('height', w)
		.attr('transform', `translate(${gx + w / 2},${y0}) rotate(90)`)
	const tss = minus ? gene.stop : gene.start
	// the other isoforms' TSSs inside the locus, to show which rows cover an alternative promoter
	const altTss = new Set<number>()
	for (const i of data.isoforms || []) {
		const t = i.strand == '-' ? i.stop : i.start
		if (t != tss && t >= region.start && t <= region.stop) altTss.add(t)
	}
	for (const t of altTss)
		g.append('line')
			.attr('class', 'sjpp-methylationLocus-altTss')
			.attr('x1', gx - w / 2 - 7)
			.attr('x2', gx - w / 2 - 1)
			.attr('y1', gy(t))
			.attr('y2', gy(t))
			.attr('stroke', '#888')
	g.append('text')
		.attr('x', gx - w / 2 - 9)
		.attr('y', gy(tss))
		.attr('text-anchor', 'end')
		.attr('dominant-baseline', 'central')
		.attr('font-size', 10)
		.text('TSS')
	g.append('text')
		.attr('x', gx)
		.attr('y', y0 - 4)
		.attr('text-anchor', 'middle')
		.attr('font-size', 11)
		.text(gene.isoform)
	const fan = g.append('g').attr('stroke', '#999').attr('stroke-width', 0.5).attr('fill', 'none')
	rows.forEach((b, row) => {
		const yRow = y0 + row * layout.rowH + layout.rowH / 2
		fan
			.append('path')
			.attr('class', 'sjpp-methylationLocus-fan')
			.attr('d', `M${gx + w / 2 + 2},${gy((b.start + b.stop) / 2)} L${layout.geneW - 4},${yRow}`)
	})
}

/* the lines of the profile: the groups when there are any, else thirds of the samples by expression */
function getSeries(data: LocusData, groupColor: (group: string) => string): Series[] {
	const { samples, groups, unit } = data
	if (groups?.length) return groups.map(g => ({ label: g, color: groupColor(g), pick: j => samples[j].group === g }))
	// samples are in ascending order of expression
	const n = samples.length
	return [
		{ label: `low ${unit}`, color: '#bbb', from: 0, to: n / 3 },
		{ label: `mid ${unit}`, color: '#777', from: n / 3, to: (2 * n) / 3 },
		{ label: `high ${unit}`, color: '#000', from: (2 * n) / 3, to: n }
	].map(t => ({ label: t.label, color: t.color, pick: (j: number) => j >= t.from && j < t.to }))
}

function seriesMean(bin: MethylationLocusBin, s: Series): number | null {
	let sum = 0,
		n = 0
	bin.beta.forEach((v, j) => {
		if (v === null || !s.pick(j)) return
		sum += v
		n++
	})
	return n ? sum / n : null
}

// the second series' mean beta minus the first's
function diff(bin: MethylationLocusBin, series: Series[]): number | null {
	const a = seriesMean(bin, series[0]),
		b = seriesMean(bin, series[1])
	return a === null || b === null ? null : b - a
}

/* mean beta of each series along the gene, on the rows of the heatmap: lines that cross mark bins
where the order of the series flips, while parallel lines are a shift of the whole locus */
function drawProfile(svg: any, rows: MethylationLocusBin[], series: Series[], x: number, y0: number) {
	const heatH = rows.length * layout.rowH
	const px = scaleLinear()
		.domain([0, 1])
		.range([x, x + layout.profW])
	const g = svg.append('g').attr('data-testid', 'sjpp-methylationLocus-profile')
	for (const v of [0, 0.5, 1])
		g.append('line')
			.attr('x1', px(v))
			.attr('x2', px(v))
			.attr('y1', y0)
			.attr('y2', y0 + heatH)
			.attr('stroke', '#e5e5e5')
	axisLabels(svg, px, [0, 0.5, 1], y0 + heatH + 12)
	header(svg, px(0.5), y0 - 4, 'mean β')
	for (const s of series) {
		const pts: [number, number][] = []
		rows.forEach((b, row) => {
			const m = seriesMean(b, s)
			if (m !== null) pts.push([px(m), y0 + row * layout.rowH + layout.rowH / 2])
		})
		g.append('path')
			.attr('class', 'sjpp-methylationLocus-profileLine')
			.attr('d', pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(''))
			.attr('fill', 'none')
			.attr('stroke', s.color)
			.attr('stroke-width', 2)
	}
}

/* the difference between two groups in each bin, blue where the second group is less methylated and
red where it is more, as on the beta scale */
function drawDiff(svg: any, rows: MethylationLocusBin[], series: Series[], x: number, y0: number) {
	const heatH = rows.length * layout.rowH
	const dx = scaleLinear()
		.domain([-0.5, 0.5])
		.range([x, x + layout.diffW])
		.clamp(true)
	const g = svg.append('g').attr('data-testid', 'sjpp-methylationLocus-diff')
	g.append('line')
		.attr('x1', dx(0))
		.attr('x2', dx(0))
		.attr('y1', y0)
		.attr('y2', y0 + heatH)
		.attr('stroke', '#999')
	rows.forEach((b, row) => {
		const d = diff(b, series)
		if (d === null) return
		g.append('rect')
			.attr('x', Math.min(dx(0), dx(d)))
			.attr('y', y0 + row * layout.rowH + 2)
			.attr('width', Math.abs(dx(d) - dx(0)))
			.attr('height', layout.rowH - 4)
			.attr('fill', colors.beta(d > 0 ? 0.85 : 0.15))
	})
	axisLabels(svg, dx, [-0.5, 0, 0.5], y0 + heatH + 12)
	header(svg, dx(0), y0 - 4, 'Δβ')
}

function drawSeriesLegend(svg: any, x: number, y: number, series: Series[], data: LocusData) {
	const g = svg.append('g').attr('font-size', 11)
	let cx = x
	const text = (t: string) => {
		g.append('text').attr('x', cx).attr('y', y).attr('dominant-baseline', 'central').text(t)
		cx += t.length * 6 + 14
	}
	text('Mean β:')
	for (const s of series) {
		g.append('line')
			.attr('x1', cx)
			.attr('x2', cx + 16)
			.attr('y1', y)
			.attr('y2', y)
			.attr('stroke', s.color)
			.attr('stroke-width', 2)
		cx += 20
		text(s.label)
	}
	if (data.groups?.length == 2) text(`Δβ = ${data.groups[1]} minus ${data.groups[0]}`)
	if (data.groups?.length) {
		g.append('circle')
			.attr('cx', cx + 4)
			.attr('cy', y)
			.attr('r', 3.5)
			.attr('fill', 'white')
			.attr('stroke', '#555')
		cx += 12
		text('ρ within a group (filled if q < 0.05)')
	}
}

/* labels under a column, the end ones anchored inward so that neighboring columns do not run together */
function axisLabels(svg: any, scale: (v: number) => number, values: number[], y: number) {
	values.forEach((v, i) =>
		svg
			.append('text')
			.attr('x', scale(v))
			.attr('y', y)
			.attr('text-anchor', i == 0 ? 'start' : i == values.length - 1 ? 'end' : 'middle')
			.attr('font-size', 10)
			.text(v)
	)
}

function header(svg: any, x: number, y: number, text: string) {
	svg.append('text').attr('x', x).attr('y', y).attr('text-anchor', 'middle').attr('font-size', 11).text(text)
}

function drawLegend(svg: any, x: number, y: number) {
	const g = svg.append('g').attr('font-size', 11)
	g.append('text').attr('x', x).attr('y', y).attr('dominant-baseline', 'central').text('β')
	for (let i = 0; i <= 20; i++)
		g.append('rect')
			.attr('x', x + 14 + i * 5)
			.attr('y', y - 6)
			.attr('width', 5)
			.attr('height', 12)
			.attr('fill', colors.beta(i / 20))
	g.append('text')
		.attr('x', x + 14)
		.attr('y', y + 18)
		.attr('text-anchor', 'middle')
		.text('0')
	g.append('text')
		.attr('x', x + 14 + 105)
		.attr('y', y + 18)
		.attr('text-anchor', 'middle')
		.text('1')
	g.append('rect')
		.attr('x', x + 140)
		.attr('y', y - 6)
		.attr('width', 12)
		.attr('height', 12)
		.attr('fill', colors.missing)
	g.append('text')
		.attr('x', x + 156)
		.attr('y', y)
		.attr('dominant-baseline', 'central')
		.text('too few reads')
	const x2 = x + 260
	g.append('rect')
		.attr('x', x2)
		.attr('y', y - 6)
		.attr('width', 12)
		.attr('height', 12)
		.attr('fill', colors.rho)
	g.append('text')
		.attr('x', x2 + 16)
		.attr('y', y)
		.attr('dominant-baseline', 'central')
		.text('ρ: left of 0 negative; faded if q ≥ 0.05')
	g.append('line')
		.attr('x1', x2 + 290)
		.attr('x2', x2 + 298)
		.attr('y1', y)
		.attr('y2', y)
		.attr('stroke', '#888')
	g.append('text')
		.attr('x', x2 + 302)
		.attr('y', y)
		.attr('dominant-baseline', 'central')
		.text("other isoforms' TSS")
}

function label(svg: any, x: number, y: number, text: string) {
	svg
		.append('text')
		.attr('x', x)
		.attr('y', y)
		.attr('text-anchor', 'end')
		.attr('dominant-baseline', 'central')
		.attr('font-size', 11)
		.text(text)
}

function round(v: number) {
	return Math.abs(v) >= 100 ? Math.round(v) : Number(v.toPrecision(3))
}

function fmtQ(q: number) {
	return q < 0.001 ? q.toExponential(1) : q.toFixed(3)
}

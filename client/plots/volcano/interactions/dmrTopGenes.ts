import { dofetch3 } from '#common/dofetch'
import { sayerror } from '#dom'
import { bplen, mclass, mclasscnvgain, mclasscnvloss } from '#shared/common.js'
import type { DmrScanSummary } from '#types'
import { HYPER_COLOR, HYPO_COLOR } from '../../dmr/settings/defaults'
import { getGroupColors } from '../colors'
import { getDefaultVolcanoSettings } from '../settings/defaults'

/* The genes whose expression moved most each way on the patients with both methylation and RNA, each
drawn with the scan's DMRs over its promoter and body and its copy-number rate per group. The
promoter window is drawn to scale and the body stretched to one width, so every gene reads
promoter-first at the same length: a DMR's place in the body is a fraction of the gene, not a
distance. Server side is termdb/dmrTopGenes. */

const PROMOTER_W = 60
const BODY_W = 300
const ROW_H = 24
const CNV_W = 60
const X = {
	gene: 0,
	fc: 95,
	p: 150,
	sketch: 215,
	len: 215 + PROMOTER_W + BODY_W + 6,
	cnv: 215 + PROMOTER_W + BODY_W + 55
}

/** x of a position given as bp from the TSS: TSS ± pad to scale, then the rest of the body to BODY_W */
export function sketchX(bp: number, length: number, pad: number): number {
	if (bp <= pad) return ((Math.max(bp, -pad) + pad) / (2 * pad)) * PROMOTER_W
	return PROMOTER_W + (length > pad ? ((Math.min(bp, length) - pad) / (length - pad)) * BODY_W : 0)
}

export async function dmrTopGenesPanel(
	tip: any,
	config: any,
	vocab: { genome: string; dslabel: string },
	scan: DmrScanSummary,
	app: any
) {
	const div = tip.d.append('div').style('padding', '10px')
	const wait = div
		.append('div')
		.style('color', '#777')
		.text('Running differential expression on the samples with methylation…')
	// the same DE the volcano and the gene-link panel run, so all share one cached result
	const de = getDefaultVolcanoSettings({}, { termType: 'geneExpression' }) as any
	const state = app.getState()
	const samplelst = scan.matchedSamplelst || config.samplelst
	const res: any = await dofetch3('termdb/dmrTopGenes', {
		body: {
			genome: vocab.genome,
			dslabel: vocab.dslabel,
			cacheId: scan.cacheId,
			minCpgs: scan.minCpgs,
			samplelst: { groups: samplelst.groups.map((g: any) => ({ name: g.name, in: g.in, values: g.values })) },
			method: de.method,
			min_count: de.minCount,
			min_total_count: de.minTotalCount,
			cpm_cutoff: de.cpmCutoff,
			filter: state.termfilter?.filter,
			filter0: state.termfilter?.filter0
		}
	}).catch((e: any) => ({ error: e?.message || String(e) }))
	wait.remove()
	if (res.error) return sayerror(div.append('div'), res.error)

	const [control, caseName] = samplelst.groups.map((g: any) => g.name)
	const colors = getGroupColors(config)
	const [n1, n2] = res.sampleSizes
	div
		.append('div')
		.style('font-weight', 'bold')
		.text(
			`Largest expression changes, ${caseName} vs ${control}, on the ${(
				n1 + n2
			).toLocaleString()} samples with both methylation and RNA`
		)
	div
		.append('div')
		.style('color', '#777')
		.style('font-size', '.92em')
		.style('max-width', '760px')
		.style('padding', '2px 0 6px')
		.text(
			`${n1} ${control} and ${n2} ${caseName} (${res.deMethod}). ${res.nSignificant.toLocaleString()} genes reach ` +
				`adjusted p < 0.05; shown are those with the largest log₂ fold change each way. DMRs are this scan's, ` +
				`${scan.minCpgs}+ CpGs` +
				(res.backgroundCorrection
					? `, only those beating matched background (p < 0.05), coloured by their excess Δβ as in the volcano. `
					: '. ') +
				(res.cnvCutoff
					? `CNV: share of each group's CNV-assayed samples with a segment mean ≥ +${res.cnvCutoff} (gain) or ≤ −${res.cnvCutoff} ` +
					  `(loss) over the gene, ${control} above ${caseName}.`
					: '')
		)
	legend(div.append('div'), res.promoterPad, caseName, !!res.cnvCutoff)

	const scroll = div.append('div').style('max-height', '65vh').style('overflow-y', 'auto')
	for (const [rows, name, color] of [
		[res.up, caseName, colors.caseColor],
		[res.down, control, colors.controlColor]
	]) {
		scroll
			.append('div')
			.style('font-weight', 'bold')
			.style('padding', '8px 0 0')
			.style('color', color)
			.text(`Higher in ${name} (${rows.length})`)
		if (rows.length) drawGenes(scroll.append('div'), rows, res.promoterPad, colors, [control, caseName])
	}
}

function legend(holder: any, pad: number, caseName: string, hasCnv: boolean) {
	const item = (swatch: (s: any) => void, label: string) => {
		const span = holder.append('span').style('margin-right', '14px').style('white-space', 'nowrap')
		swatch(
			span
				.append('span')
				.style('display', 'inline-block')
				.style('width', '14px')
				.style('height', '10px')
				.style('margin-right', '4px')
				.style('vertical-align', 'middle')
		)
		span.append('span').style('font-size', '.9em').text(label)
	}
	holder.style('padding', '2px 0 4px')
	item(s => s.style('background', '#eee'), `promoter, TSS ± ${bplen(pad)} (to scale)`)
	item(
		s => s.style('border-left', '1px dashed #888').style('width', '1px'),
		'gene body to the TES, stretched to one width'
	)
	item(s => s.style('background', HYPER_COLOR), `DMR, higher methylation in ${caseName}`)
	item(s => s.style('background', HYPO_COLOR), `lower in ${caseName}`)
	if (hasCnv) {
		item(s => s.style('background', mclass[mclasscnvgain].color), 'CNV gain')
		item(s => s.style('background', mclass[mclasscnvloss].color), 'CNV loss')
	}
}

function drawGenes(
	holder: any,
	rows: any[],
	pad: number,
	colors: { caseColor: string; controlColor: string },
	groupNames: string[]
) {
	const svg = holder
		.append('svg')
		.attr('width', X.cnv + CNV_W + 10)
		.attr('height', (rows.length + 1) * ROW_H)
		.attr('font-family', 'Arial')
	const head = svg.append('g').attr('font-size', 11).attr('fill', '#777')
	for (const [x, text] of [
		[X.gene, 'Gene'],
		[X.fc, 'log₂FC'],
		[X.p, 'adj. p'],
		[X.sketch, 'promoter ┆ gene body, 5′ → 3′'],
		[X.len, 'length'],
		[X.cnv, 'CNV']
	] as [number, string][])
		head.append('text').attr('x', x).attr('y', 15).text(text)

	for (const [i, r] of rows.entries()) {
		const g = svg.append('g').attr('transform', `translate(0,${(i + 1) * ROW_H})`)
		const text = (x: number, s: string) =>
			g
				.append('text')
				.attr('x', x)
				.attr('y', ROW_H / 2)
				.attr('dominant-baseline', 'middle')
				.attr('font-size', 12)
				.text(s)
		text(X.gene, r.gene.length > 12 ? r.gene.slice(0, 11) + '…' : r.gene)
			.attr('font-weight', 'bold')
			.append('title')
			.text(r.gene)
		text(X.fc, `${r.fc > 0 ? '+' : ''}${r.fc.toFixed(2)}`).attr(
			'fill',
			r.fc > 0 ? colors.caseColor : colors.controlColor
		)
		text(X.p, r.p < 0.001 ? r.p.toExponential(1) : r.p.toFixed(3))
		if (!r.sketch) {
			text(X.sketch, 'no gene model').attr('fill', '#999')
			continue
		}
		drawSketch(g.append('g').attr('transform', `translate(${X.sketch},0)`), r, pad)
		text(X.len, bplen(r.sketch.length)).attr('fill', '#888').attr('font-size', 11)
		if (r.cnv) drawCnv(g.append('g').attr('transform', `translate(${X.cnv},0)`), r.cnv, groupNames)
		else if (/^chr[XY]$/.test(r.model.chr))
			text(X.cnv, `${r.model.chr}: n/a`)
				.attr('fill', '#999')
				.attr('font-size', 11)
				.append('title')
				.text('Not shown: a segment mean against a diploid reference calls every male X a loss')
	}
}

const signed = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}`

function drawSketch(g: any, r: any, pad: number) {
	const { length, exons, dmrs } = r.sketch
	const x = (bp: number) => sketchX(bp, length, pad)
	const cy = ROW_H / 2
	g.append('rect')
		.attr('y', 2)
		.attr('width', PROMOTER_W)
		.attr('height', ROW_H - 4)
		.attr('fill', '#eee')
	g.append('line')
		.attr('x1', PROMOTER_W)
		.attr('x2', PROMOTER_W)
		.attr('y1', 0)
		.attr('y2', ROW_H)
		.attr('stroke', '#888')
		.attr('stroke-dasharray', '3,2')
	const x0 = x(0)
	// bent arrow at the TSS pointing the way of transcription
	g.append('path')
		.attr('d', `M${x0},${cy}V${cy - 8}h5`)
		.attr('fill', 'none')
		.attr('stroke', '#666')
	g.append('path')
		.attr('d', `M${x0 + 5},${cy - 11}l3,3l-3,3z`)
		.attr('fill', '#666')
	g.append('line').attr('x1', x0).attr('x2', x(length)).attr('y1', cy).attr('y2', cy).attr('stroke', '#666')
	for (const [a, b] of exons)
		g.append('rect')
			.attr('x', x(a))
			.attr('y', cy - 4)
			.attr('width', Math.max(1, x(b) - x(a)))
			.attr('height', 8)
			.attr('fill', '#666')
	// in a strip under the gene, so a DMR spanning the body does not hide its exons
	for (const d of dmrs)
		g.append('rect')
			.attr('x', x(d.from))
			.attr('y', cy + 5)
			.attr('width', Math.max(2, x(d.to) - x(d.from)))
			.attr('height', 6)
			.attr('fill', d.direction == 'hyper' ? HYPER_COLOR : HYPO_COLOR)
			.append('title')
			.text(
				`${r.gene} ${d.context} DMR ${d.chr}:${d.start}-${d.stop}\n` +
					`Δβ ${signed(d.deltaBeta)}` +
					(d.excess != null ? `, excess over background ${signed(d.excess)} (p ${d.bgP.toPrecision(2)})` : '') +
					`, ${d.cpgs} CpGs, FDR ${d.fdr.toExponential(1)}`
			)
	g.append('title').text(
		`${r.gene} ${r.model.chr}:${r.model.start}-${r.model.stop} (${r.model.strand}), ${dmrs.length} DMR${
			dmrs.length == 1 ? '' : 's'
		}`
	)
}

function drawCnv(g: any, cnv: { assayed: number; gain: number; loss: number }[], groupNames: string[]) {
	const pct = (n: number, of: number) => `${Math.round((100 * n) / of)}%`
	for (const [i, c] of cnv.entries()) {
		const bar = g.append('g').attr('transform', `translate(0,${4 + i * 9})`)
		bar.append('rect').attr('width', CNV_W).attr('height', 7).attr('fill', '#eee')
		if (!c.assayed) {
			bar.append('title').text(`${groupNames[i]}: no CNV-assayed samples`)
			continue
		}
		const gw = (c.gain / c.assayed) * CNV_W
		const lw = (c.loss / c.assayed) * CNV_W
		bar.append('rect').attr('width', gw).attr('height', 7).attr('fill', mclass[mclasscnvgain].color)
		bar
			.append('rect')
			.attr('x', CNV_W - lw)
			.attr('width', lw)
			.attr('height', 7)
			.attr('fill', mclass[mclasscnvloss].color)
		bar
			.append('title')
			.text(
				`${groupNames[i]}: gain ${c.gain} (${pct(c.gain, c.assayed)}), loss ${c.loss} (${pct(c.loss, c.assayed)}) ` +
					`of ${c.assayed} CNV-assayed samples`
			)
	}
}

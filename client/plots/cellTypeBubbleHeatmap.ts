import type { MassState, BasePlotConfig } from '#mass/types/mass'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { PlotBase } from './PlotBase'
import { Menu, addGeneSearchbox, LegendCircleReference } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { scaleLinear, scaleSqrt } from 'd3'

const defaultConfig = { chartType: 'cellTypeBubbleHeatmap' }

const CELL_W = 84
const CELL_H = 60
const ROW_LABEL_W = 74
const GROUP_LABEL_H = 22 // cell-type group header band
const GENO_LABEL_H = 40 // genotype sub-label band
const COL_LABEL_H = GROUP_LABEL_H + GENO_LABEL_H
const MIN_DOT_R = 8
const MAX_DOT_R = 22
// cap on −log10(FDR) used for dot size so one ultra-significant (or FDR=0) dot can't
// dwarf the rest; FDR ≤ 10^−CAP all render at the max size
const NEG_LOG_FDR_CAP = 10

// color: |log2FC| magnitude by intensity, sign by hue — blue for positive, purple
// for negative, near-white at 0 (diverging purple–white–blue)
const COLOR_NEG = '#762a83' // purple, down-regulated (negative log2FC)
const COLOR_ZERO = '#f7f7f7'
const COLOR_POS = '#2166ac' // blue, up-regulated (positive log2FC)

class CellTypeBubbleHeatmap extends PlotBase implements RxComponent {
	static type = 'cellTypeBubbleHeatmap'
	type: string
	dom!: { holder: any; body: any; tip: Menu; header?: any }
	data: any
	currentIsoform = ''
	gridHolder: any

	constructor(opts: any, api) {
		super(opts, api)
		this.type = CellTypeBubbleHeatmap.type
	}

	async init() {
		const holder = this.opts.holder.append('div').style('padding', '10px')
		this.dom = {
			holder,
			body: holder.append('div'),
			tip: new Menu({ padding: '' }),
			header: this.opts.header
		}
		if (this.dom.header) this.dom.header.html('Cell-type Bubble Heatmap')
	}

	getState(appState: MassState) {
		const config: any = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return { config }
	}

	async main() {
		const gene = this.state.config?.gene
		if (!gene) throw new Error('cellTypeBubbleHeatmap: gene is missing')

		if (this.dom.header) this.dom.header.text(`Cell-type Bubble Heatmap: ${gene}`)

		const body = {
			genome: this.app.opts.state.vocab.genome,
			dslabel: this.app.opts.state.vocab.dslabel,
			gene
		}

		const data = await dofetch3('termdb/cellTypeBubbleHeatmap', { body })
		if (data.error) throw data.error
		this.data = data

		this.dom.body.selectAll('*').remove()

		const isoformIds = Object.keys(data.isoforms)
		if (isoformIds.length === 0) {
			this.dom.body
				.append('div')
				.style('padding', '20px')
				.style('color', '#666')
				.text(`No data found for gene "${gene}" in any cohort DAPfile.`)
			return
		}

		this.currentIsoform = isoformIds[0]

		// isoform selector
		const isoBlock = this.dom.body.append('div').style('margin-bottom', '12px')
		isoBlock.append('span').style('font-weight', 'bold').text('Isoform: ')
		if (isoformIds.length > 1) {
			const sel = isoBlock
				.append('select')
				.style('margin-left', '5px')
				.style('padding', '3px 6px')
				.on('change', () => {
					this.currentIsoform = sel.node().value
					this.renderGrid()
				})
			sel
				.selectAll('option')
				.data(isoformIds)
				.enter()
				.append('option')
				.attr('value', (d: string) => d)
				.text((d: string) => `${data.isoforms[d].gene_name} — ${d}`)
		} else {
			isoBlock
				.append('span')
				.style('margin-left', '5px')
				.text(`${data.isoforms[this.currentIsoform].gene_name} — ${this.currentIsoform}`)
		}

		this.gridHolder = this.dom.body.append('div')
		this.renderGrid()
	}

	renderGrid() {
		const data = this.data
		const selectedIsoform = this.currentIsoform
		const threshold: number = data.fdrThreshold

		this.gridHolder.selectAll('*').remove()
		const container = this.gridHolder
			.append('div')
			.style('display', 'flex')
			.style('gap', '24px')
			.style('align-items', 'flex-start')
			.style('flex-wrap', 'wrap')

		const isoformData = data.isoforms[selectedIsoform]
		if (!isoformData) return

		const columns = data.columns as { key: string; cellType: string; genotype: string }[]
		const rows = data.rows as { key: string; label: string }[]
		const nCols = columns.length
		const nRows = rows.length

		// significance as −log10(FDR), capped (guards FDR<=0 and keeps the size range sane)
		const negLogFdr = (fdr: number): number => (fdr > 0 ? Math.min(-Math.log10(fdr), NEG_LOG_FDR_CAP) : NEG_LOG_FDR_CAP)

		const cellOf = (colKey: string, rowKey: string): any => isoformData.data[colKey]?.[rowKey]

		// color domain = symmetric max |log2FC| across populated cells; size domain from
		// the FDR<threshold cutoff to the most-significant cell shown
		let maxAbs = 0
		const thresholdNegLog = negLogFdr(threshold)
		let maxNegLog = thresholdNegLog
		for (const col of columns) {
			for (const row of rows) {
				const s = cellOf(col.key, row.key)
				if (!s) continue
				const v = Math.abs(s.log2FC)
				if (v > maxAbs) maxAbs = v
				const nl = negLogFdr(s.fdr)
				if (nl > maxNegLog) maxNegLog = nl
			}
		}
		if (maxAbs === 0) maxAbs = 1
		if (maxNegLog <= thresholdNegLog) maxNegLog = thresholdNegLog + 1

		const colorScale = scaleLinear<string>()
			.domain([-maxAbs, 0, maxAbs])
			.range([COLOR_NEG, COLOR_ZERO, COLOR_POS])
			.clamp(true)
		// dot size encodes significance as −log10(FDR): bigger = more significant. non-significant
		// dots clamp to the smallest size and are also faded. color carries log2FC, so size and
		// color encode two independent variables.
		const sizeScale = scaleSqrt().domain([thresholdNegLog, maxNegLog]).range([MIN_DOT_R, MAX_DOT_R]).clamp(true)

		const gridW = ROW_LABEL_W + nCols * CELL_W + 20
		const gridH = COL_LABEL_H + nRows * CELL_H + 20

		const svg = container.append('svg').attr('width', gridW).attr('height', gridH).style('flex', '0 0 auto')
		const grid = svg.append('g')

		// two-tier column header: cell-type group label spanning its genotype columns, then
		// the genotype label under each column
		let c = 0
		while (c < nCols) {
			const cellType = columns[c].cellType
			let end = c
			while (end + 1 < nCols && columns[end + 1].cellType === cellType) end++
			const xStart = ROW_LABEL_W + c * CELL_W
			const xEnd = ROW_LABEL_W + (end + 1) * CELL_W
			const xMid = (xStart + xEnd) / 2
			grid
				.append('text')
				.attr('x', xMid)
				.attr('y', GROUP_LABEL_H - 7)
				.attr('text-anchor', 'middle')
				.attr('font-size', '13px')
				.attr('font-weight', 'bold')
				.text(cellType)
			// underline the group span
			grid
				.append('line')
				.attr('x1', xStart + 4)
				.attr('y1', GROUP_LABEL_H - 3)
				.attr('x2', xEnd - 4)
				.attr('y2', GROUP_LABEL_H - 3)
				.attr('stroke', '#bbb')
				.attr('stroke-width', 1)
			c = end + 1
		}
		for (let col = 0; col < nCols; col++) {
			const cx = ROW_LABEL_W + col * CELL_W + CELL_W / 2
			grid
				.append('text')
				.attr('x', cx)
				.attr('y', COL_LABEL_H - 14)
				.attr('text-anchor', 'middle')
				.attr('font-size', '12px')
				.attr('font-weight', '600')
				.text(columns[col].genotype)
		}

		// row labels (timepoints)
		for (let r = 0; r < nRows; r++) {
			const cy = COL_LABEL_H + r * CELL_H + CELL_H / 2
			grid
				.append('text')
				.attr('x', ROW_LABEL_W - 12)
				.attr('y', cy)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'central')
				.attr('font-size', '13px')
				.attr('font-weight', 'bold')
				.text(rows[r].label)
		}

		// cells: outline + one dot when populated
		for (let r = 0; r < nRows; r++) {
			for (let col = 0; col < nCols; col++) {
				const x0 = ROW_LABEL_W + col * CELL_W
				const y0 = COL_LABEL_H + r * CELL_H

				grid
					.append('rect')
					.attr('x', x0)
					.attr('y', y0)
					.attr('width', CELL_W)
					.attr('height', CELL_H)
					.attr('fill', 'none')
					.attr('stroke', '#eee')
					.attr('stroke-width', 1)

				const s = cellOf(columns[col].key, rows[r].key)
				if (!s) continue

				const cx = x0 + CELL_W / 2
				const cy = y0 + CELL_H / 2
				grid
					.append('circle')
					.attr('cx', cx)
					.attr('cy', cy)
					.attr('r', sizeScale(negLogFdr(s.fdr)))
					.attr('fill', colorScale(s.log2FC))
					.attr('stroke', '#888')
					.attr('stroke-width', 0.8)
					.style('opacity', s.significant ? 1 : 0.35)
					.on('mouseover', (event: MouseEvent) =>
						this.showCellTip(event, isoformData.gene_name, selectedIsoform, columns[col], rows[r], s)
					)
					.on('mouseout', () => this.dom.tip.hide())
			}
		}

		this.renderLegend(container, colorScale, maxAbs, threshold, maxNegLog)
	}

	private fmtFdr(v: number): string {
		return v >= 0.0001 ? v.toFixed(4) : v.toExponential(2)
	}

	private showCellTip(
		event: MouseEvent,
		geneName: string,
		isoform: string,
		col: { cellType: string; genotype: string },
		row: { label: string },
		s: any
	) {
		this.dom.tip.clear().show(event.clientX, event.clientY)
		const t = this.dom.tip.d.append('div').style('padding', '8px').style('font-size', '13px')
		t.append('div').style('font-weight', 'bold').style('margin-bottom', '4px').text(`${geneName} — ${isoform}`)
		t.append('div').text(`Cell type: ${col.cellType}`)
		t.append('div').text(`Genotype: ${col.genotype}`)
		t.append('div').text(`Timepoint: ${row.label}`)
		t.append('div').text(`Protein: ${s.id}`)
		t.append('div').text(`log₂FC: ${s.log2FC.toFixed(3)}`)
		t.append('div').text(`FDR: ${this.fmtFdr(s.fdr)}${s.significant ? '' : ' (n.s.)'}`)
		t.append('div')
			.style('color', '#666')
			.style('margin-top', '4px')
			.text('Color = log₂FC (blue up / purple down). Size = −log₁₀ FDR.')
	}

	private renderLegend(container: any, colorScale: any, maxAbs: number, threshold: number, maxNegLog: number) {
		const legend = container
			.append('div')
			.style('display', 'flex')
			.style('flex-direction', 'column')
			.style('gap', '16px')
			.style('padding', '8px 0')
			.style('min-width', '180px')
			.style('max-width', '260px')

		// color scale
		const colorBlock = legend.append('div')
		colorBlock
			.append('div')
			.style('font-weight', 'bold')
			.style('font-size', '13px')
			.style('margin-bottom', '6px')
			.text('log₂FC')
		const cW = 22
		const cH = 130
		const cSvg = colorBlock
			.append('svg')
			.attr('width', cW + 80)
			.attr('height', cH + 16)
		const gid = `ctbh-grad-${this.id}`
		const grad = cSvg
			.append('defs')
			.append('linearGradient')
			.attr('id', gid)
			.attr('x1', '0')
			.attr('y1', '0')
			.attr('x2', '0')
			.attr('y2', '1')
		const steps = 10
		for (let i = 0; i <= steps; i++) {
			const t = i / steps
			// top = +maxAbs (blue), bottom = −maxAbs (purple)
			grad
				.append('stop')
				.attr('offset', `${t * 100}%`)
				.attr('stop-color', colorScale(maxAbs * (1 - 2 * t)))
		}
		cSvg
			.append('rect')
			.attr('x', 0)
			.attr('y', 8)
			.attr('width', cW)
			.attr('height', cH)
			.style('fill', `url(#${gid})`)
			.attr('stroke', '#999')
		const cScale = scaleLinear()
			.domain([maxAbs, -maxAbs])
			.range([8, cH + 8])
		for (const tick of [maxAbs, maxAbs / 2, 0, -maxAbs / 2, -maxAbs]) {
			const y = cScale(tick)
			cSvg
				.append('line')
				.attr('x1', cW)
				.attr('y1', y)
				.attr('x2', cW + 5)
				.attr('y2', y)
				.attr('stroke', '#666')
			cSvg
				.append('text')
				.attr('x', cW + 8)
				.attr('y', y)
				.attr('dominant-baseline', 'central')
				.attr('font-size', '10px')
				.text(`${tick > 0 ? '+' : ''}${tick.toFixed(2)}`)
		}
		colorBlock
			.append('div')
			.style('font-size', '11px')
			.style('color', '#666')
			.style('margin-top', '2px')
			.text('blue = up (+), purple = down (−)')

		// size key — significance (−log10 FDR)
		const sizeBlock = legend.append('div')
		sizeBlock
			.append('div')
			.style('font-weight', 'bold')
			.style('font-size', '13px')
			.style('margin-bottom', '6px')
			.text('Dot size: significance (−log₁₀ FDR)')
		const sSvg = sizeBlock.append('svg')
		const sG = sSvg.append('g')
		new LegendCircleReference({
			g: sG,
			inputMin: 0,
			inputMax: MAX_DOT_R * 2,
			minRadius: MIN_DOT_R,
			maxRadius: MAX_DOT_R,
			minLabel: Number(Math.min(-Math.log10(threshold), NEG_LOG_FDR_CAP).toFixed(1)),
			maxLabel: Number(maxNegLog.toFixed(1))
		})
		const sPad = 4
		const sBox = sG.node().getBBox()
		sG.attr('transform', `translate(${sPad - sBox.x}, ${sPad - sBox.y})`)
		sSvg.attr('width', Math.ceil(sBox.width + 2 * sPad)).attr('height', Math.ceil(sBox.height + 2 * sPad))

		const notes = legend
			.append('div')
			.style('font-size', '11px')
			.style('color', '#666')
			.style('line-height', '1.5')
			.style('max-width', '240px')
			.style('overflow-wrap', 'break-word')
		notes
			.append('div')
			.text(
				`Color = log₂FC (blue up, purple down). Dot size = significance, −log₁₀ FDR; the smallest size marks the FDR < ${threshold} cutoff. Non-significant dots (FDR ≥ ${threshold}) are faded.`
			)
		notes
			.append('div')
			.style('margin-top', '4px')
			.text('An empty cell means the cohort was not assayed (e.g. OPC has no 4m) or the protein was not detected.')
	}
}

export const componentInit = getCompInit(CellTypeBubbleHeatmap)

export async function getPlotConfig(opts: any) {
	const config = structuredClone(defaultConfig)
	if (!opts.gene) throw new Error('cellTypeBubbleHeatmap requires opts.gene')
	return copyMerge(config, opts)
}

export function makeChartBtnMenu(holder: any, chartsInstance: any) {
	const row = holder.append('div').style('padding', '5px')
	row.append('span').style('font-weight', 'bold').text('Enter a gene name:')

	const geneSearch = addGeneSearchbox({
		row,
		genome: chartsInstance.app.opts.genome,
		tip: new Menu({ padding: '0px' }),
		searchOnly: 'gene',
		callback: async () => {
			if (!geneSearch.geneSymbol) throw new Error('A valid gene selection is required')
			chartsInstance.dom.tip.hide()
			chartsInstance.app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'cellTypeBubbleHeatmap',
					gene: geneSearch.geneSymbol
				}
			})
		}
	})
}

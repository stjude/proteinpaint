import type { MassState, BasePlotConfig } from '#mass/types/mass'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { PlotBase } from './PlotBase'
import { Menu, addGeneSearchbox, LegendCircleReference } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { scaleLinear, scaleSqrt } from 'd3'

const defaultConfig = { chartType: 'bubbleHeatmap' }

const CELL_W = 92
const CELL_H = 64 // minimum row height
const ROW_LABEL_W = 170
const COL_LABEL_H = 92
const SITE_DOT_R = 5 // per-site dot radius (PTM)
const SITE_DOT_SP = 13 // center-to-center spacing when packing site dots
const CELL_PAD = 8
const MIN_DOT_R = 8 // protein-level (non-PTM) big dot, min radius
const MAX_DOT_R = 20 // protein-level (non-PTM) big dot, max radius
// cap on −log10(p) used for dot size, so one ultra-significant (or p=0) dot can't
// dwarf the rest; p ≤ 10^−CAP all render at the max size
const NEG_LOG_P_CAP = 10

class BubbleHeatmap extends PlotBase implements RxComponent {
	static type = 'bubbleHeatmap'
	type: string
	dom!: { holder: any; body: any; tip: Menu; header?: any }
	components: any
	data: any
	currentIsoform = ''
	useAdjusted = false
	gridHolder: any

	constructor(opts: any, api) {
		super(opts, api)
		this.type = BubbleHeatmap.type
		this.components = {}
	}

	async init() {
		const holder = this.opts.holder.append('div').style('padding', '10px')
		this.dom = {
			holder,
			body: holder.append('div'),
			tip: new Menu({ padding: '' }),
			header: this.opts.header
		}
		if (this.dom.header) this.dom.header.html('Bubble Heatmap')
	}

	getState(appState: MassState) {
		const config: any = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return { config }
	}

	async main() {
		const gene = this.state.config?.gene
		if (!gene) throw new Error('bubbleHeatmap: gene is missing')

		if (this.dom.header) this.dom.header.text(`Bubble Heatmap: ${gene}`)

		const body = {
			genome: this.app.opts.state.vocab.genome,
			dslabel: this.app.opts.state.vocab.dslabel,
			gene
		}

		const data = await dofetch3('termdb/bubbleHeatmap', { body })
		if (data.error) throw data.error
		this.data = data

		this.dom.body.selectAll('*').remove()

		const isoformIds = Object.keys(data.isoforms)
		if (isoformIds.length === 0) {
			this.dom.body
				.append('div')
				.style('padding', '20px')
				.style('color', '#666')
				.text(`No data found for gene "${gene}" in any (assay, cohort) DAPfile.`)
			return
		}

		// default to protein-abundance-adjusted values when a reference assay exists
		this.useAdjusted = !!data.proteinReferenceAssay
		this.currentIsoform = isoformIds[0]

		// isoform selector (the adjusted/raw toggle lives in the legend, by renderLegend)
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
		const useAdjusted = this.useAdjusted
		const refAssay: string | null = data.proteinReferenceAssay
		const threshold: number = data.pValueThreshold

		this.gridHolder.selectAll('*').remove()
		const container = this.gridHolder
			.append('div')
			.style('display', 'flex')
			.style('gap', '24px')
			.style('align-items', 'flex-start')
			.style('flex-wrap', 'wrap')

		const isoformData = data.isoforms[selectedIsoform]
		if (!isoformData) return

		const assays: string[] = data.assays
		const cohorts: string[] = data.cohorts
		const nRows = assays.length
		const nCols = cohorts.length

		const ptmAssays = new Set<string>(data.ptmAssays || [])
		const isPTMassay = (assay: string) => ptmAssays.has(assay)

		// value the dot's color encodes: adjusted when requested & available, else raw
		const valueOf = (s: any): number => this.valueFor(s, useAdjusted)
		// significance as −log10(p), capped (guards p<=0 and keeps the size range sane).
		const negLogP = (p: number): number => (p > 0 ? Math.min(-Math.log10(p), NEG_LOG_P_CAP) : NEG_LOG_P_CAP)

		// PTM assays show one small dot per site; build an ordered list of distinct site
		// ids (stable across cohort columns) so a site keeps the same slot in every column.
		// A site earns a slot if it is significant in at least one cohort; within a cohort
		// only the sites significant THERE are drawn, so a slot can render in one column and
		// stay empty in another. Sites never significant in any cohort are not rendered.
		// non-PTM assays show a single big dot.
		const slotIndex = new Map<string, number>() // `${assay}|${id}` → slot
		const assaySlotCount = new Map<string, number>()
		let maxAbs = 0
		// −log10(p) at the significance cutoff (~1.30 for p<0.05): the smallest sized
		// protein dot. maxNegLog grows to the most-significant protein dot shown.
		const thresholdNegLog = negLogP(threshold)
		let maxNegLog = thresholdNegLog
		for (const assay of assays) {
			const ptm = isPTMassay(assay)
			// per-site maps (PTM only) feed the stable slot order; raw log2FC so the order
			// doesn't shift with the adjusted/raw toggle
			const rawSum = new Map<string, number>()
			const rawN = new Map<string, number>()
			const significantSomewhere = new Set<string>()
			for (const cohort of cohorts) {
				const cell = isoformData.data[assay]?.[cohort]
				if (!cell) continue
				if (ptm) {
					// PTM draws one dot per site significant in this cohort; the color
					// domain reflects only those drawn sites.
					for (const s of cell.sites) {
						if (s.significant) {
							const v = Math.abs(valueOf(s))
							if (v > maxAbs) maxAbs = v
						}
						rawSum.set(s.id, (rawSum.get(s.id) ?? 0) + s.log2FC)
						rawN.set(s.id, (rawN.get(s.id) ?? 0) + 1)
						if (s.significant) significantSomewhere.add(s.id)
					}
				} else {
					// non-PTM draws only the single best row (cell.sites[0]); size = -log10(p)
					const s = cell.sites[0]
					if (!s) continue
					const v = Math.abs(valueOf(s))
					if (v > maxAbs) maxAbs = v
					const nl = negLogP(s.p_value)
					if (nl > maxNegLog) maxNegLog = nl
				}
			}
			if (ptm) {
				// direction then magnitude: most up-regulated first → most down-regulated,
				// ranked by mean raw log2FC (descending) so up/down sites group as a gradient.
				// only sites significant in some cohort earn a slot.
				const meanRaw = (id: string) => rawSum.get(id)! / rawN.get(id)!
				const ordered = [...significantSomewhere].sort((a, b) => meanRaw(b) - meanRaw(a))
				ordered.forEach((id, i) => slotIndex.set(`${assay}|${id}`, i))
				assaySlotCount.set(assay, ordered.length)
			} else {
				assaySlotCount.set(assay, 1) // single big dot per cell
			}
		}
		if (maxAbs === 0) maxAbs = 1
		// guarantee a non-degenerate size domain when no protein dot is more significant
		// than the cutoff (e.g. only the best, still non-significant, row is shown)
		if (maxNegLog <= thresholdNegLog) maxNegLog = thresholdNegLog + 1

		const colorScale = scaleLinear<string>()
			.domain([-maxAbs, 0, maxAbs])
			.range(['#2166ac', '#f7f7f7', '#b2182b'])
			.clamp(true)
		// non-PTM big-dot size encodes significance as −log10(p): bigger = more
		// significant. domain runs from the p<threshold cutoff to the most-significant
		// protein dot; non-significant dots clamp to the smallest size. color carries
		// log2FC, so size and color encode two independent variables.
		const sizeScale = scaleSqrt().domain([thresholdNegLog, maxNegLog]).range([MIN_DOT_R, MAX_DOT_R]).clamp(true)

		// per-row layout: sub-columns and row height grow with the site count
		const layout = assays.map(assay => {
			const m = assaySlotCount.get(assay)!
			const subCols = Math.max(1, Math.min(m, Math.floor((CELL_W - 2 * CELL_PAD) / SITE_DOT_SP)))
			const rows = Math.ceil(m / subCols)
			return { subCols, rows, height: Math.max(CELL_H, rows * SITE_DOT_SP + 2 * CELL_PAD) }
		})
		const rowY: number[] = []
		let yAcc = COL_LABEL_H
		for (let r = 0; r < nRows; r++) {
			rowY[r] = yAcc
			yAcc += layout[r].height
		}
		const gridW = ROW_LABEL_W + nCols * CELL_W + 20
		const gridH = yAcc + 20

		const svg = container.append('svg').attr('width', gridW).attr('height', gridH).style('flex', '0 0 auto')
		const grid = svg.append('g')

		// column labels (cohorts), rotated
		for (let c = 0; c < nCols; c++) {
			const cx = ROW_LABEL_W + c * CELL_W + CELL_W / 2
			grid
				.append('text')
				.attr('x', cx)
				.attr('y', COL_LABEL_H - 10)
				.attr('text-anchor', 'start')
				.attr('font-size', '12px')
				.attr('font-weight', 'bold')
				.attr('transform', `rotate(-35 ${cx} ${COL_LABEL_H - 10})`)
				.text(cohorts[c])
		}

		// row labels (assays) with site counts
		for (let r = 0; r < nRows; r++) {
			const cy = rowY[r] + layout[r].height / 2
			const m = assaySlotCount.get(assays[r])!
			const lbl = grid
				.append('text')
				.attr('x', ROW_LABEL_W - 10)
				.attr('y', cy)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'central')
				.attr('font-size', '12px')
				.attr('font-weight', 'bold')
			lbl.append('tspan').text(assays[r])
			lbl
				.append('tspan')
				.attr('x', ROW_LABEL_W - 10)
				.attr('dy', '1.3em')
				.attr('font-weight', 'normal')
				.attr('font-size', '10px')
				.attr('fill', '#888')
				.text(m > 1 ? `${m} sites` : '')
		}

		// cells: guideline + dots (small per-site for PTM, one big dot for non-PTM)
		for (let r = 0; r < nRows; r++) {
			const assay = assays[r]
			const ptm = isPTMassay(assay)
			const { subCols, height } = layout[r]

			for (let c = 0; c < nCols; c++) {
				const x0 = ROW_LABEL_W + c * CELL_W
				const y0 = rowY[r]

				grid
					.append('rect')
					.attr('x', x0)
					.attr('y', y0)
					.attr('width', CELL_W)
					.attr('height', height)
					.attr('fill', 'none')
					.attr('stroke', '#eee')
					.attr('stroke-width', 1)

				const cell = isoformData.data[assay]?.[cohorts[c]]
				if (!cell || !cell.sites.length) continue

				const addDot = (s: any, cx: number, cy: number, radius: number) => {
					// color = log2FC; protein-level size = significance. non-significant dots are
					// also faded via element opacity (fades fill + outline together, so a
					// small dot reads as "weak"). the constant thin outline keeps near-white
					// (~0 log2FC) dots legible, not a significance cue.
					return grid
						.append('circle')
						.attr('cx', cx)
						.attr('cy', cy)
						.attr('r', radius)
						.attr('fill', colorScale(valueOf(s)))
						.attr('stroke', '#888')
						.attr('stroke-width', 0.8)
						.style('opacity', s.significant ? 1 : 0.35)
						.on('mouseover', (event: MouseEvent) =>
							this.showSiteTip(
								event,
								isoformData.gene_name,
								selectedIsoform,
								assay,
								cohorts[c],
								s,
								useAdjusted,
								refAssay
							)
						)
						.on('mouseout', () => this.dom.tip.hide())
				}

				if (!ptm) {
					// single big dot (protein level): color = log2FC, size = −log10(p) so
					// the dot shows effect and significance as two independent channels.
					const s = cell.sites[0]
					const cx = x0 + CELL_W / 2
					const cy = y0 + height / 2
					addDot(s, cx, cy, sizeScale(negLogP(s.p_value)))
					continue
				}

				// PTM: small fixed-radius dot per site, packed at stable slots.
				// only sites significant in THIS cohort render; a site keeps its slot
				// (reserved from being significant in some cohort) so positions stay stable.
				const blockW = subCols * SITE_DOT_SP
				const blockH = layout[r].rows * SITE_DOT_SP
				const startX = x0 + (CELL_W - blockW) / 2 + SITE_DOT_SP / 2
				const startY = y0 + (height - blockH) / 2 + SITE_DOT_SP / 2
				for (const s of cell.sites) {
					if (!s.significant) continue // hide PTM sites not significant in this cohort
					// significant ⟹ significant-somewhere ⟹ always has a slot
					const slot = slotIndex.get(`${assay}|${s.id}`)!
					const cx = startX + (slot % subCols) * SITE_DOT_SP
					const cy = startY + Math.floor(slot / subCols) * SITE_DOT_SP
					addDot(s, cx, cy, SITE_DOT_R)
				}
			}
		}

		this.renderLegend(container, colorScale, maxAbs, threshold, useAdjusted, refAssay, maxNegLog)
	}

	private fmtP(v: number): string {
		return v >= 0.0001 ? v.toFixed(4) : v.toExponential(2)
	}

	/** true when the protein-adjusted value should be shown instead of raw log2FC */
	private showsAdjusted(s: any, useAdjusted: boolean): boolean {
		return !!(useAdjusted && s.adjustedAvailable && s.adjustedLog2FC != null)
	}

	/** value encoded by color: protein-adjusted when requested & available, else raw */
	private valueFor(s: any, useAdjusted: boolean): number {
		return this.showsAdjusted(s, useAdjusted) ? s.adjustedLog2FC : s.log2FC
	}

	private showSiteTip(
		event: MouseEvent,
		geneName: string,
		isoform: string,
		assay: string,
		cohort: string,
		s: any,
		useAdjusted: boolean,
		refAssay: string | null
	) {
		this.dom.tip.clear().show(event.clientX, event.clientY)
		const t = this.dom.tip.d.append('div').style('padding', '8px').style('font-size', '13px')
		t.append('div').style('font-weight', 'bold').style('margin-bottom', '4px').text(`${geneName} — ${isoform}`)
		t.append('div').text(`Assay: ${assay}`)
		t.append('div').text(`Sample set: ${cohort}`)
		const isPTM = (this.data.ptmAssays || []).includes(assay)
		t.append('div').text(`${isPTM ? 'Site' : 'Protein'}: ${s.id}`)
		t.append('div').text(`raw log₂FC: ${s.log2FC.toFixed(3)}`)
		if (s.adjustedAvailable) {
			t.append('div').text(`protein log₂FC: ${s.proteinLog2FC.toFixed(3)}`)
			t.append('div').text(`adjusted log₂FC: ${s.adjustedLog2FC.toFixed(3)}`)
		} else if (refAssay && isPTM) {
			t.append('div').style('color', '#999').text('adjusted: n/a (protein not measured)')
		}
		t.append('div').text(`p-value: ${this.fmtP(s.p_value)}`)
		const shown = this.showsAdjusted(s, useAdjusted) ? 'adjusted' : 'raw'
		t.append('div').style('color', '#666').style('margin-top', '4px').text(`Color = ${shown} log₂FC.`)
	}

	private renderLegend(
		container: any,
		colorScale: any,
		maxAbs: number,
		threshold: number,
		useAdjusted: boolean,
		refAssay: string | null,
		maxNegLog: number
	) {
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
			.attr('width', cW + 60)
			.attr('height', cH + 16)
		const gid = `bh-grad-${this.id}`
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
				.text(tick.toFixed(2))
		}

		// size key — protein-level (non-PTM) big dot, sized by significance (−log10 p)
		const sizeBlock = legend.append('div')
		sizeBlock
			.append('div')
			.style('font-weight', 'bold')
			.style('font-size', '13px')
			.style('margin-bottom', '6px')
			.text('Non-PTM dot size: significance (−log₁₀ p)')
		// small circle = the p<threshold cutoff, large circle = the most-significant
		// protein shown.
		const sSvg = sizeBlock.append('svg')
		const sG = sSvg.append('g')
		new LegendCircleReference({
			g: sG,
			inputMin: 0,
			inputMax: MAX_DOT_R * 2,
			minRadius: MIN_DOT_R,
			maxRadius: MAX_DOT_R,
			// capped to match the size scale's domain min (thresholdNegLog in renderGrid)
			minLabel: Number(Math.min(-Math.log10(threshold), NEG_LOG_P_CAP).toFixed(1)),
			maxLabel: Number(maxNegLog.toFixed(1))
		})
		// fit the SVG to the rendered legend (plus a small margin) so it doesn't reserve
		// excess space; shift the group so its content starts at the margin.
		const sPad = 4
		const sBox = sG.node().getBBox()
		sG.attr('transform', `translate(${sPad - sBox.x}, ${sPad - sBox.y})`)
		sSvg.attr('width', Math.ceil(sBox.width + 2 * sPad)).attr('height', Math.ceil(sBox.height + 2 * sPad))

		// values toggle — placed below the dot-size key, right above the note that
		// explains what "adjusted" means. The reference assay itself is never adjusted.
		if (refAssay) {
			const adjLabel = legend
				.append('div')
				.append('label')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('gap', '6px')
				.style('cursor', 'pointer')
				.style('font-size', '13px')
				.style('font-weight', 'bold')
				.attr(
					'title',
					`When checked, the PTM assays have the ${refAssay} log₂FC subtracted; other assays are shown unchanged.`
				)
			const adjCb = adjLabel
				.append('input')
				.attr('type', 'checkbox')
				.property('checked', this.useAdjusted)
				.on('change', () => {
					this.useAdjusted = adjCb.property('checked')
					this.renderGrid()
				})
			adjLabel.append('span').style('font-weight', 'normal').text('Adjust PTM for total protein abundance')
		}

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
				`Color = log₂FC. Dot size = significance, −log₁₀ p (non-PTM rows); the smallest size marks the p < ${threshold} cutoff. Non-significant dots are faded.`
			)
		notes
			.append('div')
			.style('margin-top', '4px')
			.text(
				'PTM rows: one fixed-size dot per site significant in that cohort, positions stable across cohorts; non-significant sites are not shown.'
			)
		notes
			.append('div')
			.style('margin-top', '4px')
			.text(
				'A slot stays empty where the site is not significant in that cohort, the assay was not performed, or the protein was not detected.'
			)
		if (refAssay) {
			notes
				.append('div')
				.style('margin-top', '4px')
				.text(`Adjusted log₂FC = a PTM site's log₂FC − ${refAssay} log₂FC (PTM assays only).`)
		}
	}
}

export const componentInit = getCompInit(BubbleHeatmap)

export async function getPlotConfig(opts: any) {
	const config = structuredClone(defaultConfig)
	if (!opts.gene) throw new Error('bubbleHeatmap requires opts.gene')
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
					chartType: 'bubbleHeatmap',
					gene: geneSearch.geneSymbol
				}
			})
		}
	})
}

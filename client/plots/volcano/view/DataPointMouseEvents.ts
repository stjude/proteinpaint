import { DataPointInteractions, table2col, type ActionMenuItem } from '#dom'
import { roundValueAuto } from '#shared/roundValue.js'
import { DNA_METHYLATION, GENE_EXPRESSION, SINGLECELL_CELLTYPE } from '#shared/terms.js'
import type { DataPointEntry, VolcanoPlotDimensions } from '../VolcanoTypes'
import type { VolcanoInteractions } from '../interactions/VolcanoInteractions'
import type { VolcanoPlotView } from './VolcanoPlotView'

/** Volcano-plot facade for the shared `DataPointInteractions` orchestration.
 * Owns the cover rect and hover-ring layer DOM; configures the shared module
 * with volcano-specific tooltip / table / action-menu callbacks. The view
 * stays render-only — interactions live here. */
export class DataPointMouseEvents {
	private view: VolcanoPlotView
	private termType: string
	private interactions: DataPointInteractions<DataPointEntry> | null = null

	constructor(view: VolcanoPlotView, termType: string) {
		this.view = view
		this.termType = termType
	}

	attach(plotDim: VolcanoPlotDimensions) {
		// SCCT volcanoes have no per-dot interactions — preserve that by no-op'ing.
		if (this.termType === SINGLECELL_CELLTYPE) return

		const points = this.view.viewData.pointData as DataPointEntry[]
		if (!points || points.length === 0) return

		const dotRadiusPx = this.view.viewData.plotExtent.dotRadiusPx
		const hitRadius = dotRadiusPx + 3
		// Inset by stroke-width/2 so the orange fill stops at the dot's stroke inner edge.
		const highlightRadius = Math.max(0.5, dotRadiusPx - 0.5)
		const highlightColor = this.view.settings.defaultHighlightColor

		// Hover-ring layer — visual only, never intercepts mouse events.
		const hoverLayer = this.view.volcanoDom.plot
			.append('g')
			.attr('id', 'sjpp-volcano-hover')
			.style('pointer-events', 'none')

		// Cover rect — last child of plot group so it sits on top of dots,
		// hover rings, and the fold-change line.
		const cover = this.view.volcanoDom.plot
			.append('rect')
			.attr('id', 'sjpp-volcano-cover')
			.attr('x', plotDim.plot.x)
			.attr('y', plotDim.plot.y)
			.attr('width', plotDim.plot.width)
			.attr('height', plotDim.plot.height)
			.attr('fill', 'transparent')
			.style('pointer-events', 'all')
			.style('cursor', 'default')

		// Circle as an SVG path so it can flow through the generic
		// `drawHoverShapes` helper (which renders `<path>` elements).
		const circlePath = (r: number) => `M${r},0 A${r},${r} 0 1,1 ${-r},0 A${r},${r} 0 1,1 ${r},0 Z`

		this.interactions = new DataPointInteractions<DataPointEntry>({
			cover,
			hoverLayer,
			hoverTip: this.view.dom.tip,
			points,
			// Quadtree in cover-local space — d.x/d.y are SVG-absolute, so subtract
			// the plot rect's origin once when building the tree.
			getX: d => d.x - plotDim.plot.x,
			getY: d => d.y - plotDim.plot.y,
			hitRadius,
			toHoverSpec: d => ({
				path: circlePath(highlightRadius),
				// Hover layer lives in the same coord space as the dots (SVG-absolute),
				// so translate by d.x/d.y — NOT the cover-local pair.
				transform: `translate(${d.x},${d.y})`,
				fill: highlightColor,
				fillOpacity: 0.9,
				stroke: 'none'
			}),
			maxTooltipRows: this.view.settings.maxTooltipGenes,
			itemNoun: 'gene',
			renderSingleHoverTooltip: (d, container) => {
				const table = table2col({ holder: container.append('table') })
				addTooltipRows(d, table, this.termType)
			},
			buildMultiHitTableData: dots => this.buildMultiHitTable(dots),
			getActions: d => getActionMenuOpts(d, this.termType, this.view.interactions),
			renderSingleHitInfo: (d, container) => {
				const tbl = table2col({ holder: container.append('table') })
				addTooltipRows(d, tbl, this.termType)
			},
			getRowKey: d => d.gene_name
		})

		this.interactions.attach()
	}

	private buildMultiHitTable(dots: DataPointEntry[]): { columns: any[]; rows: any[] } {
		const isDM = this.termType === DNA_METHYLATION
		const pValueType = this.view.settings.pValueType
		const pLabel = `${pValueType.charAt(0).toUpperCase()}${pValueType.slice(1)} p-value`
		const pField = `${pValueType}_p_value` as 'original_p_value' | 'adjusted_p_value'
		const columns = isDM
			? [
					{ label: 'Promoter' },
					{ label: 'Gene(s)' },
					{ label: 'log₂(FC)', sortable: true },
					{ label: pLabel, sortable: true }
			  ]
			: [{ label: 'Gene' }, { label: 'log₂(FC)', sortable: true }, { label: pLabel, sortable: true }]
		const rows = dots.map(d => {
			const fc = { value: roundValueAuto(d.fold_change) }
			const pval = { value: roundValueAuto(d[pField]) }
			if (isDM) {
				return [{ value: (d as any).promoter_id || '' }, { value: d.gene_name || '' }, fc, pval]
			}
			return [{ value: d.gene_name || '' }, fc, pval]
		})
		return { columns, rows }
	}
}

/** Returns the per-data-point action menu items (Violin / DMR / Box-plot). Used
 * by both the single-gene click flow and the multi-gene click-menu rows so the
 * launchers stay in lock-step. */
export function getActionMenuOpts(
	d: DataPointEntry,
	termType: string,
	interactions: VolcanoInteractions
): ActionMenuItem[] {
	const all = [
		{
			label: 'Violin plot',
			isVisible: () => termType === DNA_METHYLATION || termType === GENE_EXPRESSION,
			onClick: async () => {
				if (termType === DNA_METHYLATION) interactions.launchDNAMethViolin(d as any)
				if (termType === GENE_EXPRESSION) interactions.launchViolinGeneExp(d.gene_name)
			}
		},
		{
			label: 'DMR analysis',
			isVisible: () => termType === DNA_METHYLATION,
			onClick: async () => {
				const dm = d as DataPointEntry & {
					chr: string
					start: number
					stop: number
					promoter_id?: string
					gene_name?: string
				}
				await interactions.launchDmr({
					chr: dm.chr,
					start: dm.start,
					stop: dm.stop,
					promoterId: dm.promoter_id
				})
			}
		},
		{
			label: 'Box plot',
			isVisible: () => termType === GENE_EXPRESSION,
			onClick: async () => {
				interactions.launchBoxPlot(d.gene_name)
			}
		}
	]
	return all.filter(o => o.isVisible()).map(({ label, onClick }) => ({ label, onClick }))
}

/** Populates a `table2col` instance with the standard volcano hover rows
 * (gene/promoter, fold-change, original + adjusted p-values). */
export function addTooltipRows(d: DataPointEntry, table: any, termType: string) {
	if (termType === DNA_METHYLATION) {
		if ('promoter_id' in d) addTooltipRow(table, 'Promoter', (d as any).promoter_id)
		if (d.gene_name) addTooltipRow(table, 'Gene(s)', d.gene_name)
	} else {
		addTooltipRow(table, 'Gene name', d.gene_name)
	}
	addTooltipRow(table, 'log<sub>2</sub>(fold-change)', roundValueAuto(d.fold_change))
	addTooltipRow(table, 'Original p-value', roundValueAuto(d.original_p_value))
	addTooltipRow(table, 'Adjusted p-value', roundValueAuto(d.adjusted_p_value))
}

function addTooltipRow(table: any, text: string, value: number | string) {
	const [td1, td2] = table.addRow()
	td1.html(text)
	td2.text(value)
}

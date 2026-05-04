import { quadtree, type Quadtree } from 'd3-quadtree'
import {
	Menu,
	table2col,
	findPointsInRadius,
	showResultsTable,
	openActionMenu as openSharedActionMenu,
	openMultiHitClickMenu,
	type ActionMenuItem
} from '#dom'
import { roundValueAuto } from '#shared/roundValue.js'
import { DNA_METHYLATION, GENE_EXPRESSION, SINGLECELL_CELLTYPE } from '#shared/terms.js'
import type { DataPointEntry, VolcanoPlotDimensions } from '../VolcanoTypes'
import type { VolcanoInteractions } from '../interactions/VolcanoInteractions'
import type { VolcanoPlotView } from './VolcanoPlotView'

/** @deprecated use `ActionMenuItem` from `#dom`. Re-exported here for callers. */
export type ActionMenuOpt = ActionMenuItem

/** Quadtree-driven hover & click overlay for the volcano plot. Owns the
 * cover rect, hit-test quadtree, hover-ring layer, and click menu so the
 * view stays render-only — restoring the pre-quadtree-refactor split. */
export class DataPointMouseEvents {
	private view: VolcanoPlotView
	private termType: string
	private cover: any
	private hoverLayer: any
	private clickMenu!: Menu
	private clickMenuIsShown = false
	private qt!: Quadtree<DataPointEntry>
	private hitRadius = 0
	private highlightRadius = 0
	private highlightColor = ''
	private maxTooltipGenes = 0
	private plotDim!: VolcanoPlotDimensions

	constructor(view: VolcanoPlotView, termType: string) {
		this.view = view
		this.termType = termType
	}

	attach(plotDim: VolcanoPlotDimensions) {
		// SCCT volcanoes have no per-dot interactions — preserve that by no-op'ing.
		if (this.termType === SINGLECELL_CELLTYPE) return

		const points = this.view.viewData.pointData as DataPointEntry[]
		if (!points || points.length === 0) return

		this.plotDim = plotDim
		const dotRadiusPx = this.view.viewData.plotExtent.dotRadiusPx
		this.hitRadius = dotRadiusPx + 3
		// Inset by stroke-width/2 so the orange fill stops at the ring's inner edge.
		this.highlightRadius = Math.max(0.5, dotRadiusPx - 0.5)
		this.highlightColor = this.view.settings.defaultHighlightColor
		this.maxTooltipGenes = this.view.settings.maxTooltipGenes

		// Hover-ring layer — visual only, never intercepts mouse events.
		this.hoverLayer = this.view.volcanoDom.plot
			.append('g')
			.attr('id', 'sjpp-volcano-hover')
			.style('pointer-events', 'none')

		// Cover rect — last child of plot group so it sits on top of dots,
		// hover rings, and the fold-change line.
		this.cover = this.view.volcanoDom.plot
			.append('rect')
			.attr('id', 'sjpp-volcano-cover')
			.attr('x', plotDim.plot.x)
			.attr('y', plotDim.plot.y)
			.attr('width', plotDim.plot.width)
			.attr('height', plotDim.plot.height)
			.attr('fill', 'transparent')
			.style('pointer-events', 'all')
			.style('cursor', 'default')

		// Quadtree in cover-local space — d.x/d.y are SVG-absolute, so subtract
		// the plot rect's origin once when building the tree.
		this.qt = quadtree<DataPointEntry>()
			.x(d => d.x - plotDim.plot.x)
			.y(d => d.y - plotDim.plot.y)
			.addAll(points)

		this.clickMenu = new Menu({
			padding: '',
			onHide: () => {
				this.clickMenuIsShown = false
				this.drawHoverRings([])
			}
		})

		this.cover.on('mousemove', (event: MouseEvent) => this.onMousemove(event))
		this.cover.on('mouseleave', () => this.onMouseleave())
		this.cover.on('click', (event: MouseEvent) => this.onClick(event))
	}

	private findCandidates(event: MouseEvent): DataPointEntry[] {
		const rect = (this.cover.node() as SVGRectElement).getBoundingClientRect()
		const mx = event.clientX - rect.left
		const my = event.clientY - rect.top
		const candidates = findPointsInRadius<DataPointEntry>(
			this.qt,
			mx,
			my,
			this.hitRadius,
			d => d.x - this.plotDim.plot.x,
			d => d.y - this.plotDim.plot.y
		)
		candidates.sort((a, b) => a.distance - b.distance)
		return candidates.map(c => c.point)
	}

	private drawHoverRings(dots: DataPointEntry[]) {
		this.hoverLayer.selectAll('circle').remove()
		for (const d of dots) {
			this.hoverLayer
				.append('circle')
				.attr('cx', d.x)
				.attr('cy', d.y)
				.attr('r', this.highlightRadius)
				.attr('fill', this.highlightColor)
				.attr('fill-opacity', 0.9)
		}
	}

	private onMousemove(event: MouseEvent) {
		if (this.clickMenuIsShown) return
		const all = this.findCandidates(event)
		const shown = all.slice(0, this.maxTooltipGenes)
		const additionalCount = all.length - this.maxTooltipGenes

		const hoverTip = this.view.dom.tip
		if (shown.length === 0) {
			this.drawHoverRings([])
			hoverTip.hide()
			return
		}

		this.drawHoverRings(shown)
		hoverTip.clear().show(event.clientX, event.clientY)

		if (shown.length === 1) {
			const table = table2col({ holder: hoverTip.d.append('table') })
			addTooltipRows(shown[0], table, this.termType)
		} else {
			const holder = hoverTip.d.append('div').style('margin', '10px')
			this.renderMultiHitTable(holder, shown)
			if (additionalCount > 0) {
				holder
					.append('div')
					.style('font-size', '0.85em')
					.style('color', '#666')
					.style('font-style', 'italic')
					.text(`and ${additionalCount} more gene${additionalCount > 1 ? 's' : ''}...`)
			}
		}
	}

	private onMouseleave() {
		// Don't clear rings while the click menu is showing — the highlight
		// must stay on the picked dots until the user dismisses the menu.
		if (!this.clickMenuIsShown) this.drawHoverRings([])
		this.view.dom.tip.hide()
	}

	private onClick(event: MouseEvent) {
		const candidates = this.findCandidates(event)
		if (candidates.length === 0) return
		this.view.dom.tip.hide()
		// Persist highlight on the picked dots — clickMenu.onHide clears it.
		this.drawHoverRings(candidates)
		this.clickMenuIsShown = true

		if (candidates.length === 1) {
			this.openActionMenu(candidates[0], event)
			return
		}

		const { columns, rows } = this.buildMultiHitTable(candidates)
		openMultiHitClickMenu<DataPointEntry>({
			menu: this.clickMenu,
			event,
			items: candidates,
			columns,
			rows,
			getRowKey: d => d.gene_name,
			onRowClick: (d, ev) => this.openActionMenu(d, ev as MouseEvent)
		})
	}

	private openActionMenu(d: DataPointEntry, event: MouseEvent) {
		const actions: ActionMenuItem[] = getActionMenuOpts(d, this.termType, this.view.interactions)
		openSharedActionMenu({
			menu: this.clickMenu,
			event,
			actions,
			renderInfo: container => {
				const tbl = table2col({ holder: container.append('table') })
				addTooltipRows(d, tbl, this.termType)
			}
		})
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

	private renderMultiHitTable(holder: any, dots: DataPointEntry[]) {
		const { columns, rows } = this.buildMultiHitTable(dots)
		showResultsTable({
			tableDiv: holder,
			dataItems: dots,
			getRowKey: (d: any) => d.gene_name,
			columns,
			rows
		} as any)
	}
}

/** Returns the per-data-point action menu items (Violin / DMR / Box-plot). Used
 * by both the single-gene click flow and the multi-gene click-menu rows so the
 * launchers stay in lock-step. */
export function getActionMenuOpts(
	d: DataPointEntry,
	termType: string,
	interactions: VolcanoInteractions
): ActionMenuOpt[] {
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

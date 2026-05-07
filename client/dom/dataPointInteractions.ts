/**
 * `DataPointInteractions` — shared orchestration for the
 * cover → quadtree hit-test → hover ring → tooltip → click menu pipeline
 * used by manhattan, the DA volcano, and the cohort volcano (and any future
 * scatter-style plot with the same UX shape).
 *
 * The caller owns:
 *   - cover (HTML div or SVG rect with `pointer-events: all`)
 *   - hoverLayer (SVG `<g>` or div with `pointer-events: none`)
 *   - hoverTip (Menu instance, typically shared with the parent component)
 *
 * The module owns:
 *   - the d3-quadtree built from `points` at `attach()`
 *   - a private click Menu (so we can wire `onHide` to clear our hover state
 *     without colliding with the caller's hover-tip Menu)
 *   - the `clickMenuIsShown` flag and event handlers on the cover
 *
 * Defaults match manhattan / DA volcano behaviour. The cohort-volcano-specific
 * features (cluster step, per-dot precision filter, dynamic hit radius) are
 * exposed as optional config; absent, behaviour collapses to the standard flow.
 */

import { quadtree, type Quadtree } from 'd3-quadtree'
import { Menu } from './menu'
import { findPointsInRadius } from './quadtreeHitTest'
import { drawHoverShapes, type HoverShapeSpec } from './hoverShapes'
import { showResultsTable } from './resultsTable'
import { openActionMenu, openMultiHitClickMenu, type ActionMenuItem } from './dataPointClickMenu'

export interface DataPointInteractionsOpts<T> {
	/** HTML div or SVG rect, `pointer-events: all`. The caller positions it. */
	cover: any
	/** Layer where hover shapes render. Should be `pointer-events: none`. */
	hoverLayer: any
	/** Hover tooltip Menu — typically the parent component's shared tip. */
	hoverTip: Menu

	/** Underlying point data; the quadtree is built from this at attach time. */
	points: T[]
	/** Quadtree x accessor (and the x used for distance / per-dot filtering). */
	getX: (d: T) => number
	/** Quadtree y accessor (and the y used for distance / per-dot filtering). */
	getY: (d: T) => number

	/**
	 * Broad-query radius for the quadtree pre-filter, in cover-local pixels.
	 * Pass a function when the underlying max dot radius can change at runtime
	 * (e.g. cohort volcano's size-legend menu mutates its `radiusRange`).
	 */
	hitRadius: number | (() => number)
	/**
	 * Optional per-dot precision filter applied after the broad query —
	 * candidates are kept only if `distance ≤ perDotRadius(d) + perDotBuffer`.
	 * Use this when dot radius varies per-point so small dots don't have the
	 * same generous hit zone as big ones.
	 */
	perDotRadius?: (d: T) => number
	/** Forgiveness margin around `perDotRadius`. Default 0. */
	perDotBuffer?: number
	/** Filter out dots that should not be hit (e.g. legend-hidden categories). */
	isHidden?: (d: T) => boolean

	/**
	 * Optional second-stage cluster step: take the closest hit (the seed)
	 * and return a related set of dots to show together. Used by cohort
	 * volcano for its 5px-around-seed cluster. If omitted, the candidates
	 * from the broad query are used directly.
	 */
	getCluster?: (seed: T, all: T[]) => T[]

	/** Per-dot hover decoration — see `hoverShapes.ts`. */
	toHoverSpec: (d: T) => HoverShapeSpec

	/** Cap on rows shown in the multi-hit hover tooltip. Default 5. */
	maxTooltipRows?: number
	/** Used in the default header / "and N more X..." footer. Default "item". */
	itemNoun?: string
	/** Renders the body of the tooltip when a single dot is hit. */
	renderSingleHoverTooltip: (d: T, container: any) => void
	/** Builds `{ columns, rows }` for the multi-hit hover table and click menu. */
	buildMultiHitTableData: (dots: T[]) => { columns: any[]; rows: any[] }
	/**
	 * Custom header above the multi-hit table. Receives the FULL cluster size
	 * (not just `shown.length`), so callers can write "100 Cohorts" while the
	 * table caps at 5 rows + "and 95 more cohorts...".
	 */
	multiHitHeader?: (count: number) => string

	// --- Default click flow (used unless onSingleClick / onMultiClick override) ---

	/** Action buttons rendered in the action menu for a single picked dot. */
	getActions?: (d: T) => ActionMenuItem[]
	/** Renders the info section of the action menu (below the action buttons). */
	renderSingleHitInfo?: (d: T, container: any) => void
	/** Stable row identifier for the multi-hit click menu. Required for that flow. */
	getRowKey?: (d: T) => string

	// --- Click-flow overrides ---

	/** Replace the default single-hit action menu (e.g. manhattan launches lollipop directly). */
	onSingleClick?: (d: T, event: MouseEvent, ctx: ClickContext) => void
	/** Replace the default multi-hit click menu. */
	onMultiClick?: (dots: T[], event: MouseEvent, ctx: ClickContext) => void

	/** Forwarded to `new Menu({...})` for the click menu. Default `padding: ''`. */
	clickMenuPadding?: string
}

/** Passed to override callbacks. Before the override fires the module has
 * already set its hover-suppression flag and drawn hover rings. Override
 * EITHER shows `clickMenu` (its `onHide` auto-clears both) OR calls
 * `dismiss()` if the override does not show a menu (e.g. manhattan's
 * single-click goes straight to a lollipop launch). */
export interface ClickContext {
	/** The module's click `Menu`. Showing it auto-manages cleanup via its `onHide`. */
	clickMenu: Menu
	/** Immediately clear the hover-suppression flag and hover rings. Use when
	 * the override does not show a menu. */
	dismiss: () => void
}

export class DataPointInteractions<T> {
	private opts: DataPointInteractionsOpts<T>
	private qt: Quadtree<T> | null = null
	private clickMenu: Menu
	private clickMenuIsShown = false

	constructor(opts: DataPointInteractionsOpts<T>) {
		this.opts = opts
		this.clickMenu = new Menu({
			padding: opts.clickMenuPadding ?? '',
			onHide: () => {
				this.clickMenuIsShown = false
				drawHoverShapes(this.opts.hoverLayer, [])
			}
		})
	}

	/** Build the quadtree and wire mousemove / mouseleave / click on the cover. */
	attach(): void {
		this.qt = quadtree<T>().x(this.opts.getX).y(this.opts.getY).addAll(this.opts.points)

		this.opts.cover.on('mousemove', (event: MouseEvent) => this.onMousemove(event))
		this.opts.cover.on('mouseleave', () => this.onMouseleave())
		this.opts.cover.on('click', (event: MouseEvent) => this.onClick(event))
	}

	/** Detach event handlers and clear hover state. Quadtree is dropped. */
	detach(): void {
		this.opts.cover.on('mousemove', null)
		this.opts.cover.on('mouseleave', null)
		this.opts.cover.on('click', null)
		drawHoverShapes(this.opts.hoverLayer, [])
		this.opts.hoverTip.hide()
		this.clickMenu.hide()
		this.qt = null
	}

	private resolveHitRadius(): number {
		const r = this.opts.hitRadius
		return typeof r === 'function' ? r() : r
	}

	private findCandidates(event: MouseEvent): T[] {
		if (!this.qt) return []
		const rect = (this.opts.cover.node() as Element).getBoundingClientRect()
		const mx = event.clientX - rect.left
		const my = event.clientY - rect.top
		const hits = findPointsInRadius<T>(this.qt, mx, my, this.resolveHitRadius(), this.opts.getX, this.opts.getY)

		const buffer = this.opts.perDotBuffer ?? 0
		return hits
			.filter(c => {
				if (this.opts.isHidden && this.opts.isHidden(c.point)) return false
				if (this.opts.perDotRadius) return c.distance <= this.opts.perDotRadius(c.point) + buffer
				return true
			})
			.sort((a, b) => a.distance - b.distance)
			.map(c => c.point)
	}

	/** Apply the optional cluster-around-seed step. */
	private resolveDots(candidates: T[]): T[] {
		if (!this.opts.getCluster || candidates.length === 0) return candidates
		return this.opts.getCluster(candidates[0], this.opts.points)
	}

	private buildHeader(totalCount: number): string {
		if (this.opts.multiHitHeader) return this.opts.multiHitHeader(totalCount)
		const noun = this.opts.itemNoun ?? 'item'
		return `${totalCount} ${noun}${totalCount > 1 ? 's' : ''}`
	}

	private onMousemove(event: MouseEvent): void {
		if (this.clickMenuIsShown) return

		const dots = this.resolveDots(this.findCandidates(event))
		if (dots.length === 0) {
			drawHoverShapes(this.opts.hoverLayer, [])
			this.opts.hoverTip.hide()
			return
		}

		const max = this.opts.maxTooltipRows ?? 5
		const shown = dots.slice(0, max)
		const additional = dots.length - shown.length

		drawHoverShapes(
			this.opts.hoverLayer,
			shown.map(d => this.opts.toHoverSpec(d))
		)
		this.opts.hoverTip.clear().show(event.clientX, event.clientY)

		if (shown.length === 1) {
			this.opts.renderSingleHoverTooltip(shown[0], this.opts.hoverTip.d)
			return
		}

		this.opts.hoverTip.d
			.append('div')
			.style('color', '#888')
			.style('font-weight', 'bold')
			.style('margin', '0 0 6px 0')
			.text(this.buildHeader(dots.length))

		const holder = this.opts.hoverTip.d.append('div').style('margin', '10px')
		const { columns, rows } = this.opts.buildMultiHitTableData(shown)
		showResultsTable({
			tableDiv: holder,
			dataItems: shown,
			getRowKey: this.opts.getRowKey,
			columns,
			rows
		})

		if (additional > 0) {
			const noun = this.opts.itemNoun ?? 'item'
			holder
				.append('div')
				.style('font-size', '0.85em')
				.style('color', '#666')
				.style('font-style', 'italic')
				.text(`and ${additional} more ${noun}${additional > 1 ? 's' : ''}...`)
		}
	}

	private onMouseleave(): void {
		// Don't clear while the click menu is showing — its highlight must persist
		// until the user dismisses the menu (clickMenu.onHide handles cleanup).
		if (this.clickMenuIsShown) return
		drawHoverShapes(this.opts.hoverLayer, [])
		this.opts.hoverTip.hide()
	}

	private onClick(event: MouseEvent): void {
		const dots = this.resolveDots(this.findCandidates(event))
		if (dots.length === 0) return

		this.opts.hoverTip.hide()
		this.clickMenuIsShown = true
		drawHoverShapes(
			this.opts.hoverLayer,
			dots.map(d => this.opts.toHoverSpec(d))
		)

		const ctx: ClickContext = {
			clickMenu: this.clickMenu,
			dismiss: () => {
				this.clickMenuIsShown = false
				drawHoverShapes(this.opts.hoverLayer, [])
			}
		}

		if (dots.length === 1) {
			if (this.opts.onSingleClick) this.opts.onSingleClick(dots[0], event, ctx)
			else this.openDefaultActionMenu(dots[0], event)
			return
		}

		if (this.opts.onMultiClick) this.opts.onMultiClick(dots, event, ctx)
		else this.openDefaultMultiHitMenu(dots, event)
	}

	private openDefaultActionMenu(d: T, event: MouseEvent): void {
		if (!this.opts.getActions) return
		openActionMenu({
			menu: this.clickMenu,
			event,
			actions: this.opts.getActions(d),
			renderInfo: container => this.opts.renderSingleHitInfo?.(d, container)
		})
	}

	private openDefaultMultiHitMenu(dots: T[], event: MouseEvent): void {
		if (!this.opts.getRowKey) return
		const { columns, rows } = this.opts.buildMultiHitTableData(dots)
		openMultiHitClickMenu<T>({
			menu: this.clickMenu,
			event,
			items: dots,
			columns,
			rows,
			getRowKey: this.opts.getRowKey,
			header: this.buildHeader(dots.length),
			onRowClick: (d, e) => this.openDefaultActionMenu(d, e as MouseEvent)
		})
	}
}

import { Menu } from '#dom'
import { hierarchy, partition } from 'd3-hierarchy'
import { arc as d3arc } from 'd3-shape'
import { rgb as d3rgb } from 'd3-color'
import { interpolate } from 'd3-interpolate'
import { select } from 'd3-selection'
import 'd3-transition'
import { schemeTableau10 } from 'd3-scale-chromatic'

/*
Zoomable sunburst renderer, shared by the term-based sunburst chart and the panNDA cohort sunburst.

Draws a tree of SunNode: each wedge is sized by the summed `value` of its subtree. Two rings are shown
around the centre; zoomTo() makes a wedge the centre so the next two rings appear, and the centre
offers Back. The renderer owns the chart, the path card on the left (or, with pathCard: false, a
breadcrumb above the chart and an empty left column for the caller), the controls above the chart and
the stat boxes on the right; what a click does, what is selected or dimmed, the tooltip body and the
stat values come from the caller's hooks, so the caller decides what the wedges mean.

Zooming is animated the way d3's zoomable sunburst does it: every node keeps a `current` geometry
(angles + ring units, see Geom); zoomTo() assigns each node a `target` relative to the new centre, and
one transition interpolates current → target while re-drawing arcs and label positions each frame. The
clicked wedge's target is the full centre disc (y 0..1), so it visibly sweeps round into a circle and
fades as its children unfold into the rings; Back runs the same interpolation the other way. The
wedges are created once per setTree() and only their attributes change afterwards.
*/

const RINGS = 2
const R0 = 74 // centre radius
const RING_W = 74
const RADIUS = R0 + RINGS * RING_W
export const SIZE = RADIUS * 2 + 12
const DURATION = 750 // ms, zoom transition
const HOVER_DARKEN = 0.5 // d3-color darker() amount on hover
/** how far a dimmed wedge fades towards white */
const DIM = 0.65
export const WARN = '#b45309'
/** wedges touch, divided by thin white lines, with bold white labels; the chart sits on the
 *  page background like every other plot */
const DIVIDER = '#ffffff'
export const SELECT_STROKE = '#111827'
const CENTRE_FILL = '#f8fafc'
const CENTRE_STROKE = '#cbd5e1'
export const TEXT_DARK = '#111827'
export const TEXT_MUTED = '#4b5563'
export const LINK = '#2563eb'
const CARD_BORDER = '#d1d5db'
const PILL_BG = '#e5e7eb'
export const RULE = '#e5e7eb'
/** shade of a ring relative to the centre: the inner ring a touch darker than its hue */
const RING_SHADE = [-0.35, 0]
const LABEL_FONT = 12 // px, bold
const LABEL_LINE_H = LABEL_FONT * 1.15
const LABEL_CHAR_W = LABEL_FONT * 0.55 // rough advance of a bold glyph
const LABEL_MAX_LINES = 2
const NO_HUE = '#9ca3af'

/** radius of a ring-unit coordinate: the centre disc spans 0..1, every ring after is RING_W */
const radius = (y: number) => (y < 1 ? y * R0 : R0 + (y - 1) * RING_W)
const midRadius = (g: Geom) => (radius(g.y0) + radius(g.y1)) / 2

/** small inline stroke icon for the controls above the chart; `paths` is the svg content */
export const icon = (paths: string) =>
	`<svg width="13" height="13" viewBox="0 0 24 24" style="vertical-align:-2px;margin-right:6px" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`

/** one wedge. `value` is the node's own weight (e.g. 1 for a sample-set leaf, or the samples that end
 *  at this node); d3 adds the subtree's weights to it, so a node's size is value + its children's */
export type SunNode = {
	name: string
	/** ring name; undefined for the root and for leaves that are not on a ring */
	level?: string
	value?: number
	children?: SunNode[]
	/** the wedge's own hue (e.g. a term category colour); otherwise it takes its nearest ancestor's */
	color?: string
	[payload: string]: any
}

export type HNode = any // d3 HierarchyRectangularNode<SunNode>
/** a card: rounded box with a spaced-capitals title and an optional right-hand slot in its head */
export type Card = { box: any; title: any; headRight: any; body: any }

export type SunburstHooks = {
	/** a wedge was clicked; the caller zooms (renderer.zoomTo) and/or selects */
	onClick: (d: HNode, event: any) => void
	isSelected: (d: HNode) => boolean
	isDimmed?: (d: HNode) => boolean
	/** css cursor of a visible wedge, default pointer */
	cursor?: (d: HNode) => string
	/** fills the tooltip below the wedge name */
	tooltip: (d: HNode, box: any) => void
	/** the centre changed (after setTree and every zoomTo): update stats, toolbar and side panels */
	onFocus: (focus: HNode) => void
}

export type SunburstRendererOpts = {
	holder: any
	/** the counted unit, e.g. sample set(s) or sample(s) */
	unit: { one: string; many: string }
	/** centre text at the root */
	rootName: string
	/** title of the path card at the root, e.g. 'Species selection' */
	rootPathTitle?: string
	/** base colour per first-ring value, before the node's own colour and the default palette */
	colors?: { [value: string]: string }
	/** stat box labels, values come from setStats() */
	statLabels?: string[]
	/** false: show the path as a breadcrumb above the chart, and leave the left column (dom.left)
	 *  to the caller; default true */
	pathCard?: boolean
	hooks: SunburstHooks
}

export class SunburstRenderer {
	opts: SunburstRendererOpts
	hooks: SunburstHooks
	dom: {
		/** path box: the first ring at the start, then the path of clicked wedges */
		pathCard?: Card
		/** left column for the caller's cards, when there is no path card */
		left?: any
		/** path line below the toolbar, when there is no path card */
		crumbs?: any
		toolbar: any
		reset: any
		svg: any
		g: any
		/** centre disc (drawn beneath the wedges) and the text on it */
		centre: any
		centreText: any
		/** one <path> per node, whole tree; hidden ones have fill-opacity 0 */
		paths: any
		/** one <text> per node, matching paths */
		labels: any
		stats: any
		/** column right of the chart, below the stat boxes, for the caller's cards */
		right: any
		tip: Menu
	}
	root?: HNode
	focus?: HNode
	/** stat box elements and the value they currently show, for the count animation */
	statValues: Map<string, { el: any; value: number; title: any }> = new Map()
	baseColor: Map<string, string> = new Map()

	constructor(opts: SunburstRendererOpts) {
		this.opts = opts
		this.hooks = opts.hooks
		const layout = opts.holder
			.append('div')
			.style('display', 'flex')
			.style('gap', '24px')
			.style('align-items', 'flex-start')
		// path box, or the caller's column, to the left of the chart
		const withPathCard = opts.pathCard !== false
		const pathCard = withPathCard ? card(layout, 'Selection') : undefined
		pathCard?.box.style('flex', '0 0 230px')
		const left = withPathCard
			? undefined
			: layout
					.append('div')
					.style('flex', '0 0 260px')
					.style('min-width', '0')
					.style('display', 'flex')
					.style('flex-direction', 'column')
					.style('gap', '12px')
		const panel = layout.append('div').append('div').style('width', `${SIZE}px`)
		// controls above the chart, in spaced capitals: reset, then any of the caller's (addControl)
		const toolbar = panel
			.append('div')
			.style('display', 'flex')
			.style('justify-content', 'center')
			.style('gap', '28px')
			.style('min-height', '20px')
		const crumbs = withPathCard
			? undefined
			: panel
					.append('div')
					.attr('data-testid', 'sjpp-sunburst-crumbs')
					.style('text-align', 'center')
					.style('font-size', '12px')
					.style('margin-top', '6px')
					.style('min-height', '16px')
		const svg = panel.append('svg').attr('width', SIZE).attr('height', SIZE).style('display', 'block')
		const right = layout
			.append('div')
			.style('flex', '0 0 300px')
			.style('min-width', '0')
			.style('display', 'flex')
			.style('flex-direction', 'column')
			.style('gap', '12px')
		// stat boxes; their numbers follow the centre of the chart and count up/down
		const stats = right
			.append('div')
			.style('display', 'grid')
			.style('grid-template-columns', '1fr 1fr')
			.style('gap', '8px')
		this.dom = {
			pathCard,
			left,
			crumbs,
			toolbar,
			reset: undefined,
			svg,
			g: svg.append('g').attr('transform', `translate(${SIZE / 2},${SIZE / 2})`),
			centre: undefined,
			centreText: undefined,
			paths: undefined,
			labels: undefined,
			stats,
			right,
			tip: new Menu({ padding: '' })
		}
		this.dom.reset = this.addControl()
			.html(`${icon('<path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 9 9 9"/>')}RESET`)
			.on('click', () => {
				if (this.focus?.depth) this.zoomTo(this.root)
			})
		for (const label of opts.statLabels || []) {
			const box = card(stats, label)
			box.box.style('padding', '6px 10px')
			// the label on one line, so the box stays short
			box.title
				.style('margin-bottom', '0')
				.style('white-space', 'nowrap')
				.style('overflow', 'hidden')
				.style('text-overflow', 'ellipsis')
				.attr('title', label)
			const num = box.body
				.append('div')
				.style('font-size', '20px')
				.style('line-height', '1.2')
				.style('font-weight', '500')
				.style('color', TEXT_DARK)
				.style('font-variant-numeric', 'tabular-nums')
				.text('0')
			this.statValues.set(label, { el: num, value: 0, title: box.title })
		}
	}

	/** a control in the toolbar above the chart */
	addControl() {
		return this.dom.toolbar
			.append('div')
			.style('letter-spacing', '0.15em')
			.style('font-size', '11px')
			.style('font-weight', 'bold')
			.style('color', TEXT_MUTED)
			.style('cursor', 'pointer')
			.style('user-select', 'none')
			.style('white-space', 'nowrap')
	}

	unitText(n: number): string {
		return `${n.toLocaleString()} ${n === 1 ? this.opts.unit.one : this.opts.unit.many}`
	}

	/** (re)draw the chart for a new tree, centred on the root */
	setTree(tree: SunNode) {
		this.root = hierarchy<SunNode>(tree)
			.sum(d => d.value || 0)
			.sort(() => 0)
		partition<SunNode>().size([2 * Math.PI, this.root.height + 1])(this.root)
		this.focus = this.root
		// first-ring colours: the dataset colours, the node's own, else a palette in ring order
		this.baseColor.clear()
		let pi = 0
		for (const c of this.root.children || []) {
			this.baseColor.set(
				c.data.name,
				this.opts.colors?.[c.data.name] || c.data.color || schemeTableau10[pi++ % schemeTableau10.length]
			)
		}
		this.buildChart()
		this.hooks.onFocus(this.focus)
	}

	/************ colours ************/

	/** the hue of a wedge: its own colour or its nearest ancestor's, down to the first ring's */
	hue(d: HNode): string {
		let n = d
		while (n.depth > 1) {
			if (n.data.color) return n.data.color
			n = n.parent
		}
		return n.depth === 1 ? this.baseColor.get(n.data.name) || NO_HUE : NO_HUE
	}

	/** the hue, shaded by the ring the wedge occupies around the current centre (so a wedge keeps its
	 *  hue at every zoom level), faded when dimmed */
	color(d: HNode): string {
		if (d.depth === 0) return CENTRE_FILL
		const ring = Math.max(0, Math.min(RING_SHADE.length - 1, d.depth - (this.focus?.depth ?? 0) - 1))
		const c = d3rgb(this.hue(d)).brighter(RING_SHADE[ring]).formatHex()
		return d.dim ? d3rgb(interpolate(c, '#ffffff')(DIM)).formatHex() : c
	}

	hoverColor(d: HNode): string {
		return d3rgb(this.color(d)).darker(HOVER_DARKEN).formatHex()
	}

	/************ rendering ************/

	arc = d3arc()
		.startAngle((d: any) => d.x0)
		.endAngle((d: any) => d.x1)
		.innerRadius((d: any) => radius(d.y0))
		.outerRadius((d: any) => Math.max(radius(d.y0), radius(d.y1)))

	/** build every wedge and label once; zoomTo() then only animates their attributes */
	buildChart() {
		const g = this.dom.g
		g.selectAll('*').remove()
		const root = this.root!
		root.each((d: HNode) => (d.current = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 } as Geom))
		const nodes = root.descendants().slice(1)

		// centre sits beneath the wedges so a clicked wedge can sweep over it as it grows;
		// hidden wedges have pointer-events none, so clicks fall through to the disc
		this.dom.centre = g.append('g')
		this.dom.centre
			.append('circle')
			.attr('r', R0 - 3)
			.attr('fill', CENTRE_FILL)
			.attr('stroke', CENTRE_STROKE)
			.attr('stroke-width', 1.5)
			.on('click', () => {
				if (this.focus!.depth) this.zoomTo(this.focus!.parent)
			})
		this.dom.centreText = this.dom.centre.append('g').attr('pointer-events', 'none')

		this.dom.paths = g
			.append('g')
			.selectAll('path')
			.data(nodes)
			.join('path')
			.attr('class', 'sjpp-sunburst-wedge')
			.attr('fill', (d: HNode) => this.color(d))
			.attr('fill-opacity', (d: HNode) => (arcVisible(d.current, RINGS) ? 1 : 0))
			.attr('stroke-opacity', (d: HNode) => (arcVisible(d.current, RINGS) ? 1 : 0))
			.attr('pointer-events', (d: HNode) => (arcVisible(d.current, RINGS) ? 'auto' : 'none'))
			.attr('d', (d: HNode) => this.arc(d.current))
			.style('cursor', 'pointer')
			.on('mouseenter', (event: any, d: HNode) => {
				select(event.currentTarget).attr('fill', this.hoverColor(d))
				this.showTip(event, d)
			})
			.on('mouseleave', (event: any, d: HNode) => {
				select(event.currentTarget).attr('fill', this.color(d))
				this.dom.tip.hide()
			})
			.on('click', (event: any, d: HNode) => this.hooks.onClick(d, event))

		this.dom.labels = g
			.append('g')
			.attr('pointer-events', 'none')
			.attr('text-anchor', 'middle')
			.style('user-select', 'none')
			.selectAll('text')
			.data(nodes)
			.join('text')
			.attr('font-size', `${LABEL_FONT}px`)
			.attr('font-weight', 'bold')
			.attr('fill', '#fff')
			.attr('dominant-baseline', 'middle')
			.attr('fill-opacity', (d: HNode) => (this.labelVisible(d.current) ? 1 : 0))
			.attr('transform', (d: HNode) => this.labelTransform(d.current))
			.each((d: HNode, i: number, els: any[]) => this.setLabelText(select(els[i]), d, d.current))

		this.refresh()
		this.renderCentre()
	}

	/** a label shows only where its wedge is visible and at least one line fits along the arc */
	labelVisible(g: Geom): boolean {
		return arcVisible(g, RINGS) && (g.x1 - g.x0) * midRadius(g) >= LABEL_LINE_H + 2
	}

	/** along the wedge's mid radius, reading outward; flipped in the left half so it is upright */
	labelTransform(g: Geom): string {
		const a = ((g.x0 + g.x1) / 2) * (180 / Math.PI)
		return `rotate(${a - 90}) translate(${midRadius(g)},0) rotate(${a < 180 ? 0 : 180})`
	}

	/** wrap the node name into as many lines as the wedge's arc length allows (max 2), each
	 *  no longer than the ring is thick */
	setLabelText(text: any, d: HNode, g: Geom) {
		const arcLen = (g.x1 - g.x0) * midRadius(g)
		const nLines = Math.max(1, Math.min(LABEL_MAX_LINES, Math.floor(arcLen / LABEL_LINE_H)))
		const maxChars = Math.floor((RING_W - 8) / LABEL_CHAR_W)
		const lines = splitLabel(d.data.name, maxChars, nLines)
		text.selectAll('tspan').remove()
		lines.forEach((l: string, i: number) => {
			text
				.append('tspan')
				.attr('x', 0)
				.attr('dy', i === 0 ? `${(-(lines.length - 1) * LABEL_LINE_H) / 2}px` : `${LABEL_LINE_H}px`)
				.text(l)
		})
	}

	/** name, count and Back on the centre disc */
	renderCentre() {
		const focus = this.focus!
		const t = this.dom.centreText
		t.selectAll('*').remove()
		this.dom.centre.select('circle').style('cursor', focus.depth ? 'pointer' : 'default')
		const name = focus.depth ? focus.data.name : this.opts.rootName
		const nameLines = splitLabel(name, Math.floor((2 * (R0 - 16)) / (15 * 0.6)), 2)
		const rows: { text: string; size: number; weight?: string; color: string; h: number }[] = [
			...nameLines.map(l => ({ text: l, size: 15, weight: 'bold', color: TEXT_DARK, h: 18 })),
			{ text: this.unitText(focus.value || 0), size: 12, color: TEXT_MUTED, h: 16 }
		]
		if (focus.depth) rows.push({ text: '‹  BACK', size: 12, weight: 'bold', color: LINK, h: 22 })
		const total = rows.reduce((s, r) => s + r.h, 0)
		let y = -total / 2
		for (const r of rows) {
			t.append('text')
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'middle')
				.attr('y', y + r.h / 2)
				.attr('font-size', `${r.size}px`)
				.attr('font-weight', r.weight || 'normal')
				.attr('fill', r.color)
				.attr('letter-spacing', r.text.endsWith('BACK') ? '0.12em' : null)
				.text(r.text)
			y += r.h
		}
	}

	/** re-apply selection strokes, dimming and the path card after the caller's selection changed;
	 *  no geometry changes */
	refresh() {
		this.root!.each((d: HNode) => (d.dim = !!this.hooks.isDimmed?.(d)))
		this.dom.paths
			.attr('fill', (d: HNode) => this.color(d))
			.attr('stroke', (d: HNode) => (this.hooks.isSelected(d) ? SELECT_STROKE : DIVIDER))
			.attr('stroke-width', (d: HNode) => (this.hooks.isSelected(d) ? 3 : 1))
			.attr('stroke-linejoin', 'round')
			.style('cursor', (d: HNode) => this.hooks.cursor?.(d) || 'pointer')
		this.dom.labels.attr('fill', (d: HNode) => (d.dim ? TEXT_MUTED : '#fff'))
		this.renderReset()
		this.renderPath()
	}

	/** reset is only active when zoomed in */
	renderReset() {
		const zoomed = !!this.focus?.depth
		this.dom.reset.style('opacity', zoomed ? 1 : 0.35).style('cursor', zoomed ? 'pointer' : 'default')
	}

	/** the path of clicked wedges, as the path card or the breadcrumb */
	renderPath() {
		if (this.dom.pathCard) this.renderPathCard(this.dom.pathCard)
		else this.renderCrumbs()
	}

	/** root › … › centre, each earlier step clickable to zoom back to it */
	renderCrumbs() {
		const box = this.dom.crumbs
		box.selectAll('*').remove()
		const focus = this.focus!
		const steps: HNode[] = focus.ancestors().reverse()
		steps.forEach((d: HNode, i: number) => {
			if (i) box.append('span').style('color', '#9ca3af').style('margin', '0 6px').text('›')
			const isFocus = d === focus
			box
				.append('span')
				.attr('class', 'sjpp-sunburst-crumb')
				.style('color', isFocus ? TEXT_DARK : LINK)
				.style('font-weight', isFocus ? 'bold' : 'normal')
				.style('cursor', isFocus ? 'default' : 'pointer')
				.attr('title', isFocus ? null : `Go to ${d.depth ? d.data.name : this.opts.rootName}`)
				.text(d.depth ? d.data.name : this.opts.rootName)
				.on('click', () => {
					if (!isFocus) this.zoomTo(d)
				})
		})
	}

	/** the path card: at the root it lists the first ring to click into; once zoomed it shows the path
	 *  of clicked wedges, each with a colour-coded badge, and clicking a line zooms back to it */
	renderPathCard(pathCard: Card) {
		const box = pathCard.body
		box.selectAll('*').remove()
		const focus = this.focus!
		const atRoot = !focus.depth
		pathCard.title.text(atRoot ? this.opts.rootPathTitle || 'Selection' : 'Selection')
		const nodes: HNode[] = atRoot ? this.root!.children || [] : focus.ancestors().reverse().slice(1)
		const STEP = 7 // px indent per ring, so the path reads as parent → child
		nodes.forEach((d: HNode, i: number) => {
			const isFocus = d === focus
			const indent = atRoot ? 0 : i * STEP
			const row = box.append('div').style('position', 'relative').style('margin-left', `${indent}px`)
			if (indent) {
				// elbow connector from the parent's badge column down into this line
				row
					.append('div')
					.style('position', 'absolute')
					.style('left', `${-STEP + 2}px`)
					.style('top', '-6px')
					.style('width', `${STEP - 4}px`)
					.style('height', '22px')
					.style('border-left', '1px solid #cbd5e1')
					.style('border-bottom', '1px solid #cbd5e1')
					.style('border-bottom-left-radius', '4px')
			}
			const line = row
				.append('div')
				.attr('class', 'sjpp-sunburst-pathrow')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('gap', '8px')
				.style('padding', '4px 6px')
				.style('margin', '2px 0')
				.style('border-radius', '6px')
				.style('background', isFocus ? '#eef2ff' : 'transparent')
				.style('cursor', isFocus ? 'default' : 'pointer')
				.attr('title', isFocus ? d.data.name : `Go to ${d.data.name}`)
				.on('click', () => {
					if (!isFocus) this.zoomTo(d)
				})
				.on('mouseenter', (event: any) => {
					if (!isFocus) select(event.currentTarget).style('background', '#f3f4f6')
				})
				.on('mouseleave', (event: any) => {
					if (!isFocus) select(event.currentTarget).style('background', 'transparent')
				})
			badge(line, d.data.name, this.color(d))
			const text = line.append('div').style('flex', '1 1 auto').style('min-width', '0').style('line-height', '1.2')
			text
				.append('div')
				.style('font-size', '0.9em')
				.style('font-weight', isFocus ? 'bold' : 'normal')
				.style('color', '#111827')
				.style('overflow', 'hidden')
				.style('text-overflow', 'ellipsis')
				.style('white-space', 'nowrap')
				.text(d.data.name)
			text
				.append('div')
				.style('font-size', '0.7em')
				.style('color', '#6b7280')
				.text(`${d.data.level} · ${this.unitText(d.value || 0)}`)
		})
	}

	/** shown title of a stat box, which keeps `label` as its key */
	setStatTitle(label: string, text: string) {
		this.statValues.get(label)?.title.text(text).attr('title', text)
	}

	/** stat box values, by label; null shows a dash with `nullTitle` as its tooltip. Numbers roll from
	 *  the previous value */
	setStats(values: Map<string, number | null>, nullTitle = (_label: string) => '') {
		for (const [label, v] of values) {
			const box = this.statValues.get(label)
			if (!box) continue
			if (v === null) {
				box.el
					.interrupt()
					.text('—')
					.attr('title', nullTitle(label) || null)
				box.value = 0
				continue
			}
			box.el.attr('title', null)
			const from = box.value
			box.value = v
			const i = interpolate(from, v)
			box.el
				.transition()
				.duration(DURATION)
				.tween('text', () => (t: number) => box.el.text(Math.round(i(t)).toLocaleString()))
		}
	}

	/************ interaction ************/

	/** animate every wedge from its current geometry to where it sits with `p` at the centre */
	zoomTo(p: HNode) {
		this.focus = p
		this.dom.tip.hide()
		const root = this.root!
		root.each((d: HNode) => (d.target = zoomTarget(d, p)))
		const t = this.dom.g.transition().duration(DURATION)

		// no hover or clicks on wedges while they move (a wedge sweeping under the cursor would
		// otherwise darken and pop a tooltip); the visible ones take pointer events again at the end.
		// A zoom that interrupts this one re-runs the same steps, so nothing is left disabled.
		this.dom.paths.attr('pointer-events', 'none')
		// judged by the target, not d.current: the group's end event fires a tick before the
		// wedge tweens write their final frame, so current would still be a hair short of it
		t.on('end', () =>
			this.dom.paths.attr('pointer-events', (d: HNode) => (arcVisible(d.target, RINGS) ? 'auto' : 'none'))
		)
		this.dom.paths
			.transition(t)
			// every node's current geometry moves, even hidden ones, so a later zoom starts right
			.tween('data', (d: HNode) => {
				const i = interpolate(d.current, d.target)
				return (k: number) => (d.current = i(k))
			})
			.filter(function (this: any, d: HNode) {
				return +this.getAttribute('fill-opacity') || arcVisible(d.target, RINGS)
			})
			.attr('fill-opacity', (d: HNode) => (arcVisible(d.target, RINGS) ? 1 : 0))
			.attr('stroke-opacity', (d: HNode) => (arcVisible(d.target, RINGS) ? 1 : 0))
			.attr('fill', (d: HNode) => this.color(d))
			.attrTween('d', (d: HNode) => () => this.arc(d.current))

		this.dom.labels
			.filter((d: HNode, i: number, els: any[]) => +els[i].getAttribute('fill-opacity') || this.labelVisible(d.target))
			.each((d: HNode, i: number, els: any[]) => this.setLabelText(select(els[i]), d, d.target))
			.transition(t)
			.attr('fill-opacity', (d: HNode) => (this.labelVisible(d.target) ? 1 : 0))
			.attrTween('transform', (d: HNode) => () => this.labelTransform(d.current))

		// the new centre text fades in beneath the wedge sweeping over the disc
		this.renderCentre()
		this.dom.centreText.attr('opacity', 0).transition(t).attr('opacity', 1)
		this.renderReset()
		this.renderPath()
		this.hooks.onFocus(p)
	}

	showTip(event: any, d: HNode) {
		this.dom.tip.clear().show(event.clientX, event.clientY)
		const box = this.dom.tip.d
			.append('div')
			.style('padding', '10px 14px')
			.style('min-width', '170px')
			.style('font-size', '13px')
			.style('line-height', '1.45')
		box.append('div').style('font-weight', 'bold').style('font-size', '14px').text(d.data.name)
		this.hooks.tooltip(d, box)
	}

	destroy() {
		this.dom.tip.destroy?.()
	}
}

/************ shared pieces ************/

/** the card every box on the page is built from: rounded border, spaced-capitals title,
 *  a right-hand slot in the head for a count or control, and a body */
export function card(holder: any, title: string): Card {
	const box = holder
		.append('div')
		.style('border', `1px solid ${CARD_BORDER}`)
		.style('border-radius', '10px')
		.style('padding', '10px 12px')
		.style('box-sizing', 'border-box')
	const head = box
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('justify-content', 'space-between')
		.style('gap', '8px')
	const titleDiv = head
		.append('div')
		.style('font-size', '10px')
		.style('font-weight', 'bold')
		.style('letter-spacing', '0.12em')
		.style('text-transform', 'uppercase')
		.style('color', TEXT_MUTED)
		.style('margin-bottom', '8px')
		.text(title)
	const headRight = head.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '8px')
	return { box, title: titleDiv, headRight, body: box.append('div') }
}

/** colour-coded square with the short code of a name */
export function badge(holder: any, name: string, color: string, size = 30) {
	return holder
		.append('span')
		.style('flex', '0 0 auto')
		.style('min-width', `${size}px`)
		.style('height', `${size}px`)
		.style('line-height', `${size}px`)
		.style('padding', '0 4px')
		.style('box-sizing', 'border-box')
		.style('border-radius', '6px')
		.style('background', color)
		.style('color', '#fff')
		.style('font-weight', 'bold')
		.style('font-size', size >= 30 ? '0.8em' : '0.7em')
		.style('text-align', 'center')
		.text(badgeCode(name))
}

/** rounded pill: the primary action button, or a count */
export function pill(holder: any, opts: { button?: boolean } = {}) {
	const el = holder
		.append(opts.button ? 'button' : 'span')
		.style('border-radius', '999px')
		.style('font-weight', 'bold')
		.style('font-variant-numeric', 'tabular-nums')
	if (opts.button)
		el.style('border', 'none')
			.style('background', SELECT_STROKE)
			.style('color', '#fff')
			.style('font-size', '13px')
			.style('padding', '8px 16px')
			.style('width', '100%')
			.style('cursor', 'pointer')
	else el.style('background', PILL_BG).style('color', TEXT_DARK).style('font-size', '11px').style('padding', '1px 8px')
	return el
}

/** short code for a badge: short upper-case names as they are (AD, CSF, T-ALL), the leading number
 *  of a bin label (10 to <20 → 10), initials of multi-word names (Frontal Cortex → FC), else the
 *  first two letters (Human → HU) */
export function badgeCode(name: string): string {
	if (name.length <= 5 && name === name.toUpperCase()) return name
	const words = name.split(/[\s()]+/).filter(Boolean)
	if (/^[<>≤≥]?[\d.]+$/.test(words[0] || '')) return words[0].slice(0, 5)
	if (words.length > 1)
		return words
			.map(w => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 3)
	return name.slice(0, 2).toUpperCase()
}

/*********** zoom geometry (d3 zoomable-sunburst) ***********/

/** arc geometry of one wedge in partition units: angles in radians; y in ring units, where
 *  y=0 is the centre point, y=1 the edge of the centre circle and y=2 the outer edge of the
 *  first ring */
type Geom = { x0: number; x1: number; y0: number; y1: number }

/** where a node lands once `focus` is the centre: its angles are rescaled to the focus's
 *  span (clamped, so wedges outside the focus collapse to zero width) and its rings shift
 *  inward by the focus depth (so the focus itself becomes the full centre disc, y 0..1,
 *  and its ancestors collapse onto the centre point). Interpolating a node's current
 *  geometry toward this is what makes a clicked wedge sweep into a circle. */
function zoomTarget(d: Geom & { depth: number }, focus: Geom & { depth: number }): Geom {
	const span = focus.x1 - focus.x0 || 1
	const ang = (x: number) => Math.max(0, Math.min(1, (x - focus.x0) / span)) * 2 * Math.PI
	return {
		x0: ang(d.x0),
		x1: ang(d.x1),
		y0: Math.max(0, d.y0 - focus.depth),
		y1: Math.max(0, d.y1 - focus.depth)
	}
}

/** a wedge is drawn when it lies within the `rings` shown around the centre and has width */
function arcVisible(g: Geom, rings: number): boolean {
	return g.y0 >= 1 && g.y1 <= rings + 1 && g.x1 > g.x0
}

/** break a label into at most `maxLines` lines of at most `maxChars` characters, splitting
 *  at spaces; a line that still does not fit is truncated with an ellipsis */
export function splitLabel(text: string, maxChars: number, maxLines: number): string[] {
	const words = text.split(/\s+/).filter(Boolean)
	const lines: string[] = []
	let cur = ''
	for (const w of words) {
		if (!cur) cur = w
		else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w
		else {
			lines.push(cur)
			cur = w
		}
	}
	if (cur) lines.push(cur)
	if (lines.length > maxLines) {
		const rest = lines.slice(maxLines - 1).join(' ')
		lines.length = maxLines - 1
		lines.push(rest)
	}
	return lines.map(l => (l.length > maxChars ? l.slice(0, Math.max(1, maxChars - 1)) + '…' : l))
}

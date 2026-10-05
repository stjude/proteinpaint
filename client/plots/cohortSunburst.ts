import type { MassState, BasePlotConfig } from '#mass/types/mass'
import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from './PlotBase'
import { Menu } from '#dom'
import { hierarchy, partition } from 'd3-hierarchy'
import { arc as d3arc } from 'd3-shape'
import { rgb as d3rgb } from 'd3-color'
import { interpolate } from 'd3-interpolate'
import { select } from 'd3-selection'
import 'd3-transition'
import { schemeTableau10 } from 'd3-scale-chromatic'
import { deriveCatalogRows, catalogRowKey, cohortMatches, type CatalogRow } from './proteome.catalog'
import type { ProteomeCohortSunburstConfig, ProteomeSunburstStat } from '#types'

/*
Zoomable cohort sunburst.

Rings follow the dataset's `cohortSunburst.levels` (e.g. species → sample type → sample
source → disease → assay), each wedge sized by the number of sample sets (cohorts) beneath it. Two rings are shown around the centre; clicking an inner wedge zooms
so that wedge becomes the centre and the next two rings appear; the centre offers Back.
Clicking a sample-set wedge (outermost leaf) toggles it in the selection, and "Select all"
adds every sample set under the current centre. The selection panel launches the same
actions as the Studies catalog: one cohort → Analytics Tools, several → cohort compare.

Zooming is animated the way d3's zoomable sunburst does it: every node keeps a
`current` geometry (angles + ring units, see Geom); a click assigns each node a `target`
relative to the new centre, and one transition interpolates current → target while
re-drawing arcs and label positions each frame. The clicked wedge's target is the full
centre disc (y 0..1), so it visibly sweeps round into a circle and fades as its children
unfold into the rings; Back runs the same interpolation the other way, so the centre disc
shrinks back into its wedge. The wedges are created once per data load and only their
attributes change afterwards.
*/

const RINGS = 2
const R0 = 74 // centre radius
const RING_W = 74
const RADIUS = R0 + RINGS * RING_W
const SIZE = RADIUS * 2 + 12
const DURATION = 750 // ms, zoom transition
const HOVER_DARKEN = 0.5 // d3-color darker() amount on hover
/** how far a wedge of another kind than the selection fades towards white */
const DIM = 0.65
const WARN = '#b45309'
/** wedges touch, divided by thin white lines, with bold white labels; the chart sits on the
 *  page background like every other plot */
const DIVIDER = '#ffffff'
const SELECT_STROKE = '#111827'
const CENTRE_FILL = '#f8fafc'
const CENTRE_STROKE = '#cbd5e1'
const TEXT_DARK = '#111827'
const TEXT_MUTED = '#4b5563'
const LINK = '#2563eb'
const CARD_BORDER = '#d1d5db'
const PILL_BG = '#e5e7eb'
const RULE = '#e5e7eb'
/** shade of a ring relative to the centre: the inner ring a touch darker than the species colour */
const RING_SHADE = [-0.35, 0]
const LABEL_FONT = 12 // px, bold
const LABEL_LINE_H = LABEL_FONT * 1.15
const LABEL_CHAR_W = LABEL_FONT * 0.55 // rough advance of a bold glyph
const LABEL_MAX_LINES = 2

/** radius of a ring-unit coordinate: the centre disc spans 0..1, every ring after is RING_W */
const radius = (y: number) => (y < 1 ? y * R0 : R0 + (y - 1) * RING_W)
const midRadius = (g: Geom) => (radius(g.y0) + radius(g.y1)) / 2

/** small inline stroke icon for the controls above the chart; `paths` is the svg content */
const icon = (paths: string) =>
	`<svg width="13" height="13" viewBox="0 0 24 24" style="vertical-align:-2px;margin-right:6px" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`

type HNode = any // d3 HierarchyRectangularNode<TreeNode>
/** a card: rounded box with a spaced-capitals title and an optional right-hand slot in its head */
type Card = { box: any; title: any; headRight: any; body: any }

const defaultConfig = { chartType: 'cohortSunburst' }

class CohortSunburst extends PlotBase implements RxComponent {
	static type = 'cohortSunburst'
	type: string
	dom!: {
		holder: any
		body: any
		/** path box: species at the start, then the path of clicked wedges */
		selBox: Card
		/** the selected sample sets, with the analyze/compare action */
		sel: Card
		reset: any
		/** "select all" control beside reset, for the sample sets under the centre */
		selectAll: any
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
		tip: Menu
		header?: any
	}
	ui?: SunburstUiConfig
	root?: HNode
	focus?: HNode
	/** stat box elements and the value they currently show, for the count animation */
	statValues: Map<string, { el: any; value: number }> = new Map()
	/** selected cohorts by key, in selection order */
	selected: Map<string, CatalogRow> = new Map()
	/** leaf node of each cohort by key, for its species colour and ring label */
	leafNode: Map<string, HNode> = new Map()
	baseColor: Map<string, string> = new Map()

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = CohortSunburst.type
	}

	async init() {
		// the plot holder inherits nowrap from the sandbox; the cards need their text to wrap
		const holder = this.opts.holder.append('div').style('padding', '10px').style('white-space', 'normal')
		const body = holder.append('div')
		this.dom = {
			holder,
			body,
			selBox: undefined as any,
			sel: undefined as any,
			reset: undefined,
			selectAll: undefined,
			svg: undefined,
			g: undefined,
			centre: undefined,
			centreText: undefined,
			paths: undefined,
			labels: undefined,
			stats: undefined,
			tip: new Menu({ padding: '' }),
			header: this.opts.header
		}
		if (this.dom.header) this.dom.header.html('Explore cohorts')
	}

	getState(appState: MassState) {
		const config: any = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return { config }
	}

	async main() {
		const proteome = this.app.vocabApi.termdbConfig?.queries?.proteome
		const ui: SunburstUiConfig | undefined = proteome?.cohortSunburst
		this.dom.body.selectAll('*').remove()
		if (!ui?.levels?.length || !proteome?.organisms) {
			this.dom.body
				.append('div')
				.style('padding', '20px')
				.style('color', '#666')
				.text('No cohort sunburst is configured.')
			return
		}
		this.ui = ui
		const tree = buildTree(deriveCatalogRows(proteome.organisms), ui)
		this.root = hierarchy<TreeNode>(tree)
			.sum(d => (d.cohort ? 1 : 0))
			.sort(() => 0)
		partition<TreeNode>().size([2 * Math.PI, this.root.height + 1])(this.root)
		this.focus = this.root
		this.leafNode = new Map(this.root.leaves().map((l: HNode) => [cohortKey(l.data.cohort), l]))
		// first-ring colours: dataset colors, else a palette in ring order
		this.baseColor.clear()
		let pi = 0
		for (const c of this.root.children || []) {
			this.baseColor.set(c.data.name, ui.colors?.[c.data.name] || schemeTableau10[pi++ % schemeTableau10.length])
		}

		const layout = this.dom.body
			.append('div')
			.style('display', 'flex')
			.style('gap', '24px')
			.style('align-items', 'flex-start')
		//  path box to the left of the chart
		this.dom.selBox = this.card(layout, 'Selection')
		this.dom.selBox.box.style('flex', '0 0 230px')
		const left = layout.append('div')
		const panel = left.append('div').style('width', `${SIZE}px`)
		// controls above the chart, in spaced capitals: reset, and select all
		// sample sets under the centre
		const toolbar = panel
			.append('div')
			.style('display', 'flex')
			.style('justify-content', 'center')
			.style('gap', '28px')
			.style('min-height', '20px')
		const control = () =>
			toolbar
				.append('div')
				.style('letter-spacing', '0.15em')
				.style('font-size', '11px')
				.style('font-weight', 'bold')
				.style('color', TEXT_MUTED)
				.style('cursor', 'pointer')
				.style('user-select', 'none')
				.style('white-space', 'nowrap')
		this.dom.reset = control()
			.html(`${icon('<path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 9 9 9"/>')}RESET`)
			.on('click', () => {
				if (this.focus!.depth) this.zoomTo(this.root)
			})
		this.dom.selectAll = control().on('click', () => this.toggleSelectAll())
		this.dom.svg = panel.append('svg').attr('width', SIZE).attr('height', SIZE).style('display', 'block')
		this.dom.g = this.dom.svg.append('g').attr('transform', `translate(${SIZE / 2},${SIZE / 2})`)
		const right = layout
			.append('div')
			.style('flex', '0 0 300px')
			.style('min-width', '0')
			.style('display', 'flex')
			.style('flex-direction', 'column')
			.style('gap', '12px')
		// stat boxes; their numbers follow the centre of the chart and count up/down
		this.dom.stats = right
			.append('div')
			.style('display', 'grid')
			.style('grid-template-columns', '1fr 1fr')
			.style('gap', '8px')
		this.statValues = new Map()
		for (const def of ui.stats || []) {
			const box = this.card(this.dom.stats, def.label)
			box.box.style('padding', '8px 12px')
			box.title.style('margin-bottom', '0')
			const num = box.body
				.append('div')
				.style('font-size', '24px')
				.style('font-weight', '500')
				.style('color', TEXT_DARK)
				.style('font-variant-numeric', 'tabular-nums')
				.text('0')
			this.statValues.set(def.label, { el: num, value: 0 })
		}
		this.dom.sel = this.card(right, 'Selected sample sets')
		this.buildChart()
		this.renderStats()
	}

	/************ shared pieces ************/

	/** the card every box on the page is built from: rounded border, spaced-capitals title,
	 *  a right-hand slot in the head for a count or control, and a body */
	card(holder: any, title: string): Card {
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
	badge(holder: any, name: string, color: string, size = 30) {
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
			.text(this.badgeCode(name))
	}

	/** rounded pill: the primary action button, or a count */
	pill(holder: any, opts: { button?: boolean } = {}) {
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
		else
			el.style('background', PILL_BG).style('color', TEXT_DARK).style('font-size', '11px').style('padding', '1px 8px')
		return el
	}

	/************ colours ************/

	/** the first-ring (species) colour a wedge or cohort belongs to */
	speciesColor(d: HNode): string {
		let top = d
		while (top.depth > 1) top = top.parent
		return this.baseColor.get(top.data.name) || '#9ca3af'
	}

	/** the species colour, shaded by the ring the wedge occupies around the current centre
	 *  (so a wedge keeps its species hue at every zoom level) */
	color(d: HNode): string {
		if (d.depth === 0) return CENTRE_FILL
		const base = this.speciesColor(d)
		const ring = Math.max(0, Math.min(RING_SHADE.length - 1, d.depth - (this.focus?.depth ?? 0) - 1))
		const c = d3rgb(base).brighter(RING_SHADE[ring]).formatHex()
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
			.on('click', (_: any, d: HNode) => this.onWedgeClick(d))

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

		this.refreshSelection()
		this.renderCentre()
		this.renderSelBox()
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

	/** name, sample-set count and Back on the centre disc */
	renderCentre() {
		const focus = this.focus!
		const t = this.dom.centreText
		t.selectAll('*').remove()
		this.dom.centre.select('circle').style('cursor', focus.depth ? 'pointer' : 'default')
		const name = focus.depth ? focus.data.name : 'All sample sets'
		const nameLines = splitLabel(name, Math.floor((2 * (R0 - 16)) / (15 * 0.6)), 2)
		const n = countLeaves(focus.data)
		const rows: { text: string; size: number; weight?: string; color: string; h: number }[] = [
			...nameLines.map(l => ({ text: l, size: 15, weight: 'bold', color: TEXT_DARK, h: 18 })),
			{ text: `${n} sample set${n === 1 ? '' : 's'}`, size: 12, color: TEXT_MUTED, h: 16 }
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

	/** selection strokes on the wedges plus the selection panel; no geometry changes */
	refreshSelection() {
		// a wedge is dimmed when nothing beneath it can join the current selection
		const kind = this.selectedKind()
		this.root!.each((d: HNode) => {
			d.dim = kind !== undefined && !leavesOf(d.data).some(l => this.compatible(l.cohort!))
		})
		this.dom.paths
			.attr('fill', (d: HNode) => this.color(d))
			.attr('stroke', (d: HNode) => (this.isSelected(d) ? SELECT_STROKE : DIVIDER))
			.attr('stroke-width', (d: HNode) => (this.isSelected(d) ? 3 : 1))
			.attr('stroke-linejoin', 'round')
			.style('cursor', (d: HNode) => (d.dim && this.terminalLeaf(d) ? 'not-allowed' : 'pointer'))
		this.dom.labels.attr('fill', (d: HNode) => (d.dim ? TEXT_MUTED : '#fff'))
		this.renderToolbar()
		this.renderSidebar()
	}

	/************ selection kind ************/

	kindKeys(): string[] {
		return this.ui?.selectionKind?.keys || []
	}

	/** the kind of the current selection; undefined when nothing is selected */
	selectedKind(): string | undefined {
		const first = this.selected.values().next()
		return first.done ? undefined : kindOf(first.value, this.kindKeys())
	}

	/** whether a cohort could be added to the current selection */
	compatible(r: CatalogRow): boolean {
		const kind = this.selectedKind()
		return kind === undefined || kindOf(r, this.kindKeys()) === kind
	}

	/** short code for a badge: short upper-case names as they are (AD, CSF), initials of
	 *  multi-word names (Frontal Cortex → FC), else the first two letters (Human → HU) */
	badgeCode(name: string): string {
		if (name.length <= 4 && name === name.toUpperCase()) return name
		const words = name.split(/[\s()]+/).filter(Boolean)
		if (words.length > 1)
			return words
				.map(w => w[0])
				.join('')
				.toUpperCase()
				.slice(0, 3)
		return name.slice(0, 2).toUpperCase()
	}

	/** the selection box: at the root it lists the first ring (species) to click into; once
	 *  zoomed it shows the path of clicked wedges, each with a colour-coded badge, and clicking
	 *  a line zooms back to it */
	renderSelBox() {
		const box = this.dom.selBox.body
		box.selectAll('*').remove()
		const focus = this.focus!
		const atRoot = !focus.depth
		this.dom.selBox.title.text(atRoot ? `${this.ui!.levels[0]?.name || ''} selection`.trim() : 'Selection')
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
			this.badge(line, d.data.name, this.color(d))
			const text = line.append('div').style('min-width', '0').style('line-height', '1.2')
			text
				.append('div')
				.style('font-size', '0.9em')
				.style('font-weight', isFocus ? 'bold' : 'normal')
				.style('color', '#111827')
				.style('overflow', 'hidden')
				.style('text-overflow', 'ellipsis')
				.style('white-space', 'nowrap')
				.text(d.data.name)
			const n = countLeaves(d.data)
			text
				.append('div')
				.style('font-size', '0.7em')
				.style('color', '#6b7280')
				.text(`${d.data.level} · ${n} sample set${n === 1 ? '' : 's'}`)
		})
	}

	/** stat boxes for the sample sets under the centre; numbers roll from the previous value */
	renderStats() {
		const leaves = leavesOf(this.focus!.data)
		for (const def of this.ui!.stats || []) {
			const box = this.statValues.get(def.label)
			if (!box) continue
			const v = computeStat(leaves, def)
			if (v === null) {
				box.el.text('—').attr('title', `No ${def.key || ''} counts in the dataset yet`)
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

	/** the sample sets Select all would take under the centre: those of the selected kind,
	 *  or, with nothing selected, of the largest kind there; and whether all are selected */
	underFocus(): { under: TreeNode[]; allIn: boolean; kind: string } {
		const leaves = leavesOf(this.focus!.data)
		const keys = this.kindKeys()
		const kind = this.selectedKind() ?? largestKind(leaves, keys)
		const under = leaves.filter(l => kindOf(l.cohort!, keys) === kind)
		const allIn = under.length > 0 && under.every(l => this.selected.has(cohortKey(l.cohort!)))
		return { under, allIn, kind }
	}

	toggleSelectAll() {
		const { under, allIn } = this.underFocus()
		if (!under.length) return
		for (const l of under) {
			if (allIn) this.selected.delete(cohortKey(l.cohort!))
			else this.selected.set(cohortKey(l.cohort!), l.cohort!)
		}
		this.refreshSelection()
	}

	/** reset is only active when zoomed in; select all follows the centre and flips to
	 *  deselect once everything under it is selected */
	renderToolbar() {
		const zoomed = !!this.focus!.depth
		this.dom.reset.style('opacity', zoomed ? 1 : 0.35).style('cursor', zoomed ? 'pointer' : 'default')
		const { under, allIn, kind } = this.underFocus()
		const what = kind ? `${kind} sample sets` : 'sample sets'
		const none = !under.length
		this.dom.selectAll
			.style('opacity', none ? 0.35 : 1)
			.style('cursor', none ? 'default' : 'pointer')
			.attr(
				'title',
				none
					? `No ${what} under the centre; clear the selection to pick other kinds`
					: allIn
					? `Deselect every ${what.replace(/s$/, '')} under the centre`
					: `Select every ${what.replace(/s$/, '')} under the centre`
			)
			.html(
				allIn
					? `${icon('<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>')}DESELECT ALL`
					: `${icon('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>')}SELECT ALL ${under.length}${
							kind ? ` · ${kind.toUpperCase()}` : ''
					  }`
			)
	}

	/** the selected-sample-sets card: count in the head, one line per set with its species
	 *  badge, and the analyze/compare action as the footer */
	renderSidebar() {
		const { title, headRight, body } = this.dom.sel
		headRight.selectAll('*').remove()
		body.selectAll('*').remove()
		headRight.style('margin-bottom', '8px')
		const n = this.selected.size
		title.text(n ? 'Selected sample sets' : 'No sample sets selected')
		if (n) {
			this.pill(headRight).text(n)
			headRight
				.append('span')
				.style('font-size', '11px')
				.style('color', LINK)
				.style('cursor', 'pointer')
				.text('Clear')
				.on('click', () => {
					this.selected.clear()
					this.refreshSelection()
				})
		}

		const kind = this.selectedKind()
		if (kind) {
			body
				.append('div')
				.style('font-size', '0.75em')
				.style('color', TEXT_MUTED)
				.style('margin-bottom', '4px')
				.text(`${kind} only · clear the selection to pick another kind`)
		}
		const list = body
			.append('div')
			.style('max-height', `${SIZE - 200}px`)
			.style('overflow-y', 'auto')
		if (!n) {
			list
				.append('div')
				.style('font-size', '0.85em')
				.style('color', TEXT_MUTED)
				.style('padding', '4px 0')
				.text('Click a sample-set wedge, or Select all above the chart.')
		}
		for (const [k, r] of this.selected) {
			const leaf = this.leafNode.get(k)
			const line = list
				.append('div')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('gap', '8px')
				.style('padding', '3px 6px')
				.style('margin', '2px 0')
				.style('border-radius', '6px')
				.on('mouseenter', (event: any) => {
					select(event.currentTarget).style('background', '#f3f4f6').select('.sjpp-sunburst-remove').style('opacity', 1)
				})
				.on('mouseleave', (event: any) => {
					select(event.currentTarget)
						.style('background', 'transparent')
						.select('.sjpp-sunburst-remove')
						.style('opacity', 0)
				})
			this.badge(line, leaf?.data.name || r.cohort, leaf ? this.speciesColor(leaf) : '#9ca3af', 24)
			const text = line.append('div').style('flex', '1 1 auto').style('min-width', '0').style('line-height', '1.2')
			text
				.append('div')
				.style('font-size', '0.9em')
				.style('color', TEXT_DARK)
				.style('overflow', 'hidden')
				.style('text-overflow', 'ellipsis')
				.style('white-space', 'nowrap')
				.text(this.selectionLabel(r))
			text
				.append('div')
				.style('font-size', '0.7em')
				.style('color', '#6b7280')
				.text(r.proteome + (r.placeholder ? ' · placeholder data' : ''))
			line
				.append('span')
				.attr('class', 'sjpp-sunburst-remove')
				.style('opacity', 0)
				.style('cursor', 'pointer')
				.style('color', '#9ca3af')
				.style('font-size', '0.85em')
				.attr('title', 'Remove')
				.text('✕')
				.on('click', () => {
					this.selected.delete(k)
					this.refreshSelection()
				})
		}

		// PTM (site-level) and protein-level z are not comparable
		const types = new Set([...this.selected.values()].map(r => r.dataType))
		if (types.size > 1) {
			body
				.append('div')
				.style('font-size', '0.8em')
				.style('color', WARN)
				.style('margin-top', '6px')
				.text('Selection mixes PTM (site-level) and protein-level assays; their log2FC-z are not directly comparable.')
		}

		const footer = body
			.append('div')
			.style('margin-top', '10px')
			.style('padding-top', '10px')
			.style('border-top', `1px solid ${RULE}`)
		this.pill(footer, { button: true })
			.property('disabled', n === 0)
			.style('opacity', n ? 1 : 0.3)
			.style('cursor', n ? 'pointer' : 'default')
			.text(n >= 2 ? `Compare ${n} cohorts` : 'Analyze cohort')
			.on('click', () => this.onAction())
	}

	/************ interaction ************/

	/** the single sample set a wedge stands for: the leaf itself, or the only leaf beneath an
	 *  inner wedge (e.g. a human assay wedge with one cohort), so it can be selected without
	 *  zooming down to a lone full-circle wedge */
	terminalLeaf(d: HNode): CatalogRow | undefined {
		if (d.data.cohort) return d.data.cohort
		if (countLeaves(d.data) !== 1) return undefined
		return leavesOf(d.data)[0].cohort
	}

	isSelected(d: HNode): boolean {
		const r = this.terminalLeaf(d)
		return !!r && this.selected.has(cohortKey(r))
	}

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
		this.renderStats()
		this.renderToolbar()
		this.renderSelBox()
		this.renderSidebar()
	}

	onWedgeClick(d: HNode) {
		const r = this.terminalLeaf(d)
		if (r) {
			if (!this.compatible(r)) return // the tooltip says why
			const k = cohortKey(r)
			if (this.selected.has(k)) this.selected.delete(k)
			else this.selected.set(k, r)
			this.refreshSelection()
		} else this.zoomTo(d)
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
		const r = this.terminalLeaf(d)
		const stat = (label: string, value: string | number) => {
			const line = box.append('div').style('color', '#374151')
			line.append('span').text(`${label}: `)
			line.append('b').text(String(value))
		}
		const note = (text: string, color: string) =>
			box.append('div').style('margin-top', '4px').style('color', color).text(text)
		const kind = this.selectedKind()
		if (r) {
			box.append('div').style('color', '#6b7280').text(`${r.species} · ${r.proteome} · ${r.cohort}`)
			if (r.placeholder) box.append('div').style('color', WARN).text('placeholder data')
			if (!this.compatible(r))
				note(`Clear the ${kind} selection to select a ${kindOf(r, this.kindKeys())} sample set`, WARN)
			else note(this.selected.has(cohortKey(r)) ? 'click to deselect' : 'click to select', LINK)
		} else {
			box.append('div').style('color', '#6b7280').text(d.data.level)
			stat('Sample sets', countLeaves(d.data))
			if (d.dim) note(`No ${kind} sample sets here; clear the selection to pick from these`, WARN)
			note('click to zoom in', LINK)
		}
	}

	/** label for the selection list / compare plot; adds the assay when several are selected */
	selectionLabel(r: CatalogRow): string {
		const species = r.species
		const leaf = this.leafNode.get(cohortKey(r))
		const base = `${species} ${leaf?.data.name || r.cohort}`
		const assays = new Set([...this.selected.values()].map(x => x.proteome))
		return assays.size > 1 ? `${base} (${r.proteome})` : base
	}

	onAction() {
		const sel = [...this.selected.values()]
		if (sel.length === 1) {
			const c = sel[0]
			this.app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'ProteomeInput',
					proteomeDetails: { organism: c.organism, assay: c.assay, cohort: c.cohort },
					hidePlotFilter: true
				}
			})
		} else if (sel.length >= 2) {
			this.app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'proteomeCohortCompare',
					cohorts: sel.map(c => ({
						organism: c.organism,
						assay: c.assay,
						cohort: c.cohort,
						label: this.selectionLabel(c)
					}))
				}
			})
		}
	}
}

/*********** tree building and zoom geometry (DOM-free) ***********/

type SunburstUiConfig = ProteomeCohortSunburstConfig
type Level = SunburstUiConfig['levels'][number]

type TreeNode = {
	name: string
	/** ring name (Level.name); undefined for the root and the leaves */
	level?: string
	children?: TreeNode[]
	/** leaves only */
	cohort?: CatalogRow
}

/** the value of one ring for a cohort, '' if the ring does not apply to it */
function levelValue(row: CatalogRow, level: Level): string {
	for (const v of level.values) {
		if (v.when && !cohortMatches(v.when, row.organism, row.assay, row)) continue
		if (v.const) return v.const
		if (v.key && row[v.key]) return String(row[v.key])
	}
	return ''
}

function leafLabel(row: CatalogRow, cfg: SunburstUiConfig['leafLabel']): string {
	const pick = (keys: string[]) =>
		keys
			.map(k => row[k])
			.filter(Boolean)
			.map(String)
	const a = pick(cfg.keys)
	if (a.length) return a.join(' ')
	const b = pick(cfg.fallbackKeys || [])
	return b.length ? b.join(' ') : row.cohort
}

/** nest cohorts by their ring values, in first-seen order. A ring without a value for a
 *  cohort is skipped for that cohort, so branches may differ in depth. */
function buildTree(rows: CatalogRow[], ui: SunburstUiConfig, rootName = 'All sample sets'): TreeNode {
	const root: TreeNode = { name: rootName, children: [] }
	for (const r of rows) {
		let node = root
		for (const level of ui.levels) {
			const v = levelValue(r, level)
			if (!v) continue
			if (!node.children) node.children = []
			let child = node.children.find(c => c.name === v && c.level === level.name)
			if (!child) {
				child = { name: v, level: level.name, children: [] }
				node.children.push(child)
			}
			node = child
		}
		if (!node.children) node.children = []
		node.children.push({ name: leafLabel(r, ui.leafLabel), cohort: r })
	}
	disambiguateLeaves(root)
	return root
}

/** sibling leaves sharing a label (e.g. two studies of the same disease and region) get
 *  their cohort key appended, so each wedge names the sample set it selects */
function disambiguateLeaves(node: TreeNode) {
	const leaves = (node.children || []).filter(c => c.cohort)
	const seen = new Map<string, number>()
	for (const l of leaves) seen.set(l.name, (seen.get(l.name) || 0) + 1)
	for (const l of leaves) if (seen.get(l.name)! > 1) l.name = `${l.name} (${l.cohort!.cohort})`
	for (const c of node.children || []) if (!c.cohort) disambiguateLeaves(c)
}

/** number of cohorts (leaves) under a node */
function countLeaves(n: TreeNode): number {
	if (n.cohort) return 1
	let s = 0
	for (const c of n.children || []) s += countLeaves(c)
	return s
}

/** every leaf under a node, in tree order */
function leavesOf(n: TreeNode): TreeNode[] {
	if (n.cohort) return [n]
	const out: TreeNode[] = []
	for (const c of n.children || []) out.push(...leavesOf(c))
	return out
}

const cohortKey = (r: CatalogRow) => catalogRowKey(r.organism, r.assay, r.cohort)

/*********** selection kind ***********/

/** the kind of a cohort: its values of the selectionKind keys joined, e.g. "Human Whole";
 *  '' when no keys are configured, so every cohort is of one kind */
function kindOf(r: CatalogRow, keys: string[] = []): string {
	return keys
		.map(k => r[k])
		.filter(Boolean)
		.map(String)
		.join(' ')
}

/** the kind with the most leaves; first-seen wins a tie; '' for no leaves */
function largestKind(leaves: TreeNode[], keys: string[] = []): string {
	const counts = new Map<string, number>()
	for (const l of leaves) {
		const k = kindOf(l.cohort!, keys)
		counts.set(k, (counts.get(k) || 0) + 1)
	}
	let best = ''
	let bestN = 0
	for (const [k, n] of counts) {
		if (n > bestN) {
			best = k
			bestN = n
		}
	}
	return best
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
function splitLabel(text: string, maxChars: number, maxLines: number): string[] {
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

/** value of a stat box over a set of leaves; null = not available (a sum with no data) */
function computeStat(leaves: TreeNode[], def: ProteomeSunburstStat): number | null {
	const rows = leaves.map(l => l.cohort!).filter(r => !def.where || cohortMatches(def.where, r.organism, r.assay, r))
	if (def.kind === 'count') return rows.length
	if (def.kind === 'distinct') {
		const vals = new Set(
			rows.map(r => r[def.key || '']).filter(v => v !== undefined && v !== null && v !== '')
		)
		return vals.size
	}
	// sum
	let total = 0
	let seen = false
	for (const r of rows) {
		const v = Number(r[def.key || ''])
		if (!Number.isFinite(v) || r[def.key || ''] === undefined || r[def.key || ''] === '') continue
		total += v
		seen = true
	}
	return seen ? total : null
}

export const componentInit = getCompInit(CohortSunburst)

export async function getPlotConfig(opts: any) {
	const config = structuredClone(defaultConfig)
	return copyMerge(config, opts)
}

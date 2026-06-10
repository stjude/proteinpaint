import type { MassState, BasePlotConfig } from '#mass/types/mass'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { PlotBase } from './PlotBase'
import { Menu, Tabs } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { scaleSqrt, arc as d3arc, select, packSiblings, packEnclose } from 'd3'
import { forceSimulation, forceCollide, forceX, forceY } from 'd3-force'
import { TermTypes } from '#shared/terms.js'
import { getColors } from '#shared/common.js'

const defaultConfig = { chartType: 'animatedBubbleChart' }

// Fixed internal SVG coordinate space — the force simulation lives in this. The cluster
// is centered at (SPLIT_W/2, SPLIT_H/2) in every mode. The visible wrapper is sized to the
// actual bubble bounding box (see viewportW/H) and the SVG is offset so its content stays
// centered, so toggling combined⇄split grows/shrinks the viewport around a fixed point.
const SPLIT_W = 1100
const SPLIT_H = 900
const MIN_R = 6 // smallest bubble total radius
const MAX_R = 43 // largest bubble total radius
const INNER_CIRCLE_RATIO = 0.75 // inner circle radius = INNER_CIRCLE_RATIO × total radius
const RING_GAP = 1 // gap between inner circle and start of ring
const PADDING = 0 // collision padding outside the bubble's outer radius — touching bubbles, no whitespace
const HOVER_SCALE = 1.2 // how much the hovered bubble visually grows (multiplier, not a px size)
const HOVER_COLLIDE_BOOST = 1.4 // collide radius multiplier for hovered bubble
const HOVER_REPEL_REACH = 91 // px range over which the hovered bubble radially pushes others
const HOVER_REPEL_STRENGTH = 0.17 // intensity of the radial push
const GRAVITY_STRENGTH = 0.28 // strong center-gravity — bubbles stick to their home positions so each sub-cluster keeps its packed-circle shape instead of drifting loose
const HOVER_GRAVITY = 0.045 // weakened gravity during hover so neighbors don't snap back instantly

type Slice = {
	assay: string
	rank: number | null
	weight: number | null
	angle: number
	startAngle: number
	endAngle: number
}
type Bubble = {
	gene: string
	integrativeRank: number
	orderStatQ: number | null
	pValue: number | null
	fdr: number | null
	slices: Slice[]
	innerR: number
	outerR: number
	x: number
	y: number
	// Velocity fields written by d3-force on every tick (used by hoverRepel to add radial push)
	vx?: number
	vy?: number
	// Target position from packSiblings — the bubble's "home" inside the perfect circle layout.
	// Simulation pulls toward these (not toward center), so the cluster settles into a true circle.
	homeX: number
	homeY: number
	hovered: boolean
}

class AnimatedBubbleChart extends PlotBase implements RxComponent {
	static type = 'animatedBubbleChart'
	type: string
	dom!: { holder: any; controls: any; body: any; tip: Menu; header?: any }
	components: any
	private simulation: any = null
	private selectedRankingKey: string | null = null
	private groupBy: 'all' | 'modality' = 'all'
	// State for the split-view toggle. Stored on the instance so the toggle handler
	// can recompute layout + restart the simulation without re-fetching data.
	private currentNodes: Bubble[] = []
	private currentAssays: string[] = []
	// 'all'-mode packed-cluster enclosing radius (+slack); set by computeHomes and used by
	// the per-tick circular clamp, so we don't pack the same nodes twice.
	private allModeBoundaryR = 0
	private modalityLabelsSel: any = null
	// Computed each time we enter split mode: where each modality's sub-cluster sits.
	// Sizes vary because we hierarchically pack groups by their natural cluster radii.
	// `topY` is the topmost EDGE of the cluster (min(homeY - outerR)) — bubble radii
	// aren't scaled with the layout, so the visual extent reaches farther up than
	// `cy - r*scale`. Labels use this so they always sit clear of every bubble.
	private groupCenters: { assay: string; cx: number; cy: number; r: number; topY: number }[] = []
	private svgSel: any = null
	private wrapperSel: any = null
	// Computed by `computeHomes` from the actual home positions + bubble radii.
	// Drives the wrapper's visible width/height so the chart frame hugs the cluster
	// instead of inheriting the much larger fixed SPLIT canvas size.
	private contentBbox: { minX: number; minY: number; maxX: number; maxY: number } = {
		minX: 0,
		minY: 0,
		maxX: 0,
		maxY: 0
	}
	private readonly BBOX_PAD = 20

	/** Internal SVG coordinate space — fixed, used by computeHomes for layout math. */
	private canvasW(): number {
		return SPLIT_W
	}
	private canvasH(): number {
		return SPLIT_H
	}
	/** Visible viewport — sized to the actual content bbox + padding, not a fixed constant. */
	private viewportW(): number {
		return Math.max(50, this.contentBbox.maxX - this.contentBbox.minX + 2 * this.BBOX_PAD)
	}
	private viewportH(): number {
		return Math.max(50, this.contentBbox.maxY - this.contentBbox.minY + 2 * this.BBOX_PAD)
	}

	constructor(opts: any, api) {
		super(opts, api)
		this.type = AnimatedBubbleChart.type
		this.components = {}
	}

	async init() {
		const holder = this.opts.holder.append('div').style('padding', '10px')
		this.dom = {
			holder,
			controls: holder
				.append('div')
				.style('display', 'flex')
				.style('gap', '14px')
				.style('align-items', 'center')
				.style('margin-bottom', '10px'),
			body: holder.append('div'),
			tip: new Menu({ padding: '' }),
			header: this.opts.header
		}
		if (this.dom.header) this.dom.header.html('Bubble Chart')
	}

	getState(appState: MassState) {
		const config: any = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return { config }
	}

	async main() {
		await this.fetchAndRender(this.selectedRankingKey ?? undefined)
	}

	private async fetchAndRender(rankingKey?: string) {
		const body: any = {
			genome: this.app.opts.state.vocab.genome,
			dslabel: this.app.opts.state.vocab.dslabel
		}
		if (rankingKey) body.rankingKey = rankingKey

		const data = await dofetch3('termdb/animatedBubbleChart', { body })

		// Stop any previous simulation before re-rendering
		if (this.simulation) {
			this.simulation.stop()
			this.simulation = null
		}

		if (data.error) {
			// Keep the dropdown usable so the user can pick another ranking
			if (data.rankingKeys?.length) this.renderControls(data.rankingKeys, rankingKey ?? data.rankingKeys[0])
			this.dom.body.selectAll('*').remove()
			this.dom.body.append('div').style('padding', '20px').style('color', '#b00020').text(`Error: ${data.error}`)
			return
		}

		this.selectedRankingKey = data.selectedRankingKey

		this.renderControls(data.rankingKeys, data.selectedRankingKey)
		this.dom.body.selectAll('*').remove()

		if (!data.bubbles?.length) {
			this.dom.body
				.append('div')
				.style('padding', '20px')
				.style('color', '#666')
				.text('No data in the selected ranking file.')
			return
		}

		// Auto-width flex container, left-aligned (no `justify-content: center`, no fixed
		// width) so there's no symmetric whitespace bracketing the chart and the legend sits
		// directly to the right of the wrapper. The wrapper is sized to the content bbox; the
		// SVG inside is absolutely positioned and offset (left/top) so the cluster stays
		// centered as the viewport grows/shrinks on mode toggle.
		const container = this.dom.body
			.append('div')
			.style('display', 'flex')
			.style('gap', '24px')
			.style('align-items', 'flex-start')
			.style('flex-wrap', 'nowrap')

		// Assign a color per modality with the shared palette generator (same as
		// proteinView's getColors), domained on the dataset-ordered assay list so colors
		// are stable across re-fetches and consistent with other proteome charts.
		const colorScale = getColors(data.assays.length).domain(data.assays)
		const assayColors: { [a: string]: string } = {}
		for (const a of data.assays) assayColors[a] = colorScale(a)

		this.renderBubbles(container, data.bubbles, assayColors)
		this.renderLegend(container, data.assays, assayColors)
	}

	private renderControls(rankingKeys: string[], current: string) {
		this.dom.controls.selectAll('*').remove()
		const sel = this.dom.controls.append('select').style('padding', '4px 8px').style('min-width', '200px')
		sel
			.selectAll('option')
			.data(rankingKeys)
			.enter()
			.append('option')
			.attr('value', (d: string) => d)
			.text((d: string) => d)
		sel.property('value', current)
		sel.on('change', () => this.fetchAndRender(sel.node().value))

		// Two-tab toggle (uses #dom's Tabs component) — the active mode is highlighted
		// so users can see at a glance whether the chart is currently combined or split.
		const tabsHolder = this.dom.controls.append('div')
		const tabsToggle = new Tabs({
			holder: tabsHolder,
			noContent: true,
			tabs: [
				{
					label: 'Combined',
					active: this.groupBy === 'all',
					callback: () => {
						if (this.groupBy === 'all') return
						this.groupBy = 'all'
						this.applyGrouping()
					}
				},
				{
					label: 'Split by dominant data type',
					active: this.groupBy === 'modality',
					callback: () => {
						if (this.groupBy === 'modality') return
						this.groupBy = 'modality'
						this.applyGrouping()
					}
				}
			]
		})
		tabsToggle.main()
	}

	/** Find the modality (assay) that contributes the largest slice to this gene's wheel. */
	private dominantAssay(node: Bubble): string {
		let bestAssay = node.slices[0]?.assay ?? this.currentAssays[0]
		let bestAngle = -1
		for (const s of node.slices) {
			if (s.angle > bestAngle) {
				bestAngle = s.angle
				bestAssay = s.assay
			}
		}
		return bestAssay
	}

	/** Compute homeX/homeY on every node based on the current `groupBy` mode. */
	private computeHomes() {
		const nodes = this.currentNodes
		if (!nodes.length) return

		const W = this.canvasW()
		const H = this.canvasH()

		if (this.groupBy === 'all') {
			// One global packed-circle layout (same as the initial view)
			const packInputs = nodes.map(n => ({ r: n.outerR, x: 0, y: 0 }))
			packSiblings(packInputs)
			const enclose = packEnclose(packInputs as any) ?? { x: 0, y: 0, r: Math.min(W, H) / 2 }
			const dx = W / 2 - enclose.x
			const dy = H / 2 - enclose.y
			for (let i = 0; i < nodes.length; i++) {
				nodes[i].homeX = packInputs[i].x + dx
				nodes[i].homeY = packInputs[i].y + dy
			}
			// boundary for the per-tick clamp (+slack so a hover ripple can briefly bulge it)
			this.allModeBoundaryR = enclose.r + 2
			this.groupCenters = []
			this.recordContentBbox()
			return
		}

		// 'modality' mode — hierarchical packing. Each modality's bubbles are packed
		// into their own little circle (sizes vary because gene counts vary), and then
		// those CIRCLES are themselves packed together with packSiblings so a big
		// modality cluster claims more canvas space than a small one. No fixed grid.
		const assays = this.currentAssays
		// Padding around each sub-cluster. Because `packSiblings` packs the super-circles
		// to TOUCH each other, the visible empty space between two adjacent clusters ends
		// up being LABEL_GAP × 2 (one gap from each cluster's own padding). And because the
		// whole layout often gets scaled down to fit the canvas, we need this value much
		// larger than the desired post-scale gap. With a scale around 0.7-0.8 this still
		// yields ~180-200 px of clearly visible whitespace between clusters.
		const LABEL_GAP = 200

		const buckets = new Map<string, Bubble[]>()
		for (const a of assays) buckets.set(a, [])
		for (const n of nodes) buckets.get(this.dominantAssay(n))?.push(n)

		// Inner pack — per-modality sub-cluster
		type GroupLayout = {
			assay: string
			nodes: Bubble[]
			packs: { r: number; x: number; y: number }[]
			enclose: { x: number; y: number; r: number }
			naturalExtent: number
		}
		const layouts: GroupLayout[] = []
		for (const assay of assays) {
			const groupNodes = buckets.get(assay) ?? []
			if (!groupNodes.length) continue
			const packs = groupNodes.map(n => ({ r: n.outerR, x: 0, y: 0 }))
			packSiblings(packs)
			const enclose = packEnclose(packs as any) ?? { x: 0, y: 0, r: 0 }
			// Natural visible extent of this cluster — the max reach from enclose center
			// to any bubble's outer edge. Used both to size the super-circle (so adjacent
			// clusters don't overlap) and as the visible boundary radius.
			let naturalExtent = 0
			for (let j = 0; j < groupNodes.length; j++) {
				const dx2 = packs[j].x - enclose.x
				const dy2 = packs[j].y - enclose.y
				const reach = Math.sqrt(dx2 * dx2 + dy2 * dy2) + groupNodes[j].outerR
				if (reach > naturalExtent) naturalExtent = reach
			}
			layouts.push({ assay, nodes: groupNodes, packs, enclose, naturalExtent })
		}

		// Outer pack — each sub-cluster treated as a super-circle whose radius is its
		// REAL outer extent (not the smaller enclose) plus LABEL_GAP. Using the real
		// extent guarantees adjacent clusters don't overlap when their internal layouts
		// are kept at natural size below.
		const superCircles = layouts.map(g => ({ r: g.naturalExtent + LABEL_GAP, x: 0, y: 0 }))
		packSiblings(superCircles)
		const overallEnclose = packEnclose(superCircles as any) ?? { x: 0, y: 0, r: 1 }

		// Scale to fit within the canvas if the arrangement is wider/taller than the
		// current mode's dimensions. (Lots of small bubbles can produce a large enclose.)
		const margin = 10
		const maxR = Math.min(W, H) / 2 - margin
		const scale = overallEnclose.r > maxR ? maxR / overallEnclose.r : 1
		const dx = W / 2 - overallEnclose.x * scale
		const dy = H / 2 - overallEnclose.y * scale

		this.groupCenters = []
		for (let i = 0; i < layouts.length; i++) {
			const g = layouts[i]
			// Cluster center IS scaled (so the overall arrangement of clusters fits the canvas)
			const groupCx = superCircles[i].x * scale + dx
			const groupCy = superCircles[i].y * scale + dy
			// But internal bubble positions are NOT scaled — each cluster keeps its natural
			// packSiblings layout. This is what stops forceCollide from pushing bubbles outside
			// the visible boundary: at natural packing distances, bubbles already don't overlap,
			// so collide does nothing and the cluster's visible extent matches `naturalExtent`.
			const offX = groupCx - g.enclose.x
			const offY = groupCy - g.enclose.y
			for (let j = 0; j < g.nodes.length; j++) {
				g.nodes[j].homeX = g.packs[j].x + offX
				g.nodes[j].homeY = g.packs[j].y + offY
			}
			this.groupCenters.push({
				assay: g.assay,
				cx: groupCx,
				cy: groupCy,
				r: g.naturalExtent,
				topY: groupCy - g.naturalExtent
			})
		}

		// Final centering: `packEnclose` returns the smallest enclosing circle, but its
		// CENTER doesn't necessarily equal the cluster centroid when sub-cluster sizes
		// vary a lot (one big modality, several small ones). Shift everything so the
		// actual bubble bounding box is centered on the canvas — no asymmetric empty
		// bands on one side.
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity
		for (const n of nodes) {
			if (n.homeX - n.outerR < minX) minX = n.homeX - n.outerR
			if (n.homeY - n.outerR < minY) minY = n.homeY - n.outerR
			if (n.homeX + n.outerR > maxX) maxX = n.homeX + n.outerR
			if (n.homeY + n.outerR > maxY) maxY = n.homeY + n.outerR
		}
		if (Number.isFinite(minX)) {
			const shiftX = W / 2 - (minX + maxX) / 2
			const shiftY = H / 2 - (minY + maxY) / 2
			for (const n of nodes) {
				n.homeX += shiftX
				n.homeY += shiftY
			}
			for (const g of this.groupCenters) {
				g.cx += shiftX
				g.cy += shiftY
				g.topY += shiftY
			}
		}

		this.recordContentBbox()
	}

	/** Record the FINAL content bbox (after recentering) so the wrapper can hug the
	 *  cluster instead of inheriting a fixed canvas size. Called by both modes. */
	private recordContentBbox() {
		const nodes = this.currentNodes
		if (!nodes.length) return
		let bx0 = Infinity,
			by0 = Infinity,
			bx1 = -Infinity,
			by1 = -Infinity
		for (const n of nodes) {
			if (n.homeX - n.outerR < bx0) bx0 = n.homeX - n.outerR
			if (n.homeY - n.outerR < by0) by0 = n.homeY - n.outerR
			if (n.homeX + n.outerR > bx1) bx1 = n.homeX + n.outerR
			if (n.homeY + n.outerR > by1) by1 = n.homeY + n.outerR
		}
		// In split mode, extend bbox upward to include modality labels (sit at topY-32).
		if (this.groupBy === 'modality') {
			for (const g of this.groupCenters) {
				const labelY = g.topY - 32
				if (labelY < by0) by0 = labelY
			}
		}
		if (Number.isFinite(bx0)) {
			this.contentBbox = { minX: bx0, minY: by0, maxX: bx1, maxY: by1 }
		}
	}

	/** Toggle handler — recompute homes for the current groupBy and reheat the simulation. */
	private applyGrouping() {
		this.computeHomes()

		// Animate the wrapper's visible viewport (so combined ⇄ split expands/contracts
		// AROUND the cluster, which itself stays anchored at the SVG's center). At the
		// same time, re-offset the SVG's left/top so its center keeps aligning with the
		// new wrapper's center — that's what stops the cluster from drifting right-down.
		if (this.wrapperSel) {
			this.wrapperSel
				.transition()
				.duration(900)
				.style('width', `${this.viewportW()}px`)
				.style('height', `${this.viewportH()}px`)
		}
		if (this.svgSel) {
			this.svgSel
				.transition()
				.duration(900)
				.style('left', `${this.BBOX_PAD - this.contentBbox.minX}px`)
				.style('top', `${this.BBOX_PAD - this.contentBbox.minY}px`)
		}

		// Modality labels share the same per-group center metadata.
		// In split mode: position the label just above
		// it (at cy − r − 12). In combined mode: fade everything out IN PLACE so nothing
		// flies to a default coordinate.
		const centerByAssay = new Map(this.groupCenters.map(g => [g.assay, g]))

		if (this.modalityLabelsSel) {
			const labels = this.modalityLabelsSel.selectAll('text')
			if (this.groupBy === 'modality') {
				labels
					.transition()
					.duration(900)
					.attr('opacity', (assay: string) => (centerByAssay.has(assay) ? 1 : 0))
					.attr('x', (assay: string) => centerByAssay.get(assay)?.cx ?? 0)
					.attr('y', (assay: string) => {
						const g = centerByAssay.get(assay)
						// 12 px above the cluster's top edge — accurate since
						// g.r IS the cluster's natural extent (the visible boundary).
						return g ? g.cy - g.r - 12 : 0
					})
			} else {
				labels.transition().duration(400).attr('opacity', 0)
			}
		}

		if (this.simulation) {
			// Replace forceX/forceY (vallandingham pattern) so the force re-reads each node's
			// updated homeX/homeY into its internal target cache. Moderate alpha + higher
			// velocityDecay keeps the motion smooth instead of violent.
			this.simulation
				.force('x', forceX<Bubble>((d: Bubble) => d.homeX).strength(GRAVITY_STRENGTH))
				.force('y', forceY<Bubble>((d: Bubble) => d.homeY).strength(GRAVITY_STRENGTH))
				.velocityDecay(0.55)
				.alpha(0.6)
				.alphaDecay(0.018)
				.restart()
			// Restore normal velocity decay + alpha decay after the transition has played out
			// so hover ripples behave normally afterwards.
			setTimeout(() => {
				if (this.simulation) this.simulation.velocityDecay(0.4).alphaDecay(0.022)
			}, 2500)
		}
	}

	private renderBubbles(container: any, bubbles: any[], assayColors: { [a: string]: string }) {
		// Total-radius scale: rank 1 → MAX_R, rank N → MIN_R. Sqrt softens rank 1's dominance.
		const maxRank = Math.max(...bubbles.map(b => b.integrativeRank))
		const sizeScale = scaleSqrt().domain([1, maxRank]).range([MAX_R, MIN_R]).clamp(true)

		const nodes: Bubble[] = bubbles.map(b => {
			const outerR = sizeScale(b.integrativeRank) // bubble's outer radius (= ring outer radius)
			const innerR = outerR * INNER_CIRCLE_RATIO // inner circle's visual radius — smaller now, ring is wider
			// Cumulative angles for slices
			const slices: Slice[] = []
			let cum = 0
			for (const s of b.slices) {
				const start = cum
				const end = cum + s.angle
				slices.push({ ...s, startAngle: start, endAngle: end })
				cum = end
			}
			return {
				gene: b.gene,
				integrativeRank: b.integrativeRank,
				orderStatQ: b.orderStatQ,
				pValue: b.pValue,
				fdr: b.fdr,
				slices,
				innerR,
				outerR,
				// Seed positions in a small jitter around center so the simulation pulls them outward to home
				x: this.canvasW() / 2 + (Math.random() - 0.5) * 80,
				y: this.canvasH() / 2 + (Math.random() - 0.5) * 80,
				homeX: 0, // filled in by packSiblings below
				homeY: 0,
				hovered: false
			}
		})

		// Store state on the instance so the toggle handler can recompute layout later
		// without re-fetching data.
		this.currentNodes = nodes
		this.currentAssays = Object.keys(assayColors)

		// Initial layout — packed circle ('all' mode) or per-modality sub-clusters ('modality').
		// In 'all' mode this also sets this.allModeBoundaryR (used by the per-tick clamp).
		this.computeHomes()

		// Wrapper crops the SVG to the current mode's viewport; the SVG is positioned
		// absolutely so its content stays centered. The viewport is sized to the content
		// bbox and re-offset on mode toggle so the cluster doesn't drift on split.
		const wrapper = container
			.append('div')
			.style('position', 'relative')
			.style('overflow', 'hidden')
			.style('width', `${this.viewportW()}px`)
			.style('height', `${this.viewportH()}px`)
		this.wrapperSel = wrapper

		const svg = wrapper
			.append('svg')
			.attr('width', this.canvasW())
			.attr('height', this.canvasH())
			.style('position', 'absolute')
			.style('left', `${this.BBOX_PAD - this.contentBbox.minX}px`)
			.style('top', `${this.BBOX_PAD - this.contentBbox.minY}px`)
		this.svgSel = svg

		const root = svg.append('g')

		// Sub-groups (split mode) are identified by their label + the spatial clustering of
		// bubbles alone — there are no visible cluster-boundary circles.
		const arcGen = d3arc<Slice>()
			.startAngle((d: Slice) => d.startAngle)
			.endAngle((d: Slice) => d.endAngle)

		const groups = root
			.selectAll('g.sjpp-abc-bubble')
			.data(nodes)
			.enter()
			.append('g')
			.attr('class', 'sjpp-abc-bubble')
			.attr('transform', (d: Bubble) => `translate(${d.x},${d.y})`)
			.style('cursor', 'pointer')
			.attr('role', 'button')
			.attr('tabindex', 0)
			.attr('aria-label', (d: Bubble) => `Open protein view for ${d.gene}`)
		// Invisible hit-area circle covering the entire bubble (outer radius). Sits behind
		// every visible element so it doesn't obscure anything, but captures pointer events
		// across the inner-circle ↔ ring gap. Without it, mouseenter/mouseleave fires
		// spuriously when the cursor crosses that gap.
		groups
			.append('circle')
			.attr('class', 'hit-area')
			.attr('r', (d: Bubble) => d.outerR)
			.attr('fill', 'transparent')

		// Ring slices — rendered first so the inner circle sits on top
		groups.each(function (this: SVGGElement, d: Bubble) {
			const slicesG = select(this).append('g').attr('class', 'ring')
			const visible = d.slices.filter(s => s.angle > 0)
			slicesG
				.selectAll('path')
				.data(visible)
				.enter()
				.append('path')
				.attr('fill', (s: Slice) => assayColors[s.assay] ?? '#999')
				.attr('stroke', '#fff')
				.attr('stroke-width', 0.8)
				.attr('opacity', 0)
				.attr('d', (s: Slice) =>
					arcGen({
						...s,
						innerRadius: d.innerR + RING_GAP,
						outerRadius: d.outerR
					} as any)
				)
		})

		// Inner circle — starts at radius 0 and transitions out
		groups
			.append('circle')
			.attr('class', 'inner')
			.attr('r', 0)
			.attr('fill', '#fff')
			.attr('stroke', '#333')
			.attr('stroke-width', 1)

		// Gene label — font scales with bubble size. Also bounded by label width so long names fit inside small bubbles.
		const labelFontSize = (d: Bubble) => {
			const byRadius = d.innerR * 0.72
			// Heuristic: each character ~0.6 × fontSize wide; keep the text inside ~1.8 × innerR
			const maxByWidth = (d.innerR * 1.8) / Math.max(d.gene.length * 0.6, 1)
			return Math.max(5, Math.min(byRadius, maxByWidth, 20))
		}
		groups
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'central')
			.attr('font-weight', 'bold')
			.attr('font-size', (d: Bubble) => `${labelFontSize(d)}px`)
			.attr('fill', '#222')
			.attr('pointer-events', 'none')
			.attr('opacity', 0)
			.text((d: Bubble) => d.gene)

		// Tooltip handlers on the entire <g>
		const tip = this.dom.tip
		groups
			.on('mouseenter', (event: MouseEvent, d: Bubble) => {
				// Mark hovered → collide accessor inflates its radius → neighbors get pushed outward.
				// Weaken center gravity so the displaced neighbors actually move OUT instead of
				// being immediately re-clustered toward center.
				d.hovered = true
				if (this.simulation) {
					this.simulation.force('x')!.strength(HOVER_GRAVITY)
					this.simulation.force('y')!.strength(HOVER_GRAVITY)
					this.simulation.alpha(0.5).restart()
				}
				tip.clear().show(event.clientX, event.clientY)
				const t = tip.d.append('div').style('padding', '8px').style('font-size', '13px').style('min-width', '220px')
				t.append('div')
					.style('font-weight', 'bold')
					.style('font-size', '15px')
					.style('margin-bottom', '4px')
					.text(d.gene)
				t.append('div').text(`Integrative rank: ${d.integrativeRank}`)
				if (d.orderStatQ != null) t.append('div').text(`Order statistic Q: ${d.orderStatQ.toExponential(3)}`)
				if (d.pValue != null)
					t.append('div').text(`P value: ${d.pValue >= 0.0001 ? d.pValue.toFixed(4) : d.pValue.toExponential(3)}`)
				if (d.fdr != null) t.append('div').text(`FDR: ${d.fdr >= 0.0001 ? d.fdr.toFixed(4) : d.fdr.toExponential(3)}`)
				const table = t
					.append('table')
					.style('margin-top', '6px')
					.style('border-collapse', 'collapse')
					.style('font-size', '12px')
				const header = table.append('tr')
				header.append('th').style('text-align', 'left').style('padding', '2px 6px').text('Data Type')
				header.append('th').style('text-align', 'right').style('padding', '2px 6px').text('Rank')
				header.append('th').style('text-align', 'right').style('padding', '2px 6px').text('Share')
				for (const s of d.slices) {
					const row = table.append('tr')
					const swatch = row.append('td').style('padding', '2px 6px')
					swatch
						.append('span')
						.style('display', 'inline-block')
						.style('width', '10px')
						.style('height', '10px')
						.style('background', assayColors[s.assay] ?? '#999')
						.style('margin-right', '6px')
						.style('vertical-align', 'middle')
					swatch.append('span').text(s.assay)
					row
						.append('td')
						.style('padding', '2px 6px')
						.style('text-align', 'right')
						.text(s.rank == null ? 'NA' : String(s.rank))
					row
						.append('td')
						.style('padding', '2px 6px')
						.style('text-align', 'right')
						.text(s.weight == null ? '—' : `${(s.weight * 100).toFixed(1)}%`)
				}
			})
			.on('mouseleave', (_event: MouseEvent, d: Bubble) => {
				d.hovered = false
				// Restore center gravity gradually so the cluster eases back together
				// instead of snapping. Low alpha + standard gravity = a slow drift inward.
				if (this.simulation) {
					this.simulation.force('x')!.strength(GRAVITY_STRENGTH)
					this.simulation.force('y')!.strength(GRAVITY_STRENGTH)
					this.simulation.alpha(0.25).restart()
				}
				tip.hide()
			})
			.on('click keydown', (event: MouseEvent | KeyboardEvent, d: Bubble) => {
				if (event.type === 'keydown') {
					const ke = event as KeyboardEvent
					if (ke.key !== 'Enter' && ke.key !== ' ') return
					ke.preventDefault()
				}
				// Launch a proteinView chart for the clicked gene — same dispatch shape used
				// by the "Protein Selection" chart-button menu after a gene is typed in.
				tip.hide()
				this.app.dispatch({
					type: 'plot_create',
					config: {
						chartType: 'proteinView',
						tw: {
							term: {
								gene: d.gene,
								name: d.gene,
								type: TermTypes.PROTEOME_ABUNDANCE
							}
						}
					}
				})
			})

		// Animate entry — circles & ring slices grow/fade in
		groups
			.select('circle.inner')
			.transition()
			.duration(900)
			.attr('r', (d: any) => d.innerR)
		groups.select('g.ring').selectAll('path').transition().delay(200).duration(900).attr('opacity', 0.95)
		groups.select('text').transition().delay(500).duration(600).attr('opacity', 1)

		// Modality labels — appended AFTER the bubble groups so SVG draw order puts them
		// on top. Each label is data-joined to its assay name; `applyGrouping` reads
		// `this.groupCenters` to position each label above its sub-cluster.
		const assayNames = this.currentAssays
		const labelsG = svg.append('g').attr('class', 'modality-labels')
		labelsG
			.selectAll('text')
			.data(assayNames)
			.enter()
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'alphabetic')
			.attr('font-size', '13px')
			.attr('font-weight', 'bold')
			.attr('paint-order', 'stroke') // white outline behind text so it stays readable over bubbles
			.attr('stroke', '#fff')
			.attr('stroke-width', 3)
			.attr('stroke-linejoin', 'round')
			.attr('fill', (d: string) => assayColors[d] ?? '#333')
			.attr('opacity', 0)
			.attr('x', this.canvasW() / 2)
			.attr('y', 12)
			.text((d: string) => d)
		this.modalityLabelsSel = labelsG
		// If we re-rendered while groupBy is already 'modality' (e.g., user switched ranking
		// file while split), reposition labels immediately for the new node set.
		if (this.groupBy === 'modality') {
			const centerByAssay = new Map(this.groupCenters.map(g => [g.assay, g]))
			labelsG
				.selectAll('text')
				.attr('opacity', (assay: string) => (centerByAssay.has(assay) ? 1 : 0))
				.attr('x', (assay: string) => centerByAssay.get(assay)?.cx ?? this.canvasW() / 2)
				.attr('y', (assay: string) => {
					const g = centerByAssay.get(assay)
					return g ? g.cy - g.r - 8 : 12
				})
		}

		// Force simulation — each bubble is pulled toward its OWN packed "home" position
		// (computed above by packSiblings), giving a true circle-packed layout instead of
		// the soft disk that center-only gravity produces.
		const collideR = (d: Bubble) => (d.hovered ? d.outerR * HOVER_COLLIDE_BOOST : d.outerR) + PADDING

		// Custom force: when a bubble is hovered, radially push other bubbles away from it.
		// Reach and strength scale with the hovered bubble's size — a tiny bubble produces
		// a small ripple, the biggest produces the full one. Otherwise hovering the smallest
		// dot would displace neighbors as aggressively as hovering the largest anchor bubble.
		function hoverRepel(alpha: number) {
			const h = nodes.find(n => n.hovered)
			if (!h) return
			const sizeRatio = h.outerR / MAX_R // 0..1, where 1 = max-sized bubble
			const reach = HOVER_REPEL_REACH * sizeRatio
			const strength = HOVER_REPEL_STRENGTH * sizeRatio
			if (reach < 1) return
			for (const n of nodes) {
				if (n === h) continue
				const dx = n.x - h.x
				const dy = n.y - h.y
				const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
				if (dist >= reach) continue
				const falloff = 1 - dist / reach
				const push = strength * falloff * alpha
				n.vx = (n.vx ?? 0) + (dx / dist) * push * reach
				n.vy = (n.vy ?? 0) + (dy / dist) * push * reach
			}
		}

		this.simulation = forceSimulation<Bubble>(nodes)
			.force('collide', forceCollide<Bubble>(collideR).strength(1).iterations(2))
			.force('x', forceX<Bubble>((d: Bubble) => d.homeX).strength(GRAVITY_STRENGTH))
			.force('y', forceY<Bubble>((d: Bubble) => d.homeY).strength(GRAVITY_STRENGTH))
			.force('hoverRepel', hoverRepel)
			.alpha(1)
			.alphaDecay(0.022)
			.alphaMin(0.001)
			.on('tick', () => {
				// In 'all' mode the cluster is one big circle, so clamp every bubble inside
				// its enclosing radius — otherwise the perimeter would deform into a square
				// against canvas edges. In 'modality' (split) mode, each sub-cluster has its
				// own center and the clamp doesn't apply globally; bubbles are kept in place
				// by their per-group home-position gravity instead.
				if (this.groupBy === 'all') {
					const cxC = this.canvasW() / 2
					const cyC = this.canvasH() / 2
					for (const d of nodes) {
						const ddx = d.x - cxC
						const ddy = d.y - cyC
						const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 0.0001
						const maxDist = this.allModeBoundaryR - d.outerR
						if (dist > maxDist) {
							d.x = cxC + (ddx * maxDist) / dist
							d.y = cyC + (ddy * maxDist) / dist
						}
					}
				}
				groups.attr('transform', (d: Bubble) => `translate(${d.x},${d.y})${d.hovered ? ` scale(${HOVER_SCALE})` : ''}`)
			})
	}

	private renderLegend(container: any, assays: string[], assayColors: { [a: string]: string }) {
		const legend = container
			.append('div')
			.style('display', 'flex')
			.style('flex-direction', 'column')
			.style('gap', '6px')
			.style('padding', '4px 0')
			.style('min-width', '160px')
		legend
			.append('div')
			.style('font-weight', 'bold')
			.style('font-size', '13px')
			.style('margin-bottom', '4px')
			.text('Data Type')
		for (const assay of assays) {
			const row = legend
				.append('div')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('gap', '8px')
				.style('font-size', '12px')
			row
				.append('span')
				.style('display', 'inline-block')
				.style('width', '14px')
				.style('height', '14px')
				.style('background', assayColors[assay] ?? '#999')
				.style('border', '1px solid #ccc')
			row.append('span').text(assay)
		}
	}
}

export const componentInit = getCompInit(AnimatedBubbleChart)

export async function getPlotConfig(opts: any) {
	const config = structuredClone(defaultConfig)
	return copyMerge(config, opts)
}

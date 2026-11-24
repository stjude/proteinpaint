import { dofetch3 } from '#common/dofetch'
import { select } from 'd3-selection'
import { escapeHtml, capitalizeFirstLetter, Menu } from '#dom'
import { getNormalRoot, filterJoin } from '#filter'
import {
	addNewGroup,
	getGroupFilterOfConditions,
	getSamplelstTWFromFilters,
	isGroupsDisabled,
	closeGroupMenus,
	maxGroupsPerVariable
} from '#mass/groups'
import { renderGroupMenu, type GroupMenuHost } from '#mass/groupMenu'
import { getCurrentCohortChartTypes } from '#mass/charts'
import { getColors } from '#shared/common.js'
import type { Filter, SunburstRequest, SunburstResponse } from '#types'
import {
	SunburstRenderer,
	card,
	badge,
	pill,
	SIZE,
	TEXT_DARK,
	TEXT_MUTED,
	LINK,
	RULE,
	SELECT_STROKE,
	RIGHT_W,
	icon,
	type Card,
	type HNode
} from './SunburstRenderer'
import { buildTermTree, selectionFilter, selectionName, type TermSunNode } from './sunburst.data'

/*
The term-based sunburst without its rx plot component: fetches the counts of the given rings, draws them,
and keeps the wedge selection. With two or more selected wedges, a toggle chooses how they are used:
- Explore together: the selected wedges are one sample group
- Compare: the wedges are in groups, a wedge in a group of its own at first; a wedge moves to another group
  or a new one from its group badge, or by dragging it there, so that one group may have several wedges
Below the selected wedges, "Show available data" draws the shared menu of sample groups (#mass/groupMenu)
for the one group or the compared groups: its analyses, and how many of the samples have each kind of data
of the dataset, whose rows open a plot of the data. The one group can become a group in the GROUPS tab, and
the compared groups a custom variable. Used by the sunburst plot (sunburst.ts), which fills the Rings box
with term pills, and by the About tab (about.ts), which lists the dataset's default rings.

Click a wedge to zoom into it; a wedge without rings beneath it, a shift-click, or SELECT above the
chart (for the wedge at the centre) selects it. Selecting a wedge drops its selected descendants, which
it already contains.

A sample with no value for a ring, or a value the ring hides (tw.q.hiddenValues, e.g. set in the dataset's
default rings), ends at the previous ring, leaving a gap in the outer ring of its wedge; samples with no
or a hidden value for the first ring are not in the chart.
*/

// stat box keys; their titles follow the unit
const STAT_SAMPLES = 'Samples'
const STAT_SELECTED = 'Selected samples'
/** indent per ring in the Rings box, so the rings read as a path from the first to the last */
const RING_STEP = 6
const RING_LINE = '#cbd5e1'

export type SunburstChartOpts = {
	holder: any
	/** the mass app, for the term pickers and the created groups */
	app: any
	/** px between the chart and its side columns (SunburstRendererOpts.gap) */
	gap?: number
	/** called before a plot of the selection is created, e.g. to show the plots tab */
	beforeLaunch?: () => Promise<any> | void
}

export type SunburstUpdateArg = {
	genome: string
	dslabel: string
	/** ring term wrappers, inside out, filled */
	twLst: any[]
	/** the filter the counts are of: the global filter, joined with the plot's own if any */
	termfilter?: { filter?: Filter; filter0?: any }
	/** the plot's own filter, which a created group also has; the global filter is joined where the
	 *  group is used */
	groupFilter?: Filter
	/** first-ring colours from the dataset, keyed by category key */
	colors?: { [key: string]: string }
}

export class SunburstChart {
	app: any
	dom: {
		errdiv: any
		loadingDiv: any
		noteDiv: any
		/** the rings, left of the chart; filled by the caller (ringRow) */
		rings: Card
		/** the selected wedges: the explore or compare toggle, the wedges or their groups, the available data, and
		 *  the create-group or create-variable action */
		sel: Card
		/** selects the wedge at the centre, in the toolbar above the chart */
		selectFocus: any
	}
	renderer: SunburstRenderer
	twLst: any[] = []
	groupFilter?: Filter
	/** selected wedges by node id, in selection order */
	selected: Map<string, HNode> = new Map()
	/** note shown in the selection card after a group or a variable is created */
	createdNote = ''
	/** the counted unit, from the server */
	unit = { one: 'sample', many: 'samples' }
	/** number of the latest update(), so that the response of an earlier one that arrives later is dropped */
	updateId = 0
	beforeLaunch?: () => Promise<any> | void
	/** whether the available data of the selection is shown; a change of the selection hides it */
	dataShown = false
	/** explore: the selected wedges are one group; compare: the groups of groupOf are compared */
	mode: 'explore' | 'compare' = 'explore'
	/** the group of each selected wedge, by node id; a newly selected wedge has a group of its own */
	groupOf: Map<string, number> = new Map()
	/** key of the next new group; groups are ordered by their keys, the order they were made in */
	nextGroup = 0
	/** the host of the shared menu of the groups */
	host: GroupMenuHost
	/** the menu that moves a wedge to another group */
	moveMenu: Menu
	/** id of the wedge that is dragged to another group */
	dragId?: string

	constructor(opts: SunburstChartOpts) {
		this.app = opts.app
		this.beforeLaunch = opts.beforeLaunch
		const getApp = () => this.app
		this.host = {
			// the app may be replaced, e.g. by a test
			get app() {
				return getApp()
			},
			state: { termfilter: {}, currentCohortChartTypes: [] },
			tip2: new Menu({ padding: '0px', testid: 'sjpp-sunburst-data-menu' }),
			tip3: new Menu({ padding: '0px' }),
			launch: config => this.launchPlot(config)
		}
		this.moveMenu = new Menu({ padding: '0px', testid: 'sjpp-sunburst-move-menu' })
		const holder = opts.holder
		const errdiv = holder.append('div').attr('class', 'sja_errorbar').style('display', 'none')
		const loadingDiv = holder.append('div').style('display', 'none').style('padding', '24px').text('Loading ...')
		const noteDiv = holder
			.append('div')
			.style('font-size', '.85em')
			.style('color', TEXT_MUTED)
			.style('margin-bottom', '6px')
		const chartHolder = holder.append('div').attr('data-testid', 'sjpp-sunburst-chart')
		this.renderer = new SunburstRenderer({
			holder: chartHolder,
			unit: this.unit,
			rootName: 'All samples',
			statLabels: [STAT_SAMPLES, STAT_SELECTED],
			pathCard: false,
			gap: opts.gap,
			hooks: {
				onClick: (d: HNode, event: any) => this.onWedgeClick(d, event),
				isSelected: (d: HNode) => this.selected.has(d.data.id),
				cursor: (d: HNode) => (d.children ? 'zoom-in' : 'pointer'),
				tooltip: (d: HNode, box: any) => this.tooltip(d, box),
				onFocus: () => {
					this.renderStats()
					this.renderSidebar()
					this.renderSelectFocus()
					this.markShownRings()
				}
			}
		})
		const rings = card(this.renderer.dom.left, 'Rings')
		rings.body.attr('data-testid', 'sjpp-sunburst-rings')
		const selectFocus = this.renderer
			.addControl()
			.attr('data-testid', 'sjpp-sunburst-select-focus')
			.on('click', () => {
				const f = this.renderer.focus
				if (f?.depth && !this.selectedAncestor(f)) this.toggle(f)
			})
		this.dom = {
			errdiv,
			loadingDiv,
			noteDiv,
			rings,
			sel: card(this.renderer.dom.right, 'Selected wedges'),
			selectFocus
		}
	}

	/** fetch and draw the counts of the rings; with no rings, an empty chart and `emptyNote`. Resolves true
	 *  when drawn, false when the request failed (the error is shown), and undefined when a later update
	 *  replaced this one, which then has its own outcome */
	async update(arg: SunburstUpdateArg, emptyNote = ''): Promise<boolean | undefined> {
		this.closeDataPicker()
		const id = ++this.updateId
		this.twLst = arg.twLst
		this.groupFilter = arg.groupFilter
		this.dom.errdiv.style('display', 'none')
		this.dom.noteDiv.text('')
		if (!this.twLst.length) {
			// an earlier update may still be loading; its response is dropped
			this.dom.loadingDiv.style('display', 'none')
			this.clearSelection()
			this.renderer.setTree({ name: this.renderer.opts.rootName, children: [] })
			this.dom.noteDiv.text(emptyNote)
			return true
		}
		try {
			this.dom.loadingDiv.style('display', '')
			const res = await fetchSunburst({
				genome: arg.genome,
				dslabel: arg.dslabel,
				twLst: this.twLst,
				filter: getNormalRoot(arg.termfilter?.filter),
				filter0: arg.termfilter?.filter0
			})
			if (id != this.updateId) return
			this.dom.loadingDiv.style('display', 'none')
			this.render(res, arg.colors)
			return true
		} catch (e: any) {
			if (id != this.updateId) return
			this.dom.loadingDiv.style('display', 'none')
			this.dom.errdiv.style('display', '').text(e?.message || String(e))
			if (e instanceof Error) console.error(e)
			return false
		}
	}

	render(res: SunburstResponse, colors?: { [key: string]: string }) {
		this.setUnit(res.unit || { one: 'sample', many: 'samples' })
		if (res.noFirstRingValue) {
			const n = res.noFirstRingValue
			this.dom.noteDiv.text(
				`${n.toLocaleString()} ${n == 1 ? this.unit.one : this.unit.many} with ${noValue(this.twLst[0])} ${
					n == 1 ? 'is' : 'are'
				} not shown.`
			)
		}
		const focusId = this.renderer.focus?.data.id
		const selectedIds = [...this.selected.keys()]
		this.renderer.setTree(buildTermTree(res, this.twLst, this.renderer.opts.rootName, colors))
		// keep the selection and the centre of a re-fetch (e.g. after a filter change) where their
		// wedges still exist
		const byId = new Map(this.renderer.root.descendants().map((d: HNode) => [d.data.id, d]))
		this.selected = new Map(selectedIds.filter(id => byId.has(id)).map(id => [id, byId.get(id)]))
		for (const id of this.groupOf.keys()) if (!this.selected.has(id)) this.groupOf.delete(id)
		this.renderer.refresh()
		const focus = focusId && byId.get(focusId)
		if (focus?.children) this.renderer.zoomTo(focus)
		else this.renderSidebar()
	}

	/** wording of the counted unit: centre, stat box titles, tooltip and the create-group action */
	setUnit(unit: { one: string; many: string }) {
		this.unit = unit
		this.renderer.opts.unit = unit
		this.renderer.opts.rootName = `All ${unit.many}`
		this.renderer.setStatTitle(STAT_SAMPLES, capitalizeFirstLetter(unit.many))
		this.renderer.setStatTitle(STAT_SELECTED, `Selected ${unit.many}`)
	}

	/** SELECT above the chart, for the wedge at the centre (which cannot be clicked) */
	renderSelectFocus() {
		const f = this.renderer.focus
		const el = this.dom.selectFocus
		if (!f?.depth) {
			el.style('display', 'none')
			return
		}
		const anc = this.selectedAncestor(f)
		const on = this.selected.has(f.data.id)
		el.style('display', '')
			.style('opacity', anc ? 0.35 : 1)
			.style('cursor', anc ? 'default' : 'pointer')
			.style('color', on ? SELECT_STROKE : TEXT_MUTED)
			.attr('title', anc ? `Included in the selected ${anc.data.name}` : null)
			.html(
				on
					? `${icon('<polyline points="5 12 10 17 19 7"/>')}SELECTED · ${escapeHtml(f.data.name.toUpperCase())}`
					: `${icon('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>')}SELECT ${escapeHtml(
							f.data.name.toUpperCase()
					  )}`
			)
	}

	/************ rings box ************/

	/** a line of the Rings box, indented by its ring, with an elbow from the line above */
	ringRow(level: number) {
		const row = this.dom.rings.body
			.append('div')
			.style('position', 'relative')
			.style('margin', '2px 0')
			.style('margin-left', `${level * RING_STEP}px`)
		if (level) {
			row
				.append('div')
				.style('position', 'absolute')
				.style('left', `${-RING_STEP + 4}px`)
				.style('top', '-6px')
				.style('width', `${RING_STEP - 6}px`)
				.style('height', '18px')
				.style('border-left', `1px solid ${RING_LINE}`)
				.style('border-bottom', `1px solid ${RING_LINE}`)
				.style('border-bottom-left-radius', '4px')
		}
		return row
	}

	/** the line of ring i: its number, which is marked while the ring is in the chart (markShownRings),
	 *  then a slot for the caller's term pill or name */
	ringLine(i: number) {
		const row = this.ringRow(i)
			.attr('class', 'sjpp-sunburst-ring')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '4px')
		row
			.append('span')
			.attr('class', 'sjpp-sunburst-ringnum')
			.style('font-size', '.8em')
			.style('width', '14px')
			.style('flex', '0 0 auto')
			.style('padding-left', '4px')
			.style('border-left', '3px solid transparent')
			.style('border-radius', '2px')
			.text(i + 1)
		return row
	}

	/** mark the two rings around the current centre: a bar beside the ring number, which is bold */
	markShownRings() {
		const first = this.renderer.focus?.depth || 0
		const shown = (i: number) => i == first || i == first + 1
		this.dom.rings.body
			.selectAll('.sjpp-sunburst-ring')
			.attr('title', (_: any, i: number) => (shown(i) ? 'Shown in the chart' : null))
			.select('.sjpp-sunburst-ringnum')
			.style('border-left-color', (_: any, i: number) => (shown(i) ? LINK : 'transparent'))
			.style('color', (_: any, i: number) => (shown(i) ? TEXT_DARK : TEXT_MUTED))
			.style('font-weight', (_: any, i: number) => (shown(i) ? 'bold' : 'normal'))
	}

	/************ selection ************/

	/** the selected ancestor that already contains a wedge, if any */
	selectedAncestor(d: HNode): HNode | undefined {
		for (let a = d.parent; a?.depth; a = a.parent) if (this.selected.has(a.data.id)) return a
	}

	toggle(d: HNode) {
		if (!d.depth) return
		const id = d.data.id
		this.createdNote = ''
		if (this.selected.has(id)) this.unselect(id)
		else {
			if (this.selectedAncestor(d)) return // already in the selection; the tooltip says so
			// a selected wedge contains its descendants, so drop any that were selected
			for (const [k, n] of this.selected) if (n.ancestors().includes(d)) this.unselect(k)
			this.selected.set(id, d)
			this.groupOf.set(id, this.nextGroup++)
		}
		this.refreshSelection()
	}

	unselect(id: string) {
		this.selected.delete(id)
		this.groupOf.delete(id)
	}

	clearSelection() {
		this.selected.clear()
		this.groupOf.clear()
	}

	refreshSelection() {
		this.dataShown = false
		this.renderer.refresh()
		this.renderStats()
		this.renderSidebar()
		this.renderSelectFocus()
	}

	/** wedge paths from the first ring, in selection order */
	selectedPaths(): TermSunNode[][] {
		return [...this.selected.values()].map(pathOf)
	}

	selectedCount(): number {
		let n = 0
		for (const d of this.selected.values()) n += d.value || 0
		return n
	}

	renderStats() {
		const r = this.renderer
		r.setStats(
			new Map([
				[STAT_SAMPLES, r.focus.value || 0],
				[STAT_SELECTED, this.selectedCount()]
			])
		)
	}

	/************ interaction ************/

	onWedgeClick(d: HNode, event: any) {
		if (event?.shiftKey || !d.children) this.toggle(d)
		else this.renderer.zoomTo(d)
	}

	tooltip(d: HNode, box: any) {
		const line = (text: string, color = '#6b7280') => box.append('div').style('color', color).text(text)
		line(d.data.level)
		const total = this.renderer.root.value || 0
		const pct = total ? ` (${((100 * (d.value || 0)) / total).toFixed(1)}%)` : ''
		const s = box.append('div').style('color', '#374151')
		s.append('span').text(`${capitalizeFirstLetter(this.unit.many)}: `)
		s.append('b').text((d.value || 0).toLocaleString())
		s.append('span').text(pct)
		const ended = d.data.value || 0
		const next = this.twLst[d.data.ring + 1]
		if (d.children && ended && next) line(`${ended.toLocaleString()} with ${noValue(next)}`)
		const note = (text: string, color: string) =>
			box.append('div').style('margin-top', '4px').style('color', color).text(text)
		const anc = this.selectedAncestor(d)
		if (anc) note(`Included in the selected ${anc.data.name}`, TEXT_MUTED)
		else if (this.selected.has(d.data.id))
			note(d.children ? 'click to zoom in · shift-click to deselect' : 'click to deselect', LINK)
		else note(d.children ? 'click to zoom in · shift-click to select' : 'click to select', LINK)
	}

	/** the selected-wedges card: with two or more wedges, the toggle between exploring them as one group and
	 *  comparing their groups; one line per wedge with its path and count, under its group when compared; the
	 *  available data of the group or groups; and the create-group or create-variable action as the footer */
	renderSidebar() {
		this.closeDataPicker()
		// the column is widened only to fit the counts of the shown data
		if (!this.dataShown) this.setRightWidth(RIGHT_W)
		const sel = this.dom.sel
		const { title, headRight, body } = sel
		headRight.selectAll('*').remove()
		body.selectAll('*').remove()
		headRight.style('margin-bottom', '8px')
		const n = this.selected.size
		title.text(n ? 'Selected wedges' : 'No wedges selected')
		if (n) {
			pill(headRight).text(n)
			headRight
				.append('span')
				.style('font-size', '11px')
				.style('color', LINK)
				.style('cursor', 'pointer')
				.text('Clear')
				.on('click', () => {
					this.clearSelection()
					this.refreshSelection()
				})
		}
		if (n > 1) this.renderModeToggle(body)
		const grouped = n > 1 && this.mode == 'compare'
		const list = body.append('div').attr('data-testid', 'sjpp-sunburst-wedges')
		/* a long list of wedges scrolls; the compared groups do not, so that every group and the target for a
		new group stay in view as drop targets, with the actions below them */
		if (!grouped) list.style('max-height', `${SIZE - 200}px`).style('overflow-y', 'auto')
		if (!n) {
			list
				.append('div')
				.style('font-size', '0.85em')
				.style('color', TEXT_MUTED)
				.style('padding', '4px 0')
				.text('Shift-click a wedge, click an outermost one, or zoom into one and click SELECT above the chart.')
		}
		if (grouped) this.renderGroups(list)
		else for (const [id, d] of this.selected) this.wedgeRow(list, id, d)

		const count = this.selectedCount()
		if (n) void this.renderData(body, count)
		this.renderFooter(body, count)
	}

	/** Explore together | Compare */
	renderModeToggle(holder: any) {
		const wrap = holder
			.append('div')
			.attr('data-testid', 'sjpp-sunburst-mode')
			.attr('role', 'radiogroup')
			.attr('aria-label', 'Use the selected wedges')
			.style('display', 'flex')
			.style('margin', '0 0 8px 0')
			.style('border', `1px solid ${RULE}`)
			.style('border-radius', '999px')
			.style('overflow', 'hidden')
		const modes: [SunburstChart['mode'], string, string][] = [
			['explore', 'Explore together', 'Use the selected wedges as one group'],
			['compare', 'Compare', 'Compare groups of the selected wedges']
		]
		for (const [mode, label, tip] of modes) {
			const on = this.mode == mode
			wrap
				.append('button')
				.attr('data-testid', `sjpp-sunburst-mode-${mode}`)
				.attr('role', 'radio')
				.attr('aria-checked', String(on))
				.attr('title', tip)
				.style('flex', '1 1 0')
				.style('border', 'none')
				.style('padding', '4px 8px')
				.style('font-size', '12px')
				.style('cursor', 'pointer')
				.style('background', on ? SELECT_STROKE : 'white')
				.style('color', on ? '#fff' : TEXT_DARK)
				.text(label)
				.on('click', () => this.setMode(mode))
		}
	}

	setMode(mode: SunburstChart['mode']) {
		if (mode == this.mode) return
		this.mode = mode
		this.createdNote = ''
		this.renderSidebar()
	}

	/** a section per compared group with its wedges, each a drop target for a wedge, then the target for a new
	 *  group when a group has more than one wedge */
	renderGroups(list: any) {
		const groups = this.compareGroups()
		for (const g of groups) {
			const section = list
				.append('div')
				.attr('data-testid', `sjpp-sunburst-group-${g.letter}`)
				.style('margin', '4px 0 6px 0')
				.style('padding', '2px 0 2px 6px')
				.style('border-left', `3px solid ${g.color}`)
				.style('border-radius', '4px')
			this.dropTarget(section, g.key)
			const head = section
				.append('div')
				.style('display', 'flex')
				.style('justify-content', 'space-between')
				.style('gap', '8px')
				.style('font-size', '0.8em')
				.style('color', TEXT_MUTED)
			head.append('span').style('font-weight', 600).style('color', g.color).text(`Group ${g.letter}`)
			head.append('span').text(this.renderer.unitText(g.sampleCount))
			for (const d of g.nodes) this.wedgeRow(section, d.data.id, d, g)
		}
		// a lone wedge is already a group of its own, so the target for a new group is only for a wedge of a larger group
		if (groups.some(g => g.nodes.length > 1)) {
			const zone = list
				.append('div')
				.attr('data-testid', 'sjpp-sunburst-new-group')
				.style('margin', '4px 0')
				.style('padding', '6px')
				.style('border', `1px dashed ${RULE}`)
				.style('border-radius', '6px')
				.style('font-size', '0.75em')
				.style('text-align', 'center')
				.style('color', TEXT_MUTED)
				.text('Drag a wedge here for a new group')
			this.dropTarget(zone)
		}
		if (groups.length < 2)
			list
				.append('div')
				.attr('data-testid', 'sjpp-sunburst-one-group')
				.style('font-size', '0.8em')
				.style('color', TEXT_MUTED)
				.text('Put the wedges in at least two groups to compare them.')
	}

	/** a line of a selected wedge: its badge, path and count, and the remove button; when compared, first the
	 *  badge of its group, which moves it to another group, and it can be dragged to another group */
	wedgeRow(list: any, id: string, d: HNode, group?: CompareGroup) {
		const path = d
			.ancestors()
			.reverse()
			.slice(1)
			.map((a: HNode) => a.data.name)
		const row = list
			.append('div')
			.attr('class', 'sjpp-sunburst-selected-wedge')
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
		if (group) {
			row
				.attr('draggable', 'true')
				.style('cursor', 'grab')
				.on('dragstart', (event: DragEvent) => {
					this.dragId = id
					if (event.dataTransfer) {
						event.dataTransfer.effectAllowed = 'move'
						event.dataTransfer.setData('text/plain', d.data.name)
						setRowDragImage(event, event.currentTarget as HTMLElement)
					}
				})
				.on('dragend', () => (this.dragId = undefined))
			row
				.append('button')
				.attr('class', 'sjpp-sunburst-move')
				.attr('title', `Group ${group.letter}; click to move to another group`)
				.attr('aria-label', `${d.data.name} is in group ${group.letter}; move to another group`)
				.style('flex', '0 0 auto')
				.style('width', '20px')
				.style('height', '20px')
				.style('padding', '0')
				.style('border', 'none')
				.style('border-radius', '50%')
				.style('background', group.color)
				.style('color', '#fff')
				.style('font-size', '11px')
				.style('font-weight', 'bold')
				.style('cursor', 'pointer')
				.text(group.letter)
				.on('click', (event: MouseEvent) => this.showMoveMenu(event.currentTarget as HTMLElement, id))
		}
		badge(row, d.data.name, this.renderer.color(d), 24)
		const text = row.append('div').style('flex', '1 1 auto').style('min-width', '0').style('line-height', '1.2')
		text
			.append('div')
			.style('font-size', '0.9em')
			.style('color', TEXT_DARK)
			.style('overflow', 'hidden')
			.style('text-overflow', 'ellipsis')
			.style('white-space', 'nowrap')
			.attr('title', path.join(' › '))
			.text(path.join(' › '))
		text
			.append('div')
			.style('font-size', '0.7em')
			.style('color', '#6b7280')
			.text(this.renderer.unitText(d.value || 0))
		row
			.append('span')
			.attr('class', 'sjpp-sunburst-remove')
			.style('opacity', 0)
			.style('cursor', 'pointer')
			.style('color', '#9ca3af')
			.style('font-size', '0.85em')
			.attr('title', 'Remove')
			.text('✕')
			.on('click', () => {
				this.unselect(id)
				this.refreshSelection()
			})
	}

	/** the groups that a wedge can move to: each other group, and a new one unless the wedge is alone in its group */
	showMoveMenu(anchor: HTMLElement, id: string) {
		const menu = this.moveMenu
		menu.clear().showunder(anchor)
		const from = this.groupOf.get(id)
		const groups = this.compareGroups()
		const option = (text: string, key?: number) =>
			menu.d
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.attr('role', 'button')
				.attr('tabindex', 0)
				.text(text)
				.on('click', () => this.moveToGroup(id, key))
		for (const g of groups) if (g.key != from) option(`Move to group ${g.letter}: ${g.title}`, g.key)
		if (groups.find(g => g.key == from)!.nodes.length > 1) option('Move to a new group')
	}

	/** move a wedge to the group of `key`, or to a new group */
	moveToGroup(id: string, key?: number) {
		this.moveMenu.hide()
		if (!this.selected.has(id)) return
		this.groupOf.set(id, key ?? this.nextGroup++)
		this.createdNote = ''
		this.renderSidebar()
	}

	/** the element takes a dragged wedge into the group of `key`, or a new group */
	dropTarget(el: any, key?: number) {
		el.on('dragover', (event: DragEvent) => {
			if (!this.dragId) return
			event.preventDefault()
			el.style('background', '#eef2ff')
		})
			.on('dragleave', (event: DragEvent) => {
				// leaving for a child of the element is not leaving it
				if (!el.node().contains(event.relatedTarget)) el.style('background', null)
			})
			.on('drop', (event: DragEvent) => {
				event.preventDefault()
				event.stopPropagation()
				el.style('background', null)
				const id = this.dragId
				this.dragId = undefined
				if (id && (key === undefined || this.groupOf.get(id) != key)) this.moveToGroup(id, key)
			})
	}

	/** Create group of the explored wedges, or Create variable of the compared groups */
	renderFooter(body: any, count: number) {
		const n = this.selected.size
		// the groups tab cannot be used to see or use a created group or variable
		const canCreate = n > 0 && !isGroupsDisabled(this.app.vocabApi.termdbConfig)
		if (!canCreate && !this.createdNote) return
		const footer = body
			.append('div')
			.style('margin-top', '10px')
			.style('padding-top', '10px')
			.style('border-top', `1px solid ${RULE}`)
		if (canCreate) {
			if (this.effectiveMode() == 'compare') {
				const k = this.compareGroups().length
				pill(footer, { button: true })
					.attr('data-testid', 'sjpp-sunburst-create-variable')
					.text(`Create variable with ${k} groups`)
					.on('click', () => this.createVariable())
			} else {
				pill(footer, { button: true })
					.attr('data-testid', 'sjpp-sunburst-create-group')
					.text(`Create group of ${this.renderer.unitText(count)}`)
					.on('click', () => this.createGroup())
			}
		}
		if (this.createdNote) {
			footer
				.append('div')
				.style('font-size', '0.8em')
				.style('color', TEXT_MUTED)
				.style('margin-top', '6px')
				.text(this.createdNote)
		}
	}

	/** "Show available data", then the shared menu of the one group or the compared groups: its analyses, and how
	 *  many of the samples have each kind of data, whose rows open a plot of the data */
	async renderData(body: any, count: number) {
		const div = body
			.append('div')
			.attr('data-testid', 'sjpp-sunburst-group-data')
			.style('margin-top', '10px')
			.style('padding-top', '10px')
			.style('border-top', `1px solid ${RULE}`)
		if (!this.dataShown) {
			pill(div, { button: true })
				.attr('data-testid', 'sjpp-sunburst-show-data')
				.style('cursor', 'pointer')
				.text('Show available data')
				.on('click', () => {
					this.dataShown = true
					this.renderSidebar()
				})
			return
		}
		const mode = this.effectiveMode()
		const head = div
			.append('div')
			.style('display', 'flex')
			.style('justify-content', 'space-between')
			.style('align-items', 'center')
			.style('gap', '8px')
			.style('margin-bottom', '6px')
		head
			.append('span')
			.attr('data-testid', 'sjpp-sunburst-data-title')
			.style('white-space', 'nowrap')
			.style('font-size', '0.95em')
			.style('font-weight', 600)
			.style('color', TEXT_DARK)
			.text(
				mode == 'compare'
					? `Compare ${this.compareGroups().length} groups`
					: capitalizeFirstLetter(this.renderer.unitText(count))
			)
		// back to the button
		head
			.append('button')
			.attr('data-testid', 'sjpp-sunburst-hide-data')
			.style('flex', '0 0 auto')
			.style('font-size', '11px')
			.style('padding', '1px 10px')
			.style('border', `1px solid ${RULE}`)
			.style('border-radius', '10px')
			.style('background', 'white')
			.style('color', LINK)
			.style('cursor', 'pointer')
			.text('Hide ▴')
			.on('click', () => this.hideData())
		const holder = div.append('div').attr('data-testid', 'sjpp-sunburst-group-menu').style('font-size', '0.95em')
		try {
			this.refreshHost()
			const groups = this.compareGroups()
			const drawn =
				mode == 'explore'
					? renderGroupMenu({ holder, host: this.host, mode, filter: this.plotFilter() })
					: renderGroupMenu({
							holder,
							host: this.host,
							mode,
							samplelstTW: this.compareTW(),
							labels: Object.fromEntries(groups.map(g => [g.name, g.letter]))
					  })
			// the options are drawn at once; in the narrow card, at the size of the count rows
			holder.select('[data-testid=sjpp-group-menu-options]').style('font-size', '0.85em')
			await drawn
			this.fitCounts(holder)
		} catch (e: any) {
			holder
				.append('div')
				.attr('class', 'sja_errorbar')
				.text(e?.message || String(e))
		}
	}

	/** widen the column of the card to fit the counts table, whose columns of compared groups may be wider than
	 *  the column; narrow it back, down to its default width, when the table needs less */
	fitCounts(holder: any) {
		const table = holder.select('[data-testid=sjpp-group-data-availability] table').node()
		if (!table) return
		const box = table.parentElement as HTMLElement
		const style = getComputedStyle(box)
		const room = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
		const right = this.renderer.dom.right.node() as HTMLElement
		const over = Math.ceil(table.getBoundingClientRect().width - room)
		this.setRightWidth(Math.max(RIGHT_W, right.getBoundingClientRect().width + over))
	}

	setRightWidth(width: number) {
		this.renderer.dom.right.style('flex-basis', `${width}px`)
	}

	/** the app state that the shared menu of the groups reads */
	refreshHost() {
		const state = this.app.getState()
		this.host.state = {
			termfilter: state.termfilter || {},
			currentCohortChartTypes: getCurrentCohortChartTypes(state),
			matrixplots: this.app.vocabApi.termdbConfig?.matrixplots
		}
	}

	closeDataPicker() {
		closeGroupMenus(this.host)
		this.moveMenu?.hide()
	}

	hideData() {
		this.dataShown = false
		this.renderSidebar()
	}

	/** compare when chosen and the wedges are in two or more groups; else the wedges are one group */
	effectiveMode(): SunburstChart['mode'] {
		return this.mode == 'compare' && this.selected.size > 1 && this.compareGroups().length > 1 ? 'compare' : 'explore'
	}

	/** the compared groups, in the order they were made: the wedges of each, in selection order, with the
	 *  filter of the wedges and the plot's own filter */
	compareGroups(): CompareGroup[] {
		const byKey = new Map<number, HNode[]>()
		for (const [id, d] of this.selected) {
			const key = this.groupOf.get(id)!
			if (!byKey.has(key)) byKey.set(key, [])
			byKey.get(key)!.push(d)
		}
		const keys = [...byKey.keys()].sort((a, b) => a - b)
		const colors = getColors(Math.max(keys.length, 3))
		return keys.map((key, i) => {
			const nodes = byKey.get(key)!
			const paths = nodes.map(pathOf)
			const letter = groupLetter(i)
			const title = selectionName(paths)
			return {
				key,
				letter,
				title,
				name: `${letter}: ${title}`,
				nodes,
				filter: filterJoin(
					[selectionFilter(paths, this.twLst), this.groupFilter].filter(f => f?.lst?.length)
				) as Filter,
				sampleCount: nodes.reduce((n, d) => n + (d.value || 0), 0),
				color: colors(String(i))
			}
		})
	}

	/** the compared groups as a samplelst tw, each with the global filter, as the server resolves a group by its
	 *  own filter alone; first the control, then the case of a differential analysis */
	compareTW() {
		const termfilter = this.app.getState().termfilter || {}
		const groups = this.compareGroups()
		return getSamplelstTWFromFilters(
			groups.map(g => ({
				name: g.name,
				color: g.color,
				sampleCount: g.sampleCount,
				filter: filterJoin([g.filter, termfilter.filter].filter(f => f?.lst?.length)),
				filter0: termfilter.filter0
			})),
			groups.map(g => g.title).join(' vs ')
		)
	}

	/** the filter of the selected samples: the selection with the plot's own filter. A plot that is given it as
	 *  its own filter joins the global filter to it */
	plotFilter(): Filter {
		const filters = [selectionFilter(this.selectedPaths(), this.twLst), this.groupFilter]
		return filterJoin(filters.filter(f => f?.lst?.length)) as Filter
	}

	async launchPlot(config: any) {
		try {
			await this.beforeLaunch?.()
			await this.app.dispatch({ type: 'plot_create', config })
		} catch (e: any) {
			this.dom.errdiv.style('display', '').text(e?.message || String(e))
		}
	}

	/** one group of the union of the selected wedges, added to the GROUPS tab; the group also has the
	 *  plot's own filter, which the counts are of. The global filter is joined where the group is used */
	createGroup() {
		const paths = this.selectedPaths()
		if (!paths.length) return
		try {
			const name = selectionName(paths)
			const groups = this.app.getState().groups || []
			const filter = getGroupFilterOfConditions([this.groupFilter, selectionFilter(paths, this.twLst)])
			addNewGroup(this.app, filter, groups, name)
			this.clearSelection()
			this.createdNote = `Group "${name}" added; find it in the GROUPS tab.`
			this.refreshSelection()
		} catch (e: any) {
			this.dom.errdiv.style('display', '').text(e?.message || String(e))
		}
	}

	/** a custom variable of the compared groups, listed in the GROUPS tab and usable in any chart */
	async createVariable() {
		try {
			const k = this.compareGroups().length
			if (k > maxGroupsPerVariable) throw `A variable can be made from up to ${maxGroupsPerVariable} groups`
			const tw = this.compareTW()
			// a variable of the same groups again gets its own name, as addNewGroup() names a group
			const taken = new Set((this.app.getState().customTerms || []).map((t: any) => t.name))
			let name = tw.term.name
			for (let i = 1; taken.has(name); i++) name = `${tw.term.name} ${i}`
			tw.term.name = name
			await this.app.vocabApi.addCustomTerm({ name, tw })
			this.clearSelection()
			this.createdNote = `Variable "${name}" added; find it in the GROUPS tab.`
			this.refreshSelection()
		} catch (e: any) {
			this.dom.errdiv.style('display', '').text(e?.message || String(e))
		}
	}

	destroy() {
		this.closeDataPicker()
		this.host.tip2.destroy()
		this.host.tip3.destroy()
		this.moveMenu.destroy()
		this.renderer?.destroy()
	}
}

/** a group of wedges that is compared */
type CompareGroup = {
	/** groupOf key */
	key: number
	/** A, B, ... in the order of the groups */
	letter: string
	/** the wedge path, or the wedge names */
	title: string
	/** the letter and the title, unique among the groups */
	name: string
	nodes: HNode[]
	filter: Filter
	sampleCount: number
	color: string
}

/** the wedge path from the first ring */
function pathOf(d: HNode): TermSunNode[] {
	return d
		.ancestors()
		.reverse()
		.slice(1)
		.map((a: HNode) => a.data) as TermSunNode[]
}

/** the image under the mouse while a wedge row is dragged: a copy of the row alone. The browser's default image is
 *  of the row's area of the card, which can show the elements below the row too. The copy is drawn out of view,
 *  and removed once the browser has taken the image from it */
function setRowDragImage(event: DragEvent, row: HTMLElement) {
	const box = row.getBoundingClientRect()
	const copy = row.cloneNode(true) as HTMLElement
	copy.style.position = 'fixed'
	copy.style.top = '-1000px'
	copy.style.left = '0'
	copy.style.width = `${box.width}px`
	copy.style.boxSizing = 'border-box'
	copy.style.background = '#f3f4f6'
	copy.style.pointerEvents = 'none'
	document.body.appendChild(copy)
	event.dataTransfer!.setDragImage(copy, event.clientX - box.left, event.clientY - box.top)
	setTimeout(() => copy.remove(), 0)
}

/** A to Z, then A2 to Z2, ... */
function groupLetter(i: number): string {
	return String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26) + 1) : '')
}

/** why a sample is not in a ring: "no X value", or "no or a hidden X value" when the ring hides some
 *  categories (tw.q.hiddenValues), which the server treats as missing. The term's uncomputable values,
 *  which fillTermWrapper puts in hiddenValues by default, are missing values anyway, so they do not count */
function noValue(tw: any): string {
	const values = tw.term.values || {}
	const hidden = Object.keys(tw.q?.hiddenValues || {}).some(k => !values[k]?.uncomputable)
	return `no ${hidden ? 'or a hidden ' : ''}${tw.term.name} value`
}

/** termdb/sunburst request; errors are thrown */
async function fetchSunburst(body: SunburstRequest): Promise<SunburstResponse> {
	const res: any = await dofetch3('termdb/sunburst', { body })
	if (res?.error) throw res.error
	if (!res?.nodes) throw 'invalid response from termdb/sunburst'
	return res
}

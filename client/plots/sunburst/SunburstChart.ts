import { dofetch3 } from '#common/dofetch'
import { select } from 'd3-selection'
import { escapeHtml, capitalizeFirstLetter, Menu } from '#dom'
import { getNormalRoot, filterJoin } from '#filter'
import {
	addNewGroup,
	getGroupFilterOfConditions,
	getSamplelstTWFromFilters,
	getGeneExpressionPreAnalysis,
	renderPreAnalysisData
} from '#mass/groups'
import { availabilitySections, fetchDataAvailability, type AvailabilityRow } from '#mass/groupDataAvailability'
import { TermTypes } from '#types'
import { getActiveCohortStr, getCurrentCohortChartTypes } from '#mass/charts'
import { dtsnvindel, dtcnv, dtfusionrna, dtsv } from '#shared/common.js'
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
	icon,
	type Card,
	type HNode
} from './SunburstRenderer'
import { buildTermTree, selectionFilter, selectionName, type TermSunNode } from './sunburst.data'

/*
The term-based sunburst without its rx plot component: fetches the counts of the given rings, draws them,
and keeps the wedge selection, one sample group. Below the selected wedges, "Show available data" lists how
many of the selected samples have each kind of data of the dataset (termdb/dataAvailability); a kind with a
plot of its own opens that plot of the selected samples, which have the selection as the plot's filter.
When enabled for the active cohort, GRIN2 is offered for a selection with SNV/indel, CNV or SV/fusion
data, alongside the mutation rows that open the genome browser.
Summarize opens a dictionary popover beside its button to plot a term with the selection as its filter.
Gene Expression row likewise opens its gene-selection form beside the row, creating only the chosen plot.
Exactly two selected wedges can open the shared differential expression panel when supported and both
have RNA-seq counts; the first-selected wedge is the control and the second is the case.
Survival plots split two or more selected wedges into separate curves using a samplelst term, as custom variables do.
The selection can also become one sample group in the GROUPS tab. Used by the sunburst
plot (sunburst.ts), which fills the Rings box with term pills, and by the About tab (about.ts), which
lists the dataset's default rings.

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
		/** the selected wedges, with the create-group action */
		sel: Card
		/** selects the wedge at the centre, in the toolbar above the chart */
		selectFocus: any
	}
	renderer: SunburstRenderer
	twLst: any[] = []
	groupFilter?: Filter
	/** selected wedges by node id, in selection order */
	selected: Map<string, HNode> = new Map()
	/** note shown in the selection card after a group is created */
	createdNote = ''
	/** the counted unit, from the server */
	unit = { one: 'sample', many: 'samples' }
	/** number of the latest update(), so that the response of an earlier one that arrives later is dropped */
	updateId = 0
	beforeLaunch?: () => Promise<any> | void
	/** whether the available data of the selection is shown; a change of the selection hides it */
	dataShown = false
	/** number of the latest renderData(), so that the response of an earlier one is dropped */
	dataId = 0
	dataMenu?: Menu
	dataPicker?: { destroy: () => void }

	constructor(opts: SunburstChartOpts) {
		this.app = opts.app
		this.beforeLaunch = opts.beforeLaunch
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
			this.selected.clear()
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
		if (this.selected.has(id)) this.selected.delete(id)
		else {
			if (this.selectedAncestor(d)) return // already in the selection; the tooltip says so
			// a selected wedge contains its descendants, so drop any that were selected
			for (const [k, n] of this.selected) if (n.ancestors().includes(d)) this.selected.delete(k)
			this.selected.set(id, d)
		}
		this.refreshSelection()
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
		return [...this.selected.values()].map(
			(d: HNode) =>
				d
					.ancestors()
					.reverse()
					.slice(1)
					.map((a: HNode) => a.data) as TermSunNode[]
		)
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

	/** the selected-wedges card: one line per wedge with its path and count, and the create-group
	 *  action as the footer */
	renderSidebar() {
		this.closeDataPicker()
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
					this.selected.clear()
					this.refreshSelection()
				})
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
				.text('Shift-click a wedge, click an outermost one, or zoom into one and click SELECT above the chart.')
		}
		for (const [id, d] of this.selected) {
			const path = d
				.ancestors()
				.reverse()
				.slice(1)
				.map((a: HNode) => a.data.name)
			const row = list
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
					this.selected.delete(id)
					this.refreshSelection()
				})
		}

		const count = this.selectedCount()
		if (n) void this.renderData(body, count)
		if (!n && !this.createdNote) return

		const footer = body
			.append('div')
			.style('margin-top', '10px')
			.style('padding-top', '10px')
			.style('border-top', `1px solid ${RULE}`)
		if (n) {
			pill(footer, { button: true })
				.attr('data-testid', 'sjpp-sunburst-create-group')
				.text(`Create group of ${this.renderer.unitText(count)}`)
				.on('click', () => this.createGroup())
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

	/** "Show available data", then how many of the selected samples have each kind of data of the dataset;
	 *  a kind with a plot of the selected samples opens it */
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
		const id = ++this.dataId
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
			.text(capitalizeFirstLetter(this.renderer.unitText(count)))
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
		this.dataRow(
			div.append('div').style('font-size', '0.85em'),
			{ kind: 'data', key: 'summarize', label: 'Summarize', counts: [] },
			false,
			undefined,
			anchor => this.showDataPicker(anchor)
		)
		const list = div.append('div').text('Loading ...').style('font-size', '0.85em').style('color', TEXT_MUTED)
		try {
			const appState = this.app.getState()
			const termfilter = appState.termfilter || {}
			const filter = filterJoin([this.plotFilter(), termfilter.filter].filter(f => f?.lst?.length))
			const chartTypes = getCurrentCohortChartTypes(appState)
			const queries = this.app.vocabApi.termdbConfig?.queries || {}
			const canCompare = this.selected.size == 2 && chartTypes.includes('DA') && queries.rnaseqGeneCount
			const comparison = canCompare ? this.comparisonGroups() : []
			const groups = [
				{ name: 'selection', filter },
				...comparison.map(g => ({
					...g,
					filter: filterJoin([g.filter, termfilter.filter].filter(f => f?.lst?.length))
				}))
			]
			const res = await fetchDataAvailability(
				this.app.vocabApi,
				groups,
				termfilter.filter0,
				getActiveCohortStr(appState)
			)
			if (id != this.dataId) return
			list.text('').style('color', null)
			const comparisonCounts = res.groups.slice(1)
			if (
				canCompare &&
				comparisonCounts.length == 2 &&
				comparisonCounts.every(g => (g.data.rnaseqGeneCount || 0) > 0)
			) {
				const tw = getSamplelstTWFromFilters(comparison)
				this.dataRow(
					list,
					{ kind: 'data', key: 'differentialExpression', label: 'Differential Gene Expression Analysis', counts: [] },
					false,
					undefined,
					anchor => this.showDataPicker(anchor, 'differentialExpression', tw)
				)
			}
			const sections = availabilitySections({ ...res, groups: res.groups.slice(0, 1) }, ['rnaseqGeneCount'])
			if (!sections.length) {
				if (list.selectAll('*').empty()) list.style('color', TEXT_MUTED).text(`No data for these ${this.unit.many}`)
				return
			}
			for (const section of sections) {
				if (section.title) {
					list
						.append('div')
						.attr('data-testid', `sjpp-sunburst-section-${section.key}`)
						.style('margin', '8px 0 2px 0')
						.style('padding', '0 6px')
						.style('font-size', '10px')
						.style('font-weight', 600)
						.style('letter-spacing', '.06em')
						.style('text-transform', 'uppercase')
						.style('color', TEXT_MUTED)
						.text(section.title)
				}
				for (const row of section.rows) {
					const launch = this.dataPlot(row)
					this.dataRow(
						list,
						row,
						!!section.title,
						launch,
						row.kind == 'data' && row.key == 'geneExpression'
							? anchor => this.showDataPicker(anchor, 'geneExpression')
							: undefined
					)
				}
				if (
					section.key == 'mutations' &&
					chartTypes.includes('grin2') &&
					section.rows.some(row => {
						const dt = Number(row.key.split('.')[0])
						if (dt == dtsnvindel) return !!queries.snvindel
						if (dt == dtcnv) return !!(queries.cnv || queries.singleSampleMutation?.cnvTypes?.length)
						return (dt == dtfusionrna || dt == dtsv) && queries.svfusion?.dtLst?.includes(dt)
					})
				) {
					pill(list, { button: true })
						.attr('data-testid', 'sjpp-sunburst-grin2')
						.style('font-family', 'inherit')
						.style('font-weight', 'normal')
						.style('width', 'auto')
						.style('padding', '2px 8px')
						.style('margin', '4px 6px 4px 16px')
						.text('Run GRIN2')
						.on('click', () => this.launchPlot({ chartType: 'grin2', filter: this.plotFilter() }))
				}
			}
		} catch (e: any) {
			if (id != this.dataId) return
			list.attr('class', 'sja_errorbar').text(e?.message || String(e))
		}
	}

	/** Separate groups in selection order; for differential analysis, first control, then case. */
	comparisonGroups() {
		const termfilter = this.app.getState().termfilter || {}
		const nodes = [...this.selected.values()]
		return this.selectedPaths().map((path, i) => ({
			name: `${i + 1}: ${selectionName([path])}`,
			filter: filterJoin([selectionFilter([path], this.twLst), this.groupFilter].filter(f => f?.lst?.length)),
			filter0: termfilter.filter0,
			sampleCount: nodes[i].value || 0,
			color: this.renderer.color(nodes[i])
		}))
	}

	async showDataPicker(
		anchor: HTMLElement,
		kind: 'summary' | 'geneExpression' | 'differentialExpression' = 'summary',
		samplelstTW?: ReturnType<typeof getSamplelstTWFromFilters>
	) {
		this.closeDataPicker()
		const menu = new Menu({
			padding: '8px',
			testid:
				kind == 'geneExpression'
					? 'sjpp-sunburst-expression-menu'
					: kind == 'differentialExpression'
					? 'sjpp-sunburst-differential-menu'
					: 'sjpp-sunburst-summary-menu'
		})
		this.dataMenu = menu
		const position = () => {
			if (!menu.dnode) throw new Error('Missing data picker menu element')
			const rect = anchor.getBoundingClientRect()
			const width = menu.dnode.getBoundingClientRect().width
			const x = rect.right + 5 + width <= window.innerWidth ? rect.right + 5 : Math.max(0, rect.left - width - 5)
			menu.showunder(anchor, { offsetX: x - rect.left, offsetY: -rect.height - 5 })
		}
		const loading = menu.d.append('div').text('Loading ...')
		position()
		try {
			const state = this.app.getState()
			const filter = this.plotFilter()
			if (kind == 'differentialExpression') {
				if (!samplelstTW) throw new Error('Missing differential analysis groups')
				const preAnalysisData = await getGeneExpressionPreAnalysis(this.app, samplelstTW, state.termfilter)
				if (this.dataMenu != menu) return
				renderPreAnalysisData({
					preAnalysisData,
					samplelstTW,
					groups: samplelstTW.q.groups,
					tip: menu,
					self: { app: this.app, state: { termfilter: state.termfilter } },
					onLaunch: async config => {
						this.closeDataPicker()
						await this.launchPlot(config)
					}
				})
			} else if (kind == 'geneExpression') {
				const { geneExpInputInit } = await import('#plots/GeneExpInput.ts')
				if (this.dataMenu != menu) return
				const picker = await geneExpInputInit({
					app: this.app,
					holder: menu.d.append('div'),
					header: menu.d.insert('div', ':first-child'),
					config: { termType: TermTypes.GENE_EXPRESSION, spawnConfig: { filter } },
					onSubmit: async config => {
						this.closeDataPicker()
						await this.launchPlot(config)
					}
				})
				if (this.dataMenu != menu) {
					picker.destroy()
					return
				}
				this.dataPicker = picker
				await picker.update({ appState: state })
			} else {
				const { appInit } = await import('#termdb/app')
				if (this.dataMenu != menu) return
				const tree = await appInit({
					vocabApi: this.app.vocabApi,
					holder: menu.d.append('div'),
					state: {
						vocab: state.vocab,
						activeCohort: state.activeCohort,
						termfilter: {
							...state.termfilter,
							filter: filterJoin([filter, state.termfilter?.filter].filter(f => f?.lst?.length))
						},
						customTerms: state.customTerms,
						tree: { usecase: { target: 'dictionary' } }
					},
					tree: {
						click_term: selected => {
							const term = selected.term || selected
							this.closeDataPicker()
							void this.launchPlot(
								term.type == 'survival'
									? this.survivalConfig(selected.term ? selected : { term })
									: { chartType: 'summary', term: selected.term ? selected : { term }, filter }
							)
						}
					}
				})
				if (this.dataMenu != menu) {
					tree.destroy()
					return
				}
				this.dataPicker = tree
			}
			if (this.dataMenu != menu) return
			loading.remove()
			if (menu.d.style('display') != 'none') position()
		} catch (e: any) {
			if (this.dataMenu != menu) return
			loading.attr('class', 'sja_errorbar').text(e?.message || String(e))
		}
	}

	closeDataPicker() {
		this.dataPicker?.destroy()
		this.dataPicker = undefined
		this.dataMenu?.destroy()
		this.dataMenu = undefined
	}

	hideData() {
		this.dataShown = false
		// a response still on its way is not drawn
		this.dataId++
		this.renderSidebar()
	}

	/** a line of the available data: the kind of data and its count (omitted for empty counts), which opens `launch`, a plot_create config,
	 *  when given; a row of a section is indented under the section's title */
	dataRow(
		list: any,
		row: AvailabilityRow,
		inSection: boolean,
		launch?: any,
		onActivate?: (anchor: HTMLElement) => void
	) {
		const n = row.counts.length ? row.counts[0] || 0 : undefined
		const clickable = !!launch || !!onActivate
		const div = list
			.append('div')
			.attr('data-testid', `sjpp-sunburst-data-${row.kind == 'data' ? '' : row.kind + '-'}${row.key}`)
			.style('display', 'flex')
			.style('justify-content', 'space-between')
			.style('gap', '8px')
			.style('padding', `3px 6px 3px ${inSection ? 16 : 6}px`)
			.style('margin', '1px 0')
			.style('border-radius', '6px')
			.style('color', TEXT_DARK)
		div.append('span').text(row.label)
		div
			.append('span')
			.style('white-space', 'nowrap')
			.style('color', clickable ? LINK : null)
			.text(`${n === undefined ? '' : n.toLocaleString()}${row.unit ? ' ' + row.unit : ''}${clickable ? ' ›' : ''}`)
		if (!clickable) return
		const activate = (anchor: HTMLElement) => (onActivate ? onActivate(anchor) : this.launchPlot(launch))
		div
			.attr('role', 'button')
			.attr('tabindex', 0)
			.attr('title', `Open the ${row.label} of these ${this.unit.many}`)
			.style('cursor', 'pointer')
			.on('mouseenter', (event: any) => select(event.currentTarget).style('background', '#f3f4f6'))
			.on('mouseleave', (event: any) => select(event.currentTarget).style('background', 'transparent'))
			.on('click', (event: MouseEvent) => activate(event.currentTarget as HTMLElement))
			.on('keydown', (event: KeyboardEvent) => {
				if (event.key == 'Enter' || event.key == ' ') {
					event.preventDefault()
					activate(event.currentTarget as HTMLElement)
				}
			})
	}

	/** the filter of the selected samples: the selection with the plot's own filter. A plot that is given it as
	 *  its own filter joins the global filter to it */
	plotFilter(): Filter {
		const filters = [selectionFilter(this.selectedPaths(), this.twLst), this.groupFilter]
		return filterJoin(filters.filter(f => f?.lst?.length)) as Filter
	}

	survivalConfig(term: any) {
		return {
			chartType: 'survival',
			term,
			filter: this.plotFilter(),
			...(this.selected.size > 1 ? { term2: getSamplelstTWFromFilters(this.comparisonGroups()) } : {})
		}
	}

	/** the plot of the selected samples for a row of the available data, as a plot_create config; undefined
	 *  when the row has no plot of its own */
	dataPlot(row: AvailabilityRow): any {
		const filter = this.plotFilter()
		const q = this.app.vocabApi.termdbConfig?.queries || {}
		// the mutations of the selected samples, in the genome browser after a gene is entered
		if (row.kind == 'assay')
			return q.snvindel || q.svfusion || q.cnv
				? {
						chartType: 'genomeBrowser',
						filter,
						/* the mutation track shown, which the genome browser hides by default when the dataset also has
						trackLst. The query is copied as the browser's config replaces it, not merged */
						...(q.snvindel ? { snvindel: { ...structuredClone(q.snvindel), shown: true } } : {})
				  }
				: undefined
		if (row.kind == 'survival') return this.survivalConfig({ id: row.key })
		// the term search, whose DNA methylation tab lists methylation terms; a term opens its summary with the filter
		if (row.key == 'dnaMethylation') return { chartType: 'dictionary', spawnConfig: { filter } }
		// the table of the imaging samples that pass the filter, to render on a brain template
		if (row.key == 'NIdata') return { chartType: 'brainImaging', filter }
		// the lanes of the patients of the selected samples
		if (row.key == 'longitudinal') return { chartType: 'swimmer', filter }
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
			this.selected.clear()
			this.createdNote = `Group "${name}" added; find it in the GROUPS tab.`
			this.refreshSelection()
		} catch (e: any) {
			this.dom.errdiv.style('display', '').text(e?.message || String(e))
		}
	}

	destroy() {
		this.closeDataPicker()
		this.renderer?.destroy()
	}
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

import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '#plots/PlotBase.ts'
import { dofetch3 } from '#common/dofetch'
import { select } from 'd3-selection'
import { escapeHtml, capitalizeFirstLetter } from '#dom'
import { getCombinedTermFilter, getNormalRoot } from '#filter'
import { fillTermWrapper, termsettingInit } from '#termsetting'
import { addNewGroup } from '#mass/groups'
import type { SunburstRequest, SunburstResponse } from '#types'
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
import { buildTermTree, selectionFilter, selectionName, allowedSampleTypes, type TermSunNode } from './sunburst.data'

/*
Sunburst of nested sample counts, one dictionary term per ring (categorical, or numeric binned),
inside out. The dataset sets the default rings (termdb.sunburst.twLst); the Rings box left of the
chart switches, edits, adds and removes them (from each term pill's menu). Counts follow the
global and plot filters.

Click a wedge to zoom into it; a wedge without rings beneath it, a shift-click, or SELECT above the
chart (for the wedge at the centre) selects it. The selected wedges become one sample group (the union of
their filters) in the GROUPS tab, for use by other charts. Selecting a wedge drops its selected
descendants, which it already contains.

A sample with no value for a ring ends at the previous ring, leaving a gap in the outer ring of its
wedge; samples with no value for the first ring are not in the chart.

In a dataset with a sample hierarchy, the rings are patient terms and the terms of one sample type (no
value maps between sibling types such as primary and PDX samples): once a ring is of a sample type, the
pickers offer only terms of its line of descent. The server returns the counted unit (e.g. patients,
primary samples), which the chart's wording follows.
*/

// stat box keys; their titles follow the unit
const STAT_SAMPLES = 'Samples'
const STAT_SELECTED = 'Selected samples'
/** indent per ring in the Rings box, so the rings read as a path from the first to the last */
const RING_STEP = 6

class Sunburst extends PlotBase implements RxComponent {
	static type = 'sunburst'
	type: string
	dom!: {
		holder: any
		errdiv: any
		loadingDiv: any
		noteDiv: any
		/** one term pill per ring, and + Add ring */
		rings: Card
		/** the selected wedges, with the create-group action */
		sel: Card
		/** selects the wedge at the centre, in the toolbar above the chart */
		selectFocus: any
	}
	renderer!: SunburstRenderer
	twLst: any[] = []
	/** selected wedges by node id, in selection order */
	selected: Map<string, HNode> = new Map()
	/** note shown in the selection card after a group is created */
	createdNote = ''
	/** the rings the Rings box shows, to rebuild its pills only when they change */
	ringsShown = ''
	/** the Rings box pills and their main() argument without the filter, which follows the state */
	ringPills: { pill: any; arg: any }[] = []
	/** the counted unit, from the server */
	unit = { one: 'sample', many: 'samples' }

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = Sunburst.type
		if (this.opts.header)
			this.opts.header.style('padding-left', '7px').style('color', 'rgb(85, 85, 85)').html('Sunburst')
	}

	getState(appState: any) {
		const config = appState.plots.find((p: any) => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			// global mass filter combined with this plot's local filter
			termfilter: getCombinedTermFilter(appState, config.filter),
			genome: appState.vocab.genome,
			dslabel: appState.vocab.dslabel,
			sunburst: appState.termdbConfig?.sunburst || {}
		}
	}

	async init() {
		// the plot holder inherits nowrap from the sandbox; the cards need their text to wrap
		const holder = this.opts.holder
			.append('div')
			.attr('data-testid', 'sjpp-sunburst-holder')
			.style('white-space', 'normal')
			.style('padding', '10px')
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
		// a ring pill is only the term: termsetting's info button (its holder's 4th child) is hidden
		rings.box.append('style').text('.sjpp-sunburst-ringpill > div:nth-child(4) { display: none !important; }')
		const selectFocus = this.renderer
			.addControl()
			.attr('data-testid', 'sjpp-sunburst-select-focus')
			.on('click', () => {
				const f = this.renderer.focus
				if (f?.depth && !this.selectedAncestor(f)) this.toggle(f)
			})
		this.dom = {
			holder,
			errdiv,
			loadingDiv,
			noteDiv,
			rings,
			sel: card(this.renderer.dom.right, 'Selected wedges'),
			selectFocus
		}
	}

	async main() {
		const config = this.state.config
		this.twLst = config.twLst || []
		this.dom.errdiv.style('display', 'none')
		this.dom.noteDiv.text('')
		await this.renderRings()
		if (!this.twLst.length) {
			this.selected.clear()
			this.renderer.setTree({ name: this.renderer.opts.rootName, children: [] })
			this.dom.noteDiv.text('Add a ring in the Rings box to draw the sunburst.')
			return
		}
		try {
			this.dom.loadingDiv.style('display', '')
			const res = await fetchSunburst({
				genome: this.state.genome,
				dslabel: this.state.dslabel,
				twLst: this.twLst,
				filter: getNormalRoot(this.state.termfilter?.filter),
				filter0: this.state.termfilter?.filter0
			})
			this.dom.loadingDiv.style('display', 'none')
			this.render(res)
		} catch (e: any) {
			this.dom.loadingDiv.style('display', 'none')
			this.dom.errdiv.style('display', '').text(e?.message || String(e))
			if (e instanceof Error) console.error(e)
		}
	}

	render(res: SunburstResponse) {
		this.setUnit(res.unit || { one: 'sample', many: 'samples' })
		if (res.noFirstRingValue) {
			const n = res.noFirstRingValue
			this.dom.noteDiv.text(
				`${n.toLocaleString()} ${n == 1 ? this.unit.one : this.unit.many} with no ${this.twLst[0].term.name} value ${
					n == 1 ? 'is' : 'are'
				} not shown.`
			)
		}
		const focusId = this.renderer.focus?.data.id
		const selectedIds = [...this.selected.keys()]
		this.renderer.setTree(buildTermTree(res, this.twLst, this.renderer.opts.rootName, this.state.sunburst.colors))
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
		if (d.children && ended) {
			const next = this.twLst[d.data.ring + 1]?.term.name
			line(`${ended.toLocaleString()} with no ${next} value`)
		}
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

		const footer = body
			.append('div')
			.style('margin-top', '10px')
			.style('padding-top', '10px')
			.style('border-top', `1px solid ${RULE}`)
		const count = this.selectedCount()
		pill(footer, { button: true })
			.attr('data-testid', 'sjpp-sunburst-create-group')
			.property('disabled', n === 0)
			.style('opacity', n ? 1 : 0.3)
			.style('cursor', n ? 'pointer' : 'default')
			.text(n ? `Create group of ${this.renderer.unitText(count)}` : 'Create group')
			.on('click', () => this.createGroup())
		if (this.createdNote) {
			footer
				.append('div')
				.style('font-size', '0.8em')
				.style('color', TEXT_MUTED)
				.style('margin-top', '6px')
				.text(this.createdNote)
		}
	}

	/** one group of the union of the selected wedges, added to the GROUPS tab */
	createGroup() {
		const paths = this.selectedPaths()
		if (!paths.length) return
		try {
			const name = selectionName(paths)
			const groups = this.app.getState().groups || []
			addNewGroup(this.app, selectionFilter(paths, this.twLst), groups, name)
			this.selected.clear()
			this.createdNote = `Group "${name}" added; find it in the GROUPS tab.`
			this.refreshSelection()
		} catch (e: any) {
			this.dom.errdiv.style('display', '').text(e?.message || String(e))
		}
	}

	/************ rings box ************/

	/** one line per ring: its number and a term pill, whose menu switches, edits or removes the
	 *  term; then + Add ring. Rebuilt only when the rings change; otherwise the pills get the current
	 *  filter, which their term pickers use */
	async renderRings() {
		const twLst = this.twLst
		const filter = this.state.termfilter?.filter
		const sig = JSON.stringify(twLst.map(tw => [tw.$id, tw.q]))
		if (sig == this.ringsShown) {
			await Promise.all(this.ringPills.map(({ pill, arg }) => pill.main({ ...arg, filter })))
			return
		}
		this.ringsShown = sig
		this.ringPills = []
		const holder = this.dom.rings.body
		holder.selectAll('*').remove()
		const disable_terms = twLst.map(tw => tw.term)
		const sampleTypes = this.app.vocabApi.termdbConfig?.sampleTypes
		const edit = (lst: any[]) => this.app.dispatch({ type: 'plot_edit', id: this.id, config: { twLst: lst } })
		/** one line of the box, indented by its ring, with an elbow from the line above */
		const line = (level: number) => {
			const row = holder
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
		for (const [i, tw] of twLst.entries()) {
			const row = line(i)
				.attr('class', 'sjpp-sunburst-ring')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('gap', '4px')
			// the ring number; it and a bar beside it are marked while the ring is in the chart
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
			const pillDiv = row
				.append('div')
				.attr('class', 'sjpp-sunburst-ringpill')
				.style('min-width', '0')
				.style('overflow', 'hidden')
				.style('white-space', 'nowrap')
				.style('font-size', '.9em')
				.style('text-overflow', 'ellipsis')
				.attr('title', tw.term.name)
			const others = twLst.filter((_, j) => j != i)
			const p = await this.ringPill(
				pillDiv,
				newTw => {
					const lst = twLst.slice()
					if (newTw?.term) lst[i] = newTw
					else lst.splice(i, 1)
					edit(lst)
				},
				allowedSampleTypes(others, sampleTypes)
			)
			this.ringPills.push({ pill: p, arg: { term: tw.term, q: tw.q, $id: tw.$id, disable_terms } })
		}
		const addDiv = line(twLst.length).style('margin-top', '6px').append('div').style('margin-left', '21px')
		const add = await this.ringPill(
			addDiv,
			newTw => {
				if (newTw?.term) edit([...twLst, newTw])
			},
			allowedSampleTypes(twLst, sampleTypes),
			'+ Add ring'
		)
		this.ringPills.push({ pill: add, arg: { term: null, q: null, disable_terms } })
		await Promise.all(this.ringPills.map(({ pill, arg }) => pill.main({ ...arg, filter })))
		this.markShownRings()
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

	/** a ring term pill; `sampleTypes` limits the terms it offers (see allowedSampleTypes) */
	async ringPill(holder: any, callback: (tw: any) => void, sampleTypes?: string[], placeholder?: string) {
		return await termsettingInit({
			holder,
			vocabApi: this.app.vocabApi,
			usecase: { target: 'sunburst', ...(sampleTypes ? { sampleTypes } : {}) },
			// the full term name; a name too long for the box is clipped, with the name as its tooltip
			abbrCutoff: 1000,
			menuOptions: '*',
			numericEditMenuVersion: ['discrete'],
			defaultQ4fillTW: { numeric: { mode: 'discrete' } },
			...(placeholder ? { placeholder } : {}),
			debug: this.app.opts.debug,
			callback
		})
	}

	destroy() {
		this.renderer?.destroy()
	}
}

const RING_LINE = '#cbd5e1'

/** termdb/sunburst request; errors are thrown */
async function fetchSunburst(body: SunburstRequest): Promise<SunburstResponse> {
	const res: any = await dofetch3('termdb/sunburst', { body })
	if (res?.error) throw res.error
	if (!res?.nodes) throw 'invalid response from termdb/sunburst'
	return res
}

export async function getPlotConfig(opts: any, app: any) {
	const config: any = {
		chartType: 'sunburst',
		settings: {}
	}
	copyMerge(config, opts)
	// default rings from the dataset; a saved session or another chart may give its own
	if (!config.twLst) config.twLst = structuredClone(app.vocabApi.termdbConfig?.sunburst?.twLst || [])
	config.twLst = await Promise.all(
		config.twLst.map((tw: any) => fillTermWrapper(tw, app.vocabApi, { numeric: { mode: 'discrete' } } as any))
	)
	return config
}

export const sunburstInit = getCompInit(Sunburst)
// this alias will allow abstracted dynamic imports
export const componentInit = sunburstInit

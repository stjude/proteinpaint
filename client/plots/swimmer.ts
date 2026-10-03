import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '#plots/PlotBase.ts'
import { controlsInit } from './controls'
import { dofetch3 } from '#common/dofetch'
import { Menu, DownloadMenu, axisstyle, shapes, shapeSelector } from '#dom'
import { rgb } from 'd3-color'
import { getCombinedTermFilter } from '#filter'
import { getColors } from '#shared/common.js'
import { scaleLinear } from 'd3-scale'
import { axisBottom } from 'd3-axis'
import type { SwimmerLane, SwimmerLegendItem, SwimmerPoint, SwimmerRequest, SwimmerResponse } from '#types'
import { getTermValue } from './sampleView.ts'
import { getT0T2defaultQ } from './summaryQ.ts'
import { fillTermWrapper } from '#termsetting'

/*
swimmer plot: one horizontal lane per patient. the light base bar spans from
time 0 to the lane end (the terminal event, e.g. death, else the latest event or interval end);
colored segments mark treatment intervals; dots mark clinical events.
*/

type LegendEntry = {
	key: string
	label: string
	color: string
	shape: string
	sampleTerms?: string[]
	/** hidden by the user in the legend: its segments or markers are not drawn */
	hidden: boolean
}

/** user changes to one legend item, overriding the ds config */
type LegendOverride = { color?: string; shape?: string; hidden?: boolean }

/** legend overrides by legend label (items of several keys merged under one label change together).
hidden is stored as false rather than deleted, since plot_edit merges settings and cannot remove keys */
type LegendOverrides = {
	categories: { [label: string]: LegendOverride }
	events: { [label: string]: LegendOverride }
	/** categories of the "mark by" term on linked points (e.g. ctDNA status of CSF dots) */
	pointCategories: { [label: string]: LegendOverride }
}

/** linked points (with a point sample) that have no value for the "mark by" term */
const noValueCategory = 'No value'

/** pixel width of the legend column, right of the lanes */
const legendWidth = 190

/** bounding box of each shape path within its 16x16 icon box, measured once per shape. the icons fill
that box unevenly (e.g. the cross spans 12px, the circle 16px), so sizing by the box would give markers
of different heights */
const shapeBBox = new Map<string, { x: number; y: number; width: number; height: number }>()

/** draw an event marker centered at (cx, cy) inside holder, scaled so the visible shape is `height` px tall.
the shape is a key of the shared #dom shapes. a transparent
rect keeps thin shapes (e.g. a cross) easy to hover */
function drawMarker(holder, shapeKey: string, cx: number, cy: number, height: number, color: string) {
	const key = shapes[shapeKey] ? shapeKey : 'filledCircle'
	const shape = shapes[key]
	const g = holder.append('g').attr('transform', `translate(${cx},${cy})`)
	g.append('rect')
		.attr('x', -height / 2)
		.attr('y', -height / 2)
		.attr('width', height)
		.attr('height', height)
		.attr('fill', 'transparent')
	const path = g.append('path').attr('d', shape.path).attr('fill', color)
	let box = shapeBBox.get(key)
	if (!box) {
		const b = path.node().getBBox()
		// getBBox() is all zeros while the svg is hidden; fall back to the icon box without caching
		if (b.width && b.height) {
			box = { x: b.x, y: b.y, width: b.width, height: b.height }
			shapeBBox.set(key, box)
		}
	}
	const bb = box || { x: 0, y: 0, width: 16, height: 16 }
	// solid shapes get a thin white halo; line shapes (cross, outlines) are thin filled paths, so a
	// same-colored stroke thickens them to stay legible. the stroke (px) is subtracted from the height
	const strokePx = shape.isFilled ? 0.5 : Math.max(1, height * 0.08)
	const scale = Math.max(0.1, height - strokePx) / bb.height
	path
		.attr('transform', `scale(${scale}) translate(${-(bb.x + bb.width / 2)},${-(bb.y + bb.height / 2)})`)
		.attr('stroke', shape.isFilled ? 'white' : color)
		.attr('stroke-width', strokePx / scale)
		.attr('stroke-linejoin', 'round')
	return g
}

type SwimmerSettings = {
	/** pixel height of one lane, including spacing */
	rowHeight: number
	/** pixel width of the lane area, excluding sample names and legend */
	plotWidth: number
	/** 'end': longest lane first; 'sample': by lane (patient) name */
	sortBy: 'end' | 'sample'
	showSampleNames: boolean
	legend: LegendOverrides
}

class Swimmer extends PlotBase implements RxComponent {
	static type = 'swimmer'

	type: string
	components: { controls: any }
	dom!: {
		holder: any
		controlsHolder: any
		errdiv: any
		loadingDiv: any
		plotDiv: any
		noteDiv: any
		tip: Menu
	}
	renderer!: SwimmerRenderer

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = Swimmer.type
		this.components = { controls: {} }
		if (this.opts.header) {
			this.opts.header.style('padding-left', '7px').style('color', 'rgb(85, 85, 85)').html('Swimmer Plot')
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			// global mass filter combined with this plot's local filter (config.filter, set by the plot wrapper's filter UI)
			termfilter: getCombinedTermFilter(appState, config.filter),
			genome: appState.vocab.genome,
			dslabel: appState.vocab.dslabel,
			swimmer: appState.termdbConfig?.queries?.swimmer || {}
		}
	}

	async init() {
		const holder = this.opts.holder.append('div').attr('data-testid', 'sjpp-swimmer-holder')
		const controlsHolder = holder.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const rightDiv = holder.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		this.dom = {
			holder,
			controlsHolder,
			errdiv: rightDiv.append('div').attr('class', 'sja_errorbar').style('display', 'none'),
			loadingDiv: rightDiv.append('div').style('display', 'none').style('padding', '24px').text('Loading ...'),
			plotDiv: rightDiv.append('div').attr('data-testid', 'sjpp-swimmer-plot').style('padding', '10px'),
			noteDiv: rightDiv
				.append('div')
				.style('padding', '0 10px 10px 10px')
				.style('font-size', '.9em')
				.style('opacity', 0.7),
			tip: new Menu({ padding: '5px' })
		}
		this.renderer = new SwimmerRenderer(this.app, this.dom, settings =>
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: { settings: { swimmer: settings } } })
		)
		const laneName = this.renderer.laneType?.name || 'sample'
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: controlsHolder,
				inputs: [
					{
						type: 'term',
						configKey: 'term0',
						chartType: 'swimmer',
						usecase: { target: 'swimmer', detail: 'term0' },
						label: 'Divide by',
						title: 'Split lanes into one panel per category',
						vocabApi: this.app.vocabApi,
						numericEditMenuVersion: ['discrete'],
						defaultQ4fillTW: getT0T2defaultQ()
					},
					...this.getPointTermInputs(),
					{
						label: 'Sort lanes by',
						type: 'radio',
						chartType: 'swimmer',
						settingsKey: 'sortBy',
						options: [
							{ label: 'Lane length', value: 'end' },
							{ label: `${laneName[0].toUpperCase()}${laneName.slice(1)} name`, value: 'sample' }
						]
					},
					{
						label: `Show ${laneName} names`,
						type: 'checkbox',
						chartType: 'swimmer',
						settingsKey: 'showSampleNames',
						boxLabel: 'Yes'
					},
					{
						label: 'Row height',
						type: 'number',
						chartType: 'swimmer',
						settingsKey: 'rowHeight',
						min: 6,
						max: 50
					},
					{
						label: 'Plot width',
						type: 'number',
						chartType: 'swimmer',
						settingsKey: 'plotWidth',
						min: 200,
						max: 3000
					}
				]
			})
		}
		this.components.controls.on('downloadClick.swimmer', event => {
			const svg = this.renderer.dom.svg
			if (!svg) return
			new DownloadMenu([{ name: 'Swimmer plot', svg }], 'swimmer_plot').show(event.clientX, event.clientY, event.target)
		})
	}

	/** "Mark <event> by" term input, only when the ds has points linked to samples (e.g. CSF dots). the
	term picker lists only terms of those samples' types */
	getPointTermInputs() {
		const sw = this.app.vocabApi.termdbConfig?.queries?.swimmer
		if (!sw?.pointSampleTypes?.length) return []
		const events = (sw.pointSampleEvents || []).map(k => sw.events?.[k]?.label || k)
		const what = [...new Set(events)].join(' / ') || 'linked samples'
		return [
			{
				type: 'term',
				configKey: 'pointTerm',
				chartType: 'swimmer',
				usecase: { target: 'swimmer', detail: 'pointTerm', sampleTypes: sw.pointSampleTypes },
				label: `Mark ${what} by`,
				title: `Color the ${what} markers by a variable of their own samples`,
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['discrete'],
				defaultQ4fillTW: getT0T2defaultQ()
			}
		]
	}

	async main() {
		try {
			this.toggleLoadingDiv()
			this.dom.errdiv.style('display', 'none')
			const result = await this.fetchLanes()
			this.toggleLoadingDiv('none')
			this.renderer.update({
				swimmer: this.state.swimmer,
				settings: this.state.config.settings.swimmer,
				lanes: result.lanes,
				divideByOrder: result.divideByOrder,
				term0: this.state.config.term0,
				pointTerm: this.state.config.pointTerm,
				pointCategoryOrder: result.pointCategoryOrder
			})
		} catch (e: any) {
			this.toggleLoadingDiv('none')
			this.printError(e)
		}
	}

	async fetchLanes(): Promise<SwimmerResponse> {
		const body: any = {
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			filter: this.state.termfilter?.filter
		}
		if (this.state.config.term0) body.term0 = this.state.config.term0
		if (this.state.config.pointTerm) body.pointTerm = this.state.config.pointTerm
		return await fetchSwimmerLanes(body)
	}
}

/** draws swimmer lanes, divide-by panels and the legend into dom.plotDiv, with notes in dom.noteDiv. used by
the swimmer chart and by sample view, which shows the lane of the viewed patient */
export class SwimmerRenderer {
	app: any
	/** client copy of ds.queries.swimmer: timeLabel, categories, events, terminalEvent, pointSampleTypes,
	pointSampleEvents */
	swimmer: any = {}
	settings!: SwimmerSettings
	/** divide-by tw, lanes are then split into one panel per category */
	term0?: any
	lanes: SwimmerLane[] = []
	/** divide-by category order from the server, only with term0 */
	divideByOrder: string[] = []
	/** "mark by" tw of the linked points (e.g. a CSF term); their markers are then colored by point.category */
	pointTerm?: any
	/** point category order from the server, only with pointTerm */
	pointCategoryOrder: string[] = []
	dom: { plotDiv: any; noteDiv: any; tip: Menu; svg?: any }
	/** sample type of the lanes, which are patients: the root sample type when the db has exactly one, e.g.
	{name:'patient', plural_name:'patients'}, to name lanes in messages and controls. */
	laneType?: { name: string; plural_name: string }
	/** annotations of point samples (e.g. CSF) shown on hover, fetched once per sample id */
	pointSampleAnno = new Map<string, Promise<{ label: string; value: string }[]>>()

	/** called with changed settings (e.g. legend edits); without it the renderer keeps the change itself and
	redraws, as in sample view where the lane has no plot config to save it to */
	onSettingsChange?: (settings: Partial<SwimmerSettings>) => void

	constructor(
		app: any,
		dom: { plotDiv: any; noteDiv: any; tip: Menu },
		onSettingsChange?: (settings: Partial<SwimmerSettings>) => void
	) {
		this.app = app
		this.dom = dom
		this.onSettingsChange = onSettingsChange
		const roots = Object.values(app.vocabApi?.termdbConfig?.sampleTypes || {}).filter((t: any) => t.parent_id == null)
		if (roots.length == 1) this.laneType = roots[0] as { name: string; plural_name: string }
	}

	update(d: {
		swimmer: any
		settings: SwimmerSettings
		lanes: SwimmerLane[]
		divideByOrder?: string[]
		term0?: any
		pointTerm?: any
		pointCategoryOrder?: string[]
	}) {
		this.swimmer = d.swimmer || {}
		this.settings = d.settings
		this.lanes = d.lanes
		this.divideByOrder = d.divideByOrder || []
		this.term0 = d.term0
		this.pointTerm = d.pointTerm
		this.pointCategoryOrder = d.pointCategoryOrder || []
		this.render()
	}

	/** whether a point is colored by the "mark by" term: a linked point of a markBy event */
	isMarkedPoint(p: SwimmerPoint): boolean {
		return !!this.pointTerm && p.sampleId !== undefined && !!this.swimmer.pointSampleEvents?.includes(p.event)
	}

	/** with pointTerm: legend of the marked points' categories, in server order, then "No value" when some
	marked point lacks a value. colors come from term.values when set there, else a default palette; the shape
	is that of the point's event. user overrides apply as for the other legend sections */
	getPointLegend(events: { byKey: Map<string, LegendEntry> }) {
		if (!this.pointTerm) return { byKey: new Map<string, LegendEntry>(), entries: [] as LegendEntry[] }
		let hasNoValue = false
		let shape: string | undefined
		for (const lane of this.lanes) {
			for (const p of lane.points) {
				if (!this.isMarkedPoint(p)) continue
				shape ||= events.byKey.get(p.event)?.shape
				if (!p.category) hasNoValue = true
			}
		}
		const termColors = new Map<string, string>()
		for (const [k, v] of Object.entries((this.pointTerm.term?.values || {}) as { [k: string]: any }))
			if (v.color) termColors.set(v.label || k, v.color)
		const labels = [...this.pointCategoryOrder, ...(hasNoValue ? [noValueCategory] : [])]
		const palette = getColors(Math.max(labels.length, 1))
		const configured = {}
		for (const label of labels)
			configured[label] = {
				label,
				color: label == noValueCategory ? '#aaa' : termColors.get(label) || palette(label),
				shape
			}
		return this.getLegend(configured, new Set(labels), this.settings.legend?.pointCategories)
	}

	/** lanes split by divide-by category, in server order. without term0 there is one unlabeled group.
	a patient with several categories (a multivalue term, or samples in different categories) is in each
	of its groups; lanes without a value are left out and counted in the note below the plot */
	getGroups<T extends { lane: SwimmerLane }>(lanes: T[]): { label?: string; lanes: T[] }[] {
		if (!this.term0) return [{ lanes }]
		const byLabel = new Map<string, T[]>(this.divideByOrder.map(c => [c, []]))
		let noValue = 0
		for (const l of lanes) {
			if (!l.lane.divideBy?.length) {
				noValue++
				continue
			}
			for (const c of l.lane.divideBy) {
				if (!byLabel.has(c)) byLabel.set(c, [])
				byLabel.get(c)!.push(l)
			}
		}
		if (noValue) {
			const name = this.term0.term?.name || 'the divide-by variable'
			const noun = noValue > 1 ? this.laneType?.plural_name || 'samples' : this.laneType?.name || 'sample'
			this.dom.noteDiv
				.append('div')
				.attr('data-testid', 'sjpp-swimmer-novalue-note')
				.text(`${noValue} ${noun} without a value for ${name} not shown`)
		}
		return [...byLabel].filter(([, l]) => l.length).map(([label, l]) => ({ label, lanes: l }))
	}

	/** lane end: the terminal event time when present, else the latest event or interval time */
	getLaneEnd(lane: SwimmerLane): number {
		const terminal = this.swimmer.terminalEvent
		if (terminal) {
			const t = lane.points.find(p => p.event == terminal)
			if (t) return t.time
		}
		let end = 0
		for (const p of lane.points) end = Math.max(end, p.time)
		for (const r of lane.ranges) end = Math.max(end, r.start, r.end ?? 0)
		return end
	}

	/** legend entries for interval categories or events: configured items first (in config order,
	merged by label), then any key found in the data that the ds did not configure, with a default color.
	user overrides (by label) take precedence over the ds config */
	getLegend(
		configured: { [key: string]: SwimmerLegendItem } | undefined,
		dataKeys: Set<string>,
		overrides: { [label: string]: LegendOverride } = {}
	) {
		const byKey = new Map<string, LegendEntry>()
		const entries: LegendEntry[] = []
		const seenLabels = new Set<string>()
		const unconfigured = [...dataKeys].filter(k => !configured?.[k])
		const fallback = getColors(Math.max(unconfigured.length, 1))
		const add = (key: string, item: SwimmerLegendItem) => {
			const label = item.label || key
			const o = overrides[label] || {}
			const e: LegendEntry = {
				key,
				label,
				color: o.color || item.color || fallback(key),
				shape: o.shape || item.shape || 'filledCircle',
				sampleTerms: item.sampleTerms,
				hidden: !!o.hidden
			}
			byKey.set(key, e)
			if (!seenLabels.has(e.label)) {
				seenLabels.add(e.label)
				entries.push(e)
			}
		}
		for (const [key, item] of Object.entries(configured || {})) add(key, item)
		for (const key of unconfigured) add(key, {})
		return { byKey, entries }
	}

	render() {
		const s = this.settings
		const plotDiv = this.dom.plotDiv
		plotDiv.selectAll('*').remove()
		this.dom.noteDiv.selectAll('*').remove()
		delete this.dom.svg

		if (!this.lanes.length) {
			plotDiv
				.append('div')
				.style('opacity', 0.6)
				.text(`No ${this.laneType?.plural_name || 'samples'} with timeline data match the current filter`)
			return
		}

		const lanes = this.lanes.map(lane => ({ lane, end: this.getLaneEnd(lane) }))
		if (s.sortBy == 'sample') lanes.sort((a, b) => a.lane.sample.localeCompare(b.lane.sample))
		else lanes.sort((a, b) => b.end - a.end)

		const categoryKeys = new Set<string>()
		const eventKeys = new Set<string>()
		for (const { lane } of lanes) {
			for (const r of lane.ranges) categoryKeys.add(r.category)
			for (const p of lane.points) eventKeys.add(p.event)
		}
		const categories = this.getLegend(this.swimmer.categories, categoryKeys, s.legend?.categories)
		const events = this.getLegend(this.swimmer.events, eventKeys, s.legend?.events)
		const pointCategories = this.getPointLegend(events)

		const fontSize = Math.min(12, Math.max(7, s.rowHeight - 3))
		const axisHeight = 45
		const topPad = 10
		const rightPad = 20
		// lanes are separated by a thin fixed gap so the bar fills most of the row; segments and
		// event dots scale with the bar rather than the row
		const laneGap = Math.max(1, Math.round(s.rowHeight * 0.1))
		const barH = Math.max(2, s.rowHeight - laneGap)
		const segH = Math.max(1, barH * 0.6)
		// event markers are 70% of the bar height, all shapes the same height
		const markerH = Math.max(4, barH * 0.7)

		const svg = plotDiv.append('svg').attr('data-testid', 'sjpp-swimmer-svg')
		this.dom.svg = svg
		const labelWidth = s.showSampleNames
			? getMaxTextWidth(
					svg,
					lanes.map(l => l.lane.sample),
					fontSize
			  ) + 12
			: 10

		// one shared time scale for all divide-by panels, so they can be compared
		const maxEnd = Math.max(...lanes.map(l => l.end), 1)
		// events before the time origin (e.g. a CSF sample collected before treatment start) have
		// negative times; extend the axis left so they do not overlap the sample names
		let minTime = 0
		for (const { lane } of lanes) {
			for (const p of lane.points) minTime = Math.min(minTime, p.time)
			for (const r of lane.ranges) minTime = Math.min(minTime, r.start)
		}
		const x = scaleLinear()
			.domain([minTime < 0 ? minTime - (maxEnd - minTime) * 0.01 : 0, maxEnd * 1.02])
			.range([0, s.plotWidth])
		const ticks = x.ticks(Math.max(2, Math.floor(s.plotWidth / 90)))

		const tip = this.dom.tip
		const timeLabel = this.swimmer.timeLabel || 'Time'
		const fmt = (d: number) => (Number.isInteger(d) ? String(d) : d.toFixed(1))

		const groups = this.getGroups(lanes)
		if (!groups.length) {
			svg.remove()
			delete this.dom.svg
			plotDiv
				.append('div')
				.style('opacity', 0.6)
				.text(`No ${this.laneType?.plural_name || 'samples'} have a value for the divide-by variable`)
			return
		}
		const titleH = groups[0].label !== undefined ? 24 : 0
		const groupGap = 16
		let yOffset = topPad
		for (const group of groups) {
			if (group.label !== undefined) {
				svg
					.append('text')
					.attr('data-testid', 'sjpp-swimmer-group-title')
					.attr('x', labelWidth)
					.attr('y', yOffset + 15)
					.attr('font-size', 14)
					.attr('font-weight', 600)
					.attr('fill', '#333')
					.text(`${group.label} (n=${group.lanes.length})`)
				yOffset += titleH
			}
			const plotHeight = group.lanes.length * s.rowHeight
			const mainG = svg.append('g').attr('transform', `translate(${labelWidth},${yOffset})`)

			// vertical grid lines behind the lanes
			mainG
				.append('g')
				.selectAll('line')
				.data(ticks)
				.enter()
				.append('line')
				.attr('x1', d => x(d))
				.attr('x2', d => x(d))
				.attr('y1', 0)
				.attr('y2', plotHeight)
				.attr('stroke', '#e6e6e6')
				.attr('shape-rendering', 'crispEdges')

			for (const [i, { lane, end }] of group.lanes.entries()) {
				const y = i * s.rowHeight
				const g = mainG.append('g').attr('transform', `translate(0,${y})`)

				// base bar
				g.append('rect')
					.attr('x', x(0))
					.attr('y', (s.rowHeight - barH) / 2)
					.attr('width', Math.max(0, x(end) - x(0)))
					.attr('height', barH)
					.attr('fill', '#f7f7f7')
					.attr('stroke', '#999')
					.attr('stroke-width', 0.5)
					.attr('shape-rendering', 'crispEdges')
					.on('mouseover', event => {
						tip.clear().show(event.clientX, event.clientY)
						tip.d.append('div').style('font-weight', 'bold').text(lane.sample)
						tip.d.append('div').text(`Lane end: ${fmt(end)} (${timeLabel.toLowerCase()})`)
					})
					.on('mouseout', () => tip.hide())

				// interval segments. one without an end (blank or NA in the file) is ongoing: drawn up to the lane
				// end, with an arrowhead
				for (const r of lane.ranges) {
					const entry = categories.byKey.get(r.category)!
					if (entry.hidden) continue
					const segEnd = r.end ?? Math.max(end, r.start)
					const segTop = (s.rowHeight - segH) / 2
					const seg = g.append('g').on('mouseout', () => tip.hide())
					seg
						.append('rect')
						.attr('x', x(r.start))
						.attr('y', segTop)
						.attr('width', Math.max(1, x(segEnd) - x(r.start)))
						.attr('height', segH)
						.attr('fill', entry.color)
						.attr('shape-rendering', 'crispEdges')
					if (r.end == null) {
						const xe = x(r.start) + Math.max(1, x(segEnd) - x(r.start))
						seg
							.append('path')
							.attr(
								'd',
								`M${xe},${segTop - segH / 3}L${xe + segH * 0.8},${s.rowHeight / 2}L${xe},${segTop + segH * 1.33}Z`
							)
							.attr('fill', entry.color)
					}
					seg.on('mouseover', event => {
						tip.clear().show(event.clientX, event.clientY)
						tip.d.append('div').style('font-weight', 'bold').text(lane.sample)
						tip.d.append('div').text(`${entry.label}${entry.label != r.category ? ` (${r.category})` : ''}`)
						tip.d
							.append('div')
							.text(
								r.end == null
									? `From ${fmt(r.start)}, ongoing (${timeLabel.toLowerCase()})`
									: `${fmt(r.start)} to ${fmt(r.end)} (${timeLabel.toLowerCase()})`
							)
					})
				}

				// events
				for (const p of lane.points) {
					const entry = events.byKey.get(p.event)!
					if (entry.hidden) continue
					// a marked point is drawn by its "mark by" category
					const mark = this.isMarkedPoint(p) ? pointCategories.byKey.get(p.category || noValueCategory) : undefined
					if (mark?.hidden) continue
					const dot = drawMarker(
						g,
						mark?.shape || entry.shape,
						x(p.time),
						s.rowHeight / 2,
						markerH,
						mark?.color || entry.color
					)
						.attr('data-event', p.event)
						.on('mouseover', event => {
							tip.clear().show(event.clientX, event.clientY)
							tip.d.append('div').style('font-weight', 'bold').text(lane.sample)
							tip.d.append('div').text(`${entry.label}: ${fmt(p.time)} (${timeLabel.toLowerCase()})`)
							if (mark) tip.d.append('div').text(`${this.pointTerm.term?.name}: ${mark.label}`)
							if (p.sample) {
								tip.d.append('div').text(`Sample: ${p.sample}`)
								if (p.sampleId !== undefined && entry.sampleTerms?.length)
									this.showPointSampleAnno(tip, p.sampleId, entry.sampleTerms)
								tip.d.append('div').style('font-size', '0.8em').style('opacity', 0.7).text('Click to open sample view')
							}
						})
						.on('mouseout', () => tip.hide())
					if (p.sample && p.sampleId !== undefined) {
						const sample = { sampleId: p.sampleId, sampleName: p.sample }
						dot
							.attr('data-testid', 'sjpp-swimmer-linked-point')
							.style('cursor', 'pointer')
							.on('click', () => {
								tip.hide()
								this.openSampleView(sample)
							})
					}
				}

				if (s.showSampleNames) {
					g.append('text')
						.attr('x', -6)
						.attr('y', s.rowHeight / 2)
						.attr('text-anchor', 'end')
						.attr('dominant-baseline', 'central')
						.attr('font-size', fontSize)
						.attr('fill', '#333')
						.style('cursor', 'pointer')
						.text(lane.sample)
						.on('click', () => this.openSampleView({ sampleId: lane.sampleId, sampleName: lane.sample }, true))
						.on('mouseover', event => {
							tip.clear().show(event.clientX, event.clientY)
							tip.d.append('div').text('Click to open sample view')
						})
						.on('mouseout', () => tip.hide())
				}
			}

			// x axis
			const axisG = mainG.append('g').attr('transform', `translate(0,${plotHeight + 2})`)
			axisG.call(axisBottom(x).tickValues(ticks))
			axisstyle({ axis: axisG, showline: true, fontsize: 11 })
			axisG
				.append('text')
				.attr('x', s.plotWidth / 2)
				.attr('y', 34)
				.attr('text-anchor', 'middle')
				.attr('font-size', 12)
				.attr('fill', '#333')
				.text(timeLabel)
			yOffset += plotHeight + axisHeight + groupGap
		}
		const legendHeight = this.renderLegend(
			svg.append('g').attr('transform', `translate(${labelWidth + s.plotWidth + rightPad},${topPad})`),
			categories.entries,
			events.entries,
			pointCategories.entries
		)
		// a few lanes (e.g. one patient in sample view) can be shorter than the legend
		svg
			.attr('width', labelWidth + s.plotWidth + rightPad + legendWidth)
			.attr('height', Math.max(yOffset - groupGap, topPad + legendHeight))
	}

	/** returns the legend height. events linked to samples (e.g. "CSF sample") are listed last. with a "mark
	by" term their markers take the term's category colors and shapes, so the event row has no icon and names
	the term, and the term's categories follow, indented:
	  Events
	    Follow-up
	    CSF sample by <term name>
	      category1
	      category2 */
	renderLegend(g, categories: LegendEntry[], events: LegendEntry[], pointCategories: LegendEntry[] = []): number {
		const lineH = 18
		const indent = 20
		let y = 0
		const fit = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1) + '…' : text)
		const title = (text: string) => {
			g.append('text')
				.attr('y', y + 10)
				.attr('font-size', 12)
				.attr('font-weight', 'bold')
				.text(text)
			y += lineH
		}
		const item = (
			type: keyof LegendOverrides,
			e: LegendEntry,
			entries: LegendEntry[],
			drawIcon: (holder: any, e: LegendEntry) => void,
			/** label: shown instead of e.label */
			opts: { x?: number; allowColor?: boolean; allowShape?: boolean; label?: string } = {}
		) => {
			const x = opts.x || 0
			// long labels (e.g. a term name, or a free-text note stored as a category) are cut to fit the legend
			// width, with the full text on hover
			const max = Math.floor((26 * (legendWidth - x)) / legendWidth)
			const row = g
				.append('g')
				.attr('transform', `translate(${x},${y})`)
				.attr('data-testid', 'sjpp-swimmer-legend-item')
				.attr('data-legend-type', type)
				.style('cursor', 'pointer')
				.style('opacity', e.hidden ? 0.4 : 1)
				.on('click', event =>
					this.showLegendMenu(event, type, e, entries, {
						allowColor: opts.allowColor !== false,
						allowShape: type != 'categories' && opts.allowShape !== false
					})
				)
			// transparent box so the gap between icon and label is clickable too
			row
				.append('rect')
				.attr('width', legendWidth - 20 - x)
				.attr('height', lineH)
				.attr('fill', 'transparent')
			drawIcon(row, e)
			row
				.append('text')
				.attr('x', 20)
				.attr('y', 10)
				.attr('font-size', 12)
				.attr('fill', '#333')
				.style('text-decoration', e.hidden ? 'line-through' : 'none')
				.text(fit(opts.label || e.label, max))
			if ((opts.label || e.label).length > max) row.append('title').text(opts.label || e.label)
			y += lineH
		}
		const rect = (row, e: LegendEntry) =>
			row.append('rect').attr('x', 0).attr('y', 3).attr('width', 14).attr('height', 8).attr('fill', e.color)
		const marker = (row, e: LegendEntry) => drawMarker(row, e.shape, 7, 7, 12, e.color)

		if (categories.length) {
			title('Intervals')
			for (const e of categories) item('categories', e, categories, rect)
			y += 8
		}
		if (events.length) {
			const linkedKeys = new Set<string>(this.swimmer.pointSampleEvents || [])
			const linked = events.filter(e => linkedKeys.has(e.key))
			const ordered = [...events.filter(e => !linkedKeys.has(e.key)), ...linked]
			const marked = this.pointTerm && pointCategories.length > 0
			title('Events')
			for (const e of ordered) {
				if (!marked || !linkedKeys.has(e.key)) {
					item('events', e, ordered, marker)
					continue
				}
				// markers take the mark-by term's category colors and shapes: no icon, no color or shape option
				item('events', e, ordered, () => {}, {
					allowColor: false,
					allowShape: false,
					label: `${e.label} by ${this.pointTerm.term?.name || ''}`
				})
			}
			if (marked) {
				for (const e of pointCategories) item('pointCategories', e, pointCategories, marker, { x: indent })
			}
			y += 8
		}
		return y
	}

	/** legend item menu, as in the scatter plot legend: hide/show, show only, show all, color, and shape for
	events. "show only" and "show all" act within the item's own section (intervals, events or mark-by
	categories). color and shape options are left out for an event whose markers are drawn by the mark-by term */
	showLegendMenu(
		event,
		type: keyof LegendOverrides,
		e: LegendEntry,
		entries: LegendEntry[],
		opts: { allowColor: boolean; allowShape: boolean }
	) {
		this.dom.tip.hide()
		const menu = new Menu({ padding: '0px' })
		const div = menu.d.append('div')
		const option = (text: string, edit: () => { [label: string]: LegendOverride }) =>
			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(text)
				.on('click', () => {
					menu.hide()
					this.editLegend(type, edit())
				})
		option(e.hidden ? 'Show' : 'Hide', () => ({ [e.label]: { hidden: !e.hidden } }))
		if (entries.length > 1)
			option('Show only', () => Object.fromEntries(entries.map(x => [x.label, { hidden: x.label != e.label }])))
		if (entries.some(x => x.hidden))
			option('Show all', () => Object.fromEntries(entries.map(x => [x.label, { hidden: false }])))
		if (opts.allowColor)
			div
				.append('div')
				.attr('class', 'sja_sharp_border')
				.style('padding', '0px 10px')
				.text('Color:')
				.append('input')
				.attr('type', 'color')
				.attr('value', rgb(e.color).formatHex())
				.on('change', (ev: Event) => {
					menu.hide()
					this.editLegend(type, { [e.label]: { color: (ev.target as HTMLInputElement).value } })
				})
		if (opts.allowShape) {
			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Change shape')
				.on('click', () => {
					div.selectAll('*').remove()
					// shapeSelector lists the shapes in the order of the shapes object
					shapeSelector(div, (index: number) => {
						menu.hide()
						this.editLegend(type, { [e.label]: { shape: Object.keys(shapes)[index] } })
					})
				})
		}
		menu.showunder(event.target)
	}

	/** merge changes into the legend overrides, then save them through onSettingsChange or redraw locally */
	editLegend(type: keyof LegendOverrides, changes: { [label: string]: LegendOverride }) {
		const legend: LegendOverrides = structuredClone(
			this.settings.legend || { categories: {}, events: {}, pointCategories: {} }
		)
		if (!legend[type]) legend[type] = {}
		for (const [label, o] of Object.entries(changes)) legend[type][label] = { ...legend[type][label], ...o }
		if (this.onSettingsChange) this.onSettingsChange({ legend })
		else {
			this.settings = { ...this.settings, legend }
			this.render()
		}
	}

	/** list annotations of a point's own sample (e.g. a CSF sample) in the open tooltip, using the same
	single-sample query and value formatting as sample view. termIds comes from the event's sampleTerms in
	the dataset config and sets which terms are shown and in what order. the table fills in only if the
	tooltip still shows this point */
	async showPointSampleAnno(tip, sampleId: number, termIds: string[]) {
		const holder = tip.d.append('div').attr('data-sampleid', sampleId).style('margin', '4px 0')
		holder.append('div').style('opacity', 0.6).text('Loading annotations ...')
		let rows: { label: string; value: string }[]
		try {
			rows = await this.getPointSampleAnno(sampleId, termIds)
		} catch (e: any) {
			rows = []
			console.warn('swimmer: cannot load sample annotations', e)
		}
		if (!holder.node()?.isConnected) return // tooltip moved on to another element
		holder.selectAll('*').remove()
		if (!rows.length) return
		const table = holder.append('table').style('border-spacing', '0 1px').style('font-size', '0.9em')
		for (const r of rows) {
			const tr = table.append('tr')
			tr.append('td').style('padding-right', '8px').style('opacity', 0.7).text(r.label)
			tr.append('td').text(r.value)
		}
	}

	getPointSampleAnno(sampleId: number, termIds: string[]) {
		const cacheKey = `${sampleId}\t${termIds.join('\t')}`
		let pr = this.pointSampleAnno.get(cacheKey)
		if (!pr) {
			pr = (async () => {
				const data = await this.app.vocabApi.getSingleSampleData({ sampleId, term_ids: termIds })
				if ('error' in data) throw data.error
				const rows: { label: string; value: string }[] = []
				// configured order; a term without a value for this sample is skipped
				for (const id of termIds.filter(id => data[id])) {
					const term = data[id].term
					const value = getTermValue(term, data)
					if (value != null) rows.push({ label: term.name, value })
				}
				return rows
			})()
			// a failed fetch is not cached, so the next hover retries
			pr.catch(() => this.pointSampleAnno.delete(cacheKey))
			this.pointSampleAnno.set(cacheKey, pr)
		}
		return pr
	}

	/** withRelated: open the sample with its related samples (e.g. a patient lane shows the patient and
	its primary/PDX/CSF samples as columns), as when the sample is picked in the sample view search box;
	otherwise only this sample (e.g. a CSF dot) */
	openSampleView(sample: { sampleId: number; sampleName: string }, withRelated = false) {
		this.app.dispatch({
			type: 'plot_create',
			config: { chartType: 'sampleView', ...(withRelated ? { sample } : { samples: [sample] }) }
		})
	}
}

/** termdb/swimmer request. the route sends errors as a plain string, so they are not cached by dofetch3 */
export async function fetchSwimmerLanes(body: SwimmerRequest): Promise<SwimmerResponse> {
	const result: SwimmerResponse | string = await dofetch3('termdb/swimmer', { body })
	if (typeof result == 'string') throw result
	if (!result?.lanes) throw 'invalid response from termdb/swimmer'
	return result
}

/** default settings of the swimmer chart, reused by sample view */
export function getDefaultSwimmerSettings(): SwimmerSettings {
	return {
		rowHeight: 20,
		plotWidth: 800,
		sortBy: 'end',
		showSampleNames: true,
		legend: { categories: {}, events: {}, pointCategories: {} }
	}
}

/** widest rendered label in px at the given font size (px). getBBox() is 0 when the svg is hidden,
which only shrinks the left margin; the plot is visible when render() runs */
function getMaxTextWidth(svg, labels: string[], fontSize: number): number {
	let max = 0
	for (const label of labels) {
		const t = svg.append('text').attr('font-size', fontSize).text(label)
		max = Math.max(max, t.node().getBBox().width)
		t.remove()
	}
	return max
}

export async function getPlotConfig(opts, app) {
	const settings = getDefaultSwimmerSettings()
	const config: any = {
		chartType: 'swimmer',
		settings: {
			controls: { isOpen: false },
			swimmer: settings
		}
	}
	copyMerge(config, opts)
	// a divide-by or mark-by tw from a saved session or another chart is raw until filled here
	if (config.term0) config.term0 = await fillTermWrapper(config.term0, app.vocabApi)
	if (config.pointTerm) config.pointTerm = await fillTermWrapper(config.pointTerm, app.vocabApi)
	return config
}

export const swimmerInit = getCompInit(Swimmer)
// this alias will allow abstracted dynamic imports
export const componentInit = swimmerInit

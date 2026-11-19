import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '#plots/PlotBase.ts'
import { Menu } from '#dom'
import {
	renderDoseResponse,
	renderDoseResponseOverlay,
	getOverlayColors,
	TITLE_HEIGHT,
	TITLE_BASELINE,
	TITLE_FONT_SIZE
} from './chemicalSensitivity.doseResponse.ts'
import { scaleLinear, scaleSqrt } from 'd3-scale'
import { arc } from 'd3-shape'
import { rgb } from 'd3-color'
import { pointer } from 'd3-selection'
import type {
	ChemicalSensitivitySample,
	ChemicalSensitivityRequest,
	ChemicalSensitivityResponse,
	ChemicalSensitivityResult
} from '#types'

/*
drug sensitivity of the samples of a dataset, from ds.queries.chemicalSensitivity.
the chart button shows a menu of the samples (makeChartBtnMenu); selecting a sample creates its radial bar chart:
one bar per drug, anticlockwise from 3 o'clock in the order of the data file. a bar's length is sqrt-scaled by AOC
(so its area grows with AOC) and its color is IC50. both scales are shared by all samples, so that the charts of
different samples can be compared. clicking a bar shows the dose-response panel of the drug beside the chart
(chemicalSensitivity.doseResponse.ts); shift-clicking adds or removes a drug, and the panel then overlays the
dose-response curves of the drugs. the chart is hovered like a pie whose slices are the drug classes (the data
file drugClass column), each slice spanning its drugs' bars and labels and the space between them: while the
pointer is in the pie, the drugs of other classes are faded and the hovered class name is shown outside the ring.
focusing a bar does the same for its class
*/

/** px between the center and the bar base */
const INNER_RADIUS = 16
/** px of the longest bar */
const BAR_LENGTH = 218
/** px between a bar end and its label */
const LABEL_GAP = 4
/** min px between the center and a label, so that the labels of short bars are not crowded at the center */
const LABEL_MIN_RADIUS = 105
/** max px between the center and a label end; a label beyond it is put inside its bar */
const LABEL_MAX_RADIUS = INNER_RADIUS + BAR_LENGTH + 16
const FONT_SIZE = 10
/** px between the outermost drug label and the drug class label shown on hover */
const CLASS_LABEL_GAP = 12
const CLASS_FONT_SIZE = 13
/** on hover, the bars and labels of the drugs of other classes are faded to this opacity */
const FADED_OPACITY = 0.4
/** IC50 color, from sensitive (low IC50) to resistant (high IC50): one blue hue, dark to light */
const IC50_COLORS = ['#1f4c97', '#8cb4d8', '#eceffa']
/** AOC legend ticks, kept up to the max AOC; on the sqrt scale they are spread over the legend */
const AOC_TICKS = [0, 0.25, 1, 2, 4, 8, 16, 32]
/** px between the legends and the nearest label or bar beside them */
const LEGEND_GAP = 12
/** the legends are drawn at the chart scale (the AOC wedge as long as the longest bar), then shrunk by this */
const LEGEND_SCALE = 0.62
/** a drug shown in the dose-response panel, with its overlay color, which stays when other drugs are removed */
type SelectedDrug = { name: string; colorIndex: number }

class ChemicalSensitivity extends PlotBase implements RxComponent {
	static type = 'chemicalSensitivity'

	type: string
	/** names of the drugs in the data, set by main() */
	drugNames?: Set<string>
	dom!: {
		holder: any
		errdiv: any
		loadingDiv: any
		chartDiv: any
		radialDiv: any
		doseResponseDiv: any
		tip: Menu
	}

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = ChemicalSensitivity.type
		if (this.opts.header) {
			this.opts.header.style('padding-left', '7px').style('color', 'rgb(85, 85, 85)').html('Drug Sensitivity')
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			genome: appState.vocab.genome,
			dslabel: appState.vocab.dslabel
		}
	}

	async init() {
		const holder = this.opts.holder.append('div').attr('data-testid', 'sjpp-chemicalsensitivity-holder')
		this.dom = {
			holder,
			errdiv: holder.append('div').attr('class', 'sja_errorbar').style('display', 'none'),
			loadingDiv: holder.append('div').style('display', 'none').style('padding', '24px').text('Loading ...'),
			chartDiv: holder.append('div').attr('data-testid', 'sjpp-chemicalsensitivity-chart').style('padding', '10px'),
			radialDiv: null,
			doseResponseDiv: null,
			tip: new Menu({ padding: '5px' })
		}
		this.dom.radialDiv = this.dom.chartDiv.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		this.dom.doseResponseDiv = this.dom.chartDiv
			.append('div')
			.attr('data-testid', 'sjpp-chemicalsensitivity-doseresponse-panel')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin-left', '100px')
	}

	async main() {
		try {
			// a dot tooltip of the previous render
			this.dom.tip.hide()
			this.toggleLoadingDiv()
			this.dom.errdiv.style('display', 'none')
			const sample: string | undefined = this.state.config.sample
			if (!sample) throw 'no sample selected'
			const sequenceId = this.api!.getSequenceId()
			const saved: SelectedDrug[] = this.state.config.drugs || []
			let result: ChemicalSensitivityResponse
			try {
				result = await fetchChemicalSensitivity(this.app.vocabApi, {
					genome: this.state.genome,
					dslabel: this.state.dslabel,
					sample,
					drugs: saved.length ? saved.map(d => d.name) : undefined
				})
			} catch (e) {
				if (this.api!.isStaleSequenceId(sequenceId)) return
				throw e
			}
			if (this.api!.isStaleSequenceId(sequenceId)) return
			// a drug of a saved session that is no longer in the data is not shown
			this.drugNames = new Set(result.drugs.map(d => d.name))
			const selected = this.getSelectedDrugs()
			this.toggleLoadingDiv('none')
			this.dom.radialDiv.selectAll('*').remove()
			this.dom.doseResponseDiv.selectAll('*').remove()
			const s = result.samples.find(s => s.name == sample)
			if (!s || !result.results) throw 'invalid response from termdb/chemicalSensitivity'
			// a single drug is outlined in black, overlaid drugs in their curve colors
			const overlayColors = getOverlayColors(selected)
			const selectedColors = new Map(
				selected.map(d => [d.name, selected.length == 1 ? 'black' : overlayColors.get(d.name)!])
			)
			const radial = renderRadialChart(this.dom.radialDiv, s, result, result.results, `sjpp-chemsens-${this.id}`, {
				selectedColors,
				onDrugClick: (d, add) => this.selectDrug(d, add)
			})
			if (selected.length == 1) {
				renderDoseResponse(this.dom.doseResponseDiv, {
					sampleName: s.name,
					drug: selected[0].name,
					doseResponse: result.doseResponses?.[0],
					moleculeImage: result.moleculeImage,
					tip: this.dom.tip
				})
			} else if (selected.length > 1) {
				renderDoseResponseOverlay(this.dom.doseResponseDiv, {
					sampleName: s.name,
					drugs: selected.map(d => ({
						name: d.name,
						color: overlayColors.get(d.name)!,
						drugClass: result.drugs.find(x => x.name == d.name)?.class,
						doseResponse: result.doseResponses?.find(dr => dr.drug == d.name)
					})),
					onRemove: d => this.selectDrug(d, true),
					onHover: d => radial.highlightDrug(d)
				})
			}
			if (selected.length) {
				this.dom.doseResponseDiv
					.append('div')
					.style('padding-top', '10px')
					.style('font-size', '0.85em')
					.style('opacity', 0.7)
					.text('Shift-click bars to add or remove drugs')
			}
		} catch (e: any) {
			this.toggleLoadingDiv('none')
			this.printError(e)
		}
	}

	/** the selected drugs that are in the data (all of them before the data is loaded) */
	getSelectedDrugs(): SelectedDrug[] {
		const saved: SelectedDrug[] = this.state.config.drugs || []
		return this.drugNames ? saved.filter(d => this.drugNames!.has(d.name)) : saved
	}

	/** shows only this drug, or with add, adds it to the overlaid drugs or removes it from them. a drug that is not
	in the data is dropped from the selection */
	selectDrug(name: string, add: boolean) {
		const selected = this.getSelectedDrugs()
		let drugs: SelectedDrug[]
		if (!add) {
			if (selected.length == 1 && selected[0].name == name) return
			drugs = [{ name, colorIndex: 0 }]
		} else if (selected.some(d => d.name == name)) {
			drugs = selected.filter(d => d.name != name)
		} else {
			drugs = [...selected, { name, colorIndex: getFreeColorIndex(selected) }]
		}
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: { drugs } })
	}

	destroy() {
		this.dom?.tip?.destroy()
	}
}

/** the chart button menu: the samples, each with its attribute values. selecting one creates its chart */
export async function makeChartBtnMenu(holder: any, chartsInstance: any) {
	const vocabApi = chartsInstance.app.vocabApi
	const { genome, dslabel } = vocabApi.vocab
	const div = holder
		.append('div')
		.attr('data-testid', 'sjpp-chemicalsensitivity-menu')
		.style('max-height', '60vh')
		.style('overflow-y', 'auto')
	try {
		const { samples } = await fetchChemicalSensitivity(vocabApi, { genome, dslabel })
		for (const s of samples) {
			const option = div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.attr('tabindex', 0)
				.on('click', () => {
					chartsInstance.dom.tip.hide()
					chartsInstance.prepPlot({ config: { chartType: 'chemicalSensitivity', sample: s.name } })
				})
				.on('keydown', (event: KeyboardEvent) => {
					if (event.key == 'Enter') option.node().click()
				})
			option.append('span').text(s.name)
			const detail = Object.values(s.attributes || {}).join(', ')
			if (detail) option.append('span').style('margin-left', '10px').style('opacity', 0.6).text(detail)
		}
	} catch (e: any) {
		div
			.append('div')
			.attr('class', 'sja_errorbar')
			.text(e?.message || e)
	}
}

/** termdb/chemicalSensitivity request, with the termdb auth headers of the dataset. the route sends an error as
{ status, error } */
async function fetchChemicalSensitivity(
	vocabApi: any,
	body: ChemicalSensitivityRequest
): Promise<ChemicalSensitivityResponse> {
	const headers = await vocabApi.mayGetAuthHeaders('termdb')
	const result = await vocabApi.dofetch3('termdb/chemicalSensitivity', { headers, body }, vocabApi.opts.fetchOpts)
	if (result?.error) throw result.error
	if (!result?.samples) throw 'invalid response from termdb/chemicalSensitivity'
	return result
}

/** the radial bar chart of a sample, with the AOC and IC50 legends to its right */
function renderRadialChart(
	holder: any,
	sample: ChemicalSensitivitySample,
	data: ChemicalSensitivityResponse,
	results: ChemicalSensitivityResult[],
	gradientId: string,
	/** optional bar click, add is true with the shift key; the bars of the selected drugs are outlined in their colors */
	interaction?: { selectedColors?: Map<string, string>; onDrugClick?: (drug: string, add: boolean) => void }
): { highlightDrug: (drug?: string) => void } {
	const drug2result = new Map(results.map(r => [r.drug, r]))
	const step = (2 * Math.PI) / data.drugs.length
	const lengthScale = scaleSqrt().domain([0, data.aocMax || 1]).range([0, BAR_LENGTH])
	const [ic50Min, ic50Max] = data.ic50Range
	const colorScale = scaleLinear<string>()
		.domain([ic50Min, (ic50Min + ic50Max) / 2, ic50Max])
		.range(IC50_COLORS)
		.clamp(true)

	const svg = holder.append('svg').attr('data-testid', 'sjpp-chemicalsensitivity-svg')
	const title = svg
		.append('text')
		.attr('font-size', TITLE_FONT_SIZE)
		.attr('font-weight', 'bold')
		.attr('text-anchor', 'middle')
		.text(`${sample.name} Drug Sensitivity`)
	const chart = svg.append('g')

	// a bar is centered at its drug angle, in d3-shape angles: 0 at 12 o'clock, clockwise. the first drug is at
	// 3 o'clock and the next ones go anticlockwise
	const barArc = arc<any>()
		.innerRadius(INNER_RADIUS)
		.outerRadius((d: any) => INNER_RADIUS + d.length)
		.startAngle((d: any) => d.angle - step / 2)
		.endAngle((d: any) => d.angle + step / 2)
		// a 2px white gap between adjacent bars, at the bar base
		.padAngle(2 / INNER_RADIUS)
		.padRadius(INNER_RADIUS)

	let extent = LABEL_MAX_RADIUS
	/** radius of the class label, set after the drug labels are placed */
	let classRadius = 0
	/** corners of the drug labels, bar ends and class labels, in chart coordinates, to place the legends beside */
	const textBoxes: number[][][] = []
	/** the elements of each drug, to fade on hover */
	const drugElements: DrugElements[] = []
	/** key of the highlighted state, to redraw only when it changes as the pointer moves */
	let highlighted = 'none'
	const highlight = (h: HoveredDrug) => {
		const key =
			h === undefined ? 'none' : h == 'area' ? 'area' : h.drugClass ? `class ${h.drugClass}` : `drug ${h.index}`
		if (key == highlighted) return
		highlighted = key
		highlightDrugClass(drugElements, h, classLabel, classRadius)
	}
	for (const [i, drug] of data.drugs.entries()) {
		const angle = Math.PI / 2 - i * step
		const r = drug2result.get(drug.name)
		const length = r ? lengthScale(Math.max(0, r.aoc)) : 0
		const elements: DrugElements = { drugClass: drug.class, angle, label: null }
		drugElements.push(elements)
		if (r) {
			const bar = chart
				.append('path')
				.attr('data-testid', 'sjpp-chemicalsensitivity-bar')
				.attr('d', barArc({ angle, length }))
				.attr('fill', colorScale(r.ic50))
			const outline = interaction?.selectedColors?.get(drug.name)
			if (outline) bar.attr('stroke', outline).attr('stroke-width', 2.5)
			const onClick = interaction?.onDrugClick
			if (onClick) {
				bar
					.style('cursor', 'pointer')
					.attr('tabindex', 0)
					.attr('role', 'button')
					.attr('aria-label', `${drug.name}: show the dose response, with shift to add or remove it`)
					.on('click', (event: MouseEvent) => onClick(drug.name, event.shiftKey))
					.on('keydown', (event: KeyboardEvent) => {
						if (event.key == 'Enter') onClick(drug.name, event.shiftKey)
					})
			}
			bar.on('focus', () => highlight({ drugClass: drug.class, index: i })).on('blur', () => highlight(undefined))
			elements.bar = bar
		}
		const label = chart.append('text').attr('font-size', FONT_SIZE).attr('dominant-baseline', 'central').text(drug.name)
		elements.label = label
		const labelWidth = label.node().getComputedTextLength()
		// the label is beyond the bar end, at least at LABEL_MIN_RADIUS. a label that would go past LABEL_MAX_RADIUS
		// is inside the bar end when it fits there
		const barEnd = INNER_RADIUS + length
		const outsideRadius = Math.max(barEnd + LABEL_GAP, LABEL_MIN_RADIUS)
		const inside = r && outsideRadius + labelWidth > LABEL_MAX_RADIUS && length - 2 * LABEL_GAP > labelWidth
		const labelRadius = inside ? barEnd - LABEL_GAP : outsideRadius
		const x = labelRadius * Math.sin(angle),
			y = -labelRadius * Math.cos(angle)
		// text runs outward along the radius, flipped on the left half to stay upright
		const leftHalf = Math.sin(angle) < -1e-6
		let rotation = (angle * 180) / Math.PI - 90
		if (leftHalf) rotation += 180
		label
			.attr('transform', `translate(${x},${y}) rotate(${rotation})`)
			.attr('text-anchor', leftHalf != !!inside ? 'end' : 'start')
			.attr('fill', inside ? getTextColor(colorScale(r!.ic50)) : 'black')
		if (!inside) extent = Math.max(extent, labelRadius + labelWidth + FONT_SIZE / 2)
		const anchorStart = leftHalf == !!inside
		textBoxes.push(
			getRotatedBox(x, y, rotation, anchorStart ? 0 : -labelWidth, anchorStart ? labelWidth : 0, FONT_SIZE)
		)
		// the outer corners of the bar
		for (const a of [angle - step / 2, angle + step / 2])
			textBoxes.push([[(INNER_RADIUS + length) * Math.sin(a), -(INNER_RADIUS + length) * Math.cos(a)]])
	}
	// the drug class label of the hovered drug, hidden until hover
	const classLabel = chart
		.append('text')
		.attr('data-testid', 'sjpp-chemicalsensitivity-classlabel')
		.attr('font-size', CLASS_FONT_SIZE)
		.attr('font-weight', 'bold')
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'central')
		.style('pointer-events', 'none')
		.style('display', 'none')
	// the pie reaches the outermost label end; the class label is outside it
	const pieRadius = extent
	classRadius = pieRadius + CLASS_LABEL_GAP
	extent = classRadius + CLASS_FONT_SIZE
	// a transparent disc under the bars and labels, so that the whole pie gets the pointer events. the slice under
	// the pointer is found by the pointer angle; the hole at the center belongs to no slice
	chart.insert('circle', ':first-child').attr('r', pieRadius).attr('fill', 'transparent')
	chart
		.on('mousemove', (event: MouseEvent) => {
			const [x, y] = pointer(event, chart.node())
			const radius = Math.hypot(x, y)
			if (radius > pieRadius) return highlight(undefined)
			if (radius < INNER_RADIUS) return highlight('area')
			const index = getDrugIndexAtAngle(Math.atan2(x, -y), drugElements.length)
			highlight({ drugClass: drugElements[index].drugClass, index })
		})
		.on('mouseleave', () => highlight(undefined))

	// every class label as it would be shown on hover, so that the legends do not cover any
	for (const drugClass of new Set(drugElements.map(e => e.drugClass).filter(c => c !== undefined))) {
		const { x, y, rotation } = getClassLabelPlacement(drugElements, drugClass!, classRadius)
		const t = chart.append('text').attr('font-size', CLASS_FONT_SIZE).attr('font-weight', 'bold').text(drugClass!)
		const w = t.node().getComputedTextLength()
		t.remove()
		textBoxes.push(getRotatedBox(x, y, rotation, -w / 2, w / 2, CLASS_FONT_SIZE))
	}

	// legends are right of the chart, with their bottom at the bottom of the pie, as close to the chart as the
	// labels at their height allow
	const legends = svg.append('g')
	renderAocLegend(legends, lengthScale, data.aocMax, step)
	renderIc50Legend(legends.append('g').attr('transform', `translate(0,${BAR_LENGTH + 58})`), colorScale, gradientId, [
		ic50Min,
		ic50Max
	])

	const titleH = TITLE_HEIGHT
	const legendsBox = legends.node().getBBox()
	const legendW = legendsBox.width * LEGEND_SCALE,
		legendH = legendsBox.height * LEGEND_SCALE
	// in chart coordinates (center at 0,0): the legend band, and the rightmost corner of anything in it
	const bandBottom = pieRadius,
		bandTop = Math.max(-extent, pieRadius - legendH)
	let legendLeft = 0
	for (const box of textBoxes) {
		const ys = box.map(c => c[1])
		if (Math.min(...ys) > bandBottom || Math.max(...ys) < bandTop) continue
		legendLeft = Math.max(legendLeft, ...box.map(c => c[0]))
	}
	legendLeft += LEGEND_GAP
	const cx = extent,
		cy = titleH + extent
	const width = Math.max(2 * extent, cx + legendLeft + legendW)
	const height = titleH + 2 * extent
	chart.attr('transform', `translate(${cx},${cy})`)
	legends.attr(
		'transform',
		`translate(${cx + legendLeft - legendsBox.x * LEGEND_SCALE},${
			cy + bandTop - legendsBox.y * LEGEND_SCALE
		}) scale(${LEGEND_SCALE})`
	)
	title.attr('x', extent).attr('y', TITLE_BASELINE)
	svg.attr('width', width).attr('height', height)
	return {
		/** shows this drug as normal and fades the others, or with no drug shows all as normal */
		highlightDrug: (name?: string) => {
			const index = name === undefined ? -1 : data.drugs.findIndex(d => d.name == name)
			highlight(index == -1 ? undefined : { index })
		}
	}
}

/** the smallest overlay color index not used by the selected drugs */
export function getFreeColorIndex(selected: { colorIndex: number }[]): number {
	const used = new Set(selected.map(d => d.colorIndex))
	let i = 0
	while (used.has(i)) i++
	return i
}

/** the elements of a drug in the radial chart, to fade on hover */
type DrugElements = {
	drugClass?: string
	/** d3-shape angle of the bar center */
	angle: number
	bar?: any
	label: any
}

/** index of the drug whose bar sector contains a d3-shape angle (0 at 12 o'clock, clockwise), with the first
of the n drugs at 3 o'clock and the next ones anticlockwise, as in renderRadialChart */
export function getDrugIndexAtAngle(angle: number, n: number): number {
	const step = (2 * Math.PI) / n
	const i = Math.round((Math.PI / 2 - angle) / step)
	return ((i % n) + n) % n
}

/** what the pointer is on: a drug of the pie (its index and class), the hole at the pie center, or outside the pie */
type HoveredDrug = { drugClass?: string; index: number } | 'area' | undefined

/** outside the pie (undefined) all drugs are shown as normal; in the pie all are faded, except the drugs of the
class of the hovered drug, whose class name is shown outside the ring, centered on its drugs. a drug without a
class is shown as normal alone, without a class name */
function highlightDrugClass(drugElements: DrugElements[], hovered: HoveredDrug, classLabel: any, classRadius: number) {
	const drug = typeof hovered == 'object' ? hovered : undefined
	const isNormal = (e, i: number) =>
		hovered === undefined || (drug ? (drug.drugClass ? e.drugClass == drug.drugClass : i == drug.index) : false)
	for (const [i, e] of drugElements.entries()) {
		const opacity = isNormal(e, i) ? null : FADED_OPACITY
		e.bar?.attr('opacity', opacity)
		e.label.attr('opacity', opacity)
	}
	const drugClass = drug?.drugClass
	if (!drugClass) {
		classLabel.style('display', 'none')
		return
	}
	const { x, y, rotation } = getClassLabelPlacement(drugElements, drugClass, classRadius)
	classLabel.attr('transform', `translate(${x},${y}) rotate(${rotation})`).text(drugClass).style('display', null)
}

/** center and rotation of a class label: at the circular mean of the class's drug angles (d3-shape angles, 0 at
12 o'clock, clockwise), along the ring and turned to stay upright */
function getClassLabelPlacement(drugElements: DrugElements[], drugClass: string, classRadius: number) {
	const members = drugElements.filter(e => e.drugClass == drugClass)
	const angle = Math.atan2(
		members.reduce((sum, e) => sum + Math.sin(e.angle), 0),
		members.reduce((sum, e) => sum + Math.cos(e.angle), 0)
	)
	let rotation = (angle * 180) / Math.PI
	if (Math.cos(angle) < -1e-6) rotation += 180
	return { x: classRadius * Math.sin(angle), y: -classRadius * Math.cos(angle), rotation }
}

/** corners of a text box placed by translate(x,y) rotate(rotation): from x0 to x1 along the text, height h centered
on its baseline (dominant-baseline central) */
function getRotatedBox(x: number, y: number, rotation: number, x0: number, x1: number, h: number): number[][] {
	const a = (rotation * Math.PI) / 180
	const cos = Math.cos(a),
		sin = Math.sin(a)
	return [
		[x0, -h / 2],
		[x1, -h / 2],
		[x1, h / 2],
		[x0, h / 2]
	].map(([u, v]) => [x + u * cos - v * sin, y + u * sin + v * cos])
}

/** a wedge as wide as a bar at each length, with the AOC ticks on its right */
function renderAocLegend(g: any, lengthScale: any, aocMax: number, step: number) {
	// y grows downward, so the wedge is drawn with its base (AOC 0) at the bottom
	const halfWidth = (len: number) => ((INNER_RADIUS + len) * step) / 2
	const top = halfWidth(BAR_LENGTH),
		bottom = halfWidth(0)
	const cx = top
	g.append('text').attr('x', cx).attr('y', -13).attr('text-anchor', 'middle').attr('font-size', 16).text('AOC')
	g.append('path')
		.attr('d', `M${cx - bottom},${BAR_LENGTH} L${cx - top},0 L${cx + top},0 L${cx + bottom},${BAR_LENGTH} Z`)
		.attr('fill', 'none')
		.attr('stroke', '#aaa')
	const ticks = AOC_TICKS.filter(v => v <= aocMax)
	for (const v of ticks) {
		const len = lengthScale(v)
		const y = BAR_LENGTH - len
		const w = halfWidth(len)
		g.append('line')
			.attr('x1', cx - w)
			.attr('x2', cx + w + 10)
			.attr('y1', y)
			.attr('y2', y)
			.attr('stroke', '#aaa')
		g.append('text')
			.attr('x', cx + top + 16)
			.attr('y', y)
			.attr('dominant-baseline', 'central')
			.attr('font-size', 13)
			.text(v)
	}
}

/** a vertical color bar of IC50 (nM), resistant at the top */
function renderIc50Legend(g: any, colorScale: any, gradientId: string, [lo, hi]: [number, number]) {
	const barW = 16,
		barH = 156
	g.append('text')
		.attr('x', barW / 2)
		.attr('y', -13)
		.attr('font-size', 16)
		.text('IC50 (nM)')
	const gradient = g
		.append('defs')
		.append('linearGradient')
		.attr('id', gradientId)
		.attr('x1', 0)
		.attr('x2', 0)
		.attr('y1', 1)
		.attr('y2', 0)
	for (const offset of [0, 0.5, 1]) {
		gradient
			.append('stop')
			.attr('offset', offset)
			.attr('stop-color', colorScale(lo + offset * (hi - lo)))
	}
	g.append('rect').attr('width', barW).attr('height', barH).attr('fill', `url(#${gradientId})`)
	const y = scaleLinear().domain([lo, hi]).range([barH, 0])
	for (const k of getLog10Ticks(lo, hi)) {
		g.append('line')
			.attr('x1', barW)
			.attr('x2', barW + 6)
			.attr('y1', y(k))
			.attr('y2', y(k))
			.attr('stroke', '#555')
		g.append('text')
			.attr('x', barW + 10)
			.attr('y', y(k))
			.attr('dominant-baseline', 'central')
			.attr('font-size', 13)
			.text(formatPower10(k))
	}
}

/** integer log10 values within [lo, hi], every other one when there are more than 6 */
export function getLog10Ticks(lo: number, hi: number): number[] {
	const all: number[] = []
	for (let k = Math.ceil(lo); k <= Math.floor(hi); k++) all.push(k)
	if (all.length <= 6) return all
	// keep the even exponents so that 1 (10^0) is always a tick
	return all.filter(k => k % 2 == 0)
}

/** 10^k as a number label: 1e-4, 0.01, 1, 100, 10000 */
export function formatPower10(k: number): string {
	return k < -2 ? `1e${k}` : String(10 ** k)
}

/** white text on a dark fill, black on a light one */
function getTextColor(fill: string): string {
	const { r, g, b } = rgb(fill)
	return 0.299 * r + 0.587 * g + 0.114 * b < 150 ? 'white' : 'black'
}

export async function getPlotConfig(opts) {
	const config: any = {
		chartType: 'chemicalSensitivity',
		/** name of the sample whose chart is shown, set by the chart button menu */
		sample: undefined,
		/** drugs whose dose responses are shown, set by clicking (one drug) and shift-clicking (more drugs) bars */
		drugs: []
	}
	copyMerge(config, opts)
	return config
}

export const chemicalSensitivityInit = getCompInit(ChemicalSensitivity)
// this alias will allow abstracted dynamic imports
export const componentInit = chemicalSensitivityInit

import { scaleLinear } from 'd3-scale'
import { format } from 'd3-format'
import { line, area } from 'd3-shape'
import { axisBottom, axisLeft } from 'd3-axis'
import { axisstyle } from '#dom'
import { getColorScheme } from '#shared/common.js'
import type { ChemicalSensitivityDoseResponse, ChemicalSensitivityCurve } from '#types'

/*
the dose-response panel of a sample and drug, shown beside the radial chart when a bar is clicked: the molecule
image, then the dose-response chart of the replicates and their average. the x axis is the concentration (nM, log
scale), the y axis the relative survival; dots are the measured points and lines the fitted curves. the shaded
area between survival 1 and the average curve over the tested range is the AOC. the legend lists the IC50 and
AOC of each curve, and hovering a dot shows its values. with several drugs, renderDoseResponseOverlay() overlays
their average curves instead
*/

const PLOT_W = 300
const PLOT_H = 220
const MARGIN = { top: 10, right: 15, bottom: 45, left: 55 }
const FONT_SIZE = 12
const DOT_RADIUS = 4
/** px of the invisible hover target of a dot, larger than the dot */
const DOT_HIT_RADIUS = 9
const AVERAGE_COLOR = '#333'
const AOC_FILL = '#c9b458'
const IMAGE_SIZE = 180
/** a concentration (nM), AOC or relative survival, with up to 3 significant digits and no exponent */
const formatValue = format('.3~r')
/** the panel title is drawn like the radial chart title, so that both are on one line */
export const TITLE_HEIGHT = 44
export const TITLE_BASELINE = 26
export const TITLE_FONT_SIZE = 21

/** renders the panel into holder; tip is the hover menu */
export function renderDoseResponse(
	holder: any,
	arg: {
		sampleName: string
		drug: string
		doseResponse?: ChemicalSensitivityDoseResponse
		moleculeImage?: string
		tip: any
	}
) {
	renderTitle(holder, `${arg.drug} in ${arg.sampleName}`)
	if (arg.moleculeImage) {
		// an <img> of the svg, rather than the svg inserted in the page, so that the svg cannot run scripts
		holder
			.append('img')
			.attr('data-testid', 'sjpp-chemicalsensitivity-molecule')
			.attr('alt', `molecule structure of ${arg.drug}`)
			.attr('src', `data:image/svg+xml;charset=utf-8,${encodeURIComponent(arg.moleculeImage)}`)
			.style('display', 'block')
			.style('width', `${IMAGE_SIZE}px`)
			.style('height', `${IMAGE_SIZE}px`)
	}
	if (!arg.doseResponse) {
		holder.append('div').style('padding', '10px 0').style('opacity', 0.7).text('No dose-response data')
		return
	}
	renderDoseResponseChart(holder, arg.doseResponse, arg.tip)
}

function renderDoseResponseChart(holder: any, dr: ChemicalSensitivityDoseResponse, tip: any) {
	const curveColors = getCurveColors(dr.curves)
	const [concLo, concHi] = dr.concRange
	const { x, y } = getScales([dr], dr.curves)
	const g = appendPlot(holder, 'sjpp-chemicalsensitivity-doseresponse')

	// AOC: between survival 1 and the average curve, over the tested range
	const aocCurve = getAverageCurve(dr)
	const aocPoints = aocCurve.fit.conc
		.map((c, i) => [c, aocCurve.fit.act[i]])
		.filter(([c]) => c >= concLo && c <= concHi)
	g.append('path')
		.datum(aocPoints)
		.attr(
			'd',
			area<number[]>()
				.x(d => x(d[0]))
				.y0(y(1))
				.y1(d => y(Math.min(1, d[1])))
		)
		.attr('fill', AOC_FILL)
		.attr('fill-opacity', 0.35)
	// survival 1, the top of the AOC
	g.append('line')
		.attr('x1', x(concLo))
		.attr('x2', x(concHi))
		.attr('y1', y(1))
		.attr('y2', y(1))
		.attr('stroke', AOC_FILL)

	drawAxes(g, x, y)

	const fitLine = line<number[]>()
		.x(d => x(d[0]))
		.y(d => y(d[1]))
	for (const c of dr.curves) {
		const color = curveColors.get(c.name)!
		g.append('path')
			.datum(c.fit.conc.map((v, i) => [v, c.fit.act[i]]))
			.attr('d', fitLine)
			.attr('fill', 'none')
			.attr('stroke', color)
			.attr('stroke-width', 2)
			.attr('stroke-dasharray', c.raw ? null : '5,3')
	}
	// dots above all lines, so that every dot can be hovered. the dots of one concentration overlap (replicates
	// and repeated measures), so hovering a dot shows all the measured values at its concentration
	const conc2values = getMeasuredValues(dr.curves)
	for (const c of dr.curves) {
		if (!c.raw) continue
		const color = curveColors.get(c.name)!
		for (const [i, conc] of c.raw.conc.entries()) {
			const dot = g.append('g').attr('transform', `translate(${x(conc)},${y(c.raw.act[i])})`)
			dot.append('circle').attr('r', DOT_RADIUS).attr('fill', color).attr('stroke', 'white').attr('stroke-width', 1)
			dot
				.append('circle')
				.attr('r', DOT_HIT_RADIUS)
				.attr('fill', 'transparent')
				.on('mouseover', (event: MouseEvent) => {
					tip.clear()
					const d = tip.d.append('div').style('font-size', '0.9em')
					d.append('div')
						.style('font-weight', 'bold')
						.text(`Concentration: ${formatValue(10 ** conc)} nM`)
					d.append('div').text('Relative survival')
					for (const [name, acts] of conc2values.get(conc)!) {
						const row = d.append('div').style('padding-left', '8px')
						row.append('span').style('color', curveColors.get(name)!).text('\u25CF ')
						row.append('span').text(`${name}: ${acts.map(formatValue).join(', ')}`)
					}
					tip.show(event.clientX, event.clientY)
				})
				.on('mouseout', () => tip.hide())
		}
	}

	renderCurveLegend(holder, dr.curves, curveColors)
}

/** the panel title, as an svg text with the font and baseline of the radial chart title */
function renderTitle(holder: any, text: string) {
	holder
		.append('svg')
		.attr('data-testid', 'sjpp-chemicalsensitivity-paneltitle')
		.attr('width', MARGIN.left + PLOT_W + MARGIN.right)
		.attr('height', TITLE_HEIGHT)
		.style('display', 'block')
		.style('overflow', 'visible')
		.append('text')
		.attr('y', TITLE_BASELINE)
		.attr('font-size', TITLE_FONT_SIZE)
		.attr('font-weight', 'bold')
		.text(text)
}

/** the scales of the dose-response chart of these curves, with x covering the tested ranges */
function getScales(doseResponses: ChemicalSensitivityDoseResponse[], curves: ChemicalSensitivityCurve[]) {
	const allConc = [
		...doseResponses.flatMap(dr => dr.concRange),
		...curves.flatMap(c => [...c.fit.conc, ...(c.raw?.conc || [])])
	]
	const allAct = curves.flatMap(c => [...c.fit.act, ...(c.raw?.act || [])])
	const lo = Math.min(...allConc),
		hi = Math.max(...allConc)
	const xPad = Math.max(0.05, (hi - lo) * 0.04)
	const x = scaleLinear()
		.domain([lo - xPad, hi + xPad])
		.range([0, PLOT_W])
	const y = scaleLinear()
		.domain([Math.min(0, ...allAct), Math.max(1.2, ...allAct)])
		.range([PLOT_H, 0])
		.nice()
	return { x, y }
}

/** the svg of a dose-response chart; returns the plot area */
function appendPlot(holder: any, testid: string) {
	return holder
		.append('svg')
		.attr('data-testid', testid)
		.attr('width', MARGIN.left + PLOT_W + MARGIN.right)
		.attr('height', MARGIN.top + PLOT_H + MARGIN.bottom)
		.append('g')
		.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
}

/** concentration axis (nM, log scale) and relative survival axis, with their titles */
function drawAxes(g: any, x: any, y: any) {
	const xAxis = g
		.append('g')
		.attr('transform', `translate(0,${PLOT_H})`)
		.call(
			axisBottom(x)
				.tickValues(getLogTicks(x.domain()[0], x.domain()[1]))
				.tickFormat((v: any) => formatValue(10 ** v))
		)
	const yAxis = g.append('g').call(axisLeft(y).ticks(6))
	axisstyle({ axis: xAxis, color: '#555', fontsize: FONT_SIZE, showline: true })
	axisstyle({ axis: yAxis, color: '#555', fontsize: FONT_SIZE, showline: true })
	g.append('text')
		.attr('x', PLOT_W / 2)
		.attr('y', PLOT_H + 38)
		.attr('text-anchor', 'middle')
		.attr('font-size', FONT_SIZE + 1)
		.text('Concentration (nM)')
	g.append('text')
		.attr('transform', `translate(-42,${PLOT_H / 2}) rotate(-90)`)
		.attr('text-anchor', 'middle')
		.attr('font-size', FONT_SIZE + 1)
		.text('Relative survival')
}

/** the average curve of a drug (the curve without raw points), else its last curve */
function getAverageCurve(dr: ChemicalSensitivityDoseResponse): ChemicalSensitivityCurve {
	return dr.curves.find(c => !c.raw) || dr.curves[dr.curves.length - 1]
}

/** overlay colors of the selected drugs, from the shared categorical color scheme for that many colors (as in the
scatter plot, getColorScheme(): its palette changes with the count, a rainbow beyond 20). a drug's color is at its
color index, which stays when other drugs are removed, so the scheme covers the largest index too */
export function getOverlayColors(selected: { name: string; colorIndex: number }[]): Map<string, string> {
	const count = Math.max(selected.length, ...selected.map(d => d.colorIndex + 1))
	const scheme: readonly string[] = getColorScheme(count)
	return new Map(selected.map(d => [d.name, scheme[d.colorIndex % scheme.length]]))
}

/** the overlay of the average dose-response curves of several drugs in a sample, each over its tested range, with a
legend row per drug: its color, name, class, IC50 and AOC, and a button to remove it. hovering a curve or a row
emphasizes the drug and calls onHover with it, then with undefined */
export function renderDoseResponseOverlay(
	holder: any,
	arg: {
		sampleName: string
		drugs: {
			name: string
			color: string
			drugClass?: string
			doseResponse?: ChemicalSensitivityDoseResponse
		}[]
		onRemove: (drug: string) => void
		onHover: (drug?: string) => void
	}
) {
	renderTitle(holder, `${arg.drugs.length} drugs in ${arg.sampleName}`)
	const withData = arg.drugs.filter(d => d.doseResponse)
	const curves = withData.map(d => getAverageCurve(d.doseResponse!))
	const paths = new Map<string, any>()
	const rows = new Map<string, any>()
	const emphasize = (name?: string) => {
		for (const [n, p] of paths) {
			p.attr('opacity', name === undefined || n == name ? null : 0.2).attr('stroke-width', n == name ? 3.5 : 2)
		}
		for (const [n, r] of rows) r.style('background-color', n == name ? '#eee' : null)
		arg.onHover(name)
	}
	// no chart when none of the drugs has dose-response data; the legend says so
	if (curves.length) {
		const g = appendPlot(holder, 'sjpp-chemicalsensitivity-overlay')
		const { x, y } = getScales(
			withData.map(d => d.doseResponse!),
			curves
		)
		drawAxes(g, x, y)
		const fitLine = line<number[]>()
			.x(d => x(d[0]))
			.y(d => y(d[1]))
		for (const [i, d] of withData.entries()) {
			const points = curves[i].fit.conc.map((v, j) => [v, curves[i].fit.act[j]])
			paths.set(
				d.name,
				g
					.append('path')
					.attr('data-testid', 'sjpp-chemicalsensitivity-overlay-curve')
					.datum(points)
					.attr('d', fitLine)
					.attr('fill', 'none')
					.attr('stroke', d.color)
					.attr('stroke-width', 2)
			)
			// a wider invisible line above, as the hover target
			g.append('path')
				.datum(points)
				.attr('d', fitLine)
				.attr('fill', 'none')
				.attr('stroke', 'transparent')
				.attr('stroke-width', 10)
				.on('mouseover', () => emphasize(d.name))
				.on('mouseout', () => emphasize(undefined))
		}
	}

	const table = holder
		.append('table')
		.attr('data-testid', 'sjpp-chemicalsensitivity-overlaylegend')
		.style('margin-left', `${MARGIN.left}px`)
		.style('font-size', `${FONT_SIZE + 1}px`)
		.style('border-collapse', 'collapse')
	for (const d of arg.drugs) {
		const tr = table
			.append('tr')
			.on('mouseover', () => emphasize(d.name))
			.on('mouseout', () => emphasize(undefined))
		rows.set(d.name, tr)
		const td = (text = '') => tr.append('td').style('padding', '3px 6px').text(text)
		renderSwatch(td(), d.color, { width: 3 })
		td(d.name)
		td(d.drugClass || '').style('opacity', 0.6)
		if (d.doseResponse) {
			const avg = getAverageCurve(d.doseResponse)
			td(`IC50 ${formatValue(avg.ic50)} nM`)
			td(`AOC ${formatValue(avg.aoc)}`)
		} else {
			td('No dose-response data').attr('colspan', 2).style('opacity', 0.6)
		}
		td()
			.append('button')
			.attr('aria-label', `Remove ${d.name}`)
			.attr('title', `Remove ${d.name}`)
			.style('border', 'none')
			.style('background', 'none')
			.style('cursor', 'pointer')
			.style('font-size', '1em')
			.text('\u2715')
			.on('click', () => {
				arg.onHover(undefined)
				arg.onRemove(d.name)
			})
	}
}

/** one row per curve: its swatch, name, IC50 and AOC */
function renderCurveLegend(holder: any, curves: ChemicalSensitivityCurve[], curveColors: Map<string, string>) {
	const table = holder
		.append('table')
		.attr('data-testid', 'sjpp-chemicalsensitivity-curvelegend')
		.style('margin-left', `${MARGIN.left}px`)
		.style('font-size', `${FONT_SIZE + 1}px`)
		.style('border-spacing', '10px 3px')
	for (const c of curves) {
		const tr = table.append('tr')
		// a replicate has its measured dots and a solid line, the average a dashed line
		renderSwatch(tr.append('td'), curveColors.get(c.name)!, { width: 2, dashed: !c.raw, dot: !!c.raw })
		tr.append('td').text(c.name)
		tr.append('td').text(`IC50 ${formatValue(c.ic50)} nM`)
		tr.append('td').text(`AOC ${formatValue(c.aoc)}`)
	}
}

/** a legend swatch of a curve: a short line, optionally dashed, optionally with a dot */
function renderSwatch(holder: any, color: string, opts: { width: number; dashed?: boolean; dot?: boolean }) {
	const svg = holder.append('svg').attr('width', 24).attr('height', 12).style('vertical-align', 'middle')
	svg
		.append('line')
		.attr('x1', 0)
		.attr('x2', 24)
		.attr('y1', 6)
		.attr('y2', 6)
		.attr('stroke', color)
		.attr('stroke-width', opts.width)
		.attr('stroke-dasharray', opts.dashed ? '5,3' : null)
	if (opts.dot) svg.append('circle').attr('cx', 12).attr('cy', 6).attr('r', DOT_RADIUS).attr('fill', color)
}

/** measured values by concentration, then by curve name in the curves order */
export function getMeasuredValues(curves: ChemicalSensitivityCurve[]): Map<number, Map<string, number[]>> {
	const conc2values = new Map<number, Map<string, number[]>>()
	for (const c of curves) {
		if (!c.raw) continue
		for (const [i, conc] of c.raw.conc.entries()) {
			if (!conc2values.has(conc)) conc2values.set(conc, new Map())
			const name2acts = conc2values.get(conc)!
			if (!name2acts.has(c.name)) name2acts.set(c.name, [])
			name2acts.get(c.name)!.push(c.raw.act[i])
		}
	}
	return conc2values
}

/** the replicates in the shared categorical color scheme for their count (as the overlaid drugs), in order; the
average (a curve without raw points) in dark gray */
export function getCurveColors(curves: ChemicalSensitivityCurve[]): Map<string, string> {
	const scheme: readonly string[] = getColorScheme(curves.filter(c => c.raw).length)
	const colors = new Map<string, string>()
	let i = 0
	for (const c of curves) colors.set(c.name, c.raw ? scheme[i++ % scheme.length] : AVERAGE_COLOR)
	return colors
}

/** log10 tick values in [lo, hi]: every power of 10, also 2x and 5x when that gives fewer than 3 ticks */
export function getLogTicks(lo: number, hi: number): number[] {
	const ticks: number[] = []
	for (const steps of [[1], [1, 2, 5]]) {
		ticks.length = 0
		for (let k = Math.floor(lo); k <= Math.ceil(hi); k++) {
			for (const s of steps) {
				const v = k + Math.log10(s)
				if (v >= lo && v <= hi) ticks.push(v)
			}
		}
		if (ticks.length >= 3) break
	}
	return ticks
}

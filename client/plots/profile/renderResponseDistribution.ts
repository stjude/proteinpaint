import { scaleBand, scaleLinear } from 'd3-scale'
import { axisBottom, axisLeft, axisRight } from 'd3-axis'
import { line } from 'd3-shape'
import { axisstyle } from '../../dom/axisstyle.js'
import type { ImpressionZone } from './renderImpressionThermometer.js'

/*
Response-distribution combo chart, one per POC responder group. x = impression rating
1..maxScore. Site-Coordinator response frequency is a line in the module color on the LEFT
y-axis (site counts); POC-staff response frequency is grey columns on the RIGHT y-axis (staff
counts). Three performance zones (Weak/Intermediate/Strong) are drawn as background bands.
The two y-axes are independent because POC counts far exceed SC counts (see the reference mock-up).
*/

const POC_COLUMN_FILL = '#bdbdbd'
// Single neutral color for all axis text (ticks + titles), so labels read consistently.
const AXIS_COLOR = '#333'
const POC_COLUMN_STROKE = '#616161'
const SC_POINT_R = 5

type RatingBin = { rating: number; count: number; pct: number }

export type ResponseDistributionTexts = {
	leftAxisLabel: string
	rightAxisLabel: string
	xAxisLabel: string
}

export type ResponseDistributionArgs = {
	// d3 selection of the div that will hold this chart's own <svg> (inside profilePlot.dom.rightDiv).
	holder: any
	id: any
	maxScore: number
	// Shared SC frequency distribution (site counts per rating) — the line series.
	scDistribution: RatingBin[]
	// This responder group's POC distribution (staff counts per rating) — the column series.
	pocDistribution: RatingBin[]
	texts: ResponseDistributionTexts
	// Drives the background bands only — the zones are named in the shared legend, not in here.
	zones: ImpressionZone[]
	// Module color for the SC line/points (same source as the thermometer's SC color).
	colors: { sc: string }
	// Binds tooltip text (+ optional hover descriptor) as the element's datum; read by the
	// shared profilePlot mousemove→onMouseOver delegation. Passed in by profileForms.
	attachTip: (sel: any, text: string, hover?: any) => void
}

const MARGIN = { top: 24, right: 64, bottom: 52, left: 64 }
const PLOT_W = 300
const PLOT_H = 260

export function renderResponseDistribution(a: ResponseDistributionArgs) {
	const maxScore = a.maxScore
	const scColor = a.colors?.sc || '#888'
	const ratings: number[] = []
	for (let r = 1; r <= maxScore; r++) ratings.push(r)

	const scByRating: Record<number, RatingBin> = {}
	for (const d of a.scDistribution || []) scByRating[d.rating] = d
	const pocByRating: Record<number, RatingBin> = {}
	for (const d of a.pocDistribution || []) pocByRating[d.rating] = d

	const scTotal = (a.scDistribution || []).reduce((s, d) => s + (d.count || 0), 0)
	const maxScCount = Math.max(1, ...ratings.map(r => scByRating[r]?.count || 0))
	const maxPocCount = Math.max(1, ...ratings.map(r => pocByRating[r]?.count || 0))

	const svgW = MARGIN.left + PLOT_W + MARGIN.right
	const svgH = MARGIN.top + PLOT_H + MARGIN.bottom // the legend is the card's, not this chart's
	const svg = a.holder.append('svg').attr('width', svgW).attr('height', svgH)
	const plot = svg.append('g').attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)

	// ~15% headroom above the tallest value on each axis so the line/columns don't touch the top edge.
	const HEADROOM = 1.15
	const x = scaleBand().domain(ratings.map(String)).range([0, PLOT_W]).padding(0.2)
	const yLeft = scaleLinear()
		.domain([0, maxScCount * HEADROOM])
		.range([PLOT_H, 0])
		.nice()
	const yRight = scaleLinear()
		.domain([0, maxPocCount * HEADROOM])
		.range([PLOT_H, 0])
		.nice()

	// Zone background bands. Each rating occupies a step-wide cell (band + padding); a zone spans
	// from the left edge of its first cell to the right edge of its last, so adjacent zones meet at
	// the midpoint between ratings — no white gap — and together fill the full plot width.
	const bw = x.bandwidth()
	const step = x.step()
	for (const z of a.zones) {
		const cMin = x(String(z.min))
		const cMax = x(String(z.max))
		if (cMin == null || cMax == null) continue
		const zStart = Math.max(0, cMin + bw / 2 - step / 2)
		const zEnd = Math.min(PLOT_W, cMax + bw / 2 + step / 2)
		plot
			.append('rect')
			.attr('class', 'impression-zone')
			.attr('x', zStart)
			.attr('y', 0)
			.attr('width', zEnd - zStart)
			.attr('height', PLOT_H)
			.attr('fill', z.color)
			.attr('opacity', 0.3)
	}

	// POC grey columns on the RIGHT axis
	for (const r of ratings) {
		const bin = pocByRating[r]
		const count = bin?.count || 0
		const bx = x(String(r))
		if (bx == null) continue
		const col = plot
			.append('rect')
			.attr('class', 'poc-column')
			.attr('x', bx)
			.attr('y', yRight(count))
			.attr('width', x.bandwidth())
			.attr('height', PLOT_H - yRight(count))
			.attr('fill', POC_COLUMN_FILL)
			.attr('stroke', POC_COLUMN_STROKE)
			.attr('stroke-width', 0.5)
		a.attachTip(col, `POC rating ${r}: ${count} response${count === 1 ? '' : 's'}`, {
			on: { fill: '#8d8d8d' },
			off: { fill: POC_COLUMN_FILL }
		})
	}

	// SC series on the LEFT axis. Multi-site → a line through every rating's site count;
	// single site (scTotal=1) → a single round point (user discretion for one SC response).
	const cx = (r: number) => (x(String(r)) ?? 0) + x.bandwidth() / 2
	if (scTotal === 1) {
		for (const r of ratings) {
			const count = scByRating[r]?.count || 0
			if (count <= 0) continue
			const pt = plot
				.append('circle')
				.attr('class', 'sc-point')
				.attr('cx', cx(r))
				.attr('cy', yLeft(count))
				.attr('r', SC_POINT_R)
				.attr('fill', scColor)
			a.attachTip(pt, `SC rating ${r}: ${count} response`, {
				on: { stroke: '#222', 'stroke-width': '1.5' },
				off: { stroke: 'none' }
			})
		}
	} else {
		const lineGen = line<number>()
			.x(r => cx(r))
			.y(r => yLeft(scByRating[r]?.count || 0))
		plot
			.append('path')
			.attr('class', 'sc-line')
			.attr('d', lineGen(ratings))
			.attr('fill', 'none')
			.attr('stroke', scColor)
			.attr('stroke-width', 2)
		for (const r of ratings) {
			const count = scByRating[r]?.count || 0
			const pt = plot
				.append('circle')
				.attr('class', 'sc-point')
				.attr('cx', cx(r))
				.attr('cy', yLeft(count))
				.attr('r', 3)
				.attr('fill', scColor)
			a.attachTip(pt, `SC rating ${r}: ${count} response${count === 1 ? '' : 's'}`, {
				on: { stroke: '#222', 'stroke-width': '1.5' },
				off: { stroke: 'none' }
			})
		}
	}

	// Axes — all axis text uses one neutral color; series identity is carried by the line/columns
	// and the legend, not by the axis colors.
	const xAxis = plot.append('g').attr('transform', `translate(0, ${PLOT_H})`).call(axisBottom(x))
	axisstyle({ axis: xAxis, showline: true, color: AXIS_COLOR })
	const leftAxis = plot.append('g').call(axisLeft(yLeft).ticks(5))
	axisstyle({ axis: leftAxis, showline: true, color: AXIS_COLOR })
	const rightAxis = plot.append('g').attr('transform', `translate(${PLOT_W}, 0)`).call(axisRight(yRight).ticks(5))
	axisstyle({ axis: rightAxis, showline: true, color: AXIS_COLOR })

	// Axis titles (same neutral color as the ticks)
	plot
		.append('text')
		.attr('transform', `translate(${PLOT_W / 2}, ${PLOT_H + 40})`)
		.attr('text-anchor', 'middle')
		.attr('font-size', '0.85rem')
		.attr('font-weight', 'bold')
		.attr('fill', AXIS_COLOR)
		.text(a.texts.xAxisLabel)
	plot
		.append('text')
		.attr('transform', `translate(${-MARGIN.left + 14}, ${PLOT_H / 2}) rotate(-90)`)
		.attr('text-anchor', 'middle')
		.attr('font-size', '0.82rem')
		.attr('font-weight', 'bold')
		.attr('fill', AXIS_COLOR)
		.text(a.texts.leftAxisLabel)
	plot
		.append('text')
		.attr('transform', `translate(${PLOT_W + MARGIN.right - 14}, ${PLOT_H / 2}) rotate(90)`)
		.attr('text-anchor', 'middle')
		.attr('font-size', '0.82rem')
		.attr('font-weight', 'bold')
		.attr('fill', AXIS_COLOR)
		.text(a.texts.rightAxisLabel)

	/*
	No legend and no zone labels here: both are drawn once per card by profileForms, under this
	chart and the thermometer together. Rendering them per chart put the same swatches and the same
	three zone names on screen twice, side by side.
	*/
}

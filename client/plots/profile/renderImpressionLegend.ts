import type { Div } from '../../types/d3'
import type { ImpressionZone } from './renderImpressionThermometer.js'

/*
The one legend for an impression card, drawn under the thermometer and the response-distribution
chart together. Both charts used to carry their own legend and both labelled the performance zones,
so every card showed the same swatches twice and the same three zone names twice, side by side at
two sizes and two greys. This is now the single place the series and the zones are named.

Swatches mirror the marks in the response-distribution chart — a line with a vertex dot for the SC
series, a square for the POC columns — so the legend reads directly against the line graph. The
thermometer's fills are the same two colors, so the same entries serve it.
*/

const SWATCH_SIZE = 14 // square swatches: the POC series and the zone bands
const LINE_W = 22 // the SC line swatch
const DOT_R = 4 // the vertex marker on the SC line swatch
const LABEL_GAP = 6
const ITEM_GAP = 20
const ROW_H = 22
const FONT_SIZE = '0.8rem'

/*
Zone swatches carry the same 0.3 opacity the bands are painted at in both charts, so the swatch is
the color the viewer actually sees rather than the saturated source color.
*/
const ZONE_OPACITY = 0.3

/*
Each series is swatched as the mark that carries it in the response-distribution chart: SC is a
line through every rating, so a line with a vertex dot; POC is a column per rating, so a square.
*/
export type ImpressionSeriesSymbol = 'line' | 'square'

export type ImpressionLegendArgs = {
	// d3 selection of the div that will hold this legend's own <svg>.
	holder: Div
	// Series entries in draw order: SC always, POC only when the module has responder groups.
	series: { color: string; label: string; symbol: ImpressionSeriesSymbol }[]
	zones: ImpressionZone[]
}

const textWidth = (sel: any) => (sel.node() as SVGTextElement).getBBox().width

export function renderImpressionLegend(a: ImpressionLegendArgs) {
	const holder = a.holder.style('display', 'flex').style('justify-content', 'center').style('padding-top', '8px')
	const svg = holder.append('svg')
	const g = svg.append('g')
	const cy = ROW_H / 2
	let x = 0

	for (const s of a.series) {
		const item = g.append('g').attr('class', 'impression-legend-item')
		const swatchW = s.symbol === 'line' ? LINE_W : SWATCH_SIZE
		if (s.symbol === 'line') {
			item
				.append('line')
				.attr('x1', x)
				.attr('y1', cy)
				.attr('x2', x + LINE_W)
				.attr('y2', cy)
				.attr('stroke', s.color)
				.attr('stroke-width', 2)
			item
				.append('circle')
				.attr('cx', x + LINE_W / 2)
				.attr('cy', cy)
				.attr('r', DOT_R)
				.attr('fill', s.color)
		} else {
			item
				.append('rect')
				.attr('x', x)
				.attr('y', cy - SWATCH_SIZE / 2)
				.attr('width', SWATCH_SIZE)
				.attr('height', SWATCH_SIZE)
				.attr('fill', s.color)
				.attr('stroke', '#666')
				.attr('stroke-width', 0.5)
		}
		const label = item
			.append('text')
			.attr('x', x + swatchW + LABEL_GAP)
			.attr('y', cy)
			.attr('dominant-baseline', 'central')
			.attr('font-size', FONT_SIZE)
			.text(s.label)
		x += swatchW + LABEL_GAP + textWidth(label) + ITEM_GAP
	}

	// Sort a copy — the caller's zones array is shared with both chart renderers.
	for (const z of [...a.zones].sort((z1, z2) => z1.min - z2.min)) {
		const item = g.append('g').attr('class', 'impression-legend-zone')
		item
			.append('rect')
			.attr('x', x)
			.attr('y', cy - SWATCH_SIZE / 2)
			.attr('width', SWATCH_SIZE)
			.attr('height', SWATCH_SIZE)
			.attr('fill', z.color)
			.attr('opacity', ZONE_OPACITY)
			.attr('stroke', '#ccc')
			.attr('stroke-width', 0.5)
		const label = item
			.append('text')
			.attr('x', x + SWATCH_SIZE + LABEL_GAP)
			.attr('y', cy)
			.attr('dominant-baseline', 'central')
			.attr('font-size', FONT_SIZE)
			.text(z.label)
		x += SWATCH_SIZE + LABEL_GAP + textWidth(label) + ITEM_GAP
	}

	// Size the svg to what was actually drawn; the flex holder centers it under the two charts.
	const bb = (g.node() as SVGGElement).getBBox()
	svg.attr('width', Math.ceil(bb.width)).attr('height', Math.ceil(Math.max(ROW_H, bb.height)))
}

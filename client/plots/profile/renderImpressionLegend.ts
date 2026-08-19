import type { Div } from '../../types/d3'
import type { ImpressionZone } from './renderImpressionThermometer.js'

/*
One legend per chart in an impression card: the thermometer and the response-distribution chart each
draw their own, so each names its series with the mark that carries it there. The distribution chart
uses a line with a vertex dot for the SC series and a square for the POC columns; the thermometer
uses a circle for each fill. Both legends also name the three performance zones (shared swatches).
*/

const SWATCH_SIZE = 14 // square swatches: the POC series and the zone bands
const LINE_W = 22 // the SC line swatch
const DOT_R = 4 // the vertex marker on the SC line swatch
const LABEL_GAP = 6
const ITEM_GAP = 20
const ROW_H = 22
const PAD_X = 2 // horizontal inset so the outermost swatch strokes stay inside the svg
const FONT_SIZE = '0.8rem'

/*
Zone swatches carry the same 0.3 opacity the bands are painted at in both charts, so the swatch is
the color the viewer actually sees rather than the saturated source color.
*/
const ZONE_OPACITY = 0.3

/*
Each series is swatched as the mark that carries it in its chart: in the distribution chart SC is a
line through every rating (a line with a vertex dot) and POC is a column per rating (a square); in
the thermometer both are fills (a circle each).
*/
export type ImpressionSeriesSymbol = 'line' | 'square' | 'circle'

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
	const svg = holder.append('svg').attr('data-testid', 'sjpp-profileForms-impression-legend')
	const g = svg.append('g')

	// Row 1 — series swatches (SC / POC). Laid out from x=0, then the whole row is centered below.
	const seriesG = g.append('g')
	const seriesCy = ROW_H / 2
	let sx = 0
	for (const s of a.series) {
		const item = seriesG.append('g').attr('class', 'impression-legend-item')
		const swatchW = s.symbol === 'line' ? LINE_W : SWATCH_SIZE
		if (s.symbol === 'line') {
			item
				.append('line')
				.attr('x1', sx)
				.attr('y1', seriesCy)
				.attr('x2', sx + LINE_W)
				.attr('y2', seriesCy)
				.attr('stroke', s.color)
				.attr('stroke-width', 2)
			item
				.append('circle')
				.attr('cx', sx + LINE_W / 2)
				.attr('cy', seriesCy)
				.attr('r', DOT_R)
				.attr('fill', s.color)
		} else if (s.symbol === 'circle') {
			item
				.append('circle')
				.attr('cx', sx + SWATCH_SIZE / 2)
				.attr('cy', seriesCy)
				.attr('r', SWATCH_SIZE / 2)
				.attr('fill', s.color)
				.attr('stroke', '#666')
				.attr('stroke-width', 0.5)
		} else {
			item
				.append('rect')
				.attr('x', sx)
				.attr('y', seriesCy - SWATCH_SIZE / 2)
				.attr('width', SWATCH_SIZE)
				.attr('height', SWATCH_SIZE)
				.attr('fill', s.color)
				.attr('stroke', '#666')
				.attr('stroke-width', 0.5)
		}
		const label = item
			.append('text')
			.attr('x', sx + swatchW + LABEL_GAP)
			.attr('y', seriesCy)
			.attr('dominant-baseline', 'central')
			.attr('font-size', FONT_SIZE)
			.text(s.label)
		sx += swatchW + LABEL_GAP + textWidth(label) + ITEM_GAP
	}
	const seriesW = Math.max(0, sx - ITEM_GAP)

	// Row 2 — zone swatches (Weak / Intermediate / Strong), sorted low to high on a copy since the
	// caller's zones array is shared with both chart renderers.
	const zonesG = g.append('g')
	const zonesCy = ROW_H + ROW_H / 2
	let zx = 0
	for (const z of [...a.zones].sort((z1, z2) => z1.min - z2.min)) {
		const item = zonesG.append('g').attr('class', 'impression-legend-zone')
		item
			.append('rect')
			.attr('x', zx)
			.attr('y', zonesCy - SWATCH_SIZE / 2)
			.attr('width', SWATCH_SIZE)
			.attr('height', SWATCH_SIZE)
			.attr('fill', z.color)
			.attr('opacity', ZONE_OPACITY)
			.attr('stroke', '#ccc')
			.attr('stroke-width', 0.5)
		const label = item
			.append('text')
			.attr('x', zx + SWATCH_SIZE + LABEL_GAP)
			.attr('y', zonesCy)
			.attr('dominant-baseline', 'central')
			.attr('font-size', FONT_SIZE)
			.text(z.label)
		zx += SWATCH_SIZE + LABEL_GAP + textWidth(label) + ITEM_GAP
	}
	const zonesW = Math.max(0, zx - ITEM_GAP)

	/*
	Center each row within the wider of the two, and size the svg to two rows. Rows are inset by
	PAD_X because swatch strokes are centered on the path: the leftmost circle/rect of the wider
	row sits at x=0 and its stroke would otherwise render half outside the viewport.
	*/
	const totalW = Math.max(seriesW, zonesW)
	seriesG.attr('transform', `translate(${PAD_X + (totalW - seriesW) / 2}, 0)`)
	zonesG.attr('transform', `translate(${PAD_X + (totalW - zonesW) / 2}, 0)`)
	svg.attr('width', Math.ceil(totalW) + 2 * PAD_X).attr('height', 2 * ROW_H)
}

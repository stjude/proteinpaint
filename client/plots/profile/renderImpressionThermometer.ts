import { scaleLinear } from 'd3-scale'
import { axisLeft } from 'd3-axis'
import { hsl } from 'd3-color'
import { axisstyle } from '../../dom/axisstyle.js'
import type { BaseType, Selection } from 'd3-selection'
import type { Div } from '../../types/d3'

export const IMPRESSION_MAX_SCORE = 10

// Fallback if a term has no color in jsondata (shouldn't happen for impression terms in
// the live db, but keeps the renderer from emitting `fill="undefined"` if it ever does).
const FALLBACK_COLOR = '#888'

// POC grey — the right (Point-of-Care) half of the vessel. Exported so the shared card legend
// swatches the same grey the fill uses.
export const POC_FILL = '#9e9e9e'

/*
Hover cue for a liquid column: the fill eases to a lighter shade and back, so the column reads as
responding rather than having a border drawn around it. The easing is declared as a CSS transition
on the element itself, so the shared profilePlot delegation — which only sets the attribute —
animates for free, with no extra work in onMouseOver/onMouseOut.

The shift moves away from mid-lightness, keeping the cue visible on a dark module color and a
light one alike.
*/
const HOVER_MS = 140

function hoverFill(fill: string): ImpressionHover {
	const c = hsl(fill)
	c.l = c.l > 0.6 ? c.l - 0.14 : c.l + 0.14
	return { on: { fill: c.formatHex() }, off: { fill } }
}

/*
Three impression performance zones (Weak/Intermediate/Strong) labelled along the rating axis.
Bins are config-driven from the dataset (impression.zones) so the boundaries live in one place,
shared with the response-distribution chart.
*/
export type ImpressionZone = { label: string; min: number; max: number; color: string }

// One responder group's median/total (POC side of a single thermometer). null for SC-only modules.
export type ImpressionPoc = { median: number | null; total: number } | null

/*
Attribute maps the shared profilePlot delegation applies on mouseover and restores on mouseout;
profileForms.onMouseOver/onMouseOut read these off the element's __data__.
*/
export type ImpressionHover = { on: Record<string, string>; off: Record<string, string> }

/*
Binds tooltip text (+ optional hover descriptor) as the element's datum. Supplied by profileForms.
Generic over the element type because d3's Selection is invariant in it — a plain
Selection<Element, ...> parameter would reject the Selection<SVGPathElement, ...> the fills produce.
*/
export type AttachTip = <T extends BaseType>(
	sel: Selection<T, any, any, any>,
	text: string,
	hover?: ImpressionHover
) => void

export type ImpressionThermometerArgs = {
	// d3 selection of the div that will hold this thermometer's own <svg>. Lives inside
	// profilePlot.dom.rightDiv, which owns the mousemove/mouseout tooltip delegation.
	holder: Div
	// Unique per rendered thermometer (one per responder group); prefixes this svg's defs ids.
	id: string
	// Shared SC median across eligible sites + the site count (n) — the left (module-color) fill.
	sc: { median: number | null; total: number }
	// This group's POC median/total, or null for SC-only modules — the right (grey) fill.
	poc: ImpressionPoc
	// Title for the single 1..maxScore rating axis (left).
	ratingAxisLabel: string
	// Drives the background bands only — the zones are named in the shared legend, not in here.
	zones: ImpressionZone[]
	// Per-module color for the SC (left) half of the vessel (terms.jsondata.color in the DB).
	colors: { sc: string }
	attachTip: AttachTip
}

/*
Geometry for a single thermometer svg. Only the left rating axis and its rotated title sit outside
the vessel now — the zone labels that used to occupy the right margin, and the legend rows that sat
below the bulb, both moved to the shared card legend — so the svg is sized to the vessel plus the
axis gutter. Note CENTER_X derives from SVG_W: changing the width moves every x in the file.
*/
const SVG_W = 140
const TUBE_W = 46
const TUBE_H = 300
const TUBE_TOP = 24 // small top margin above the tube (labels/header live in the card, not the svg)
const TUBE_BOTTOM = TUBE_TOP + TUBE_H
const CENTER_X = SVG_W / 2
const TUBE_HALF = TUBE_W / 2
// Median fills read as thick vertical bars inside the tube (one per half), not full half-fills.
const BAR_W = 12

/*
The bulb out-measures the tube so it reads as the anchored reservoir rather than a wide spot in
the column, and a fillet arc welds the two into one silhouette (see vesselPath). The fillet needs
BULB_R > TUBE_HALF: at or below that the tangent solve has no real root, NECK_DY goes NaN, and
every derived coordinate — including the whole vessel path — becomes NaN, which renders as an
empty svg with nothing thrown. The guard below keeps that failure loud.
*/
const BULB_R = 39
/*
Kept small so the glass hugs the bulb circle. The liquid's reservoir IS that circle, so a wide
fillet would flare the glass out past the liquid and leave a crescent of empty tube at each
shoulder; at NECK_R = 6 the widest such gap is under 5px.
*/
const NECK_R = 6
if (!(BULB_R > TUBE_HALF))
	throw new Error('impression thermometer geometry: BULB_R must exceed TUBE_W/2 for a tangential neck')
// The bar's outer wall has to actually meet the circle, or BAR_JOIN_Y goes NaN the same way.
if (!(BULB_R > BAR_W))
	throw new Error('impression thermometer geometry: BULB_R must exceed BAR_W for the bar to meet the bulb')

/*
Vertical drop from the fillet centre to the bulb centre. Placing the bulb this far below
TUBE_BOTTOM puts the start of the flare exactly at rating 0, so the entire 1..maxScore scale sits
on the straight, parallel-sided part of the tube and no tick ever lands on a curve.
*/
const NECK_DY = Math.sqrt((BULB_R + NECK_R) ** 2 - (TUBE_HALF + NECK_R) ** 2)
const BULB_CY = TUBE_BOTTOM + NECK_DY
const BULB_BOTTOM = BULB_CY + BULB_R
const SVG_H = Math.ceil(BULB_BOTTOM) + 12 // just breathing room under the bulb; the legend is the card's

const TUBE_X = CENTER_X - TUBE_HALF
const CAP_Y = TUBE_TOP + TUBE_HALF

// rating (1..maxScore) → y on the tube
const yScale = scaleLinear().domain([0, IMPRESSION_MAX_SCORE]).range([TUBE_BOTTOM, TUBE_TOP])
const yOf = (rating: number) => yScale(rating)

const round = (n: number) => Math.round(n * 1000) / 1000

/*
Vertical extent of one performance zone's background band, for zones sorted ascending by rating.
A band spans its own ratings — yOf(z.max) down to yOf(z.min - 1) — so adjacent bands meet exactly
at the tick between them. The lowest band continues past rating 0 through the bulb, putting the
low end of the scale at the reservoir; the highest is held to the top of the vessel.

The bands and their labels both derive their position from here, so the two cannot drift apart.
*/
function zoneExtent(z: ImpressionZone, i: number, count: number): { top: number; bottom: number } {
	return {
		top: i === count - 1 ? TUBE_TOP : yOf(z.max),
		bottom: i === 0 ? BULB_BOTTOM : yOf(z.min - 1)
	}
}

/*
The vessel as one closed path: rounded top cap, straight sides, a fillet arc on each side that is
externally tangent to both the tube wall and the bulb, then the long way around the bulb. The
fillet centre sits at distance NECK_R from the wall and BULB_R + NECK_R from the bulb centre, which
puts both joins at G1 continuity — the tube flows into the bulb with no seam to paint over.
*/
function vesselPath(): string {
	const xL = TUBE_X
	const xR = TUBE_X + TUBE_W
	const neckY = TUBE_BOTTOM // = BULB_CY - NECK_DY, the fillet centres' y
	// Tangent points on the bulb, along the line from the bulb centre to each fillet centre.
	const tx = (BULB_R * (TUBE_HALF + NECK_R)) / (BULB_R + NECK_R)
	const ty = BULB_CY - (BULB_R * NECK_DY) / (BULB_R + NECK_R)
	return (
		`M ${xL} ${CAP_Y}` +
		` A ${TUBE_HALF} ${TUBE_HALF} 0 0 1 ${xR} ${CAP_Y}` +
		` L ${xR} ${neckY}` +
		` A ${NECK_R} ${NECK_R} 0 0 0 ${round(CENTER_X + tx)} ${round(ty)}` +
		` A ${BULB_R} ${BULB_R} 0 1 1 ${round(CENTER_X - tx)} ${round(ty)}` +
		` A ${NECK_R} ${NECK_R} 0 0 0 ${xL} ${neckY}` +
		` Z`
	)
}

// Rounded-top, flat-bottom bar: the median column has a domed top but runs flush into the bulb at
// the bottom (no rounded cap), so the column + reservoir read as one continuous liquid.
function barPath(x: number, yTop: number, w: number, yBottom: number): string {
	const r = w / 2
	return `M ${x} ${yBottom} L ${x} ${yTop + r} A ${r} ${r} 0 0 1 ${x + w} ${yTop + r} L ${x + w} ${yBottom} Z`
}

/*
Where the bar's outer wall meets the bulb circle — the bar rises out of the circle from here, so
no shoulder, no taper and no extra shape is needed to join them.
*/
const BAR_JOIN_Y = BULB_CY - Math.sqrt(BULB_R ** 2 - BAR_W ** 2)

/*
One series' entire body of liquid as a single closed path: half the bulb circle, with the bar
rising straight out of it. Traced as dome → down the bar's outer wall to where it meets the
circle → around that half of the circle to the bottom centre → back up the centre divider.

Tracing it in that order keeps the outline a simple closed shape: the bar's centre edge and the
half-disc's flat edge are collinear, so they are one straight segment rather than two overlapping
pieces that would pinch the path where they meet.
*/
function liquidPath(yTop: number, half: 'left' | 'right'): string {
	const r = BAR_W / 2
	const dir = half === 'left' ? -1 : 1
	const colOuter = CENTER_X + dir * BAR_W
	const domeY = yTop + r
	// The dome sweeps over the top from the centre divider out to the bar's outer wall, and the
	// bulb arc runs from that wall around to the bottom of the circle — mirrored per side.
	const domeSweep = half === 'left' ? 0 : 1
	const bulbSweep = half === 'left' ? 0 : 1
	return (
		`M ${CENTER_X} ${round(domeY)}` +
		` A ${r} ${r} 0 0 ${domeSweep} ${colOuter} ${round(domeY)}` +
		` L ${colOuter} ${round(BAR_JOIN_Y)}` +
		` A ${BULB_R} ${BULB_R} 0 0 ${bulbSweep} ${CENTER_X} ${round(BULB_BOTTOM)}` +
		` L ${CENTER_X} ${round(domeY)}` +
		` Z`
	)
}

export function renderImpressionThermometer(a: ImpressionThermometerArgs) {
	const maxScore = IMPRESSION_MAX_SCORE
	const scColor = a.colors?.sc || FALLBACK_COLOR
	const scMedian: number | null = a.sc?.median ?? null
	const scTotal: number = a.sc?.total || 0
	const pocMedian: number | null = a.poc?.median ?? null
	const pocTotal: number = a.poc?.total || 0

	const svg = a.holder.append('svg').attr('width', SVG_W).attr('height', SVG_H)
	const root = svg.append('g')
	const defs = root.append('defs')
	const vessel = vesselPath()

	// Sort a copy — the caller's zones array is shared with the distribution chart.
	const sortedZones = [...a.zones].sort((z1, z2) => z1.min - z2.min)

	/*
	Depth cues are layered white/black gradients clipped to the vessel rather than SVG filters:
	filters degrade in the svg→png download path, and no first-party proteinpaint client code uses
	them. Clipping a plain horizontal gradient to the vessel is what makes it an inner shadow — it
	darkens the edges of the actual silhouette and follows the neck curve for free.
	*/
	const sheenId = `${a.id}-liquid-sheen`
	const sheen = defs
		.append('linearGradient')
		.attr('id', sheenId)
		.attr('x1', '0')
		.attr('y1', '0')
		.attr('x2', '0')
		.attr('y2', '1')
	sheen.append('stop').attr('offset', '0%').attr('stop-color', '#fff').attr('stop-opacity', 0.04)
	sheen.append('stop').attr('offset', '45%').attr('stop-color', '#fff').attr('stop-opacity', 0.07)
	sheen.append('stop').attr('offset', '100%').attr('stop-color', '#000').attr('stop-opacity', 0.1)

	const barGlossId = `${a.id}-bar-gloss`
	const barGloss = defs
		.append('linearGradient')
		.attr('id', barGlossId)
		.attr('x1', '0')
		.attr('y1', '0')
		.attr('x2', '1')
		.attr('y2', '0')
	/*
	Kept to a narrow highlight band rather than a broad wash: the column is only BAR_W wide, so a
	wide white ramp desaturates the fill instead of reading as curvature. Most of the column stays
	the undiluted series color, with the shading concentrated at the left highlight and right edge.
	*/
	barGloss.append('stop').attr('offset', '0%').attr('stop-color', '#fff').attr('stop-opacity', 0.04)
	barGloss.append('stop').attr('offset', '20%').attr('stop-color', '#fff').attr('stop-opacity', 0.2)
	barGloss.append('stop').attr('offset', '38%').attr('stop-color', '#fff').attr('stop-opacity', 0.03)
	barGloss.append('stop').attr('offset', '100%').attr('stop-color', '#000').attr('stop-opacity', 0.18)

	const innerShadeId = `${a.id}-inner-shade`
	const innerShade = defs
		.append('linearGradient')
		.attr('id', innerShadeId)
		.attr('gradientUnits', 'userSpaceOnUse')
		.attr('x1', CENTER_X - BULB_R)
		.attr('y1', 0)
		.attr('x2', CENTER_X + BULB_R)
		.attr('y2', 0)
	innerShade.append('stop').attr('offset', '0%').attr('stop-color', '#000').attr('stop-opacity', 0.22)
	innerShade.append('stop').attr('offset', '16%').attr('stop-color', '#000').attr('stop-opacity', 0)
	innerShade.append('stop').attr('offset', '84%').attr('stop-color', '#000').attr('stop-opacity', 0)
	innerShade.append('stop').attr('offset', '100%').attr('stop-color', '#000').attr('stop-opacity', 0.26)

	const bulbShadeId = `${a.id}-bulb-shade`
	const shade = defs
		.append('radialGradient')
		.attr('id', bulbShadeId)
		.attr('cx', '50%')
		.attr('cy', '50%')
		.attr('r', '50%')
	shade.append('stop').attr('offset', '55%').attr('stop-color', '#000').attr('stop-opacity', 0)
	shade.append('stop').attr('offset', '100%').attr('stop-color', '#000').attr('stop-opacity', 0.3)
	const bulbGlossId = `${a.id}-bulb-gloss`
	const gloss = defs
		.append('radialGradient')
		.attr('id', bulbGlossId)
		.attr('cx', '36%')
		.attr('cy', '30%')
		.attr('r', '45%')
	gloss.append('stop').attr('offset', '0%').attr('stop-color', '#fff').attr('stop-opacity', 0.6)
	gloss.append('stop').attr('offset', '70%').attr('stop-color', '#fff').attr('stop-opacity', 0.06)
	gloss.append('stop').attr('offset', '100%').attr('stop-color', '#fff').attr('stop-opacity', 0)

	/*
	One clip for everything drawn inside the glass. The vessel path already bounds the neck flare
	and the bulb, so a liquid's reservoir subpath can be a plain half-width rectangle and still
	resolve to exactly half the reservoir's curved shape — no second clip, and no seam at the neck.
	*/
	const vesselClipId = `${a.id}-vessel-clip`
	defs.append('clipPath').attr('id', vesselClipId).append('path').attr('d', vessel)

	const inVessel = () => root.append('g').attr('clip-path', `url(#${vesselClipId})`)
	// Bounding box of the vessel — the fill area for the full-height gradient overlays.
	const boxX = CENTER_X - BULB_R
	const boxW = 2 * BULB_R
	const boxY = TUBE_TOP
	const boxH = BULB_BOTTOM - TUBE_TOP

	/*
	1) Distribution track: one band per performance zone, filling tube and bulb (the empty state).
	Same colors, same 0.3 opacity and same discrete-band form the sibling response-distribution
	chart uses, so the pair reads as one system. Bands are discrete rather than a blended gradient
	because a module's zone shades are three tints of one hue — smoothing the boundaries away
	leaves a single flat wash with no readable zones. Extents come from zoneExtent().
	*/
	const trackG = inVessel()
	sortedZones.forEach((z, i) => {
		const { top, bottom } = zoneExtent(z, i, sortedZones.length)
		trackG
			.append('rect')
			.attr('class', 'impression-zone')
			.attr('x', boxX)
			.attr('y', top)
			.attr('width', boxW)
			.attr('height', bottom - top)
			.attr('fill', z.color)
			.attr('opacity', 0.3)
	})

	/*
	2) The liquid: one element per series covering its column and its half of the reservoir, so the
	whole body is a single hover target. The reservoir half is always drawn — the bulb reads full
	regardless of the median — and the column rises out of it to the median.
	*/
	const liquidG = inVessel()
	const scX = CENTER_X - BAR_W
	const pocX = CENTER_X
	if (scMedian != null) {
		const scFill = liquidG
			.append('path')
			.attr('class', 'sc-fill')
			.attr('d', liquidPath(yOf(scMedian), 'left'))
			.attr('fill', scColor)
			.style('transition', `fill ${HOVER_MS}ms ease-out`)
		a.attachTip(
			scFill,
			`Site Coordinator median: ${scMedian} (n=${scTotal} ${scTotal === 1 ? 'SC' : 'SCs'})`,
			hoverFill(scColor)
		)
	}
	if (pocMedian != null) {
		const pocFill = liquidG
			.append('path')
			.attr('class', 'poc-fill')
			.attr('d', liquidPath(yOf(pocMedian), 'right'))
			.attr('fill', POC_FILL)
			.style('transition', `fill ${HOVER_MS}ms ease-out`)
		a.attachTip(pocFill, `POC median: ${pocMedian} (n=${pocTotal} staff responses)`, hoverFill(POC_FILL))
	}

	// Every layer from here down is decorative, so the two fills stay the only hover targets and
	// the shared profilePlot mousemove delegation keeps reading their __data__.
	const overlay = () => inVessel().attr('pointer-events', 'none')

	/*
	4) Wetness: a vertical sheen over the horizontal cylindrical gloss, along the straight part of
	each bar only — it stops where the bar meets the bulb circle. A cylinder highlight belongs on a
	cylinder; carried into the bulb it traces the bar's edges across the reservoir, betraying two
	cylinders where the eye should read one body of liquid. Below the join the spherical shading in
	layer 5 is the only shading the reservoir gets.
	*/
	const wet = overlay()
	const columns: { x: number; median: number }[] = []
	if (scMedian != null) columns.push({ x: scX, median: scMedian })
	if (pocMedian != null) columns.push({ x: pocX, median: pocMedian })
	for (const c of columns) {
		const d = barPath(c.x, yOf(c.median), BAR_W, BAR_JOIN_Y)
		wet.append('path').attr('class', 'liquid-gloss').attr('d', d).attr('fill', `url(#${sheenId})`)
		wet.append('path').attr('class', 'liquid-gloss').attr('d', d).attr('fill', `url(#${barGlossId})`)
	}

	// 5) Spherical shading over the reservoir, clipped so the flare crops it cleanly.
	const bulbShading = overlay()
	bulbShading
		.append('circle')
		.attr('cx', CENTER_X)
		.attr('cy', BULB_CY)
		.attr('r', BULB_R)
		.attr('fill', `url(#${bulbShadeId})`)
	bulbShading
		.append('circle')
		.attr('cx', CENTER_X)
		.attr('cy', BULB_CY)
		.attr('r', BULB_R)
		.attr('fill', `url(#${bulbGlossId})`)

	// 6) Inner shadow along the silhouette's edges — the curvature cue for the glass wall.
	overlay()
		.append('rect')
		.attr('x', boxX)
		.attr('y', boxY)
		.attr('width', boxW)
		.attr('height', boxH)
		.attr('fill', `url(#${innerShadeId})`)

	// 7) Glass outline: one stroke around the whole vessel, drawn last so it caps every overlay.
	root
		.append('path')
		.attr('class', 'vessel-outline')
		.attr('d', vessel)
		.attr('fill', 'none')
		.attr('stroke', '#444')
		.attr('stroke-width', 2)
		.attr('pointer-events', 'none')

	// LEFT axis: 1..maxScore rating numbers with inward ticks + rotated title. The vessel outline
	// serves as the axis line, so the domain path is suppressed.
	const ratings: number[] = []
	for (let r = 1; r <= maxScore; r++) ratings.push(r)
	const axis = root
		.append('g')
		.attr('transform', `translate(${TUBE_X}, 0)`)
		// Negative tick size points the ticks inward, into the tube; tickPadding restores the label gap.
		.call(
			axisLeft(yScale)
				.tickValues(ratings)
				.tickFormat(d => String(d))
				.tickSize(-5)
				.tickPadding(8)
		)
	axisstyle({ axis, showline: false, color: '#333' })
	root
		.append('text')
		.attr('transform', `translate(${TUBE_X - 32}, ${TUBE_TOP + TUBE_H / 2}) rotate(-90)`)
		.attr('text-anchor', 'middle')
		.attr('font-size', '0.9rem')
		.attr('font-weight', 'bold')
		.text(a.ratingAxisLabel)

	/*
	No zone labels and no legend here: the zones are named once per card, as swatches in the shared
	legend that profileForms draws under this chart and the response-distribution chart together.
	Labelling them in both charts put the same three words on screen twice, side by side, at two
	sizes and two greys.
	*/
}

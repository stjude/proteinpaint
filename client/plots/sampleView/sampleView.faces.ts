import { select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { Menu } from '#dom'
import type { SwimmerLane } from '#types'
import type { ToolContext } from './sampleView.tiles.ts'

/*********************************************************************
 * sampleView tile faces
 *
 * A face is a cover of the tool, not a readable plot: the full tool's own
 * drawing cropped to its main part and fit to the card (disco, swimmer),
 * the server's image (genome-wide quantification, brain imaging, whole
 * slide thumbnail), the dots of a scatter, or a static sketch (genome
 * browser track, single cell). Expanding the tile shows the full tool
 *********************************************************************/

// drawing width of a face: the card content width
const FACE_W = 230
const FACE_H = 172

/** fits svg to the card (`width` wide, centered), cropped to the box around `parts`, and turns off its mouse handling. svg has no
 * viewBox yet, so a pixel of the page is a unit of the svg; it must be displayed, to measure the parts */
function fitSvg(svg: any, parts: Element[], width = FACE_W) {
	const s = svg.node().getBoundingClientRect()
	let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
	for (const p of parts) {
		const r = p.getBoundingClientRect()
		if (!r.width && !r.height) continue
		x0 = Math.min(x0, r.left)
		y0 = Math.min(y0, r.top)
		x1 = Math.max(x1, r.right)
		y1 = Math.max(y1, r.bottom)
	}
	if (!(x1 > x0 && y1 > y0)) throw 'the plot was not displayed'
	svg
		.attr('viewBox', `${x0 - s.left} ${y0 - s.top} ${x1 - x0} ${y1 - y0}`)
		.attr('preserveAspectRatio', 'xMidYMid meet')
		.attr('width', width)
		.attr('height', FACE_H)
		.style('display', 'block')
		.style('margin', '6px auto 0')
		.style('pointer-events', 'none')
}

/************ disco ************/

/** the full disco plot cropped to its chromosome ring, without the gene labels and legend around it */
export async function renderDiscoFace(face: any, data: any, sample: any, ctx: ToolContext) {
	const { renderDisco } = await import('../plot.disco.js')
	// the full plot is laid out out of sight, to measure its ring
	const work = face.append('div').style('visibility', 'hidden')
	const app = await renderDisco(ctx.termdbConfig, ctx.vocab.dslabel, sample, data, work, ctx.genome)
	ctx.onDestroy(() => app?.destroy())
	const svg = work.select('[data-testid="sjpp_disco_plot"]')
	if (svg.empty()) throw 'no disco plot'
	// square: in a wider face the label lines would show beside the ring
	fitSvg(svg, [svg.select('[data-testid="sjpp_chromosomes_arc_group"]').node()], FACE_H)
	face.node().append(svg.node())
	work.remove()
}

/************ swimmer ************/

/** plot width of the swimmer drawn for a face, and the height of its lanes at that width to fill the card:
 * the face height scaled to that width, less the room for the axis and a highlighted event label */
const SWIMMER_FACE_PLOT_W = 400
const SWIMMER_FACE_LANES_H = (SWIMMER_FACE_PLOT_W * FACE_H) / FACE_W - 75

/** the full swimmer lanes and time axis, without sample names and the legend */
export async function renderSwimmerFace(
	face: any,
	data: { lanes: SwimmerLane[]; timeReference?: string },
	ctx: ToolContext,
	highlightSample: string
) {
	const { SwimmerRenderer, getDefaultSwimmerSettings } = await import('../swimmer.ts')
	const plotDiv = face.append('div')
	const renderer = new SwimmerRenderer(ctx.app, {
		plotDiv,
		// not shown
		noteDiv: select(document.createElement('div')),
		tip: new Menu({ padding: '5px' })
	})
	ctx.onDestroy(() => renderer.destroy())
	renderer.update({
		swimmer: ctx.termdbConfig.queries.swimmer,
		// a narrower plot with taller lanes than the full plot, so a patient's few lanes fill the card
		settings: {
			...getDefaultSwimmerSettings(),
			showSampleNames: false,
			plotWidth: SWIMMER_FACE_PLOT_W,
			rowHeight: Math.max(12, Math.min(30, SWIMMER_FACE_LANES_H / data.lanes.length))
		},
		lanes: data.lanes,
		timeReference: data.timeReference,
		highlightSample
	})
	const svg = plotDiv.select('svg')
	if (svg.empty()) throw 'no swimmer plot'
	// the legend is the last group of the svg, after the lanes of each panel
	const parts = svg.selectAll(':scope > g').nodes()
	parts.pop()
	fitSvg(svg, parts)
}

/************ genome-wide quantification (e.g. methylation array) ************/

/** the server-drawn genome-wide image cropped to its plot area (no axis margins) and stretched to the card */
export function renderSsgqFace(
	face: any,
	data: {
		src: string
		canvasWidth: number
		canvasHeight: number
		xoff: number
		yoff?: number
		plotHeight?: number
		chrLst: any[]
	}
) {
	const plotW = data.chrLst[data.chrLst.length - 1]?.xStop || data.canvasWidth - data.xoff
	const yoff = data.yoff ?? 0
	const plotH = data.plotHeight ?? data.canvasHeight
	const kx = FACE_W / plotW
	const ky = FACE_H / plotH
	face
		.append('div')
		.style('width', `${FACE_W}px`)
		.style('height', `${FACE_H}px`)
		.style('overflow', 'hidden')
		.style('margin-top', '6px')
		.append('img')
		.attr('src', data.src)
		.style('display', 'block')
		.style('max-width', 'none')
		.style('width', `${data.canvasWidth * kx}px`)
		.style('height', `${data.canvasHeight * ky}px`)
		.style('margin-left', `${-data.xoff * kx}px`)
		.style('margin-top', `${-yoff * ky}px`)
}

/************ brain imaging ************/

/** one axial slice of the sample on the template, fit to the card on black */
export function renderBrainImagingFace(face: any, data: { url: string; slice: number }) {
	face
		.append('div')
		.style('background', '#000')
		.style('border-radius', '4px')
		.style('margin-top', '6px')
		.style('height', '165px')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('justify-content', 'center')
		.append('img')
		.attr('src', data.url)
		.style('max-width', '100%')
		.style('max-height', '100%')
	face
		.append('div')
		.style('font-size', '.72em')
		.style('color', '#6b7280')
		.style('margin-top', '4px')
		.text(`Axial slice ${data.slice} · expand for all three views`)
}

/************ prebuilt scatter ************/

/** smallest zoomed region of a scatter face, as a fraction of the plot's range on each axis: a lone sample is
 * shown with its neighborhood */
const SCATTER_ZOOM_MIN = 0.1
/** room around the highlighted dots in the zoomed region, as a fraction of their range on each axis */
const SCATTER_ZOOM_PAD = 0.15
/** most a dot grows on a zoomed face */
const SCATTER_DOT_MAX_GROWTH = 3

/** the dots of a sampleScatter response in the plot's colors, zoomed into the region of the `highlight`
 * samples (all of them, e.g. a patient's samples), which are ringed as on the expanded scatter: thicker for
 * `emphasized`. Without any highlighted dot, the whole plot is shown */
export function renderScatterFace(face: any, result: any, highlight: string[] = [], emphasized?: string) {
	const charts: any[] = Object.values(result)
	const colorOf = new Map<any, string>()
	for (const chart of charts) for (const [key, item] of chart.colorLegend || []) colorOf.set(key, item.color)
	const dots: any[] = charts.flatMap(chart => chart.samples || [])
	const names = new Set(highlight)
	const marked = dots.filter(c => names.has(c.sample))
	const xFull = extent(dots.map(c => c.x)) || [0, 1]
	const yFull = extent(dots.map(c => c.y)) || [0, 1]
	const xView = zoomRange(xFull, extent(marked.map(c => c.x)))
	const yView = zoomRange(yFull, extent(marked.map(c => c.y)))
	// dots grow with the zoom, though less, so a dense cloud stays readable
	const zoom = Math.min(span(xFull) / span(xView), span(yFull) / span(yView)) || 1
	const growth = Math.min(SCATTER_DOT_MAX_GROWTH, Math.sqrt(zoom))
	const pad = 6
	const x = scaleLinear()
		.domain(xView)
		.range([pad, FACE_W - pad])
	const y = scaleLinear()
		.domain(yView)
		.range([FACE_H - pad, pad])
	const svg = face
		.append('svg')
		.attr('width', FACE_W)
		.attr('height', FACE_H)
		.style('display', 'block')
		.style('margin-top', '6px')
		.style('overflow', 'hidden')
	// dots out of the region are left out; the ones by its edges are cut by the svg
	const inView = (c: any) =>
		c.x >= xView[0] - span(xView) / 20 &&
		c.x <= xView[1] + span(xView) / 20 &&
		c.y >= yView[0] - span(yView) / 20 &&
		c.y <= yView[1] + span(yView) / 20
	const radius = (c: any) => (c.isRef ? 0.9 : 1.3) * growth
	svg
		.append('g')
		.selectAll('circle')
		.data(dots.filter(inView))
		.enter()
		.append('circle')
		.attr('cx', c => x(c.x))
		.attr('cy', c => y(c.y))
		.attr('r', radius)
		.attr('fill', c => colorOf.get(c.category) || '#9ca3af')
		.attr('opacity', 0.75)
	// rings above all the dots, the emphasized one last
	svg
		.append('g')
		.selectAll('circle')
		.data(marked.sort((a, b) => Number(a.sample == emphasized) - Number(b.sample == emphasized)))
		.enter()
		.append('circle')
		.attr('data-testid', 'sjpp-sampleview-scatter-highlight')
		.attr('cx', c => x(c.x))
		.attr('cy', c => y(c.y))
		.attr('r', c => radius(c) + 2.5)
		.attr('fill', 'none')
		.attr('stroke', 'black')
		.attr('stroke-width', c => (c.sample == emphasized ? 2 : 1.25))
}

/** [min, max] of values, or undefined for none */
function extent(values: number[]): [number, number] | undefined {
	const finite = values.filter(Number.isFinite)
	return finite.length ? [Math.min(...finite), Math.max(...finite)] : undefined
}

function span(r: [number, number]) {
	return r[1] - r[0]
}

/** the shown range of an axis: the padded range of the highlighted dots, at least SCATTER_ZOOM_MIN of the
 * full range, moved inside the full range; the full range without highlighted dots or when the region is
 * as large */
export function zoomRange(full: [number, number], marked: [number, number] | undefined): [number, number] {
	const fullSpan = span(full)
	if (!marked || !(fullSpan > 0)) return fullSpan > 0 ? full : [full[0] - 0.5, full[0] + 0.5]
	const size = Math.max(span(marked) * (1 + 2 * SCATTER_ZOOM_PAD), fullSpan * SCATTER_ZOOM_MIN)
	if (size >= fullSpan) return full
	const center = (marked[0] + marked[1]) / 2
	const start = Math.min(Math.max(center - size / 2, full[0]), full[1] - size)
	return [start, start + size]
}

/************ genome browser track ************/

const TRACK_SKETCH_H = 120
// most track names listed under the cover
const MAX_TRACK_NAMES = 3

/** a static cover: a sketch of a signal track over a gene, and the names of the tracks */
export function renderTrackFace(face: any, tracks: { name: string }[]) {
	const svg = face
		.append('svg')
		.attr('width', FACE_W)
		.attr('height', TRACK_SKETCH_H)
		.style('display', 'block')
		.style('margin-top', '6px')
	// signal bars of made-up heights
	const base = 70
	for (let x = 4; x < FACE_W - 4; x += 5) {
		const h = 6 + 50 * Math.abs(Math.sin(x * 0.13) * Math.cos(x * 0.031))
		svg
			.append('rect')
			.attr('x', x)
			.attr('y', base - h)
			.attr('width', 3)
			.attr('height', h)
			.attr('fill', '#9ca3af')
	}
	// a gene: an intron line with exon boxes
	const geneY = 96
	svg
		.append('line')
		.attr('x1', 20)
		.attr('x2', FACE_W - 20)
		.attr('y1', geneY)
		.attr('y2', geneY)
		.attr('stroke', '#1f3a93')
	for (const [x, w] of [
		[20, 14],
		[70, 10],
		[118, 18],
		[170, 8],
		[FACE_W - 34, 14]
	])
		svg
			.append('rect')
			.attr('x', x)
			.attr('y', geneY - 6)
			.attr('width', w)
			.attr('height', 12)
			.attr('fill', '#1f3a93')
	const div = face.append('div').style('font-size', '.72em').style('color', '#374151').style('margin-top', '4px')
	for (const t of tracks.slice(0, MAX_TRACK_NAMES))
		div
			.append('div')
			.style('white-space', 'nowrap')
			.style('overflow', 'hidden')
			.style('text-overflow', 'ellipsis')
			.attr('title', t.name)
			.text(t.name)
	if (tracks.length > MAX_TRACK_NAMES)
		div
			.append('div')
			.style('color', '#6b7280')
			.text(`+${tracks.length - MAX_TRACK_NAMES} more tracks`)
}

/************ single cell ************/

/** made-up cells of the single-cell cover, per lobe: [color, x, y, spread along, spread across, angle, cells].
 * A cluster is a few overlapping lobes, so its outline is irregular as on a UMAP; a long, thin lobe is a line
 * of cells between two clusters, as a differentiation path is */
const SC_LOBES: [string, number, number, number, number, number, number][] = [
	['#4e79a7', 62, 92, 16.5, 9.8, 0.5, 340],
	['#4e79a7', 88, 110, 10.5, 6.8, -0.3, 180],
	['#4e79a7', 45, 70, 6.8, 5.3, 1.1, 100],
	['#59a14f', 160, 38, 9.8, 6.8, 0.2, 160],
	['#59a14f', 174, 50, 6, 4.5, 0.9, 70],
	['#b07aa1', 58, 28, 7.5, 4.5, -0.6, 90],
	['#b07aa1', 70, 20, 4.5, 3, 0.4, 40],
	['#e15759', 188, 112, 8.3, 6, 1.2, 110],
	['#e15759', 200, 125, 4.5, 3.8, 0.1, 50],
	['#76b7b2', 128, 72, 5.3, 3.8, 0, 60],
	['#f28e2b', 94, 53, 15, 1.5, 0.58, 30]
]

/** the svg markup of the single-cell cover, made once */
let scSketch: string | undefined

/** a static cover, as the sample's maps are large to load for a face: made-up clusters of small, faint cells,
 * the same on every face (fixed seed). Each lobe is one path of zero-length round-capped segments, one per cell */
export function renderSingleCellFace(face: any) {
	if (!scSketch) {
		// a seeded generator (LCG) and normal deviates (Box-Muller)
		let seed = 7
		const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
		const normal = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand())
		scSketch = SC_LOBES.map(([color, x, y, sx, sy, a, n]) => {
			let d = ''
			for (let k = 0; k < n; k++) {
				const [u, v] = [normal() * sx, normal() * sy]
				d += `M${(x + u * Math.cos(a) - v * Math.sin(a)).toFixed(1)} ${(y + u * Math.sin(a) + v * Math.cos(a)).toFixed(
					1
				)}h0`
			}
			return `<path d="${d}" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>`
		}).join('')
	}
	face
		.append('svg')
		.attr('width', FACE_W)
		.attr('height', FACE_H - 20)
		.style('display', 'block')
		.style('margin-top', '6px')
		.html(scSketch)
}

/************ whole slide images ************/

/** the thumbnail of the first slide (the whole slide in one tile, as listed by termdb/wsiBySample), fit to the
 * card, and the number of slides */
export function renderWsiFace(face: any, images: { fileName: string; thumbnail: string }[]) {
	// the server origin of the thumbnail path, as the slide viewer prefixes its tile urls (w2/view/View.ts)
	let host = sessionStorage.getItem('hostURL') || (window as any).testHost || ''
	while (host.endsWith('/')) host = host.slice(0, -1)
	face
		.append('div')
		.style('background', '#f3f4f6')
		.style('border-radius', '4px')
		.style('margin-top', '6px')
		.style('height', '165px')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('justify-content', 'center')
		.append('img')
		.attr('data-testid', 'sjpp-sampleview-wsi-thumbnail')
		.attr('src', `${host}/${images[0].thumbnail}`)
		.style('max-width', '100%')
		.style('max-height', '100%')
}

/*
 Sequence-based spatial transcriptomics (Visium) viewer, method=sequence. The image-based
 viewer (wsi.direct.ts) is for a tiled slide with per-cell polygons; here the data is one
 high-resolution tissue png plus sequenced spots, so this is a separate, much smaller viewer.

 Direct URL (needs serverconfig.features.wsi.allowDirectSlidePath; paths are tpmasterdir-relative):
   ?method=sequence&image_file=Visium/LG_1/tissue_hires_image.png&spatial_data=Visium/LG_1/spatial.h5ad
   &cell_types=1            fill spots by their dominant cell type (needs obsm/cell_type_proportions);
                            a JSON array, e.g. &cell_types=["Epithelial","T"], shows only those types
   &gene_expression=A,B     fill spots by the summed counts of the listed genes
   &image_opacity=0.4       opacity of the tissue image, 0 (transparent) to 1 (opaque, default)

 Only in-tissue spots are drawn, as circles at their true spot diameter over the image.
 Hovering a spot shows its barcode, array position, cell-type proportions and gene counts.
*/
import 'ol/ol.css'
import OlMap from 'ol/Map.js'
import OlView from 'ol/View.js'
import ImageLayer from 'ol/layer/Image.js'
import ImageStatic from 'ol/source/ImageStatic.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import Feature from 'ol/Feature.js'
import Circle from 'ol/geom/Circle.js'
import { fromExtent } from 'ol/geom/Polygon.js'
import Projection from 'ol/proj/Projection.js'
import { Fill, Stroke, Style } from 'ol/style.js'
import { dofetch3 } from '#common/dofetch'
import { sayerror } from '#dom'
import { CELL_TYPE_COLORS } from './wsi.direct'

const EXPR_RGB = '255, 0, 0'
const SHADES = 8 // opacity buckets of the expression fill

/** the sequence-based spots of one sample, from visium/spots (x/y in hires-image px, y down) */
export type VisiumSpots = {
	ids: string[]
	x: number[]
	y: number[]
	arrayRow: number[]
	arrayCol: number[]
	radius: number
	width: number
	height: number
	proportions: { [type: string]: (number | null)[] }
}

/** Index of the largest proportion among `types` for spot i; -1 if the spot has none (no proportions / not in
 the CSV). Spots whose dominant type is outside `types` are the ones a type filter hides. */
export function dominantType(props: VisiumSpots['proportions'], i: number, types: string[]): number {
	let best = -1
	let max = 0
	for (const [k, t] of types.entries()) {
		const v = props[t]?.[i]
		if (v != null && v > max) {
			max = v
			best = k
		}
	}
	return best
}

/** a cell type counts as present in a spot from this proportion up (the tooltip pie uses the same cutoff) */
export const PRESENT = 0.01

/** How a spot is marked for the selected types `shown`: a circle when its dominant type (over ALL `types`) is
 selected, else a square when some selected type is present (>= PRESENT) though not dominant, else null.
 Squares only occur under a type filter: with every type shown, the dominant type is always selected.
 `type` is the selected type to color by: the dominant one, or the largest present one for a square. */
export function spotMark(
	props: VisiumSpots['proportions'],
	i: number,
	types: string[],
	shown: string[]
): { type: string; shape: 'circle' | 'square' } | null {
	const k = dominantType(props, i, types)
	if (k >= 0 && shown.includes(types[k])) return { type: types[k], shape: 'circle' }
	const j = dominantType(props, i, shown)
	if (j >= 0 && (props[shown[j]][i] as number) >= PRESENT) return { type: shown[j], shape: 'square' }
	return null
}

/** Fill color of a spot whose dominant type (color `rgb`, "r, g, b") has proportion p (0-1): the color is blended with
 white, so a 90% spot is a darker shade than a 30% one of the same type. Opaque, so the tissue image can't wash it out. */
export function shadeColor(rgb: string, p: number): string {
	const t = 0.15 + 0.85 * Math.min(1, Math.max(0, p)) // 0.15 = palest shade, still visible
	const c = rgb.split(',').map(v => Math.round(Number(v) * t + 255 * (1 - t)))
	return `rgba(${c.join(', ')}, 0.9)`
}

/** SVG path `d` of each pie slice (radius r, centered at r,r, clockwise from 12 o'clock); slices are
 normalized by their sum, so proportions that don't total exactly 1 still fill the circle. */
export function pieSlices(values: number[], r: number): string[] {
	const total = values.reduce((a, v) => a + v, 0)
	let a0 = 0
	return values.map(v => {
		const a1 = a0 + (v / total) * 2 * Math.PI
		const pt = (a: number) => `${r + r * Math.sin(a)} ${r - r * Math.cos(a)}`
		// an SVG arc can't draw a full circle in one piece: use two half arcs
		const d =
			v / total > 0.9999
				? `M ${r} 0 A ${r} ${r} 0 1 1 ${r} ${2 * r} A ${r} ${r} 0 1 1 ${r} 0 Z`
				: `M ${r} ${r} L ${pt(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)} Z`
		a0 = a1
		return d
	})
}

/** a usable image opacity: clamped to 0-1, and 1 (opaque) when missing or not a number */
export function clampOpacity(x: unknown): number {
	const n = Number(x)
	return x == null || x === '' || Number.isNaN(n) ? 1 : Math.min(1, Math.max(0, n))
}

export async function init(
	opts: {
		/** query string addressing the sample on the visium route: either dataset mode
         (wsimage=&dslabel=&genome=&sample_id=) or direct mode (image_file=&spatial_data=), URI-encoded */
		query: string
		/** fill spots by dominant cell type */
		showCellTypes?: boolean
		/** only these types (all when empty); colors are fixed over ALL types so a type keeps its color */
		cellTypeFilter?: string[]
		/** comma-separated genes, summed into one fill */
		geneExpression?: string
		/** genes load for the hover tooltip but no expression fill is drawn */
		hideExpressionFills?: boolean
		/** tissue image opacity, 0-1 (default 1) */
		imageOpacity?: number
		width?: string
		height?: string
	},
	holder: any
) {
	const loading = holder.append('div').style('margin', '20px').text('Loading spots …')
	try {
		const spots: VisiumSpots = await dofetch3(`visium/spots?${opts.query}`)
		if (!spots || (spots as any).error || (spots as any).status === 'error')
			throw (spots as any)?.error || 'failed to load spots'
		const { width: w, height: h } = spots
		let host = sessionStorage.getItem('hostURL') || (window as any).testHost || ''
		while (host.endsWith('/')) host = host.slice(0, -1)

		// image pixel space, y flipped: OpenLayers' y points up, the image's down
		const extent = [0, 0, w, h]
		const projection = new Projection({ code: 'visium-px', units: 'pixels', extent })
		const types = Object.keys(spots.proportions) // fixed order = fixed colors
		const typeRgb = Object.fromEntries(types.map((t, i) => [t, CELL_TYPE_COLORS[i % CELL_TYPE_COLORS.length]]))
		const shown = opts.cellTypeFilter?.length ? types.filter(t => opts.cellTypeFilter!.includes(t)) : types

		// summed counts over the listed genes, per spot id
		const genes = (opts.geneExpression || '')
			.split(',')
			.map(s => s.trim())
			.filter(Boolean)
		const counts = new Map<string, number>() // spot id -> summed count
		const perGene: { [gene: string]: { [id: string]: number } } = {} // for the tooltip
		for (const g of genes) {
			const r = await dofetch3(`visium/genecounts?${opts.query}&gene=${encodeURIComponent(g)}`)
			if (r?.error) {
				sayerror(holder, `${g}: ${r.error}`)
				continue
			}
			perGene[g] = r.cells
			for (const [id, n] of Object.entries(r.cells as { [id: string]: number }))
				counts.set(id, (counts.get(id) || 0) + n)
		}
		const maxCount = Math.max(0, ...counts.values())

		const byDominant = !!opts.showCellTypes && shown.length > 0
		const byExpression = !byDominant && !opts.hideExpressionFills && maxCount > 0 // fills never overlap
		const spotStroke = new Stroke({ color: 'rgba(255,255,255,0.7)', width: 0.5 })
		const marks = byDominant ? spots.ids.map((_, i) => spotMark(spots.proportions, i, types, shown)) : []
		const features = spots.ids.map((id, i) => {
			const cx = spots.x[i]
			const cy = h - spots.y[i]
			const mark = marks[i]
			// circle = dominant selected type; square (same center, side = spot diameter) = present but not dominant
			const geom =
				mark?.shape == 'square'
					? fromExtent([cx - spots.radius, cy - spots.radius, cx + spots.radius, cy + spots.radius])
					: new Circle([cx, cy], spots.radius)
			const f = new Feature(geom)
			f.set('i', i)
			let style = new Style({ stroke: spotStroke, fill: new Fill({ color: 'rgba(0,0,0,0)' }) })
			if (byDominant) {
				// spots with none of the selected types stay unfilled
				if (mark) {
					// a square's type is by definition a minor share, so floor its shade at a 30% spot's: still visibly colored
					const p = spots.proportions[mark.type][i] as number
					const color = shadeColor(typeRgb[mark.type], mark.shape == 'square' ? Math.max(p, 0.3) : p)
					style = new Style({ stroke: spotStroke, fill: new Fill({ color }) })
				}
			} else if (byExpression) {
				const n = counts.get(id) || 0
				if (n > 0) {
					// log-scaled, bucketed like the image-based viewer's expression fill
					const shade = Math.max(1, Math.ceil((Math.log1p(n) / Math.log1p(maxCount)) * SHADES))
					style = new Style({
						stroke: spotStroke,
						fill: new Fill({ color: `rgba(${EXPR_RGB}, ${(shade / SHADES) * 0.85})` })
					})
				}
			}
			f.setStyle(style)
			return f
		})

		loading.remove()
		const mapDiv = holder
			.append('div')
			.style('position', 'relative')
			.style('width', opts.width || '100%')
			.style('height', opts.height || '70vh')
		const map = new OlMap({
			target: mapDiv.node(),
			layers: [
				new ImageLayer({
					opacity: clampOpacity(opts.imageOpacity),
					source: new ImageStatic({
						url: `${host}/visium/image?${opts.query}`,
						imageExtent: extent,
						projection,
						crossOrigin: 'anonymous'
					})
				}),
				new VectorLayer({ source: new VectorSource({ features }) })
			],
			view: new OlView({ projection, extent, showFullExtent: true, constrainOnlyCenter: true, maxZoom: 6 })
		})
		map.getView().fit(extent)

		// legend, top-left inside the map
		const legend = mapDiv
			.append('div')
			.attr('data-testid', 'sjpp-visium-typelegend')
			.style('position', 'absolute')
			.style('top', '50px')
			.style('left', '8px')
			.style('z-index', '10')
			.style('background', 'rgba(255,255,255,0.85)')
			.style('padding', '4px 6px')
			.style('font-size', '0.8em')
			.style('display', byDominant || byExpression ? 'block' : 'none')
		if (byDominant) {
			const n: { [t: string]: number } = {} // spots where the type is dominant (circles)
			const sq: { [t: string]: number } = {} // spots where it is present but not dominant (squares)
			for (const m of marks)
				if (m) (m.shape == 'circle' ? n : sq)[m.type] = ((m.shape == 'circle' ? n : sq)[m.type] || 0) + 1
			const filtered = shown.length < types.length
			legend.append('div').style('margin-bottom', '2px').text('Dominant cell type; darker = higher %')
			if (filtered) legend.append('div').style('margin-bottom', '2px').text('● dominant   ■ present, not dominant')
			// most common dominant type first (stable: ties keep the type order); colors are fixed per type, so unaffected
			for (const t of [...shown].sort((a, b) => (n[b] || 0) - (n[a] || 0))) {
				const row = legend.append('div')
				row
					.append('span')
					.style('display', 'inline-block')
					.style('width', '10px')
					.style('height', '10px')
					.style('margin-right', '4px')
					.style('background', `rgb(${typeRgb[t]})`)
				row.append('span').text(filtered ? `${t} (${n[t] || 0} / ${sq[t] || 0})` : `${t} (${n[t] || 0})`)
			}
		} else if (byExpression) {
			legend.text(`${genes.join(' + ')}: 1 – ${maxCount} counts`)
			legend
				.append('div')
				.style('height', '8px')
				.style('background', `linear-gradient(to right, rgba(${EXPR_RGB},0.1), rgb(${EXPR_RGB}))`)
		}

		// hover tooltip
		const tip = mapDiv
			.append('div')
			.style('position', 'absolute')
			.style('pointer-events', 'none')
			.style('z-index', '20')
			.style('background', 'white')
			.style('border', '1px solid #aaa')
			.style('padding', '4px 6px')
			.style('font-size', '0.8em')
			.style('display', 'none')
		map.on('pointermove', evt => {
			const f = map.forEachFeatureAtPixel(evt.pixel, f => f)
			if (!f) return void tip.style('display', 'none')
			const i = f.get('i') as number
			const lines = [`${spots.ids[i]}`, `array row ${spots.arrayRow[i]}, col ${spots.arrayCol[i]}`]
			for (const g of Object.keys(perGene)) lines.push(`${g}: ${perGene[g][spots.ids[i]] || 0}`)
			const props = types
				.map(t => [t, spots.proportions[t][i]] as [string, number | null])
				.filter(([, v]) => v != null && v >= PRESENT)
				.sort((a, b) => b[1]! - a[1]!) as [string, number][]
			tip
				.style('display', 'block')
				.style('left', `${evt.pixel[0] + 12}px`)
				.style('top', `${evt.pixel[1] + 12}px`)
			tip.selectAll('*').remove()
			for (const l of lines) tip.append('div').text(l)
			if (!props.length) return
			// pie of the spot's cell-type proportions; each slice's title shows its type and %
			const R = 45
			const row = tip.append('div').style('display', 'flex').style('gap', '8px').style('margin-top', '4px')
			const svg = row
				.append('svg')
				.attr('width', 2 * R)
				.attr('height', 2 * R)
				.style('flex', 'none')
			const paths = pieSlices(
				props.map(p => p[1]),
				R
			)
			props.forEach(([t, v], k) =>
				svg
					.append('path')
					.attr('d', paths[k])
					.attr('fill', `rgb(${typeRgb[t]})`)
					.attr('stroke', 'white')
					.attr('stroke-width', 0.5)
					.append('title')
					.text(`${t}: ${(v * 100).toFixed(1)}%`)
			)
			// legend of the types present in this spot, largest share first
			const key = row.append('div')
			for (const [t, v] of props) {
				const r = key.append('div')
				r.append('span')
					.style('display', 'inline-block')
					.style('width', '10px')
					.style('height', '10px')
					.style('margin-right', '4px')
					.style('background', `rgb(${typeRgb[t]})`)
				r.append('span').text(`${t} ${(v * 100).toFixed(1)}%`)
			}
		})
	} catch (e: any) {
		loading.remove()
		sayerror(holder, `Error loading spatial sample: ${e?.message || e}`)
	}
}

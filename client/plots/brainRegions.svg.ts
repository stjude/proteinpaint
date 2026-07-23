import type { Menu } from '#dom'

export type RegionGeom = { d: string; transform: string | null }

export type BrainAssets = {
	paths: { [code: string]: RegionGeom }
	viewBoxW: number
	viewBoxH: number
}

type RegionRender = {
	code: string
	// Text drawn on the shape: the region code, unless the config label is a merged
	// code like "FG/FC"
	displayLabel: string
	fillColor: string
	d: string
	dimmed: boolean
	outerG: any
	innerG: any
	pathSel: any
	pathEl: SVGPathElement
	matrix: DOMMatrix | null
	vx: number
	vy: number
	bboxW: number
	bboxH: number
}

const cachedBrainAssets: { [svgUrl: string]: BrainAssets } = {}

export async function loadBrainAssets(svgUrl: string, regionCodes: string[]): Promise<BrainAssets> {
	if (cachedBrainAssets[svgUrl]) return cachedBrainAssets[svgUrl]
	const res = await fetch(svgUrl)
	if (!res.ok) throw new Error(`failed to load ${svgUrl}: ${res.status}`)
	const text = await res.text()
	const doc = new DOMParser().parseFromString(text, 'image/svg+xml')

	const svgEl = doc.documentElement
	let viewBoxW = 0
	let viewBoxH = 0
	const vb = svgEl.getAttribute('viewBox')
	if (vb) {
		const parts = vb.trim().split(/\s+/).map(Number)
		if (parts.length === 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3])) {
			viewBoxW = parts[2]
			viewBoxH = parts[3]
		}
	}
	if (!viewBoxW || !viewBoxH) {
		viewBoxW = Number(svgEl.getAttribute('width')) || 0
		viewBoxH = Number(svgEl.getAttribute('height')) || 0
	}
	if (!viewBoxW || !viewBoxH) throw new Error(`could not determine viewBox dimensions from ${svgUrl}`)

	const paths: { [code: string]: RegionGeom } = {}
	for (const code of regionCodes) {
		const el = doc.getElementById(code)
		const d = el?.getAttribute('d')
		if (d) paths[code] = { d, transform: el?.getAttribute('transform') ?? null }
	}
	const assets = { paths, viewBoxW, viewBoxH }
	cachedBrainAssets[svgUrl] = assets
	return assets
}

// Find the "pole of inaccessibility" — the point inside the filled shape that
// is farthest from any boundary point. Bbox center fails for concave shapes
// (cingulate band, frontal lobe curve); this works for any closed path.
function visualCenter(pathEl: SVGPathElement, gridN = 24, boundarySamples = 160): { x: number; y: number } {
	const bbox = pathEl.getBBox()
	const svgRoot = pathEl.ownerSVGElement
	if (!svgRoot) {
		return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 }
	}
	const probe = svgRoot.createSVGPoint()

	const len = pathEl.getTotalLength()
	const bx: number[] = new Array(boundarySamples)
	const by: number[] = new Array(boundarySamples)
	for (let i = 0; i < boundarySamples; i++) {
		const p = pathEl.getPointAtLength((i / boundarySamples) * len)
		bx[i] = p.x
		by[i] = p.y
	}

	let bestX = bbox.x + bbox.width / 2
	let bestY = bbox.y + bbox.height / 2
	let bestMinSq = -Infinity
	for (let i = 0; i < gridN; i++) {
		for (let j = 0; j < gridN; j++) {
			const x = bbox.x + ((i + 0.5) / gridN) * bbox.width
			const y = bbox.y + ((j + 0.5) / gridN) * bbox.height
			probe.x = x
			probe.y = y
			if (!pathEl.isPointInFill(probe)) continue
			let minSq = Infinity
			for (let k = 0; k < boundarySamples; k++) {
				const dx = bx[k] - x
				const dy = by[k] - y
				const d = dx * dx + dy * dy
				if (d < minSq) minSq = d
			}
			if (minSq > bestMinSq) {
				bestMinSq = minSq
				bestX = x
				bestY = y
			}
		}
	}
	return { x: bestX, y: bestY }
}

// Test if an outer-space point lies inside a region's filled path.
function isPointInRegion(outerX: number, outerY: number, r: RegionRender): boolean {
	const svg = r.pathEl.ownerSVGElement
	if (!svg) return false
	const pt = svg.createSVGPoint()
	pt.x = outerX
	pt.y = outerY
	const local = r.matrix ? pt.matrixTransform(r.matrix.inverse()) : pt
	return r.pathEl.isPointInFill(local)
}

// Find the best label position INSIDE a region. Returns the candidate inside
// the region that minimizes label-rectangle probe points falling in any OTHER
// region's path. Returns null only if no point inside the region exists.
function findInlineLabelSpot(
	r: RegionRender,
	labelW: number,
	labelH: number,
	others: RegionRender[],
	gridN = 36
): { x: number; y: number; conflicts: number } | null {
	const localBBox = r.pathEl.getBBox()
	const svg = r.pathEl.ownerSVGElement
	if (!svg) return null

	const corners = [
		{ x: localBBox.x, y: localBBox.y },
		{ x: localBBox.x + localBBox.width, y: localBBox.y },
		{ x: localBBox.x, y: localBBox.y + localBBox.height },
		{ x: localBBox.x + localBBox.width, y: localBBox.y + localBBox.height }
	]
	const outerCorners = corners.map(c => {
		if (!r.matrix) return c
		const p = svg.createSVGPoint()
		p.x = c.x
		p.y = c.y
		return p.matrixTransform(r.matrix)
	})
	const xs = outerCorners.map(c => c.x)
	const ys = outerCorners.map(c => c.y)
	const minX = Math.min(...xs)
	const maxX = Math.max(...xs)
	const minY = Math.min(...ys)
	const maxY = Math.max(...ys)

	let bestX = 0
	let bestY = 0
	let bestConflicts = Infinity
	let bestDistSq = Infinity
	let found = false
	for (let i = 0; i < gridN; i++) {
		for (let j = 0; j < gridN; j++) {
			const x = minX + ((i + 0.5) / gridN) * (maxX - minX)
			const y = minY + ((j + 0.5) / gridN) * (maxY - minY)
			if (!isPointInRegion(x, y, r)) continue
			const probes: [number, number][] = [
				[x, y],
				[x - labelW / 2, y - labelH / 2],
				[x + labelW / 2, y - labelH / 2],
				[x - labelW / 2, y + labelH / 2],
				[x + labelW / 2, y + labelH / 2]
			]
			let conflicts = 0
			for (const [px, py] of probes) {
				for (const o of others) {
					if (isPointInRegion(px, py, o)) {
						conflicts++
						break
					}
				}
			}
			const dx = x - r.vx
			const dy = y - r.vy
			const distSq = dx * dx + dy * dy
			const better = conflicts < bestConflicts || (conflicts === bestConflicts && distSq < bestDistSq)
			if (better) {
				bestX = x
				bestY = y
				bestConflicts = conflicts
				bestDistSq = distSq
				found = true
			}
		}
	}
	return found ? { x: bestX, y: bestY, conflicts: bestConflicts } : null
}

function findClearOffset(
	vx: number,
	vy: number,
	offset: number,
	labelW: number,
	labelH: number,
	others: RegionRender[],
	viewBoxCx: number,
	viewBoxCy: number
): { x: number; y: number; dx: number; dy: number } {
	const baseAngle = Math.atan2(vy - viewBoxCy, vx - viewBoxCx)
	const angleDeltasDeg = [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180]
	for (const delta of angleDeltasDeg) {
		const angle = baseAngle + (delta * Math.PI) / 180
		const dx = Math.cos(angle)
		const dy = Math.sin(angle)
		const lx = vx + dx * offset
		const ly = vy + dy * offset
		const probePts: [number, number][] = [
			[lx, ly],
			[lx - labelW / 2, ly - labelH / 2],
			[lx + labelW / 2, ly - labelH / 2],
			[lx - labelW / 2, ly + labelH / 2],
			[lx + labelW / 2, ly + labelH / 2]
		]
		let overlap = false
		for (const other of others) {
			const svgRoot = other.pathEl.ownerSVGElement
			if (!svgRoot) continue
			const inv = other.matrix ? other.matrix.inverse() : null
			const pt = svgRoot.createSVGPoint()
			for (const [x, y] of probePts) {
				pt.x = x
				pt.y = y
				const localPt = inv ? pt.matrixTransform(inv) : pt
				if (other.pathEl.isPointInFill(localPt)) {
					overlap = true
					break
				}
			}
			if (overlap) break
		}
		if (!overlap) return { x: lx, y: ly, dx, dy }
	}
	const dx = Math.cos(baseAngle)
	const dy = Math.sin(baseAngle)
	return { x: vx + dx * offset, y: vy + dy * offset, dx, dy }
}

export type RenderBrainSvgOpts = {
	holder: any
	width: number
	templateUrl: string
	assets: BrainAssets
	regions: { [code: string]: string }
	fillByRegion: (code: string) => string
	tooltipByRegion: (code: string, label: string) => string
	title?: string
	tip: Menu
	// Optional: invoked when the user clicks a region. Caller decides what to do
	// (e.g. open a hide/show menu at the event coordinates).
	onRegionClick?: (code: string, event: MouseEvent) => void
	// Optional: when true for a code, render that region with the "no-data" gray
	// fill and reduced opacity to signal it's filtered out.
	isRegionDimmed?: (code: string) => boolean
}

const DIMMED_FILL = '#dcdcdc'
const DIMMED_OPACITY = 0.35

// Render one brain SVG (template image + colored region paths + labels) into
// `holder`. Returns the created <svg> element.
export function renderBrainSvg(opts: RenderBrainSvgOpts): SVGSVGElement {
	const {
		holder,
		width,
		templateUrl,
		assets,
		regions,
		fillByRegion,
		tooltipByRegion,
		title,
		tip,
		onRegionClick,
		isRegionDimmed
	} = opts
	const { paths: regionPaths, viewBoxW, viewBoxH } = assets
	const renderH = Math.round((width * viewBoxH) / viewBoxW)

	const col = holder.append('div')
	if (title) {
		col
			.append('div')
			.style('text-align', 'center')
			.style('font-weight', 'bold')
			.style('font-size', '16px')
			.style('margin-bottom', '8px')
			.text(title)
	}

	const svg = col
		.append('svg')
		.attr('width', width)
		.attr('height', renderH)
		.attr('viewBox', `0 0 ${viewBoxW} ${viewBoxH}`)

	svg
		.append('image')
		.attr('href', templateUrl)
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', viewBoxW)
		.attr('height', viewBoxH)
		.style('filter', 'grayscale(1) brightness(1.05)')
		.style('opacity', 0.55)

	const overlayGroup = svg.append('g')

	// PASS 1: render all paths + capture geometry so PASS 2's collision checks
	// (isPointInFill on neighbor paths) work against the final positioned paths.
	const rendered: RegionRender[] = []
	for (const [code, label] of Object.entries(regions)) {
		const geom = regionPaths[code]
		if (!geom) continue

		const dimmed = isRegionDimmed?.(code) === true
		const fillColor = dimmed ? DIMMED_FILL : fillByRegion(code)
		const tooltipText = tooltipByRegion(code, label)
		// A merged label like "FG/FC" (contains a slash) is drawn on the shape; all
		// other regions keep their short code (full names go only in the tooltip).
		const displayLabel = label && label.includes('/') ? label : code

		const outerG = overlayGroup.append('g').style('cursor', 'pointer')
		const innerG = outerG.append('g')
		if (geom.transform) innerG.attr('transform', geom.transform)

		// stroke-width is in path-local coordinates. For paths with a transform
		// (AM, SN), divide by the matrix scale so the rendered stroke ends up
		// the same thickness as un-transformed regions.
		const baseStrokePx = 3
		let strokeWidth = baseStrokePx
		if (geom.transform) {
			const m = (innerG.node() as SVGGraphicsElement).transform.baseVal.consolidate()?.matrix
			if (m) {
				const scale = (Math.abs(m.a) + Math.abs(m.d)) / 2
				if (scale > 0) strokeWidth = baseStrokePx / scale
			}
		}

		const pathSel = innerG
			.append('path')
			.attr('d', geom.d)
			.attr('fill', fillColor)
			.attr('stroke', '#333')
			.attr('stroke-width', strokeWidth)
			.attr('opacity', dimmed ? DIMMED_OPACITY : 0.75)

		const pathEl = pathSel.node() as SVGPathElement
		const { x: localX, y: localY } = visualCenter(pathEl)
		const localBBox = pathEl.getBBox()

		const innerEl = innerG.node() as SVGGraphicsElement
		const matrix = innerEl.transform.baseVal.consolidate()?.matrix ?? null
		const ownerSvg = pathEl.ownerSVGElement!
		const localPt = ownerSvg.createSVGPoint()
		localPt.x = localX
		localPt.y = localY
		const outerPt = matrix ? localPt.matrixTransform(matrix) : { x: localX, y: localY }
		const bboxW = localBBox.width * (matrix ? Math.abs(matrix.a) : 1)
		const bboxH = localBBox.height * (matrix ? Math.abs(matrix.d) : 1)

		rendered.push({
			code,
			displayLabel,
			fillColor,
			d: geom.d,
			dimmed,
			outerG,
			innerG,
			pathSel,
			pathEl,
			matrix,
			vx: outerPt.x,
			vy: outerPt.y,
			bboxW,
			bboxH
		})

		outerG
			.on('mouseover', (event: MouseEvent) => {
				tip.clear().show(event.clientX, event.clientY)
				const lines = tooltipText.split('\n')
				const tipDiv = tip.d.append('div').style('padding', '8px').style('font-size', '13px')
				tipDiv.append('div').style('font-weight', 'bold').style('margin-bottom', '4px').text(lines[0])
				for (let i = 1; i < lines.length; i++) {
					tipDiv.append('div').text(lines[i])
				}
			})
			.on('mouseout', () => {
				tip.hide()
			})
		if (onRegionClick) {
			outerG.on('click', (event: MouseEvent) => onRegionClick(code, event))
		}
	}

	// PASS 2: place labels. Inline when the region is roomy enough to host the
	// full label rect; callout with leader line when not (AM, SN).
	const fontSize = 46
	for (const r of rendered) {
		const labelW = r.displayLabel.length * fontSize * 0.62
		const labelH = fontSize
		const labelHalfDiag = Math.hypot(labelW / 2, labelH / 2)

		const others = rendered.filter(rr => rr !== r)
		const regionRoomy = r.bboxW * r.bboxH > labelW * labelH * 1.5
		const inlinePoint = regionRoomy ? findInlineLabelSpot(r, labelW, labelH, others) : null
		const fitsInside = !!inlinePoint

		let labelX = inlinePoint ? inlinePoint.x : r.vx
		let labelY = inlinePoint ? inlinePoint.y : r.vy

		if (!fitsInside) {
			if (!r.dimmed) r.pathSel.attr('opacity', 1)
			// White halo behind the colored path, inside the same transformed group
			r.innerG
				.insert('path', ':first-child')
				.attr('d', r.d)
				.attr('fill', '#fff')
				.attr('stroke', '#fff')
				.attr('stroke-width', 18)
				.attr('stroke-linejoin', 'round')

			const offset = Math.max(r.bboxW, r.bboxH) / 2 + labelHalfDiag * 1.6
			const placed = findClearOffset(r.vx, r.vy, offset, labelW, labelH, others, viewBoxW / 2, viewBoxH / 2)
			labelX = placed.x
			labelY = placed.y

			r.outerG
				.append('line')
				.attr('x1', r.vx)
				.attr('y1', r.vy)
				.attr('x2', labelX - placed.dx * labelHalfDiag * 0.9)
				.attr('y2', labelY - placed.dy * labelHalfDiag * 0.9)
				.attr('stroke', '#333')
				.attr('stroke-width', 2)
		}

		r.outerG
			.append('text')
			.attr('x', labelX)
			.attr('y', labelY)
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'central')
			.attr('font-size', `${fontSize}px`)
			.attr('font-weight', 'bold')
			.attr('fill', '#333')
			.attr('paint-order', 'stroke')
			.attr('stroke', '#fff')
			.attr('stroke-width', 6)
			.text(r.displayLabel)
	}

	return svg.node() as SVGSVGElement
}

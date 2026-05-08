/** A single hover-decoration shape — typically rendered on top of a data
 * point to indicate hover/selection. The caller supplies the SVG `d`
 * attribute and `transform` string so the decoration can match whatever
 * shape the underlying point uses (circle, triangle, square, …). */
export interface HoverShapeSpec {
	path: string
	transform: string
	stroke?: string
	strokeWidth?: number
	fill?: string
	fillOpacity?: number
	/** Keep stroke width constant in screen pixels regardless of the
	 * transform scale. Default true — matches what most callers want
	 * when the transform encodes both position and size. */
	nonScalingStroke?: boolean
}

/** Replaces the contents of `layer` with one `<path>` per spec. Used to
 * draw hover rings/highlights over data points; works for any SVG path
 * shape, so plots with mixed shapes (triangles, squares, …) get a
 * highlight that matches the underlying point. */
export function drawHoverShapes(layer: any, shapes: HoverShapeSpec[]): void {
	layer.selectAll('path').remove()
	for (const s of shapes) {
		const p = layer
			.append('path')
			.attr('d', s.path)
			.attr('transform', s.transform)
			.attr('fill', s.fill ?? 'none')
			.attr('stroke', s.stroke ?? 'black')
			.attr('stroke-width', s.strokeWidth ?? 1.5)
		if (s.fillOpacity !== undefined) p.attr('fill-opacity', s.fillOpacity)
		if (s.nonScalingStroke !== false) p.style('vector-effect', 'non-scaling-stroke')
	}
}

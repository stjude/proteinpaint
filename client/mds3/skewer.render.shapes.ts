import { dtsnvindel, dtsv, dtfusionrna } from '#shared/common'

export function renderSkewerShapes(tk, skewer, shapeG) {
	const shapePath = shapeG
		.append('path')
		.attr('d', d => skewer.shape.calculatePath({ width: d.radius, height: d.radius }))
		.attr('fill', skewer.shape.isFilled ? d => tk.color4disc(d.mlst[0]) : 'white')
		.attr('stroke', !skewer.shape.isFilled ? d => tk.color4disc(d.mlst[0]) : '')

	shapePath.filter(d => d.dt == dtsnvindel || d.dt == dtsv || d.dt == dtfusionrna)

	return shapeG
}
